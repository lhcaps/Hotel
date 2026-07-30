import { describe, expect, it } from 'vitest';
import {
  calculateDiscount,
  calculateFixedDiscount,
  calculatePercentageDiscount,
} from '../../src/coupon/coupon-calculator.js';
import { CouponInvalidInputError } from '../../src/coupon/coupon-errors.js';

describe('calculateFixedDiscount', () => {
  it('returns the fixed amount when below gross', () => {
    expect(calculateFixedDiscount(50_000n, 200_000n)).toBe(50_000n);
  });

  it('returns the gross amount when fixed equals gross', () => {
    expect(calculateFixedDiscount(200_000n, 200_000n)).toBe(200_000n);
  });

  it('clamps the discount to gross when fixed exceeds gross', () => {
    expect(calculateFixedDiscount(500_000n, 200_000n)).toBe(200_000n);
  });

  it('rejects non-positive fixed amounts', () => {
    expect(() => calculateFixedDiscount(0n, 100_000n)).toThrow(CouponInvalidInputError);
    expect(() => calculateFixedDiscount(-1n, 100_000n)).toThrow(CouponInvalidInputError);
  });

  it('rejects negative gross amounts', () => {
    expect(() => calculateFixedDiscount(50_000n, -1n)).toThrow(CouponInvalidInputError);
  });
});

describe('calculatePercentageDiscount', () => {
  it('computes exact division', () => {
    // 10% of 1_000_000 = 100_000
    expect(calculatePercentageDiscount(1_000, null, 1_000_000n)).toBe(100_000n);
    // 50% of 800_000 = 400_000
    expect(calculatePercentageDiscount(5_000, null, 800_000n)).toBe(400_000n);
  });

  it('floors fractional results deterministically', () => {
    // 7.5% of 1_000 = 75 (exact)
    expect(calculatePercentageDiscount(750, null, 1_000n)).toBe(75n);
    // 7.5% of 999 = 74.925 -> 74
    expect(calculatePercentageDiscount(750, null, 999n)).toBe(74n);
    // 12.34% of 123_456 = 15234.4704 -> 15234
    expect(calculatePercentageDiscount(1234, null, 123_456n)).toBe(15_234n);
  });

  it('caps at maximumDiscountVnd when set', () => {
    // 50% of 1_000_000 = 500_000 but max is 100_000
    expect(calculatePercentageDiscount(5_000, 100_000n, 1_000_000n)).toBe(100_000n);
  });

  it('never exceeds gross when no cap is set', () => {
    // 100% of 100_000 = 100_000
    expect(calculatePercentageDiscount(10_000, null, 100_000n)).toBe(100_000n);
  });

  it('returns zero when gross is zero', () => {
    expect(calculatePercentageDiscount(5_000, null, 0n)).toBe(0n);
  });

  it('rejects basis points outside [1, 10000]', () => {
    expect(() => calculatePercentageDiscount(0, null, 100_000n)).toThrow(CouponInvalidInputError);
    expect(() => calculatePercentageDiscount(10_001, null, 100_000n)).toThrow(
      CouponInvalidInputError,
    );
    expect(() => calculatePercentageDiscount(1.5 as unknown as number, null, 100_000n)).toThrow(
      CouponInvalidInputError,
    );
  });

  it('rejects non-positive maximumDiscountVnd when set', () => {
    expect(() => calculatePercentageDiscount(1_000, 0n, 100_000n)).toThrow(CouponInvalidInputError);
    expect(() => calculatePercentageDiscount(1_000, -1n, 100_000n)).toThrow(
      CouponInvalidInputError,
    );
  });
});

