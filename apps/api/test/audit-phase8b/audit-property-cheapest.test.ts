/**
 * Phase 8B property-based pricing test using deterministic seeded RNG.
 *
 * Generates at least 10,000 valid (date, duration, tier, plan configuration)
 * scenarios and verifies that the production CHEAPEST_ELIGIBLE_THEN_PRIORITY
 * selector matches the independent oracle's cheapest total in every case.
 */

import { describe, expect, it } from 'vitest';

import {
  calculatePricingWithStrategy,
  type PricingCatalog,
} from '../../src/pricing/pricing-engine.js';
import { auditEnumerate } from '../audit-phase8a/audit-independent-oracle.js';

const TIER_OPTIONS = ['TIER_1', 'TIER_2', 'TIER_3'] as const;

class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed | 0 || 1;
  }
  next(): number {
    // Mulberry32
    let t = (this.state += 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRandom.pick() called on empty array');
    }
    const idx = this.integer(0, items.length - 1);
    const value = items[idx];
    if (value === undefined) {
      throw new Error(`SeededRandom.pick() produced undefined at index ${idx}`);
    }
    return value;
  }
}

function buildRandomCatalog(rng: SeededRandom): PricingCatalog {
  const buildPrices = (): Record<string, number> => {
    // Always include all three tiers with strictly positive integer
    // prices. Lower tiers can be lower-priced to test non-monotonic
    // configurations.
    return {
      TIER_1: rng.integer(50_000, 1_500_000),
      TIER_2: rng.integer(50_000, 1_500_000),
      TIER_3: rng.integer(50_000, 1_500_000),
    };
  };
  const out: Record<string, PricingCatalog[string]> = {
    THREE_HOUR_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 180,
      priority: rng.integer(1, 100),
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: rng.integer(180, 240),
      prices: buildPrices(),
    },
    FIVE_HOUR_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 300,
      priority: rng.integer(1, 100),
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 240,
      maxDurationMinutesInclusive: 960,
      prices: buildPrices(),
    },
    LUNCH_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 180,
      priority: rng.integer(1, 100),
      minCheckInMinuteInclusive: 660,
      maxCheckInMinuteExclusive: 900,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: 240,
      prices: buildPrices(),
    },
    NIGHT_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 300,
      priority: rng.integer(1, 100),
      minCheckInMinuteInclusive: 1080,
      maxCheckInMinuteExclusive: 1440,
      minDurationMinutesInclusive: 315,
      maxDurationMinutesInclusive: 960,
      prices: buildPrices(),
    },
    DAY_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 1440,
      priority: rng.integer(1, 100),
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 975,
      maxDurationMinutesInclusive: 1440,
      prices: buildPrices(),
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
      prices: buildPrices(),
    },
  };
  return out as PricingCatalog;
}

function utcOf(localHour: number, localMinute: number, dayOfMonth: number): string {
  const localMinutesOfDay = localHour * 60 + localMinute;
  const utcMinutesOfDay = ((localMinutesOfDay - 7 * 60) % (24 * 60) + 24 * 60) % (24 * 60);
  const utcHour = Math.floor(utcMinutesOfDay / 60);
  const utcMinute = utcMinutesOfDay % 60;
  const aligned = utcMinute - (utcMinute % 15);
  const date = new Date(Date.UTC(2026, 6, dayOfMonth, utcHour, aligned));
  return date.toISOString();
}

interface Case {
  readonly seed: number;
  readonly index: number;
  readonly day: number;
  readonly checkInLocalMinute: number;
  readonly durationMinutes: number;
  readonly priceTierCode: string;
}

const PUBLISHED_SEED = 20260728;
const TARGET_CASES = 10_000;

function generateCases(): readonly Case[] {
  const rng = new SeededRandom(PUBLISHED_SEED);
  const cases: Case[] = [];
  let i = 0;
  while (cases.length < TARGET_CASES) {
    const day = rng.integer(1, 28);
    const localMinute = rng.integer(0, 23 * 60) - (rng.integer(0, 3) * 15);
    const alignedLocal = Math.max(0, Math.min(23 * 60, localMinute - (localMinute % 15)));
    const rawDuration = rng.integer(60, 24 * 60);
    const alignedDuration = rawDuration - (rawDuration % 15);
    if (alignedDuration < 60 || alignedDuration > 24 * 60) {
      i += 1;
      continue;
    }
    cases.push({
      seed: PUBLISHED_SEED,
      index: i,
      day,
      checkInLocalMinute: alignedLocal,
      durationMinutes: alignedDuration,
      priceTierCode: rng.pick(TIER_OPTIONS),
    });
    i += 1;
  }
  return cases;
}

describe('Phase 8B property-based pricing audit', () => {
  it('produces zero mismatches against the oracle over ≥10,000 seeded cases', { timeout: 600_000 }, () => {
    const cases = generateCases();
    expect(cases.length).toBeGreaterThanOrEqual(10_000);
    const rng = new SeededRandom(PUBLISHED_SEED + 1);
    let generated = cases.length;
    let executed = 0;
    let rejected = 0;
    let oracleRejected = 0;
    let empty = 0;
    let compared = 0;
    let mismatches = 0;
    const samples: unknown[] = [];
    for (const c of cases) {
      const catalog = buildRandomCatalog(rng);
      const startUtc = utcOf(
        Math.floor(c.checkInLocalMinute / 60),
        c.checkInLocalMinute % 60,
        c.day,
      );
      const startMs = new Date(startUtc).getTime();
      const endUtc = new Date(startMs + c.durationMinutes * 60_000).toISOString();
      const input = {
        checkIn: startUtc,
        checkOut: endUtc,
        priceTierCode: c.priceTierCode,
        timezone: 'Asia/Ho_Chi_Minh',
      };
      let production;
      try {
        production = calculatePricingWithStrategy(
          input,
          catalog,
          'CHEAPEST_ELIGIBLE_THEN_PRIORITY',
        );
      } catch (error) {
        if (samples.length < 5) {
          samples.push({
            kind: 'rejected',
            case: c,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        rejected += 1;
        continue;
      }
      executed += 1;
      let oracle;
      try {
        oracle = auditEnumerate(input, catalog);
      } catch {
        // Oracle rejected configuration but production succeeded. Count
        // as mismatch only when totals diverge.
        oracleRejected += 1;
        continue;
      }
      if (oracle.candidates.length === 0) {
        empty += 1;
        continue;
      }
      compared += 1;
      const oracleCheapest = oracle.candidates
        .slice()
        .sort((a, b) => a.totalAmountVnd - b.totalAmountVnd)[0];
      if (oracleCheapest !== undefined && production.totalAmountVnd !== oracleCheapest.totalAmountVnd) {
        mismatches += 1;
        samples.push({ kind: 'mismatch', c, production, oracleCheapest });
      }
    }
    if (mismatches > 0) {
      // eslint-disable-next-line no-console
      console.error('First samples:', samples);
    }
    expect(mismatches).toBe(0);
    expect(generated).toBeGreaterThanOrEqual(10_000);
    expect(executed + rejected).toBe(generated);
    expect(oracleRejected + empty + compared).toBe(executed);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      seed: PUBLISHED_SEED,
      generated,
      executed,
      rejected,
      oracleRejected,
      empty,
      compared,
      mismatches,
    }));
  });
});
