import { describe, it, expect } from 'vitest';
import { computeDigest, type DigestInput } from './digest.js';

describe('computeDigest', () => {
  it('produces identical output for identical input', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');
    const input: DigestInput = {
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [Buffer.from('part1'), Buffer.from('part2')],
    };

    const digest1 = computeDigest(input);
    const digest2 = computeDigest(input);

    expect(digest1.equals(digest2)).toBe(true);
    expect(digest1).toHaveLength(32);
  });

  it('produces different output for different domain labels', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');
    const parts = [Buffer.from('part1')];

    const digest1 = computeDigest({
      secretKey,
      domainLabel: 'room-management/email-lookup/v1',
      parts,
    });

    const digest2 = computeDigest({
      secretKey,
      domainLabel: 'room-management/session/v1',
      parts,
    });

    expect(digest1.equals(digest2)).toBe(false);
  });

  it('produces consistent output for canonical UUID serialization', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');
    const uuidBytes = Buffer.from([
      0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde,
      0xf0,
    ]);

    const digest1 = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [uuidBytes],
    });

    const digest2 = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [uuidBytes],
    });

    expect(digest1.equals(digest2)).toBe(true);
  });

  it('does not collide when part boundaries shift (split-ambiguity regression)', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');

    const digestAbC = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [Buffer.from('ab'), Buffer.from('c')],
    });

    const digestABc = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [Buffer.from('a'), Buffer.from('bc')],
    });

    expect(digestAbC.equals(digestABc)).toBe(false);
  });

  it('produces different output when parts are reordered', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');

    const digestForward = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [Buffer.from('first'), Buffer.from('second')],
    });

    const digestReversed = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [Buffer.from('second'), Buffer.from('first')],
    });

    expect(digestForward.equals(digestReversed)).toBe(false);
  });

  it('produces different output for a different number of parts with the same concatenation', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');

    const digestOnePart = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [Buffer.from('abc')],
    });

    const digestThreeParts = computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [Buffer.from('a'), Buffer.from('b'), Buffer.from('c')],
    });

    expect(digestOnePart.equals(digestThreeParts)).toBe(false);
  });

  it('does not mutate caller-provided buffers', () => {
    const secretKey = Buffer.from('test-secret-key-32-bytes-long!!');
    const part = Buffer.from('untouched');
    const partCopy = Buffer.from(part);

    computeDigest({
      secretKey,
      domainLabel: 'room-management/test/v1',
      parts: [part],
    });

    expect(part.equals(partCopy)).toBe(true);
  });
});