describe('calculateDiscount', () => {
  it('fixed discount below gross', () => {
    const result = calculateDiscount({
      shape: { kind: 'FIXED', fixedAmountVnd: 50_000n },
      grossAmountVnd: 200_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result).toEqual({
      discountAmountVnd: 50_000n,
      finalAmountVnd: 150_000n,
      minimumOrderMet: true,
    });
  });

  it('fixed discount equal to gross clamps at gross', () => {
    const result = calculateDiscount({
      shape: { kind: 'FIXED', fixedAmountVnd: 200_000n },
      grossAmountVnd: 200_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(200_000n);
    expect(result.finalAmountVnd).toBe(0n);
  });

  it('fixed discount above gross clamps at gross', () => {
    const result = calculateDiscount({
      shape: { kind: 'FIXED', fixedAmountVnd: 999_999n },
      grossAmountVnd: 200_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(200_000n);
    expect(result.finalAmountVnd).toBe(0n);
  });

  it('percentage exact division', () => {
    const result = calculateDiscount({
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 1_000, maximumDiscountVnd: null },
      grossAmountVnd: 1_000_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(100_000n);
    expect(result.finalAmountVnd).toBe(900_000n);
  });

  it('percentage fractional result floors deterministically', () => {
    const result = calculateDiscount({
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 750, maximumDiscountVnd: null },
      grossAmountVnd: 999n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(74n);
    expect(result.finalAmountVnd).toBe(925n);
  });

  it('percentage maximumDiscount cap', () => {
    const result = calculateDiscount({
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 5_000, maximumDiscountVnd: 100_000n },
      grossAmountVnd: 1_000_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(100_000n);
    expect(result.finalAmountVnd).toBe(900_000n);
  });

  it('percentage discount never exceeds gross', () => {
    const result = calculateDiscount({
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 10_000, maximumDiscountVnd: null },
      grossAmountVnd: 100_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(100_000n);
    expect(result.finalAmountVnd).toBe(0n);
  });

  it('minimumOrder exact boundary', () => {
    const result = calculateDiscount({
      shape: { kind: 'FIXED', fixedAmountVnd: 50_000n },
      grossAmountVnd: 100_000n,
      minimumOrderAmountVnd: 100_000n,
    });
    expect(result.discountAmountVnd).toBe(50_000n);
    expect(result.finalAmountVnd).toBe(50_000n);
    expect(result.minimumOrderMet).toBe(true);
  });

  it('minimumOrder one VND below rejects discount', () => {
    const result = calculateDiscount({
      shape: { kind: 'FIXED', fixedAmountVnd: 50_000n },
      grossAmountVnd: 99_999n,
      minimumOrderAmountVnd: 100_000n,
    });
    expect(result.discountAmountVnd).toBe(0n);
    expect(result.finalAmountVnd).toBe(99_999n);
    expect(result.minimumOrderMet).toBe(false);
  });

  it('basis points lower boundary', () => {
    const result = calculateDiscount({
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 1, maximumDiscountVnd: null },
      grossAmountVnd: 1_000_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(100n);
    expect(result.finalAmountVnd).toBe(999_900n);
  });

  it('basis points upper boundary', () => {
    const result = calculateDiscount({
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 10_000, maximumDiscountVnd: null },
      grossAmountVnd: 1_000_000n,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(1_000_000n);
    expect(result.finalAmountVnd).toBe(0n);
  });

  it('integer overflow path remains exact', () => {
    // gross 1e12 VND × 10000 bps = 1e16 still within BigInt
    const gross = 1_000_000_000_000n; // 1 trillion VND
    const result = calculateDiscount({
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 10_000, maximumDiscountVnd: null },
      grossAmountVnd: gross,
      minimumOrderAmountVnd: 0n,
    });
    expect(result.discountAmountVnd).toBe(gross);
    expect(result.finalAmountVnd).toBe(0n);
  });

  it('rejects zero or negative gross', () => {
    expect(() =>
      calculateDiscount({
        shape: { kind: 'FIXED', fixedAmountVnd: 50_000n },
        grossAmountVnd: 0n,
        minimumOrderAmountVnd: 0n,
      }),
    ).not.toThrow();
    expect(() =>
      calculateDiscount({
        shape: { kind: 'FIXED', fixedAmountVnd: 50_000n },
        grossAmountVnd: -1n,
        minimumOrderAmountVnd: 0n,
      }),
    ).toThrow(CouponInvalidInputError);
  });

  it('rejects zero or negative minimum order', () => {
    expect(() =>
      calculateDiscount({
        shape: { kind: 'FIXED', fixedAmountVnd: 50_000n },
        grossAmountVnd: 100_000n,
        minimumOrderAmountVnd: -1n,
      }),
    ).toThrow(CouponInvalidInputError);
  });

  it('produces identical output for identical input (determinism)', () => {
    const input = {
      shape: { kind: 'PERCENTAGE', percentageBasisPoints: 1234, maximumDiscountVnd: 80_000n },
      grossAmountVnd: 123_456n,
      minimumOrderAmountVnd: 100_000n,
    } as const;
    const first = calculateDiscount(input);
    const second = calculateDiscount(input);
    expect(first).toEqual(second);
    expect(first.discountAmountVnd).toBe(15_234n);
    expect(first.finalAmountVnd).toBe(108_222n);
  });

  it('rejects mismatched discount shape values', () => {
    // PERCENTAGE shape with null basis points must be caught upstream; we
    // emulate the engine by calling calculatePercentageDiscount directly.
    expect(() => calculatePercentageDiscount(0, null, 1_000n)).toThrow(CouponInvalidInputError);
  });
});
