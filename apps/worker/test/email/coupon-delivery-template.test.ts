import { describe, expect, it } from 'vitest';

import { renderCouponDelivery } from '../../src/email/templates/coupon-delivery.js';

describe('renderCouponDelivery', () => {
  it('renders persisted coupon codes without a payment or login link', () => {
    const rendered = renderCouponDelivery({
      bookingCode: 'BOOK-2026',
      propertyName: 'Main Hotel',
      couponCodes: ['WELCOME-10', 'VIP-2026'],
    });

    expect(rendered.subject).toContain('BOOK-2026');
    expect(rendered.text).toContain('WELCOME-10');
    expect(rendered.html).toContain('VIP-2026');
    expect(rendered.html).not.toMatch(/https?:\/\//i);
  });
});
