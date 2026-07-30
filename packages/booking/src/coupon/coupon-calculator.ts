/**
 * Deterministic coupon discount calculation (CPN-001 §4).
 *
 * Pure integer arithmetic only. All amounts are integer VND; percentage
 * values are integer basis points (1 == 0.01%, 10_000 == 100%).
 *
 * Multiplication can exceed the JavaScript safe-integer range for
 * large gross amounts and basis points, so all intermediate math is done
 * with `bigint` before being narrowed back to a `bigint` result that the
 * repository/contract layer can serialize safely.
 *
 * The calculator never validates time validity, quota, or currency —
 * those concerns are enforced by repositories/services that own the
 * transaction-time view of the database.
 */

import {
  BASIS_POINTS_TOTAL,
  MAX_BASIS_POINTS,
  MIN_BASIS_POINTS,
  type CouponDiscountShape,
  type CouponEvaluation,
} from './coupon-types.js';
import { CouponInvalidInputError } from './coupon-errors.js';

export interface CalculateDiscountInput {
  readonly shape: CouponDiscountShape;
  readonly grossAmountVnd: bigint;
  readonly minimumOrderAmountVnd: bigint;
}

export function assertNonNegativeInteger(value: bigint, field: string): void {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new CouponInvalidInputError(`${field} must be a non-negative integer`);
  }
}

export function assertPositiveInteger(value: bigint, field: string): void {
  if (typeof value !== 'bigint' || value <= 0n) {
    throw new CouponInvalidInputError(`${field} must be a positive integer`);
  }
}

export function calculateFixedDiscount(fixedAmountVnd: bigint, grossAmountVnd: bigint): bigint {
  assertPositiveInteger(fixedAmountVnd, 'fixedAmountVnd');
  assertNonNegativeInteger(grossAmountVnd, 'grossAmountVnd');
  if (fixedAmountVnd > grossAmountVnd) return grossAmountVnd;
  return fixedAmountVnd;
}

export function calculatePercentageDiscount(
  percentageBasisPoints: number,
  maximumDiscountVnd: bigint | null,
  grossAmountVnd: bigint,
): bigint {
  if (
    !Number.isInteger(percentageBasisPoints) ||
    percentageBasisPoints < MIN_BASIS_POINTS ||
    percentageBasisPoints > MAX_BASIS_POINTS
  ) {
    throw new CouponInvalidInputError(
      `percentageBasisPoints must be between ${MIN_BASIS_POINTS} and ${MAX_BASIS_POINTS}`,
    );
  }
  assertNonNegativeInteger(grossAmountVnd, 'grossAmountVnd');
  if (maximumDiscountVnd !== null) {
    assertPositiveInteger(maximumDiscountVnd, 'maximumDiscountVnd');
  }
  if (grossAmountVnd === 0n) return 0n;
  const basisPoints = BigInt(percentageBasisPoints);
  const raw = (grossAmountVnd * basisPoints) / BigInt(BASIS_POINTS_TOTAL);
  const cappedByMax =
    maximumDiscountVnd !== null && raw > maximumDiscountVnd ? maximumDiscountVnd : raw;
  return cappedByMax > grossAmountVnd ? grossAmountVnd : cappedByMax;
}

export function calculateDiscount(input: CalculateDiscountInput): {
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
  readonly minimumOrderMet: boolean;
} {
  const { shape, grossAmountVnd, minimumOrderAmountVnd } = input;
  assertNonNegativeInteger(grossAmountVnd, 'grossAmountVnd');
  assertNonNegativeInteger(minimumOrderAmountVnd, 'minimumOrderAmountVnd');

  const minimumOrderMet = grossAmountVnd >= minimumOrderAmountVnd;
  if (!minimumOrderMet) {
    return {
      discountAmountVnd: 0n,
      finalAmountVnd: grossAmountVnd,
      minimumOrderMet: false,
    };
  }

  const discountAmountVnd =
    shape.kind === 'FIXED'
      ? calculateFixedDiscount(shape.fixedAmountVnd, grossAmountVnd)
      : calculatePercentageDiscount(
          shape.percentageBasisPoints,
          shape.maximumDiscountVnd,
          grossAmountVnd,
        );

  const finalAmountVnd = grossAmountVnd - discountAmountVnd;
  return {
    discountAmountVnd,
    finalAmountVnd,
    minimumOrderMet: true,
  };
}

export interface EvaluateStaticCouponInput {
  readonly couponId: string;
  readonly normalizedCode: string;
  readonly shape: CouponDiscountShape;
  readonly grossAmountVnd: bigint;
  readonly minimumOrderAmountVnd: bigint;
  readonly now: Date;
  readonly validFrom: Date;
  readonly validUntil: Date;
}

export function evaluateStaticCoupon(input: EvaluateStaticCouponInput): CouponEvaluation {
  if (input.validUntil <= input.validFrom) {
    throw new CouponInvalidInputError('Coupon validity window is invalid');
  }
  const validityWindowMet =
    input.now.getTime() >= input.validFrom.getTime() &&
    input.now.getTime() < input.validUntil.getTime();

  const { discountAmountVnd, minimumOrderMet } = calculateDiscount({
    shape: input.shape,
    grossAmountVnd: input.grossAmountVnd,
    minimumOrderAmountVnd: input.minimumOrderAmountVnd,
  });

  return {
    couponId: input.couponId,
    normalizedCode: input.normalizedCode,
    discountType: input.shape.kind,
    grossAmountVnd: input.grossAmountVnd,
    discountAmountVnd: validityWindowMet && minimumOrderMet ? discountAmountVnd : 0n,
    finalAmountVnd: input.grossAmountVnd,
    minimumOrderMet,
    validityWindowMet,
  };
}

export function couponRequiresRoomTypeLookup(
  shape: CouponDiscountShape,
): shape is CouponDiscountShape {
  return shape.kind === 'FIXED' || shape.kind === 'PERCENTAGE';
}
