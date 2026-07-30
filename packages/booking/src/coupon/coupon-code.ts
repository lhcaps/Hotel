/**
 * Coupon code normalization (CPN-001).
 *
 * Public/admin contracts receive a raw coupon code and the engine must
 * normalize it deterministically before any database lookup or audit entry.
 *
 * The accepted character set is a closed ASCII subset chosen to avoid
 * Unicode confusables, locale-dependent case folding, and accidental
 * whitespace smuggling. Any input that does not normalize to this alphabet
 * is rejected.
 */

import { CouponInvalidInputError } from './coupon-errors.js';

const COUPON_CODE_PATTERN = /^[A-Z0-9-]{4,32}$/;

export function normalizeCouponCode(raw: string): string {
  if (typeof raw !== 'string') {
    throw new CouponInvalidInputError('Coupon code must be a string');
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new CouponInvalidInputError('Coupon code must not be empty');
  }
  if (trimmed.length > 32) {
    throw new CouponInvalidInputError('Coupon code must not exceed 32 characters');
  }
  const upper = trimmed.toUpperCase();
  if (!COUPON_CODE_PATTERN.test(upper)) {
    throw new CouponInvalidInputError(
      'Coupon code must match ^[A-Z0-9-]{4,32}$ after normalization',
    );
  }
  return upper;
}

export function isNormalizedCouponCode(value: string): boolean {
  return COUPON_CODE_PATTERN.test(value);
}
