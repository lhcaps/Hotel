import { describe, expect, it } from 'vitest';

import {
  availabilitySearchRequestSchema,
  createQuoteRequestSchema,
  pricingBreakdownSchema,
  quoteSchema,
} from '../src/index.js';

const interval = {
  checkIn: '2026-07-22T11:00:00+07:00',
  checkOut: '2026-07-22T14:00:00+07:00',
};

describe('pricing and availability contracts', () => {
  it('accepts a quarter-hour public availability request and rejects unsafe inputs', () => {
    expect(availabilitySearchRequestSchema.parse({ ...interval, adults: 1, children: 0 })).toEqual({
      ...interval,
      adults: 1,
      children: 0,
    });
    expect(() =>
      availabilitySearchRequestSchema.parse({
        ...interval,
        checkIn: '2026-07-22T11:07:00+07:00',
        adults: 1,
        children: 0,
      }),
    ).toThrow();
    expect(() =>
      availabilitySearchRequestSchema.parse({
        ...interval,
        checkOut: '2026-07-23T12:00:00+07:00',
        adults: 1,
        children: 0,
      }),
    ).toThrow();
  });

  it('accepts only server-authoritative quote inputs', () => {
    expect(
      createQuoteRequestSchema.parse({
        ...interval,
        roomTypeId: '550e8400-e29b-41d4-a716-446655440000',
        adults: 1,
        children: 0,
      }),
    ).toMatchObject({ roomTypeId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(() =>
      createQuoteRequestSchema.parse({
        ...interval,
        roomTypeId: '550e8400-e29b-41d4-a716-446655440000',
        adults: 1,
        children: 0,
        totalAmountVnd: 1,
      }),
    ).toThrow();
  });

  it('requires integer VND totals and exposes no physical room data', () => {
    const pricing = pricingBreakdownSchema.parse({
      ruleVersion: 'phase-4-pricing-availability-v1',
      selectedPlanCode: 'LUNCH_COMBO',
      basePlanCode: 'LUNCH_COMBO',
      baseMinutes: 180,
      extraUnits: 0,
      baseAmountVnd: 359000,
      extraAmountVnd: 0,
      totalAmountVnd: 359000,
      lineItems: [{ code: 'LUNCH_COMBO', amountVnd: 359000, units: 1 }],
    });
    expect(pricing.totalAmountVnd).toBe(359000);
    expect(() => pricingBreakdownSchema.parse({ ...pricing, totalAmountVnd: 359000.5 })).toThrow();
    expect(() =>
      pricingBreakdownSchema.parse({
        ...pricing,
        selectedPlanCode: 'EXTRA_HOUR',
        basePlanCode: 'EXTRA_HOUR',
      }),
    ).toThrow();
    expect(() =>
      pricingBreakdownSchema.parse({
        ...pricing,
        lineItems: [{ code: 'LUNCH_COMBO', amountVnd: 1, units: 1 }],
      }),
    ).toThrow();
    expect(() =>
      pricingBreakdownSchema.parse({
        ...pricing,
        extraUnits: 1,
        extraAmountVnd: 100000,
        totalAmountVnd: 459000,
        lineItems: [
          { code: 'LUNCH_COMBO', amountVnd: 359000, units: 1 },
          { code: 'EXTRA_HOUR', amountVnd: 100000, units: 2 },
        ],
      }),
    ).toThrow();

    expect(() =>
      quoteSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        roomTypeId: '550e8400-e29b-41d4-a716-446655440001',
        roomTypeName: 'Standard',
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        adults: 1,
        children: 0,
        expiresAt: '2026-07-22T11:15:00+07:00',
        pricing,
        roomNumber: '101',
      }),
    ).toThrow();
  });
});
