import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BookingHoldCouponSummary, CouponQuoteSummary } from '@room/contracts';

import { CouponSummary } from '../src/components/coupon-summary';
import { LocaleProvider } from '../src/components/locale-provider';

const FIXED: BookingHoldCouponSummary = {
  code: 'SUMMER-50K',
  discountType: 'FIXED',
  grossAmountVnd: 359000,
  discountAmountVnd: 50000,
  finalAmountVnd: 309000,
};

const PERCENTAGE: CouponQuoteSummary = {
  code: 'PCT-25PCT',
  discountType: 'PERCENTAGE',
  grossAmountVnd: 500000,
  discountAmountVnd: 125000,
  finalAmountVnd: 375000,
  revalidationNotice: 'Coupon discount is provisional; quota revalidated at HOLD.',
};

describe('CouponSummary', () => {
  it('renders English discount and total labels while preserving the coupon code', () => {
    render(
      <LocaleProvider locale="en">
        <CouponSummary coupon={FIXED} />
      </LocaleProvider>,
    );

    const summary = screen.getByTestId('coupon-summary');
    expect(summary).toHaveTextContent('Coupon code: SUMMER-50K');
    expect(summary).toHaveTextContent('Fixed discount');
    expect(summary).toHaveTextContent('Final total');
    expect(summary).not.toHaveTextContent('Mã giảm giá');
  });

  it('renders server-provided code, gross, discount, and final amounts', () => {
    render(<CouponSummary coupon={FIXED} />);
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('SUMMER-50K');
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('359.000');
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('50.000');
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('309.000');
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('Giảm cố định');
  });

  it('labels percentage discounts in Vietnamese and shows the revalidation notice when requested', () => {
    render(<CouponSummary coupon={PERCENTAGE} showRevalidationNotice />);
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('Giảm theo phần trăm');
    const notice = screen.getByTestId('coupon-revalidation-notice');
    expect(notice).toHaveTextContent(/provisional/i);
  });

  it('does not leak internal UUIDs, digests, or quota fields', () => {
    render(<CouponSummary coupon={FIXED} />);
    const text = screen.getByTestId('coupon-summary').textContent ?? '';
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    expect(text).not.toMatch(/digest|quota|uuid/i);
    expect(text).not.toContain('@');
  });
});
