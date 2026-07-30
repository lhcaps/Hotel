/**
 * Coupon domain types (CPN-001).
 *
 * Types are kept narrow and serialization-safe so they can flow through
 * Drizzle rows, HTTP contracts, and immutable snapshots without mutation.
 */

export type CouponDiscountType = 'FIXED' | 'PERCENTAGE';

export type CouponApplicationStatus =
  | 'ASSOCIATED'
  | 'RESERVED'
  | 'REDEEMED'
  | 'RELEASED';

export interface FixedDiscountShape {
  readonly kind: 'FIXED';
  readonly fixedAmountVnd: bigint;
}

export interface PercentageDiscountShape {
  readonly kind: 'PERCENTAGE';
  readonly percentageBasisPoints: number;
  readonly maximumDiscountVnd: bigint | null;
}

export type CouponDiscountShape = FixedDiscountShape | PercentageDiscountShape;

export interface CouponDefinition {
  readonly id: string;
  readonly propertyId: string;
  readonly normalizedCode: string;
  readonly discountType: CouponDiscountType;
  readonly fixedAmountVnd: bigint | null;
  readonly percentageBasisPoints: number | null;
  readonly maximumDiscountVnd: bigint | null;
  readonly minimumOrderAmountVnd: bigint;
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly appliesToAllRoomTypes: boolean;
  readonly scopedRoomTypeIds: ReadonlyArray<string>;
  readonly totalUsageLimit: number | null;
  readonly perCustomerLimit: number | null;
  readonly status: 'ACTIVE' | 'DISABLED';
}

export interface CouponEvaluation {
  readonly couponId: string;
  readonly normalizedCode: string;
  readonly discountType: CouponDiscountType;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
  readonly minimumOrderMet: boolean;
  readonly validityWindowMet: boolean;
}

export interface CouponEvaluationSnapshot {
  readonly couponId: string;
  readonly normalizedCode: string;
  readonly discountType: CouponDiscountType;
  readonly fixedAmountVnd: bigint | null;
  readonly percentageBasisPoints: number | null;
  readonly maximumDiscountVnd: bigint | null;
  readonly minimumOrderAmountVnd: bigint;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
}

export const BASIS_POINTS_TOTAL = 10_000;
export const MIN_BASIS_POINTS = 1;
export const MAX_BASIS_POINTS = BASIS_POINTS_TOTAL;
