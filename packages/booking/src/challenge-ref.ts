/**
 * Challenge reference derivation and decoy generation
 *
 * Real challenge references are deterministically derived from the internal
 * challenge UUID via a domain-separated HMAC-SHA256, so the server can
 * re-derive the same public reference without storing plaintext. Decoy
 * challenge references are cryptographically random and share the same
 * external format, but cannot resolve to any real challenge because no
 * digest is ever persisted for them. These are two distinct primitives:
 * a generic random generator must never be reused for both.
 */

import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { computeDigest } from './digest.js';

const ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ALPHABET_SIZE = 32;
const REF_LENGTH = 32;
const TRUNCATED_BYTE_LENGTH = 20;
const CHALLENGE_REF_DOMAIN_LABEL = 'room-management/challenge-ref/v1';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidToBytes(uuid: string): Buffer {
  if (!UUID_REGEX.test(uuid)) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  return Buffer.from(uuid.replaceAll('-', ''), 'hex');
}

function base32Encode(bytes: Buffer): string {
  let output = '';
  let bitBuffer = 0;
  let bitCount = 0;

  for (const byte of bytes) {
    bitBuffer = (bitBuffer << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      bitCount -= 5;
      const index = (bitBuffer >>> bitCount) & 0x1f;
      const char = ALPHABET[index];
      if (char === undefined) {
        throw new Error(`Invalid base32 index: ${index}`);
      }
      output += char;
    }
    bitBuffer &= (1 << bitCount) - 1;
  }

  if (bitCount > 0) {
    const index = (bitBuffer << (5 - bitCount)) & 0x1f;
    const char = ALPHABET[index];
    if (char === undefined) {
      throw new Error(`Invalid base32 index: ${index}`);
    }
    output += char;
  }

  return output;
}

export interface DeriveChallengeRefInput {
  readonly secretKey: Buffer;
  readonly challengeId: string;
}

/**
 * Deterministically derives the public challengeRef from the internal
 * challenge UUID. Same secretKey + challengeId always yields the same
 * 32-character base32 string. No checksum, no randomness.
 */
export function deriveChallengeRef(input: DeriveChallengeRefInput): string {
  const uuidBytes = uuidToBytes(input.challengeId);

  const digest = computeDigest({
    secretKey: input.secretKey,
    domainLabel: CHALLENGE_REF_DOMAIN_LABEL,
    parts: [uuidBytes],
  });

  const truncated = digest.subarray(0, TRUNCATED_BYTE_LENGTH);
  const ref = base32Encode(truncated);

  if (ref.length !== REF_LENGTH) {
    throw new Error(`Derived challenge reference has unexpected length: ${ref.length}`);
  }

  return ref;
}

/**
 * Computes the keyed digest stored in guest_otp_challenges.challenge_ref_digest
 * for lookup. Real challenge references are looked up by digest; decoy
 * references never have a corresponding stored digest and therefore never
 * resolve.
 */
export function digestChallengeRef(secretKey: Buffer, challengeRef: string): Buffer {
  return computeDigest({
    secretKey,
    domainLabel: CHALLENGE_REF_DOMAIN_LABEL,
    parts: [Buffer.from(challengeRef, 'utf8')],
  });
}

export type RandomBytesSource = (length: number) => Buffer;

const defaultRandomBytesSource: RandomBytesSource = (length: number) => nodeRandomBytes(length);

/**
 * Generates a cryptographically random decoy challengeRef with the same
 * external format as a real reference. It has no persisted digest, so it
 * cannot resolve to a real challenge. The injectable byte source exists
 * only to allow deterministic tests; production always uses secure
 * randomness via node:crypto. Each byte maps to an alphabet index via
 * modulo: 256 is an exact multiple of ALPHABET_SIZE (32), so every symbol
 * has exactly 8 preimages and the mapping is unbiased.
 */
export function generateDecoyChallengeRef(
  randomBytesSource: RandomBytesSource = defaultRandomBytesSource,
): string {
  const rawBytes = randomBytesSource(REF_LENGTH);
  let ref = '';

  for (let i = 0; i < REF_LENGTH; i++) {
    const byte = rawBytes[i];
    if (byte === undefined) {
      throw new Error('Decoy challenge reference byte source returned insufficient bytes');
    }
    const index = byte % ALPHABET_SIZE;
    const char = ALPHABET[index];
    if (char === undefined) {
      throw new Error(`Invalid random index: ${index}`);
    }
    ref += char;
  }

  return ref;
}

const CHALLENGE_REF_REGEX = /^[1-9A-HJKMNP-Z]{32}$/;

export function normalizeChallengeRef(raw: string): string {
  const trimmed = raw.trim().toUpperCase();

  if (!CHALLENGE_REF_REGEX.test(trimmed)) {
    throw new Error(`Invalid challenge reference format: ${raw}`);
  }

  return trimmed;
}
