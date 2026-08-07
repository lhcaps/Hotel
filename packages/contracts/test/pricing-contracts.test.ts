import { describe, expect, it } from 'vitest';

import {
  availabilitySearchRequestSchema,
  createQuoteRequestSchema,
  multiNightIntentSchema,
  pricingBreakdownSchema,
  quoteSchema,
} from '../src/index.js';

const interval = {
  checkIn: '2026-07-22T11:00:00+07:00',
  checkOut: '2026-07-22T14:00:00+07:00',
};

describe('pricing and availability contracts', () => {
  it('accepts exact arbitrary minutes and seconds and rejects unsafe intervals', () => {
    expect(availabilitySearchRequestSchema.parse({ ...interval, adults: 1, children: 0 })).toEqual({
      ...interval,
      adults: 1,
      children: 0,
    });
    expect(
      availabilitySearchRequestSchema.parse({
        ...interval,
        checkIn: '2026-07-22T11:07:17+07:00',
        checkOut: '2026-07-22T14:22:46+07:00',
        adults: 1,
        children: 0,
      }),
    ).toMatchObject({
      checkIn: '2026-07-22T11:07:17+07:00',
      checkOut: '2026-07-22T14:22:46+07:00',
    });
    expect(
      availabilitySearchRequestSchema.parse({
        ...interval,
        checkOut: '2026-07-23T12:00:00+07:00',
        adults: 1,
        children: 0,
      }),
    ).toMatchObject({ checkOut: '2026-07-23T12:00:00+07:00' });
    expect(() =>
      availabilitySearchRequestSchema.parse({
        ...interval,
        checkOut: '2026-08-23T12:00:00+07:00',
        adults: 1,
        children: 0,
      }),
    ).toThrow();
  });

  it('keeps the existing overnight public literal and accepts the additive multi-night literal', () => {
    expect(
      availabilitySearchRequestSchema.parse({
        checkIn: '2026-07-22T21:00:00+07:00',
        checkOut: '2026-07-23T09:00:00+07:00',
        mode: 'overnight',
        adults: 1,
        children: 0,
      }).mode,
    ).toBe('overnight');
    expect(
      availabilitySearchRequestSchema.parse({
        ...interval,
        mode: 'overnight',
        adults: 1,
        children: 0,
      }),
    ).toMatchObject({ mode: 'overnight', ...interval });
    expect(
      availabilitySearchRequestSchema.parse({
        checkIn: '2026-07-22T21:00:00+07:00',
        checkOut: '2026-07-24T09:00:00+07:00',
        mode: 'multi_night',
        adults: 1,
        children: 0,
      }),
    ).toMatchObject({ mode: 'multi_night' });
  });

  it('represents additive multi-night intervals across calendar boundaries', () => {
    const intervals = [
      ['two nights', '2026-07-22T21:00:00+07:00', '2026-07-24T09:00:00+07:00'],
      ['three nights', '2026-07-22T21:00:00+07:00', '2026-07-25T09:00:00+07:00'],
      ['cross month', '2026-07-31T21:00:00+07:00', '2026-08-02T09:00:00+07:00'],
      ['cross year', '2026-12-31T21:00:00+07:00', '2027-01-02T09:00:00+07:00'],
      ['leap year', '2028-02-28T21:00:00+07:00', '2028-03-01T09:00:00+07:00'],
    ] as const;

    for (const [, checkIn, checkOut] of intervals) {
      expect(
        multiNightIntentSchema.parse({
          checkIn,
          checkOut,
          mode: 'multi_night',
          adults: 1,
          children: 0,
        }),
      ).toMatchObject({ checkIn, checkOut, mode: 'multi_night' });
    }
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
    for (const field of [
      'nightCount',
      'durationMinutes',
      'displayNightCount',
      'pricingComponents',
      'role',
      'physicalRoomId',
      'physicalRoomCode',
    ]) {
      expect(() =>
        createQuoteRequestSchema.parse({
          ...interval,
          roomTypeId: '550e8400-e29b-41d4-a716-446655440000',
          adults: 1,
          children: 0,
          [field]: field === 'pricingComponents' ? [] : 1,
        }),
      ).toThrow();
    }
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
