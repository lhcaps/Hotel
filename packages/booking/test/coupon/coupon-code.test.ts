import { describe, expect, it } from 'vitest';
import { normalizeCouponCode, isNormalizedCouponCode } from '../../src/coupon/coupon-code.js';
import { CouponInvalidInputError } from '../../src/coupon/coupon-errors.js';

describe('normalizeCouponCode', () => {
  it('accepts valid ASCII codes', () => {
    expect(normalizeCouponCode('hello-world')).toBe('HELLO-WORLD');
  });

  it('uppercases lowercase input', () => {
    expect(normalizeCouponCode('save10')).toBe('SAVE10');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCouponCode('  SAVE10  ')).toBe('SAVE10');
  });

  it('rejects empty strings', () => {
    expect(() => normalizeCouponCode('')).toThrow(CouponInvalidInputError);
  });

  it('rejects whitespace-only input', () => {
    expect(() => normalizeCouponCode('   ')).toThrow(CouponInvalidInputError);
  });

  it('rejects codes shorter than 4 characters', () => {
    expect(() => normalizeCouponCode('AB1')).toThrow(CouponInvalidInputError);
  });

  it('rejects codes longer than 32 characters', () => {
    expect(() => normalizeCouponCode('A'.repeat(33))).toThrow(CouponInvalidInputError);
  });

  it('rejects unsupported characters', () => {
    expect(() => normalizeCouponCode('SAVE 10')).toThrow(CouponInvalidInputError);
    expect(() => normalizeCouponCode('SAVE_10')).toThrow(CouponInvalidInputError);
    expect(() => normalizeCouponCode('SAVE.10')).toThrow(CouponInvalidInputError);
  });

  it('rejects confusable unicode characters', () => {
    // Cyrillic "А" (U+0410) is not in [A-Z0-9-]
    expect(() => normalizeCouponCode('S\u0410VE10')).toThrow(CouponInvalidInputError);
    // Fullwidth "1" (U+FF11)
    expect(() => normalizeCouponCode('SAVE\uFF11')).toThrow(CouponInvalidInputError);
    // Soft hyphen (U+00AD)
    expect(() => normalizeCouponCode('SAVE\u00AD10')).toThrow(CouponInvalidInputError);
  });

  it('isNormalizedCouponCode is true for valid codes', () => {
    expect(isNormalizedCouponCode('SAVE10')).toBe(true);
    expect(isNormalizedCouponCode('HELLO-WORLD')).toBe(true);
  });

  it('isNormalizedCouponCode is false for invalid codes', () => {
    expect(isNormalizedCouponCode('save10')).toBe(false);
    expect(isNormalizedCouponCode('SAVE 10')).toBe(false);
    expect(isNormalizedCouponCode('SAVE_10')).toBe(false);
    expect(isNormalizedCouponCode('AB')).toBe(false);
  });
});
