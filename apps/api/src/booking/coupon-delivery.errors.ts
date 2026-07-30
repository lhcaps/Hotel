export type CouponDeliveryErrorCode =
  | 'COUPON_DELIVERY_IDEMPOTENCY_REQUIRED'
  | 'COUPON_DELIVERY_BOOKING_NOT_FOUND'
  | 'COUPON_DELIVERY_COUPON_UNAVAILABLE'
  | 'COUPON_DELIVERY_IDEMPOTENCY_CONFLICT';

export class CouponDeliveryError extends Error {
  public constructor(public readonly code: CouponDeliveryErrorCode) {
    super(code);
  }
}
