/**
 * Phase 8B exhaustive pricing verification using the INDEPENDENT oracle.
 *
 * For every reachable (local_minute, duration_minutes) pair across a range
 * of representative dates and non-monotonic configurations, the production
 * CHEAPEST_ELIGIBLE_THEN_PRIORITY selector must agree with the oracle's
 * cheapest total. Zero mismatches are required.
 */

import { describe, expect, it } from 'vitest';

import {
  calculatePricingWithStrategy,
  type PricingCatalog,
} from '../../src/pricing/pricing-engine.js';
import { auditEnumerate } from '../audit-phase8a/audit-independent-oracle.js';

function utcOf(localHour: number, localMinute: number, dayOfMonth = 22): string {
  const localMinutesOfDay = localHour * 60 + localMinute;
  const utcMinutesOfDay = (((localMinutesOfDay - 7 * 60) % (24 * 60)) + 24 * 60) % (24 * 60);
  const utcHour = Math.floor(utcMinutesOfDay / 60);
  const utcMinute = utcMinutesOfDay % 60;
  if (utcMinute % 15 !== 0) {
    throw new Error(`utcOf(${localHour},${localMinute}) produces non-15-minute UTC`);
  }
  const date = new Date(Date.UTC(2026, 6, dayOfMonth, utcHour, utcMinute));
  return date.toISOString();
}

interface CatalogFactoryOptions {
  readonly nonMonotonic?: boolean;
  readonly samePrice?: boolean;
}

function buildCatalog(options: CatalogFactoryOptions = {}): PricingCatalog {
  const threeHour = options.nonMonotonic ? 280_000 : 300_000;
  const lunch = options.nonMonotonic ? 200_000 : 359_000;
  const fiveHour = options.samePrice ? 300_000 : 450_000;
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
      prices: { TIER_1: threeHour, TIER_2: 360_000, TIER_3: 420_000 },
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
      prices: { TIER_1: fiveHour, TIER_2: 520_000, TIER_3: 590_000 },
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
      prices: { TIER_1: lunch, TIER_2: 419_000, TIER_3: 489_000 },
    },
    NIGHT_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 300,
      priority: 90,
      minCheckInMinuteInclusive: 1080,
      maxCheckInMinuteExclusive: 1440,
      minDurationMinutesInclusive: 315,
      maxDurationMinutesInclusive: 960,
      prices: { TIER_1: 600_000, TIER_2: 680_000, TIER_3: 760_000 },
    },
    DAY_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 1440,
      priority: 100,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 975,
      maxDurationMinutesInclusive: 1440,
      prices: { TIER_1: 800_000, TIER_2: 900_000, TIER_3: 1_000_000 },
    },
    EXTRA_HOUR: {
      status: 'ACTIVE',
      isBasePlan: false,
      includedDurationMinutes: 60,
      priority: 0,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: null,
      maxDurationMinutesInclusive: null,
      prices: { TIER_1: 100_000, TIER_2: 100_000, TIER_3: 100_000 },
    },
  };
}

interface Scenario {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly durationMinutes: number;
  readonly label: string;
}

function enumerateScenarios(
  dates: readonly { readonly day: number; readonly label: string }[],
): readonly Scenario[] {
  const out: Scenario[] = [];
  for (const date of dates) {
    for (let localMinute = 0; localMinute <= 23 * 60 + 45; localMinute += 15) {
      for (let dur = 60; dur <= 24 * 60; dur += 15) {
        const startUtc = utcOf(Math.floor(localMinute / 60), localMinute % 60, date.day);
        const startMs = new Date(startUtc).getTime();
        const endUtc = new Date(startMs + dur * 60_000).toISOString();
        out.push({
          checkIn: startUtc,
          checkOut: endUtc,
          durationMinutes: dur,
          label: `${date.label}@${localMinute}+${dur}`,
        });
      }
    }
  }
  return out;
}

const REPRESENTATIVE_DATES: ReadonlyArray<{ readonly day: number; readonly label: string }> = [
  { day: 22, label: 'ordinary' },
  { day: 31, label: 'month-end' },
  { day: 31, label: 'year-end-31-jul' },
];

