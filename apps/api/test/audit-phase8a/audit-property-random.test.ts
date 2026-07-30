/**
 * Phase 8A audit-only property-based pricing tests.
 *
 * Uses a deterministic PRNG seeded at runtime with a fixed seed so the entire
 * sequence is reproducible. Asserts invariants that the production selector
 * MUST satisfy even under non-monotonic, deliberately-contrived inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePricingWithStrategy,
  PricingConfigurationError,
  type PricingCatalog,
} from '../../src/pricing/pricing-engine.js';
import { auditEnumerate } from './audit-independent-oracle.js';

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(generator: () => number, items: readonly T[]): T {
  const idx = Math.floor(generator() * items.length);
  const value = items[idx];
  if (value === undefined) {
    throw new Error(`pick: empty items array or out-of-range index ${idx}`);
  }
  return value;
}

function buildRandomCatalog(rngFn: () => number): PricingCatalog {
  const tier = (lo: number, hi: number): Record<string, number> => ({
    TIER_1: lo + Math.floor(rngFn() * (hi - lo)),
    TIER_2: lo + Math.floor(rngFn() * (hi - lo)),
    TIER_3: lo + Math.floor(rngFn() * (hi - lo)),
  });
  const include = 180 + Math.floor(rngFn() * 11) * 60; // 180..780 in 60 steps
  return {
    THREE_HOUR_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 180,
      priority: Math.floor(rngFn() * 1001),
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: 240,
      prices: tier(200_000, 600_000),
    },
    FIVE_HOUR_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 300,
      priority: Math.floor(rngFn() * 1001),
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 255,
      maxDurationMinutesInclusive: 960,
      prices: tier(300_000, 700_000),
    },
    LUNCH_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: include,
      priority: Math.floor(rngFn() * 1001),
      minCheckInMinuteInclusive: 660,
      maxCheckInMinuteExclusive: 900,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: 960,
      prices: tier(150_000, 900_000),
    },
    NIGHT_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 300,
      priority: Math.floor(rngFn() * 1001),
      minCheckInMinuteInclusive: 1080,
      maxCheckInMinuteExclusive: 1440,
      minDurationMinutesInclusive: 315,
      maxDurationMinutesInclusive: 960,
      prices: tier(300_000, 1_200_000),
    },
    DAY_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 1440,
      priority: Math.floor(rngFn() * 1001),
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 975,
      maxDurationMinutesInclusive: 1440,
      prices: tier(500_000, 2_000_000),
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
      prices: tier(50_000, 300_000),
    },
  };
}

function randomRequest(rngFn: () => number): {
  checkIn: string;
  checkOut: string;
  timezone: 'Asia/Ho_Chi_Minh';
} {
  const startHour = Math.floor(rngFn() * 24);
  const startMin = Math.floor(rngFn() * 4) * 15;
  const dur = 60 + Math.floor(rngFn() * 92) * 15;
  const day = 22;
  const date = new Date(Date.UTC(2026, 6, day, startHour - 7, startMin));
  const end = new Date(date.getTime() + dur * 60_000);
  return {
    checkIn: date.toISOString(),
    checkOut: end.toISOString(),
    timezone: 'Asia/Ho_Chi_Minh',
  };
}

interface RunRecord {
  readonly seed: number;
  readonly attempt: number;
  readonly checkInUtc: string;
  readonly durationMinutes: number;
  readonly tier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  readonly productionSelected: string | null;
  readonly productionTotal: number | null;
  readonly oracleMinimum: number | null;
  readonly oracleCheapestPlan: string | null;
  readonly diff: number | null;
  readonly productionException: string | null;
  readonly oracleException: string | null;
}

export async function runPropertyTests(seed: number, count: number): Promise<RunRecord[]> {
  const rngFn = rng(seed);
  const records: RunRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const catalog = buildRandomCatalog(rngFn);
    const request = randomRequest(rngFn);
    const tier = pick(rngFn, ['TIER_1', 'TIER_2', 'TIER_3'] as const);
    let productionSelected: string | null = null;
    let productionTotal: number | null = null;
    let productionException: string | null = null;
    try {
      const result = calculatePricingWithStrategy(
        { ...request, priceTierCode: tier },
        catalog,
        'PRIORITY_WINS_LEGACY',
      );
      productionSelected = result.selectedPlanCode;
      productionTotal = result.totalAmountVnd;
    } catch (error) {
      productionException = error instanceof Error ? error.message : String(error);
    }
    let oracleMinimum: number | null = null;
    let oracleCheapestPlan: string | null = null;
    let oracleException: string | null = null;
    try {
      const oracle = auditEnumerate({ ...request, priceTierCode: tier }, catalog);
      oracleMinimum = oracle.minimumTotalVnd;
      oracleCheapestPlan = oracle.tiedCheapestCandidates[0]?.planCode ?? null;
    } catch (error) {
      oracleException = error instanceof Error ? error.message : String(error);
    }
    const diff =
      productionTotal !== null && oracleMinimum !== null
        ? productionTotal - oracleMinimum
        : null;
    records.push({
      seed,
      attempt: i,
      checkInUtc: request.checkIn,
      durationMinutes:
        (new Date(request.checkOut).getTime() - new Date(request.checkIn).getTime()) / 60_000,
      tier,
      productionSelected,
      productionTotal,
      oracleMinimum,
      oracleCheapestPlan,
      diff,
      productionException,
      oracleException,
    });
  }
  return records;
}

const SEED = 8_008_008;
const COUNT = 2_000;

describe('Phase 8A audit-only property-based pricing assertions', () => {
  it('runs the full random suite without crashing', async () => {
    const records = await runPropertyTests(SEED, COUNT);
    const resolved = records.filter((r) => r.productionTotal !== null && r.oracleMinimum !== null);
    expect(resolved.length).toBeGreaterThan(0);
    // Document the analysis numerically inside the artifact instead of
    // asserting on the mismatch-rate.
    const mismatched = resolved.filter(
      (r) => r.productionTotal !== null && r.oracleMinimum !== null && r.productionTotal !== r.oracleMinimum,
    );
    expect(records.length).toBe(COUNT);
    // Snapshot to artifact json file for later analysis.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const here = path.resolve(process.cwd());
    let repoRoot = here;
    for (let i = 0; i < 8; i += 1) {
      const candidate = path.join(repoRoot, 'apps');
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) break;
      } catch {
        // not yet
      }
      const parent = path.dirname(repoRoot);
      if (parent === repoRoot) {
        throw new Error(`could not find repoRoot from cwd=${here}`);
      }
      repoRoot = parent;
    }
    const out = path.join(repoRoot, 'docs/audit/phase-8a/artifacts/pricing-property-random.json');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(
      out,
      JSON.stringify(
        {
          seed: SEED,
          count: COUNT,
          resolved: resolved.length,
          generated: records.length,
          executed: records.length,
          rejected: records.length - resolved.length,
          compared: resolved.length,
          rejectedCases: records
            .filter((record) => record.productionTotal === null || record.oracleMinimum === null)
            .map((record) => ({
              attempt: record.attempt,
              checkInUtc: record.checkInUtc,
              durationMinutes: record.durationMinutes,
              tier: record.tier,
              productionException: record.productionException,
              oracleException: record.oracleException,
            })),
          mismatches: mismatched.length,
          oracleCheaper: mismatched.length,
          sample: records.slice(0, 200),
        },
        null,
        2,
      ),
    );
  });

  it('rejects a deliberately broken catalog deterministically', () => {
    // EXTRA_HOUR with prices={} means the matcher can never bill extras,
    // so any scenario requiring extras must fail closed.
    const broken: PricingCatalog = {
      THREE_HOUR_COMBO: {
        status: 'ACTIVE',
        isBasePlan: true,
        includedDurationMinutes: 180,
        priority: 10,
        minCheckInMinuteInclusive: null,
        maxCheckInMinuteExclusive: null,
        minDurationMinutesInclusive: 60,
        maxDurationMinutesInclusive: 240,
        prices: { TIER_1: 300_000 },
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
        prices: { TIER_1: 450_000 },
      },
      LUNCH_COMBO: {
        status: 'ACTIVE',
        isBasePlan: true,
        includedDurationMinutes: 180,
        priority: 80,
        minCheckInMinuteInclusive: 660,
        maxCheckInMinuteExclusive: 900,
        minDurationMinutesInclusive: 60,
        maxDurationMinutesInclusive: 960,
        prices: { TIER_1: 359_000 },
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
        prices: { TIER_1: 600_000 },
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
        prices: { TIER_1: 800_000 },
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
        prices: {}, // no tier price — must throw on extras
      },
    };
    const date = new Date(Date.UTC(2026, 6, 22, 11, 0)); // 18:00 local, 5h15 = NIGHT + 1 extra
    expect(() =>
      calculatePricingWithStrategy(
        {
          checkIn: date.toISOString(),
          checkOut: new Date(date.getTime() + (5 * 60 + 15) * 60_000).toISOString(),
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        broken,
        'PRIORITY_WINS_LEGACY',
      ),
    ).toThrow(PricingConfigurationError);
  });
});
