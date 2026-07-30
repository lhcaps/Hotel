import { describe, expect, it } from 'vitest';

import { adminBookingCouponDeliverySchema } from '../src/coupon.js';

describe('adminBookingCouponDeliverySchema', () => {
  it('accepts a bounded, unique set of coupon codes and normalizes each code', () => {
    expect(
      adminBookingCouponDeliverySchema.parse({
        couponCodes: ['welcome-10', 'vip-2026'],
      }),
    ).toEqual({ couponCodes: ['WELCOME-10', 'VIP-2026'] });
  });

  it('rejects duplicate, empty, and oversized coupon-code selections', () => {
    expect(() =>
      adminBookingCouponDeliverySchema.parse({ couponCodes: ['WELCOME-10', 'welcome-10'] }),
    ).toThrow();
    expect(() => adminBookingCouponDeliverySchema.parse({ couponCodes: [] })).toThrow();
    expect(() =>
      adminBookingCouponDeliverySchema.parse({
        couponCodes: Array.from(
          { length: 11 },
          (_, index) => `CODE-${index.toString().padStart(2, '0')}`,
        ),
      }),
    ).toThrow();
  });
});
