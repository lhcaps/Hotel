import { describe, expect, it } from 'vitest';
import { evaluateStaticCoupon } from '../../src/coupon/coupon-calculator.js';
import { CouponInvalidInputError } from '../../src/coupon/coupon-errors.js';
import type { CouponEvaluationSnapshot } from '../../src/coupon/coupon-types.js';

describe('evaluateStaticCoupon', () => {
  const validFrom = new Date('2026-01-01T00:00:00.000Z');
  const validUntil = new Date('2026-12-31T23:59:59.999Z');

  it('returns zero discount outside the validity window', () => {
    const evaluation = evaluateStaticCoupon({
      couponId: '11111111-1111-1111-1111-111111111111',
      normalizedCode: 'SAVE10',
      shape: { kind: 'FIXED', fixedAmountVnd: 100_000n },
      grossAmountVnd: 1_000_000n,
      minimumOrderAmountVnd: 0n,
      now: new Date('2027-01-01T00:00:00.000Z'),
      validFrom,
      validUntil,
    });
    expect(evaluation.validityWindowMet).toBe(false);
    expect(evaluation.discountAmountVnd).toBe(0n);
    expect(evaluation.finalAmountVnd).toBe(1_000_000n);
  });

  it('includes the lower boundary (validFrom)', () => {
    const evaluation = evaluateStaticCoupon({
      couponId: '11111111-1111-1111-1111-111111111111',
      normalizedCode: 'SAVE10',
      shape: { kind: 'FIXED', fixedAmountVnd: 100_000n },
      grossAmountVnd: 1_000_000n,
      minimumOrderAmountVnd: 0n,
      now: validFrom,
      validFrom,
      validUntil,
    });
    expect(evaluation.validityWindowMet).toBe(true);
    expect(evaluation.discountAmountVnd).toBe(100_000n);
  });

  it('excludes the upper boundary (validUntil)', () => {
    const evaluation = evaluateStaticCoupon({
      couponId: '11111111-1111-1111-1111-111111111111',
      normalizedCode: 'SAVE10',
      shape: { kind: 'FIXED', fixedAmountVnd: 100_000n },
      grossAmountVnd: 1_000_000n,
      minimumOrderAmountVnd: 0n,
      now: validUntil,
      validFrom,
      validUntil,
    });
    expect(evaluation.validityWindowMet).toBe(false);
  });

  it('enforces minimum order against gross', () => {
    const evaluation = evaluateStaticCoupon({
      couponId: '11111111-1111-1111-1111-111111111111',
      normalizedCode: 'SAVE10',
      shape: { kind: 'FIXED', fixedAmountVnd: 100_000n },
      grossAmountVnd: 50_000n,
      minimumOrderAmountVnd: 100_000n,
      now: new Date('2026-06-01T00:00:00.000Z'),
      validFrom,
      validUntil,
    });
    expect(evaluation.minimumOrderMet).toBe(false);
    expect(evaluation.discountAmountVnd).toBe(0n);
  });

  it('rejects invalid validity windows', () => {
    expect(() =>
      evaluateStaticCoupon({
        couponId: '11111111-1111-1111-1111-111111111111',
        normalizedCode: 'SAVE10',
        shape: { kind: 'FIXED', fixedAmountVnd: 100_000n },
        grossAmountVnd: 1_000_000n,
        minimumOrderAmountVnd: 0n,
        now: new Date('2026-06-01T00:00:00.000Z'),
        validFrom: validUntil,
        validUntil: validFrom,
      }),
    ).toThrow(CouponInvalidInputError);
  });
});

describe('CouponEvaluationSnapshot', () => {
  it('is JSON-serializable without leaking bigint', () => {
    const snapshot: CouponEvaluationSnapshot = {
      couponId: '11111111-1111-1111-1111-111111111111',
      normalizedCode: 'SAVE10',
      discountType: 'FIXED',
      fixedAmountVnd: 50_000n,
      percentageBasisPoints: null,
      maximumDiscountVnd: null,
      minimumOrderAmountVnd: 0n,
      grossAmountVnd: 1_000_000n,
      discountAmountVnd: 50_000n,
      finalAmountVnd: 950_000n,
    };
    const serializable = {
      ...snapshot,
      fixedAmountVnd: snapshot.fixedAmountVnd === null ? null : snapshot.fixedAmountVnd.toString(),
      maximumDiscountVnd:
        snapshot.maximumDiscountVnd === null ? null : snapshot.maximumDiscountVnd.toString(),
      minimumOrderAmountVnd: snapshot.minimumOrderAmountVnd.toString(),
      grossAmountVnd: snapshot.grossAmountVnd.toString(),
      discountAmountVnd: snapshot.discountAmountVnd.toString(),
      finalAmountVnd: snapshot.finalAmountVnd.toString(),
    };
    expect(typeof JSON.stringify(serializable)).toBe('string');
    expect(JSON.parse(JSON.stringify(serializable)).discountAmountVnd).toBe('50000');
  });
});
