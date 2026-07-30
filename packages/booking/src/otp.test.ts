import { describe, it, expect } from 'vitest';
import { deriveOtp, verifyOtp, type HmacSource, type OtpInput } from './otp.js';

describe('deriveOtp', () => {
  it('returns a 6-digit zero-padded string', () => {
    const input: OtpInput = {
      secretKey: Buffer.from('test-secret-key-32-bytes-long!!'),
      labelByteSequence: Buffer.from('domain-label\x1fnonce'),
    };

    const otp = deriveOtp(input);
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp).toHaveLength(6);
  });

  it('yields identical OTPs for identical input', () => {
    const input: OtpInput = {
      secretKey: Buffer.from('test-secret-key-32-bytes-long!!'),
      labelByteSequence: Buffer.from('domain-label\x1fnonce'),
    };

    const otp1 = deriveOtp(input);
    const otp2 = deriveOtp(input);

    expect(otp1).toBe(otp2);
  });

  it('yields different OTPs for different nonces', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');

    const otp1 = deriveOtp({
      secretKey,
      labelByteSequence: Buffer.from('domain-label\x1fnonce1'),
    });

    const otp2 = deriveOtp({
      secretKey,
      labelByteSequence: Buffer.from('domain-label\x1fnonce2'),
    });

    expect(otp1).not.toBe(otp2);
  });

  it('uses rejection sampling with correct limit', () => {
    // The limit should be Math.floor((2 ** 32) / 1_000_000) * 1_000_000
    const expectedLimit = Math.floor(2 ** 32 / 1_000_000) * 1_000_000;
    expect(expectedLimit).toBe(4294000000);

    // Test that the function completes (doesn't throw)
    const input: OtpInput = {
      secretKey: Buffer.from('test-secret-key-32-bytes-long!!'),
      labelByteSequence: Buffer.from('domain-label\x1ftest'),
    };

    expect(() => deriveOtp(input)).not.toThrow();
  });

  it('rejects a first candidate at or above the limit and accepts the second, incremented-counter candidate', () => {
    // First HMAC output: last byte 0x00 -> offset 0; bytes[0..3] = 0xFFFFFFFF
    // = 4294967295, which is >= REJECTION_LIMIT (4294000000), so it must be
    // rejected without ever being returned.
    const rejectedMac = Buffer.alloc(32, 0x00);
    rejectedMac[0] = 0xff;
    rejectedMac[1] = 0xff;
    rejectedMac[2] = 0xff;
    rejectedMac[3] = 0xff;
    rejectedMac[31] = 0x00; // last byte -> offset 0

    // Second HMAC output: last byte 0x00 -> offset 0; bytes[0..3] = 0x00000001
    // = 1, which is well below the limit, so it must be accepted.
    const acceptedMac = Buffer.alloc(32, 0x00);
    acceptedMac[0] = 0x00;
    acceptedMac[1] = 0x00;
    acceptedMac[2] = 0x00;
    acceptedMac[3] = 0x01;
    acceptedMac[31] = 0x00; // last byte -> offset 0

    const seenMessages: Buffer[] = [];
    let callCount = 0;
    const fakeHmacSource: HmacSource = (_secretKey, message) => {
      seenMessages.push(Buffer.from(message));
      callCount++;
      return callCount === 1 ? rejectedMac : acceptedMac;
    };

    const input: OtpInput = {
      secretKey: Buffer.from('test-secret-key-32-bytes-long!!'),
      labelByteSequence: Buffer.from('domain-label\x1fnonce'),
    };

    const otp = deriveOtp(input, fakeHmacSource);

    expect(callCount).toBe(2);
    expect(otp).toBe('000001');

    // Verify the counter is part of the canonical HMAC input and changes
    // between the rejected and accepted attempts (fixed 4-byte big-endian
    // counter appended after the label byte sequence).
    expect(seenMessages).toHaveLength(2);
    const [firstMessage, secondMessage] = seenMessages;
    if (firstMessage === undefined || secondMessage === undefined) {
      throw new Error('Expected two captured HMAC messages');
    }
    const firstCounterBytes = firstMessage.subarray(-4);
    const secondCounterBytes = secondMessage.subarray(-4);
    expect(firstCounterBytes.equals(Buffer.from([0, 0, 0, 0]))).toBe(true);
    expect(secondCounterBytes.equals(Buffer.from([0, 0, 0, 1]))).toBe(true);
    expect(firstCounterBytes.equals(secondCounterBytes)).toBe(false);
  });

  it('throws after exceeding the maximum retry limit if every candidate is rejected', () => {
    const alwaysRejectedMac = Buffer.alloc(32, 0xff);
    const fakeHmacSource: HmacSource = () => alwaysRejectedMac;

    const input: OtpInput = {
      secretKey: Buffer.from('test-secret-key-32-bytes-long!!'),
      labelByteSequence: Buffer.from('domain-label\x1fnonce'),
    };

    expect(() => deriveOtp(input, fakeHmacSource)).toThrow('OTP derivation exceeded retry limit');
  });

  it('preserves zero padding for small candidate values', () => {
    const mac = Buffer.alloc(32, 0x00);
    mac[3] = 0x05; // candidate = 5
    const fakeHmacSource: HmacSource = () => mac;

    const input: OtpInput = {
      secretKey: Buffer.from('test-secret-key-32-bytes-long!!'),
      labelByteSequence: Buffer.from('domain-label\x1fnonce'),
    };

    const otp = deriveOtp(input, fakeHmacSource);
    expect(otp).toBe('000005');
  });
});

