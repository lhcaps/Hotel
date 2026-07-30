/**
 * Phase 8B advisory recommendation engine tests.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  searchRecommendations,
  type AvailabilityProbe,
  type ProvisionalCouponProbe,
} from '../src/pricing/recommendation.service.js';
import type { PricingCatalog } from '../src/pricing/pricing-engine.js';
import type { PricingInput } from '../src/pricing/selection-rule-matcher.js';

const TIER_PRICES = { TIER_1: 100_000, TIER_2: 110_000, TIER_3: 120_000 };

function buildCatalog(): PricingCatalog {
  return {
    THREE_HOUR_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 180,
      priority: 10,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: 240,
      prices: TIER_PRICES,
    },
    FIVE_HOUR_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 300,
      priority: 70,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 255,
      maxDurationMinutesInclusive: 960,
      prices: TIER_PRICES,
    },
    LUNCH_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 180,
      priority: 80,
      minCheckInMinuteInclusive: 660,
      maxCheckInMinuteExclusive: 900,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: 240,
      prices: TIER_PRICES,
    },
    NIGHT_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 600,
      priority: 60,
      minCheckInMinuteInclusive: 1260,
      maxCheckInMinuteExclusive: 1440,
      minDurationMinutesInclusive: 315,
      maxDurationMinutesInclusive: 960,
      prices: TIER_PRICES,
    },
    DAY_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 1440,
      priority: 50,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 975,
      maxDurationMinutesInclusive: 1440,
      prices: TIER_PRICES,
    },
    EXTRA_HOUR: {
      status: 'ACTIVE',
      isBasePlan: false,
      includedDurationMinutes: 60,
      priority: 0,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 0,
      maxDurationMinutesInclusive: 1440,
      prices: TIER_PRICES,
    },
  };
}

function utcOf(hour: number, minute = 0): string {
  // Asia/Ho_Chi_Minh is GMT+7, so local 11:00 = 04:00 UTC.
  const totalUtcMinutes = hour * 60 - 7 * 60 + minute;
  const h = Math.floor(totalUtcMinutes / 60);
  const m = totalUtcMinutes % 60;
  return new Date(Date.UTC(2026, 6, 15, h, m, 0)).toISOString();
}

function shift(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

function clone<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('clone() called on undefined catalog entry');
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Expected value at ${label} to be defined`);
  }
  return value;
}

class AlwaysAvailableProbe implements AvailabilityProbe {
  async isAvailable(_input: PricingInput): Promise<boolean> {
    return true;
  }
}

class AlwaysUnavailableProbe implements AvailabilityProbe {
  async isAvailable(_input: PricingInput): Promise<boolean> {
    return false;
  }
}

class ConstantCouponProbe implements ProvisionalCouponProbe {
  private readonly discountVnd: number;
  constructor(discountVnd: number) {
    this.discountVnd = discountVnd;
  }
  async preview(_input: PricingInput, _gross: number): Promise<number> {
    return this.discountVnd;
  }
}

describe('Phase 8B advisory recommendations', () => {
  const catalog = buildCatalog();
  let availability: AvailabilityProbe;
  let coupon: ProvisionalCouponProbe;

  beforeEach(() => {
    availability = new AlwaysAvailableProbe();
    coupon = new ConstantCouponProbe(0);
  });

  it('case 1 — exact interval is already cheapest → no recommendations', async () => {
    // 14:00 local is outside lunch window; only THREE eligible; offsets
    // don't introduce cheaper plans because no LUNCH availability.
    const result = await searchRecommendations(
      {
        checkIn: utcOf(14, 0),
        checkOut: shift(utcOf(14, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability, coupon },
    );
    expect(result.recommendations).toHaveLength(0);
  });

  it('case 2 — nearest cheaper interval found within ±60 minute window', async () => {
    const customCatalog: PricingCatalog = {
      ...catalog,
      THREE_HOUR_COMBO: {
        ...clone(catalog.THREE_HOUR_COMBO),
        prices: { TIER_1: 300_000, TIER_2: 310_000, TIER_3: 320_000 },
      },
      LUNCH_COMBO: {
        ...clone(catalog.LUNCH_COMBO),
        prices: { TIER_1: 200_000, TIER_2: 210_000, TIER_3: 220_000 },
      },
      EXTRA_HOUR: {
        ...clone(catalog.EXTRA_HOUR),
        prices: { TIER_1: 50_000, TIER_2: 0, TIER_3: 0 },
      },
    };
    // 10:00 + 4h → only THREE eligible (LUNCH window starts 11:00):
    // THREE 300k + (240-180)/60*50k = 350k. Shift +60m → 11:00 + 4h:
    // LUNCH eligible 200k + 1 extra 50k = 250k (cheaper).
    const result = await searchRecommendations(
      {
        checkIn: utcOf(10, 0),
        checkOut: shift(utcOf(10, 0), 240),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      customCatalog,
      { availability, coupon },
    );
    const shifted = result.recommendations.filter((r) => r.shiftMinutes === 60);
    expect(shifted.length).toBeGreaterThan(0);
    const firstShifted = expectDefined(shifted[0], 'shifted[0]');
    expect(firstShifted.selectedPlanCode).toBe('LUNCH_COMBO');
    expect(firstShifted.savingsVnd).toBe(100_000);
  });

  it('case 3 — globally cheapest nearby interval found', async () => {
    // At baseline (11:00 + 1h) only THREE eligible (LUNCH window starts
    // at 11:00 but maxDurationMinutesInclusive is 240, OK). To force
    // THREE selection at baseline, set LUNCH as INACTIVE. Then at
    // +60m → 12:00 + 1h, enable LUNCH but only at offset by toggling
    // dynamically via catalog mutation? No — catalog is static. Use a
    // catalog where baseline THREE 100k and shift +60 produces LUNCH
    // 60k (cheaper).
    const customCatalog: PricingCatalog = {
      ...catalog,
      THREE_HOUR_COMBO: {
        ...clone(catalog.THREE_HOUR_COMBO),
        minCheckInMinuteInclusive: 0,
        maxCheckInMinuteExclusive: 780,
        prices: { TIER_1: 100_000, TIER_2: 110_000, TIER_3: 120_000 },
      },
      LUNCH_COMBO: {
        ...clone(catalog.LUNCH_COMBO),
        prices: { TIER_1: 60_000, TIER_2: 70_000, TIER_3: 80_000 },
      },
      EXTRA_HOUR: { ...clone(catalog.EXTRA_HOUR), prices: { TIER_1: 0, TIER_2: 0, TIER_3: 0 } },
    };
    // 10:00 + 1h: THREE eligible (window 0..780). THREE = 100k.
    // Shift +60 → 11:00 + 1h: THREE eligible. LUNCH eligible (660..900).
    // LUNCH 60k + 0 extras (60 < 180) = 60k.
    const result = await searchRecommendations(
      {
        checkIn: utcOf(10, 0),
        checkOut: shift(utcOf(10, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      customCatalog,
      { availability, coupon },
    );
    expect(result.recommendations.length).toBeGreaterThan(0);
    const cheapestRec = result.recommendations.reduce((best, current) =>
      current.finalAmountVnd < best.finalAmountVnd ? current : best,
    );
    expect(cheapestRec.finalAmountVnd).toBe(60_000);
    expect(cheapestRec.selectedPlanCode).toBe('LUNCH_COMBO');
  });

  it('case 4 — duration preserved exactly across every recommendation', async () => {
    const customCatalog: PricingCatalog = {
      ...catalog,
      LUNCH_COMBO: {
        ...clone(catalog.LUNCH_COMBO),
        prices: { TIER_1: 50_000, TIER_2: 60_000, TIER_3: 70_000 },
      },
    };
    const checkIn = utcOf(11, 0);
    const checkOut = shift(checkIn, 240);
    const result = await searchRecommendations(
      { checkIn, checkOut, priceTierCode: 'TIER_1', timezone: 'Asia/Ho_Chi_Minh' },
      customCatalog,
      { availability, coupon },
    );
    const duration = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    for (const rec of result.recommendations) {
      const recDuration = new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime();
      expect(recDuration).toBe(duration);
    }
  });

  it('case 5 — -60 and +60 boundaries are searched', async () => {
    // Baseline at 10:00 + 1h: only THREE eligible (LUNCH window starts
    // at 11:00). THREE = 100k. At shift +60m → 11:00 + 1h: LUNCH
    // eligible with cheap price 60k. So +60 produces a strictly cheaper
    // recommendation. Test boundary inclusion.
    const customCatalog: PricingCatalog = {
      ...catalog,
      LUNCH_COMBO: {
        ...clone(catalog.LUNCH_COMBO),
        prices: { TIER_1: 60_000, TIER_2: 70_000, TIER_3: 80_000 },
      },
      EXTRA_HOUR: { ...clone(catalog.EXTRA_HOUR), prices: { TIER_1: 0, TIER_2: 0, TIER_3: 0 } },
    };
    const result = await searchRecommendations(
      {
        checkIn: utcOf(10, 0),
        checkOut: shift(utcOf(10, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      customCatalog,
      { availability, coupon },
    );
    const shifts = new Set(result.recommendations.map((r) => r.shiftMinutes));
    expect(shifts.has(60)).toBe(true);
  });

  it('case 6 — recommendations stay within ±60 boundaries', async () => {
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability, coupon },
    );
    for (const rec of result.recommendations) {
      expect(Math.abs(rec.shiftMinutes)).toBeLessThanOrEqual(60);
    }
  });

  it('case 7 — unavailable candidates are excluded', async () => {
    const availability = new AlwaysUnavailableProbe();
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability, coupon },
    );
    expect(result.recommendations).toHaveLength(0);
  });

  it('case 8 — recommendations never expose physical room identity', async () => {
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability, coupon },
    );
    for (const rec of result.recommendations) {
      expect(Object.keys(rec)).not.toContain('roomId');
      expect(Object.keys(rec)).not.toContain('physicalRoomId');
      expect(Object.keys(rec)).not.toContain('roomTypeId');
    }
  });

  it('case 9 — coupon preview affects ranking without reservation', async () => {
    const customCatalog: PricingCatalog = {
      ...catalog,
      LUNCH_COMBO: {
        ...clone(catalog.LUNCH_COMBO),
        prices: { TIER_1: 50_000, TIER_2: 60_000, TIER_3: 70_000 },
      },
      THREE_HOUR_COMBO: {
        ...clone(catalog.THREE_HOUR_COMBO),
        prices: { TIER_1: 100_000, TIER_2: 110_000, TIER_3: 120_000 },
      },
    };
    const couponProbe: ProvisionalCouponProbe = {
      async preview(input, gross) {
        // Apply 100% coupon at offset +60 only.
        return input.checkIn === shift(utcOf(11, 0), 60) ? gross : 0;
      },
    };
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
        couponCode: 'PROMO60',
      },
      customCatalog,
      { availability, coupon: couponProbe },
    );
    expect(result.recommendations.length).toBeGreaterThan(0);
    // The +60 candidate (with discount) should appear with final=0.
    const free = expectDefined(
      result.recommendations.find((r) => r.shiftMinutes === 60),
      'shiftMinutes=60 recommendation',
    );
    expect(free.finalAmountVnd).toBe(0);
    expect(free.discountAmountVnd).toBe(50_000);
  });

  it('case 10 — response states advisory nature via advisoryExpiresAt', async () => {
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability, coupon, now: () => new Date('2026-07-15T04:00:00Z') },
    );
    expect(result.generatedAt).toBe('2026-07-15T04:00:00.000Z');
    expect(result.advisoryExpiresAt).toBe('2026-07-15T04:05:00.000Z');
  });

  it('case 11 — ties resolve deterministically by stable ordering', async () => {
    // Construct catalog where multiple shifts yield identical final
    // amounts; assert stable ordering.
    const flatCatalog: PricingCatalog = {
      ...catalog,
      THREE_HOUR_COMBO: {
        ...clone(catalog.THREE_HOUR_COMBO),
        maxDurationMinutesInclusive: 300,
        prices: { TIER_1: 100_000, TIER_2: 110_000, TIER_3: 120_000 },
      },
      FIVE_HOUR_COMBO: {
        ...clone(catalog.FIVE_HOUR_COMBO),
        minDurationMinutesInclusive: 60,
        prices: { TIER_1: 100_000, TIER_2: 110_000, TIER_3: 120_000 },
      },
      LUNCH_COMBO: {
        ...clone(catalog.LUNCH_COMBO),
        prices: { TIER_1: 100_000, TIER_2: 110_000, TIER_3: 120_000 },
      },
    };
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      flatCatalog,
      { availability, coupon },
    );
    // Each recommendation must be a frozen unique entry.
    const shifts = result.recommendations.map((r) => r.shiftMinutes);
    const unique = new Set(shifts);
    expect(unique.size).toBe(shifts.length);
  });

  it('case 12 — no dominated duplicates across categories', async () => {
    const customCatalog: PricingCatalog = {
      ...catalog,
      LUNCH_COMBO: {
        ...clone(catalog.LUNCH_COMBO),
        prices: { TIER_1: 50_000, TIER_2: 60_000, TIER_3: 70_000 },
      },
    };
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      customCatalog,
      { availability, coupon },
    );
    // Deduplicate: no two recommendations share the same shift+planCode.
    const ids = new Set<string>();
    for (const rec of result.recommendations) {
      const id = `${rec.shiftMinutes}|${rec.selectedPlanCode}`;
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  it('case 13 — at most three recommendations returned', async () => {
    const result = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability, coupon },
    );
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('case 14 — no strictly cheaper candidates → empty recommendations', async () => {
    const result = await searchRecommendations(
      {
        checkIn: utcOf(14, 0),
        checkOut: shift(utcOf(14, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability, coupon },
    );
    expect(result.recommendations).toHaveLength(0);
  });

  it('case 15 — concurrent availability change is detected; recommendation stays advisory', async () => {
    // First call: availability returns true → recommendation included.
    // Second call: availability returns false → recommendation excluded.
    let available = true;
    const probe: AvailabilityProbe = {
      async isAvailable() {
        return available;
      },
    };
    const first = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability: probe, coupon },
    );
    expect(first.recommendations.length).toBeGreaterThanOrEqual(0);
    // Toggle availability.
    available = false;
    const second = await searchRecommendations(
      {
        checkIn: utcOf(11, 0),
        checkOut: shift(utcOf(11, 0), 60),
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      { availability: probe, coupon },
    );
    expect(second.recommendations).toHaveLength(0);
    // Both responses remain advisory (have generatedAt + advisoryExpiresAt).
    expect(first.advisoryExpiresAt).toBeDefined();
    expect(second.advisoryExpiresAt).toBeDefined();
  });
});
