import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@room/contracts';

import { QuoteSummary } from '../src/components/quote-summary';
import { LocaleProvider } from '../src/components/locale-provider';

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-id-1',
    roomTypeId: '11111111-1111-4111-8111-111111111111',
    roomTypeName: 'Deluxe',
    checkIn: '2027-01-10T03:00:00.000Z',
    checkOut: '2027-01-10T06:00:00.000Z',
    adults: 2,
    children: 0,
    expiresAt: '2027-01-10T02:15:00.000Z',
    pricing: {
      ruleVersion: 'phase-4-pricing-availability-v1',
      selectedPlanCode: 'THREE_HOUR_COMBO',
      basePlanCode: 'THREE_HOUR_COMBO',
      baseMinutes: 180,
      extraUnits: 0,
      baseAmountVnd: 359000,
      extraAmountVnd: 0,
      totalAmountVnd: 359000,
      lineItems: [{ code: 'THREE_HOUR_COMBO', amountVnd: 359000, units: 1 }],
    },
    ...overrides,
  };
}

describe('QuoteSummary', () => {
  it('renders English labels and customer-facing plan labels without internal plan codes', () => {
    render(
      <LocaleProvider locale="en">
        <QuoteSummary quote={makeQuote()} />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Quote Deluxe' })).toBeInTheDocument();
    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getAllByText('3-hour stay')).not.toHaveLength(0);
    expect(document.body.textContent).not.toContain('THREE_HOUR_COMBO');
    expect(document.body.textContent).not.toContain('Tổng cộng');
  });

  it('renders only the gross total when no coupon is applied', () => {
    render(<QuoteSummary quote={makeQuote()} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Tổng cộng:');
    expect(text).toContain('359.000');
    expect(text).not.toContain('Sau mã giảm giá:');
  });

  it('renders gross and discounted amounts when a coupon is applied', () => {
    render(
      <QuoteSummary
        quote={makeQuote({
          pricing: {
            ruleVersion: 'phase-4-pricing-availability-v1',
            selectedPlanCode: 'THREE_HOUR_COMBO',
            basePlanCode: 'THREE_HOUR_COMBO',
            baseMinutes: 180,
            extraUnits: 0,
            baseAmountVnd: 359000,
            extraAmountVnd: 0,
            totalAmountVnd: 359000,
            lineItems: [{ code: 'THREE_HOUR_COMBO', amountVnd: 359000, units: 1 }],
          },
          coupon: {
            code: 'SUMMER-50K',
            discountType: 'FIXED',
            grossAmountVnd: 359000,
            discountAmountVnd: 50000,
            finalAmountVnd: 309000,
            revalidationNotice: 'Coupon discount is provisional.',
          },
        })}
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain('Tổng gốc:');
    expect(text).toContain('Sau mã giảm giá:');
    expect(text).toContain('309.000');
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('SUMMER-50K');
  });

  it('does not display any internal UUID, digest, or quota fields', () => {
    render(
      <QuoteSummary
        quote={makeQuote({
          coupon: {
            code: 'SUMMER-50K',
            discountType: 'FIXED',
            grossAmountVnd: 359000,
            discountAmountVnd: 50000,
            finalAmountVnd: 309000,
            revalidationNotice: 'provisional',
          },
        })}
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    expect(text).not.toMatch(/digest|quota/i);
  });
});
