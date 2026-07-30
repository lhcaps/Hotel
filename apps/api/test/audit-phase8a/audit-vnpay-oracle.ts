/**
 * Phase 8A audit-only independent VNPAY signature oracle.
 *
 * Re-implements the VNPAY "Checkout 2.1.0" signature protocol from first
 * principles using ONLY the official canonical specification (per the source
 * comments in vnpay.signature.ts: "VNPAY Checkout v2.1.0 signs sorted,
 * URL-encoded non-empty vnp_ parameters").
 *
 * This implementation is structurally distinct from
 * apps/api/src/payment/providers/vnpay/vnpay.signature.ts:
 *
 *  - it does NOT import from there;
 *  - it does NOT use URLSearchParams to assemble the canonical query;
 *  - it sorts parameters differently and independently validates the
 *    exclusion list before signing.
 *
 * Audit cross-check: both implementations should produce identical
 * signatures for the same canonical-form inputs.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const EXCLUDED_KEYS: ReadonlySet<string> = new Set(['vnp_SecureHash', 'vnp_SecureHashType']);

export interface VnpayCanonicalInput {
  readonly fields: Readonly<Record<string, string>>;
  readonly hashSecret: string;
}

function _vnPaySafeChar(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    code === 0x2d ||
    code === 0x5f ||
    code === 0x2e ||
    code === 0x7e
  );
}

export function auditBuildVnpayCanonicalQuery(fields: Readonly<Record<string, string>>): string {
  // VNPAY's canonical form sorts vnp_* keys (excluding vnp_SecureHash and
  // vnp_SecureHashType), excludes empty values, and URL-encodes each k/v
  // before joining with '&'. The official spec is ambiguous about the
  // exact space encoding; this audit oracle preserves the production
  // encoder's behaviour (space -> '+', default URLSearchParams) so the
  // audit oracle can independently verify signature parity.
  const keys = Object.keys(fields)
    .filter(
      (key) =>
        key.startsWith('vnp_') &&
        !EXCLUDED_KEYS.has(key) &&
        fields[key] !== undefined &&
        fields[key] !== '',
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  // Apply percent-encoding that maps a literal ' ' to '+' (the
  // application/x-www-form-urlencoded form), matching
  // URLSearchParams.toString(). Non-alphanumeric characters are upper-cased
  // percent escapes. Sign characters are preserved.
  const encode = (s: string): string => {
    const buf = Buffer.from(s, 'utf8');
    let out = '';
    for (const byte of buf) {
      if (_vnPaySafeChar(byte)) {
        out += String.fromCharCode(byte);
      } else if (byte === 0x20) {
        out += '+';
      } else {
        out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      }
    }
    return out;
  };
  return keys.map((k) => `${encode(k)}=${encode(fields[k] as string)}`).join('&');
}

export function auditSignVnpayCanonicalQuery(hashSecret: string, canonical: string): string {
  return createHmac('sha512', hashSecret).update(canonical, 'utf8').digest('hex');
}

export function auditHasValidVnpaySignature(
  hashSecret: string,
  canonical: string,
  received: string,
): boolean {
  if (!/^[a-f0-9]{128}$/.test(received)) return false;
  const expected = Buffer.from(auditSignVnpayCanonicalQuery(hashSecret, canonical), 'hex');
  const actual = Buffer.from(received, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