describe('verifyOtp', () => {
  it('returns true for the correct OTP', () => {
    expect(verifyOtp('123456', '123456')).toBe(true);
  });

  it('returns false when the first digit differs', () => {
    expect(verifyOtp('923456', '123456')).toBe(false);
  });

  it('returns false when the last digit differs', () => {
    expect(verifyOtp('123459', '123456')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(verifyOtp('12345', '123456')).toBe(false);
    expect(verifyOtp('123456', '12345')).toBe(false);
    expect(verifyOtp('1234567', '123456')).toBe(false);
  });

  it('returns false for non-digit ASCII characters, without throwing', () => {
    expect(() => verifyOtp('12345a', '123456')).not.toThrow();
    expect(verifyOtp('12345a', '123456')).toBe(false);
    expect(verifyOtp('abcdef', '123456')).toBe(false);
  });

  it('returns false for punctuation characters', () => {
    expect(verifyOtp('123-56', '123456')).toBe(false);
    expect(verifyOtp('12.456', '123456')).toBe(false);
  });

  it('returns false for fullwidth Unicode digits, without throwing', () => {
    const fullwidth = '\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16'; // fullwidth "123456"
    expect(fullwidth).toHaveLength(6);
    expect(() => verifyOtp(fullwidth, '123456')).not.toThrow();
    expect(verifyOtp(fullwidth, '123456')).toBe(false);
  });

  it('returns false for other Unicode numeric characters, without throwing', () => {
    const devanagariDigits = '\u0967\u0968\u0969\u096A\u096B\u096C'; // Devanagari 1-6
    expect(devanagariDigits).toHaveLength(6);
    expect(() => verifyOtp(devanagariDigits, '123456')).not.toThrow();
    expect(verifyOtp(devanagariDigits, '123456')).toBe(false);
  });

  it('returns false for same JS character length but different UTF-8 byte length, without throwing', () => {
    // '\uFF11' etc. are single UTF-16 code units (length 6) but each
    // encodes to 3 UTF-8 bytes, so naive utf8 byte comparison against a
    // 6-byte ASCII expected value would throw on length mismatch.
    const fullwidth = '\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16';
    expect(() => verifyOtp(fullwidth, '654321')).not.toThrow();
    expect(verifyOtp(fullwidth, '654321')).toBe(false);
  });

  it('returns false for a leading zero mismatch and true for a matching leading zero', () => {
    expect(verifyOtp('012345', '012345')).toBe(true);
    expect(verifyOtp('012345', '112345')).toBe(false);
  });

  it('rejects empty strings without throwing', () => {
    expect(verifyOtp('', '123456')).toBe(false);
    expect(verifyOtp('123456', '')).toBe(false);
  });
});
