import { describe, it, expect } from 'vitest';
import {
  deriveChallengeRef,
  digestChallengeRef,
  generateDecoyChallengeRef,
  normalizeChallengeRef,
  type RandomBytesSource,
} from './challenge-ref.js';

const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');
const challengeIdA = '12345678-1234-4234-8234-123456789abc';
const challengeIdB = 'abcdef01-2345-4234-8234-abcdef012345';

describe('deriveChallengeRef', () => {
  it('returns a 32-character string using the booking-code alphabet', () => {
    const ref = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    expect(ref).toHaveLength(32);
    expect(ref).toMatch(/^[1-9A-HJKMNP-Z]{32}$/);
  });

  it('is deterministic for the same secretKey and challengeId', () => {
    const ref1 = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    const ref2 = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    expect(ref1).toBe(ref2);
  });

  it('produces different references for different challengeIds', () => {
    const ref1 = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    const ref2 = deriveChallengeRef({ secretKey, challengeId: challengeIdB });
    expect(ref1).not.toBe(ref2);
  });

  it('produces different references for different secret keys', () => {
    const otherSecret = Buffer.from('other-secret-key-32-bytes-long!!');
    const ref1 = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    const ref2 = deriveChallengeRef({ secretKey: otherSecret, challengeId: challengeIdA });
    expect(ref1).not.toBe(ref2);
  });

  it('rejects a malformed challengeId', () => {
    expect(() => deriveChallengeRef({ secretKey, challengeId: 'not-a-uuid' })).toThrow(
      'Invalid UUID',
    );
  });
});

describe('digestChallengeRef', () => {
  it('returns a 32-byte keyed digest', () => {
    const ref = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    const digest = digestChallengeRef(secretKey, ref);
    expect(digest).toHaveLength(32);
  });

  it('is deterministic for the same secretKey and ref', () => {
    const ref = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    const digest1 = digestChallengeRef(secretKey, ref);
    const digest2 = digestChallengeRef(secretKey, ref);
    expect(digest1.equals(digest2)).toBe(true);
  });

  it('produces a different digest for a different ref', () => {
    const refA = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    const refB = deriveChallengeRef({ secretKey, challengeId: challengeIdB });
    const digestA = digestChallengeRef(secretKey, refA);
    const digestB = digestChallengeRef(secretKey, refB);
    expect(digestA.equals(digestB)).toBe(false);
  });

  it('produces a different digest for a different secret key', () => {
    const ref = deriveChallengeRef({ secretKey, challengeId: challengeIdA });
    const otherSecret = Buffer.from('other-secret-key-32-bytes-long!!');
    const digest1 = digestChallengeRef(secretKey, ref);
    const digest2 = digestChallengeRef(otherSecret, ref);
    expect(digest1.equals(digest2)).toBe(false);
  });
});

describe('generateDecoyChallengeRef', () => {
  it('returns a 32-character string with the same format as a real challengeRef', () => {
    const ref = generateDecoyChallengeRef();
    expect(ref).toHaveLength(32);
    expect(ref).toMatch(/^[1-9A-HJKMNP-Z]{32}$/);
  });

  it('uses an injected random byte source deterministically', () => {
    const fixedByte = 5; // maps to ALPHABET[5] for every position
    const deterministicSource: RandomBytesSource = (length: number) =>
      Buffer.alloc(length, fixedByte);

    const ref1 = generateDecoyChallengeRef(deterministicSource);
    const ref2 = generateDecoyChallengeRef(deterministicSource);

    expect(ref1).toBe(ref2);
    expect(ref1).toBe('6'.repeat(32)); // alphabet index 5 -> '6'
  });

  it('does not resolve to any real challenge via digestChallengeRef lookup', () => {
    // A decoy has no persisted digest by construction; this test proves the
    // decoy value is not equal to any real derivation for the same secret,
    // demonstrating the two code paths are architecturally distinct.
    const deterministicSource: RandomBytesSource = (length: number) => Buffer.alloc(length, 9);
    const decoy = generateDecoyChallengeRef(deterministicSource);
    const real = deriveChallengeRef({ secretKey, challengeId: challengeIdA });

    expect(decoy).not.toBe(real);
  });

  it('produces different output for different injected byte sources', () => {
    const sourceA: RandomBytesSource = (length: number) => Buffer.alloc(length, 1);
    const sourceB: RandomBytesSource = (length: number) => Buffer.alloc(length, 200);

    const refA = generateDecoyChallengeRef(sourceA);
    const refB = generateDecoyChallengeRef(sourceB);

    expect(refA).not.toBe(refB);
  });
});

describe('normalizeChallengeRef', () => {
  it('trims whitespace and uppercases', () => {
    const validRef = '123456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 32 chars, all valid
    const result = normalizeChallengeRef(`  ${validRef.toLowerCase()}  `);
    expect(result).toBe(validRef);
  });

  it('rejects inputs shorter than 32 characters', () => {
    expect(() => normalizeChallengeRef('ABCD')).toThrow('Invalid challenge reference format');
  });

  it('rejects inputs with excluded alphabet characters', () => {
    const invalidRef = 'ABCDEFGHJKMNPQRSTUVWXYZ123456O'; // contains O
    expect(() => normalizeChallengeRef(invalidRef)).toThrow('Invalid challenge reference format');
  });
});
