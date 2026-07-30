export class CouponNotFoundError extends Error {
  public readonly code = 'COUPON_NOT_FOUND';

  public constructor() {
    super('The requested coupon was not found.');
    this.name = 'CouponNotFoundError';
  }
}

export class CouponConflictError extends Error {
  public readonly code = 'COUPON_CONFLICT';

  public constructor() {
    super('Coupon code already exists for this property.');
    this.name = 'CouponConflictError';
  }
}

export class CouponReferencedError extends Error {
  public readonly code = 'COUPON_REFERENCED';

  public constructor() {
    super('Coupon already has an application referencing it.');
    this.name = 'CouponReferencedError';
  }
}