describe('Phase 8B cheapest-eligible pricing oracle match', () => {
  it('matches the independent oracle across the standard grid', { timeout: 120_000 }, () => {
    const scenarios = enumerateScenarios(REPRESENTATIVE_DATES);
    const catalog = buildCatalog();
    let compared = 0;
    let mismatches = 0;
    const mismatchSamples: {
      label: string;
      productionPlan: string;
      oraclePlan: string;
      productionTotal: number;
      oracleTotal: number;
    }[] = [];
    for (const scenario of scenarios) {
      const production = calculatePricingWithStrategy(
        {
          checkIn: scenario.checkIn,
          checkOut: scenario.checkOut,
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        catalog,
        'CHEAPEST_ELIGIBLE_THEN_PRIORITY',
      );
      const oracle = auditEnumerate(
        {
          checkIn: scenario.checkIn,
          checkOut: scenario.checkOut,
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        catalog,
      );
      const oracleCheapest = oracle.candidates
        .slice()
        .sort((a, b) => a.totalAmountVnd - b.totalAmountVnd)[0];
      compared += 1;
      if (
        oracleCheapest === undefined ||
        production.totalAmountVnd !== oracleCheapest.totalAmountVnd
      ) {
        mismatches += 1;
        mismatchSamples.push({
          label: scenario.label,
          productionPlan: production.selectedPlanCode,
          oraclePlan: oracleCheapest?.planCode ?? 'NONE',
          productionTotal: production.totalAmountVnd,
          oracleTotal: oracleCheapest?.totalAmountVnd ?? 0,
        });
      }
    }
    if (mismatches > 0) {
      // eslint-disable-next-line no-console
      console.error('Phase 8B exhaustive mismatches (first 10):', mismatchSamples.slice(0, 10));
    }
    expect(mismatches).toBe(0);
    expect(compared).toBe(scenarios.length);
  });

  it('handles non-monotonic price configurations without diverging', { timeout: 120_000 }, () => {
    const scenarios = enumerateScenarios(REPRESENTATIVE_DATES);
    const catalog = buildCatalog({ nonMonotonic: true });
    let compared = 0;
    let mismatches = 0;
    for (const scenario of scenarios) {
      const production = calculatePricingWithStrategy(
        {
          checkIn: scenario.checkIn,
          checkOut: scenario.checkOut,
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        catalog,
        'CHEAPEST_ELIGIBLE_THEN_PRIORITY',
      );
      const oracle = auditEnumerate(
        {
          checkIn: scenario.checkIn,
          checkOut: scenario.checkOut,
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        catalog,
      );
      const oracleCheapest = oracle.candidates
        .slice()
        .sort((a, b) => a.totalAmountVnd - b.totalAmountVnd)[0];
      compared += 1;
      if (
        oracleCheapest !== undefined &&
        production.totalAmountVnd !== oracleCheapest.totalAmountVnd
      ) {
        mismatches += 1;
      }
    }
    expect(mismatches).toBe(0);
    expect(compared).toBe(scenarios.length);
  });

  it('handles equal-price configurations deterministically', { timeout: 120_000 }, () => {
    const scenarios = enumerateScenarios(REPRESENTATIVE_DATES);
    const catalog = buildCatalog({ samePrice: true });
    let compared = 0;
    let mismatches = 0;
    for (const scenario of scenarios) {
      const production = calculatePricingWithStrategy(
        {
          checkIn: scenario.checkIn,
          checkOut: scenario.checkOut,
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        catalog,
        'CHEAPEST_ELIGIBLE_THEN_PRIORITY',
      );
      const oracle = auditEnumerate(
        {
          checkIn: scenario.checkIn,
          checkOut: scenario.checkOut,
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        catalog,
      );
      const oracleCheapest = oracle.candidates
        .slice()
        .sort((a, b) => a.totalAmountVnd - b.totalAmountVnd)[0];
      compared += 1;
      if (
        oracleCheapest !== undefined &&
        production.totalAmountVnd !== oracleCheapest.totalAmountVnd
      ) {
        mismatches += 1;
      }
    }
    expect(mismatches).toBe(0);
    expect(compared).toBe(scenarios.length);
  });
});
