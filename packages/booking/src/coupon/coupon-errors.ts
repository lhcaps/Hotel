/**
 * Coupon domain errors.
 *
 * Each class carries a stable `code` used by callers (API layer) to map to
 * Problem Details responses without exposing internal details such as
 * digests, raw codes, or SQL constraint names.
 */

export class CouponNotFoundError extends Error {
  override readonly name = 'CouponNotFoundError';
  readonly code = 'COUPON_NOT_FOUND_OR_UNAVAILABLE';
}

export class CouponExpiredError extends Error {
  override readonly name = 'CouponExpiredError';
  readonly code = 'COUPON_EXPIRED';
}

export class CouponNotApplicableError extends Error {
  override readonly name = 'CouponNotApplicableError';
  readonly code = 'COUPON_NOT_APPLICABLE';
}

export class CouponMinimumNotMetError extends Error {
  override readonly name = 'CouponMinimumNotMetError';
  readonly code = 'COUPON_MINIMUM_NOT_MET';
}

export class CouponLimitReachedError extends Error {
  override readonly name = 'CouponLimitReachedError';
  readonly code = 'COUPON_LIMIT_REACHED';
}

export class CouponCustomerLimitReachedError extends Error {
  override readonly name = 'CouponCustomerLimitReachedError';
  readonly code = 'COUPON_CUSTOMER_LIMIT_REACHED';
}

export class CouponHoldWindowIncompatibleError extends Error {
  override readonly name = 'CouponHoldWindowIncompatibleError';
  readonly code = 'COUPON_HOLD_WINDOW_INCOMPATIBLE';
}

export class CouponRequoteRequiredError extends Error {
  override readonly name = 'CouponRequoteRequiredError';
  readonly code = 'COUPON_REQUOTE_REQUIRED';
}

export class CouponAlreadyAppliedError extends Error {
  override readonly name = 'CouponAlreadyAppliedError';
  readonly code = 'COUPON_ALREADY_APPLIED';
}

export class CouponApplicationNotRedeemableError extends Error {
  override readonly name = 'CouponApplicationNotRedeemableError';
  readonly code = 'COUPON_APPLICATION_NOT_REDEEMABLE';
}

export class CouponInvalidInputError extends Error {
  override readonly name = 'CouponInvalidInputError';
  readonly code = 'COUPON_INVALID_INPUT';
}

export type CouponErrorCode =
  | typeof CouponNotFoundError.prototype.code
  | typeof CouponExpiredError.prototype.code
  | typeof CouponNotApplicableError.prototype.code
  | typeof CouponMinimumNotMetError.prototype.code
  | typeof CouponLimitReachedError.prototype.code
  | typeof CouponCustomerLimitReachedError.prototype.code
  | typeof CouponHoldWindowIncompatibleError.prototype.code
  | typeof CouponRequoteRequiredError.prototype.code
  | typeof CouponAlreadyAppliedError.prototype.code
  | typeof CouponApplicationNotRedeemableError.prototype.code
  | typeof CouponInvalidInputError.prototype.code;
