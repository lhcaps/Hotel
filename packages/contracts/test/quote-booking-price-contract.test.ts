import { describe, expect, it } from 'vitest';

import { bookingHoldResponseSchema, pricingBreakdownSchema, quoteSchema } from '../src/index.js';

const interval = {
  checkIn: '2026-07-22T11:00:00+07:00',
  checkOut: '2026-07-22T14:00:00+07:00',
};

const pricingFixture = {
  ruleVersion: 'phase-4-pricing-availability-v1',
  selectedPlanCode: 'LUNCH_COMBO',
  basePlanCode: 'LUNCH_COMBO',
  baseMinutes: 180,
  extraUnits: 0,
  baseAmountVnd: 359000,
  extraAmountVnd: 0,
  totalAmountVnd: 359000,
  lineItems: [{ code: 'LUNCH_COMBO', amountVnd: 359000, units: 1 }],
} as const;

const quoteFixture = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  roomTypeId: '550e8400-e29b-41d4-a716-446655440001',
  roomTypeName: 'Deluxe',
  checkIn: interval.checkIn,
  checkOut: interval.checkOut,
  adults: 2,
  children: 0,
  expiresAt: '2026-07-22T11:15:00+07:00',
  pricing: pricingFixture,
};

describe('Phase 4 to Phase 5 price contract', () => {
  it('uses the same pricingBreakdown shape for quote and (implicitly) for booking HOLD', () => {
    const parsedPricing = pricingBreakdownSchema.parse(pricingFixture);
    expect(parsedPricing.totalAmountVnd).toBe(
      parsedPricing.baseAmountVnd + parsedPricing.extraAmountVnd,
    );
    expect(parsedPricing.lineItems.reduce((sum, line) => sum + line.amountVnd, 0)).toBe(
      parsedPricing.totalAmountVnd,
    );
  });

  it('locks pricing.ruleVersion to the Phase 4 plan id', () => {
    expect(() =>
      pricingBreakdownSchema.parse({
        ...pricingFixture,
        ruleVersion: 'phase-5-some-other-version',
      }),
    ).toThrow();
  });

  it('quote response carries the canonical pricing snapshot', () => {
    const parsedQuote = quoteSchema.parse(quoteFixture);
    expect(parsedQuote.pricing.ruleVersion).toBe('phase-4-pricing-availability-v1');
    expect(parsedQuote.pricing.totalAmountVnd).toBe(pricingFixture.totalAmountVnd);
    expect(parsedQuote.pricing.basePlanCode).toBe(pricingFixture.basePlanCode);
  });

  it('booking HOLD response uses VND integer amount derived from the immutable quote', () => {
    const parsedQuote = quoteSchema.parse(quoteFixture);
    const parsedBookingHold = bookingHoldResponseSchema.parse({
      bookingId: '550e8400-e29b-41d4-a716-446655440010',
      bookingCode: 'AB12CD34EF',
      status: 'HOLD',
      checkIn: parsedQuote.checkIn,
      checkOut: parsedQuote.checkOut,
      holdExpiresAt: '2026-07-22T11:15:00+07:00',
      amountVnd: parsedQuote.pricing.totalAmountVnd,
      currency: 'VND',
      idempotent: false,
    });
    expect(parsedBookingHold.amountVnd).toBe(parsedQuote.pricing.totalAmountVnd);
    expect(parsedBookingHold.currency).toBe('VND');
  });

  it('rejects any non-VND currency override in the booking HOLD response shape', () => {
    expect(() =>
      bookingHoldResponseSchema.parse({
        bookingId: '550e8400-e29b-41d4-a716-446655440010',
        bookingCode: 'AB12CD34EF',
        status: 'HOLD',
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        holdExpiresAt: '2026-07-22T11:15:00+07:00',
        amountVnd: 359000,
        currency: 'USD',
        idempotent: false,
      }),
    ).toThrow();
  });

  it('rejects a non-integer amount in the booking HOLD response shape', () => {
    expect(() =>
      bookingHoldResponseSchema.parse({
        bookingId: '550e8400-e29b-41d4-a716-446655440010',
        bookingCode: 'AB12CD34EF',
        status: 'HOLD',
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        holdExpiresAt: '2026-07-22T11:15:00+07:00',
        amountVnd: 359000.5,
        currency: 'VND',
        idempotent: false,
      }),
    ).toThrow();
  });

  it('does not expose any fallback price or repricing field in either contract', () => {
    expect(Object.keys(pricingBreakdownSchema.shape).sort()).not.toContain('fallbackPrice');
    expect(Object.keys(pricingBreakdownSchema.shape).sort()).not.toContain('originalPrice');
    expect(Object.keys(pricingBreakdownSchema.shape).sort()).not.toContain('clientOverride');
    expect(Object.keys(quoteSchema.shape).sort()).not.toContain('fallbackPrice');
    expect(Object.keys(quoteSchema.shape).sort()).not.toContain('originalPrice');
    expect(Object.keys(bookingHoldResponseSchema.shape).sort()).not.toContain('fallbackPrice');
    expect(Object.keys(bookingHoldResponseSchema.shape).sort()).not.toContain('originalPrice');
  });
});
