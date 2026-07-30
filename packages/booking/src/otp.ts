/**
 * OTP derivation using unbiased rejection sampling
 *
 * Derives a 6-digit OTP from HMAC-SHA256 with no modulo bias
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface OtpInput {
  readonly secretKey: Buffer;
  readonly labelByteSequence: Buffer;
}

export type HmacSource = (secretKey: Buffer, message: Buffer) => Buffer;

const defaultHmacSource: HmacSource = (secretKey, message) =>
  createHmac('sha256', secretKey).update(message).digest();

const UINT32_RANGE = 2 ** 32;
const OTP_SPACE = 1_000_000;
const REJECTION_LIMIT = Math.floor(UINT32_RANGE / OTP_SPACE) * OTP_SPACE;
const MAX_ITERATIONS = 100;
const COUNTER_BYTE_LENGTH = 4;
const CANDIDATE_BYTE_LENGTH = 4;

/**
 * Derives a 6-digit OTP via unbiased rejection sampling over the full
 * unsigned 32-bit range. The counter is encoded as a fixed four-byte
 * big-endian suffix on the canonical HMAC input, so each retry attempt
 * produces a distinct message. The hmacSource seam exists to allow
 * deterministic tests of the rejection/acceptance boundary; production
 * always uses HMAC-SHA256 via node:crypto.
 */
export function deriveOtp(input: OtpInput, hmacSource: HmacSource = defaultHmacSource): string {
  let counter = 0;

  while (counter < MAX_ITERATIONS) {
    const counterBytes = Buffer.alloc(COUNTER_BYTE_LENGTH);
    counterBytes.writeUInt32BE(counter, 0);

    const mac = hmacSource(input.secretKey, Buffer.concat([input.labelByteSequence, counterBytes]));

    const lastByte = mac[mac.length - 1];
    if (lastByte === undefined) {
      counter++;
      continue;
    }

    const offset = lastByte & 0x0f;
    if (offset + CANDIDATE_BYTE_LENGTH > mac.length) {
      counter++;
      continue;
    }

    const candidate = mac.readUInt32BE(offset);

    if (candidate >= REJECTION_LIMIT) {
      counter++;
      continue;
    }

    return (candidate % OTP_SPACE).toString().padStart(6, '0');
  }

  throw new Error('OTP derivation exceeded retry limit');
}

const SIX_ASCII_DIGITS_REGEX = /^[0-9]{6}$/;

/**
 * Convenience wrapper that derives a 6-digit OTP from the canonical
 * `(secretKey, nonce)` pair. The nonce is the stored per-challenge random
 * bytes; the secretKey is the configured OTP secret. Use this helper
 * wherever the storage model is "challenge row stores a nonce" — the
 * underlying `deriveOtp` stays generic.
 */
export function deriveOtpForChallenge(secretKey: Buffer, nonce: Buffer): string {
  return deriveOtp({ secretKey, labelByteSequence: nonce });
}

/**
 * Verifies a candidate OTP against the expected OTP in constant time.
 * Both values must be exactly six ASCII digits before any byte comparison
 * occurs; malformed input (wrong length, non-digit characters, Unicode
 * digits outside ASCII) returns false rather than throwing or falling
 * back to a non-constant-time comparison.
 */
export function verifyOtp(provided: string, expected: string): boolean {
  if (!SIX_ASCII_DIGITS_REGEX.test(provided) || !SIX_ASCII_DIGITS_REGEX.test(expected)) {
    return false;
  }

  // Both strings matched the six-ASCII-digit pattern, so both buffers are
  // guaranteed to be exactly 6 bytes; timingSafeEqual requires equal length.
  const providedBuffer = Buffer.from(provided, 'ascii');
  const expectedBuffer = Buffer.from(expected, 'ascii');

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
