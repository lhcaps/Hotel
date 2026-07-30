/**
 * Domain-separated digest computation
 *
 * All digests are SHA-256 HMAC with domain separation
 */

import { createHmac } from 'node:crypto';

export interface DigestInput {
  readonly secretKey: Buffer;
  readonly domainLabel: string;
  readonly parts: ReadonlyArray<Buffer>;
}

const DOMAIN_SEPARATOR = Buffer.from([0x1f]);

/**
 * Frames the domain label and parts unambiguously so that no two distinct
 * (domainLabel, parts) inputs can serialize to the same byte sequence.
 * Each part is prefixed with its own 32-bit big-endian length, and the
 * part count is prefixed up front, preventing split-boundary collisions
 * such as [Buffer.from('ab'), Buffer.from('c')] vs
 * [Buffer.from('a'), Buffer.from('bc')].
 */
function frameDigestInput(domainLabel: string, parts: ReadonlyArray<Buffer>): Buffer {
  const labelBuffer = Buffer.from(domainLabel, 'utf8');
  const labelLength = Buffer.alloc(4);
  labelLength.writeUInt32BE(labelBuffer.length, 0);

  const partCount = Buffer.alloc(4);
  partCount.writeUInt32BE(parts.length, 0);

  const framedParts = parts.map((part) => {
    const partLength = Buffer.alloc(4);
    partLength.writeUInt32BE(part.length, 0);
    return Buffer.concat([partLength, part]);
  });

  return Buffer.concat([labelLength, labelBuffer, DOMAIN_SEPARATOR, partCount, ...framedParts]);
}

export function computeDigest(input: DigestInput): Buffer {
  const framed = frameDigestInput(input.domainLabel, input.parts);

  return createHmac('sha256', input.secretKey).update(framed).digest();
}
