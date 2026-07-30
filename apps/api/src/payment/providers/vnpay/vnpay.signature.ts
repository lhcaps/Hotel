import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

/** VNPAY Checkout v2.1.0 signs sorted, URL-encoded non-empty vnp_ parameters. */
export function buildVnpayCanonicalQuery(fields: Readonly<Record<string, string>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)
    .filter(
      ([key, value]) =>
        key.startsWith('vnp_') &&
        key !== 'vnp_SecureHash' &&
        key !== 'vnp_SecureHashType' &&
        value !== '',
    )
    .sort(([left], [right]) => left.localeCompare(right))) {
    params.append(key, value);
  }
  return params.toString();
}

export function signVnpayCanonicalQuery(hashSecret: string, canonical: string): string {
  return createHmac('sha512', hashSecret).update(canonical, 'utf8').digest('hex');
}

export function hasValidVnpaySignature(
  hashSecret: string,
  canonical: string,
  received: string | undefined,
): boolean {
  if (received === undefined || !/^[a-f0-9]{128}$/.test(received)) return false;
  const expected = Buffer.from(signVnpayCanonicalQuery(hashSecret, canonical), 'hex');
  const actual = Buffer.from(received, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
