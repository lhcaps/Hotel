/**
 * Domain error taxonomy for booking HOLD creation (Task 3)
 *
 * Each error class carries a stable machine-readable `code` used by callers
 * (API layer) to map to Problem Details responses. See design doc §D
 * "Errors mapped to API".
 */

export class QuoteNotFoundError extends Error {
  override readonly name = 'QuoteNotFoundError';
  readonly code = 'QUOTE_NOT_FOUND';
}

export class QuoteExpiredError extends Error {
  override readonly name = 'QuoteExpiredError';
  readonly code = 'QUOTE_EXPIRED';
}

export class QuoteAlreadyUsedError extends Error {
  override readonly name = 'QuoteAlreadyUsedError';
  readonly code = 'QUOTE_ALREADY_USED';
}

export class RoomTypeUnavailableError extends Error {
  override readonly name = 'RoomTypeUnavailableError';
  readonly code = 'ROOM_TYPE_UNAVAILABLE';
}

export class AllocationBusyError extends Error {
  override readonly name = 'AllocationBusyError';
  readonly code = 'ALLOCATION_BUSY';
}

export class StaleHoldCleanupRetryError extends Error {
  override readonly name = 'StaleHoldCleanupRetryError';
  readonly code = 'STALE_HOLD_CLEANUP_RETRY';
}

// Phase 6C coupon domain errors (booking-side re-export)
export {
  CouponExpiredError,
  CouponRequoteRequiredError,
  CouponHoldWindowIncompatibleError,
  CouponMinimumNotMetError,
  CouponLimitReachedError,
  CouponCustomerLimitReachedError,
} from './coupon/coupon-errors.js';

export type BookingHoldErrorCode =
  | typeof QuoteNotFoundError.prototype.code
  | typeof QuoteExpiredError.prototype.code
  | typeof QuoteAlreadyUsedError.prototype.code
  | typeof RoomTypeUnavailableError.prototype.code
  | typeof AllocationBusyError.prototype.code
  | typeof StaleHoldCleanupRetryError.prototype.code;
