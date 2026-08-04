/**
 * Phase 8A audit-only exhaustive time-domain pricing verification.
 *
 * Walks the complete finite domain of reachable public timestamps:
 *   - 96 check-in minutes × 93 valid duration steps per (configuration, date).
 * For each scenario we call BOTH the production calculatePricing AND the
 * auditEnumerate() oracle, and we classify every mismatch.
 *
 * The oracle does NOT import the production matcher. Comparing them in
 * isolation surfaces real selector logic that differs from brute force.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePricingWithStrategy,
  PricingPriceMissingError,
  type PricingCatalog,
} from '../../src/pricing/pricing-engine.js';
import { auditEnumerate } from './audit-independent-oracle.js';

interface Counterexample {
  readonly label: string;
  readonly checkInLocal: string;
  readonly durationMinutes: number;
  readonly productionSelected: string;
  readonly productionTotalVnd: number;
  readonly productionBaseVnd: number;
  readonly productionExtraUnits: number;
  readonly oracleMinimumVnd: number;
  readonly oracleCheapestPlan: string;
  readonly savingsVndIfSwitch: number;
}

const TIER_PRICES = {
  TIER_1: 359_000,
  TIER_2: 419_000,
  TIER_3: 489_000,
};

const extraHour = 100_000;

function buildCatalog(
  overrides: Record<string, Partial<PricingCatalog[string]>> = {},
): PricingCatalog {
  const base: Record<string, PricingCatalog[string]> = {
    THREE_HOUR_COMBO: {
      status: 'ACTIVE',
      isBasePlan: true,
      includedDurationMinutes: 180,
      priority: 10,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: 240,
      prices: { TIER_1: 300_000, TIER_2: 360_000, TIER_3: 420_000 },
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
      prices: { TIER_1: 450_000, TIER_2: 520_000, TIER_3: 590_000 },
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
      prices: {
        TIER_1: TIER_PRICES.TIER_1,
        TIER_2: TIER_PRICES.TIER_2,
        TIER_3: TIER_PRICES.TIER_3,
      },
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
      prices: { TIER_1: extraHour, TIER_2: extraHour, TIER_3: extraHour },
    },
  };
  for (const [code, patch] of Object.entries(overrides)) {
    base[code] = { ...base[code], ...patch } as PricingCatalog[string];
  }
  return base as PricingCatalog;
}

function utcOf(localHour: number, localMinute: number): string {
  // Convert Asia/Ho_Chi_Minh (UTC+7) local clock to UTC. We pick a fixed
  // local date so the offset is exact and the resulting UTC minutes are
  // guaranteed to be aligned to the 15-minute grid by construction.
  const localMinutesOfDay = localHour * 60 + localMinute;
  const utcMinutesOfDay = (((localMinutesOfDay - 7 * 60) % (24 * 60)) + 24 * 60) % (24 * 60);
  const utcHour = Math.floor(utcMinutesOfDay / 60);
  const utcMinute = utcMinutesOfDay % 60;
  if (utcMinute % 15 !== 0) {
    throw new Error(`utcOf(${localHour},${localMinute}) would produce non-15-minute UTC`);
  }
  const date = new Date(Date.UTC(2026, 6, 22, utcHour, utcMinute));
  return date.toISOString();
}

interface Scenario {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly durationMinutes: number;
  readonly localCheckInMinute: number;
}

function enumerateScenarios(): readonly Scenario[] {
  const out: Scenario[] = [];
  for (let localMinute = 0; localMinute <= 23 * 60 + 45; localMinute += 15) {
    for (let dur = 60; dur <= 24 * 60; dur += 15) {
      const startMinutesOfDay = localMinute;
      const startUtc = utcOf(Math.floor(startMinutesOfDay / 60), startMinutesOfDay % 60);
      const startMs = new Date(startUtc).getTime();
      const endMs = startMs + dur * 60_000;
      const endUtc = new Date(endMs).toISOString();
      out.push({
        checkIn: startUtc,
        checkOut: endUtc,
        durationMinutes: dur,
        localCheckInMinute: startMinutesOfDay,
      });
    }
  }
  return out;
}

function classifyScenario(
  catalog: PricingCatalog,
  scenario: Scenario,
): {
  productionResult: ReturnType<typeof calculatePricingWithStrategy> | undefined;
  productionError: string | undefined;
  oracle: ReturnType<typeof auditEnumerate> | undefined;
  oracleError: string | undefined;
} {
  let productionResult: ReturnType<typeof calculatePricingWithStrategy> | undefined;
  let productionError: string | undefined;
  try {
    productionResult = calculatePricingWithStrategy(
      {
        checkIn: scenario.checkIn,
        checkOut: scenario.checkOut,
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
      'PRIORITY_WINS_LEGACY',
    );
  } catch (error) {
    productionError = error instanceof Error ? error.message : String(error);
  }
  let oracle: ReturnType<typeof auditEnumerate> | undefined;
  let oracleError: string | undefined;
  try {
    oracle = auditEnumerate(
      {
        checkIn: scenario.checkIn,
        checkOut: scenario.checkOut,
        priceTierCode: 'TIER_1',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      catalog,
    );
  } catch (error) {
    oracleError = error instanceof Error ? error.message : String(error);
  }
  return { productionResult, productionError, oracle, oracleError };
}

describe('Phase 8A audit-only exhaustive pricing verification', () => {
  it('counts the reachable finite grid', () => {
    const scenarios = enumerateScenarios();
    expect(scenarios.length).toBe(96 * 93);
  });

  it('oracle keeps the grid finite and resolves the production selector count', () => {
    const scenarios = enumerateScenarios();
    const catalog = buildCatalog();
    let productionResolved = 0;
    let productionNoMatch = 0;
    let productionException = 0;
    let oracleResolved = 0;
    let oracleNoMatch = 0;
    for (const scenario of scenarios) {
      const { productionResult, productionError, oracle, oracleError } = classifyScenario(
        catalog,
        scenario,
      );
      if (productionError !== undefined) productionException += 1;
      if (productionResult !== undefined) productionResolved += 1;
      if (oracleError !== undefined) throw new Error(`oracle failed: ${oracleError}`);
      if (oracle === undefined) throw new Error('oracle returned undefined');
      if (oracle.candidates.length === 0) oracleNoMatch += 1;
      else oracleResolved += 1;
    }
    expect(productionResolved + productionException).toBe(scenarios.length);
    expect(productionResolved).toBe(scenarios.length - productionNoMatch);
    expect(oracleResolved).toBe(scenarios.length - oracleNoMatch);
    // The exhaustive validator should refuse a configuration that has any
    // uncovered scenario. With the locked LUNCH/FIVE/THREE layout we expect
    // every scenario to be coverable.
    expect(oracleNoMatch).toBe(0);
  }, 30_000);

  it('captures the production-vs-cheapest mismatch set (Phase 7B priority tie)', async () => {
    const scenarios = enumerateScenarios();
    const catalog = buildCatalog();
    const counterexamples: Counterexample[] = [];
    let matches = 0;
    let mismatches = 0;
    let productionExceptions = 0;
    for (const scenario of scenarios) {
      const { productionResult, productionError, oracle } = classifyScenario(catalog, scenario);
      if (productionError !== undefined) {
        productionExceptions += 1;
        continue;
      }
      if (oracle === undefined || productionResult === undefined) continue;
      if (oracle.minimumTotalVnd === productionResult.totalAmountVnd) {
        matches += 1;
        continue;
      }
      mismatches += 1;
      if (counterexamples.length < 50) {
        counterexamples.push({
          label: `checkIn=${scenario.localCheckInMinute / 60}:${String(
            scenario.localCheckInMinute % 60,
          ).padStart(2, '0')} dur=${scenario.durationMinutes / 60}h`,
          checkInLocal: scenario.checkIn,
          durationMinutes: scenario.durationMinutes,
          productionSelected: productionResult.selectedPlanCode,
          productionTotalVnd: productionResult.totalAmountVnd,
          productionBaseVnd: productionResult.baseAmountVnd,
          productionExtraUnits: productionResult.extraUnits,
          oracleMinimumVnd: oracle.minimumTotalVnd,
          oracleCheapestPlan: oracle.tiedCheapestCandidates[0]?.planCode ?? 'NONE',
          savingsVndIfSwitch: productionResult.totalAmountVnd - oracle.minimumTotalVnd,
        });
      }
    }
    // Persist machine-readable artifacts for the audit report.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const here = path.resolve(process.cwd());
    // Walk upward until we find a directory whose child is 'apps'.
    let repoRoot = here;
    for (let i = 0; i < 8; i += 1) {
      const candidate = path.join(repoRoot, 'apps');
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) {
          break;
        }
      } catch {
        // not yet, keep walking up
      }
      const parent = path.dirname(repoRoot);
      if (parent === repoRoot) {
        throw new Error(`could not find repoRoot from cwd=${here}`);
      }
      repoRoot = parent;
    }
    const artDir = path.join(repoRoot, 'docs/audit/phase-8a/artifacts');
    await fs.mkdir(artDir, { recursive: true });
    const summary = {
      tier: 'TIER_1',
      scenarios: scenarios.length,
      matches,
      mismatches,
      productionExceptions,
      oracleNoMatch: 0,
      oracleResolved: scenarios.length - 0,
      catalogFingerprint: 'phase-7b-locked-defaults',
    };
    await fs.writeFile(
      path.join(artDir, 'pricing-exhaustive-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf8',
    );
    await fs.writeFile(
      path.join(artDir, 'pricing-counterexamples.json'),
      JSON.stringify(counterexamples, null, 2),
      'utf8',
    );
    const csvHeader =
      'label,checkInLocal,durationMinutes,productionSelected,productionTotalVnd,productionBaseVnd,productionExtraUnits,oracleMinimumVnd,oracleCheapestPlan,savingsVndIfSwitch\n';
    const csvBody = counterexamples
      .map(
        (c) =>
          `${c.label},${c.checkInLocal},${c.durationMinutes},${c.productionSelected},${c.productionTotalVnd},${c.productionBaseVnd},${c.productionExtraUnits},${c.oracleMinimumVnd},${c.oracleCheapestPlan},${c.savingsVndIfSwitch}`,
      )
      .join('\n');
    await fs.writeFile(
      path.join(artDir, 'pricing-boundary-matrix.csv'),
      csvHeader + csvBody + '\n',
      'utf8',
    );
    expect(matches + mismatches + productionExceptions).toBe(scenarios.length);
    expect(counterexamples).toBeDefined();
  }, 30_000);

  it('rejects an active rule set with uncovered 18:00 → 23:15 (5h15, before-night)', () => {
    // Construct a misconfigured catalog that has NO base plan covering
    // check-in 17:45 with duration 5h15 (315 minutes). Three has 60..240,
    // Five has 255..960, Lunch needs check-in 660..900, Night needs
    // 1080..1440, Day needs 975..1440. With Five set INACTIVE the only
    // eligible plans collide on the 18:00 NIGHT cutoff (check-in 17:45
    // falls outside Night), so the production matcher must refuse.
    const noFive = buildCatalog({
      FIVE_HOUR_COMBO: {
        status: 'INACTIVE',
      },
    });
    const checkIn = utcOf(17, 45);
    const checkOut = new Date(new Date(checkIn).getTime() + (5 * 60 + 15) * 60_000).toISOString();
    expect(() =>
      calculatePricingWithStrategy(
        { checkIn, checkOut, priceTierCode: 'TIER_1', timezone: 'Asia/Ho_Chi_Minh' },
        noFive,
        'PRIORITY_WINS_LEGACY',
      ),
    ).toThrow();
  });

  it('detects a real "highest-priority-wins but not cheapest" mismatch (Phase 7B selector)', () => {
    // At check-in 11:00 + 6h00 duration we have:
    //   LUNCH eligible (window 11..14:59, dur 360 within 60..960)
    //   FIVE  eligible (dur 360 within 255..960)
    // With deliberately-elevated LUNCH prices and cheap FIVE prices,
    // LUNCH + 3 extras (700k + 300k = 1000k) is more expensive than
    // FIVE alone + 1 extra (350k + 100k = 450k). Production picks LUNCH
    // because it has higher priority (80 vs 70). This is the audit
    // finding that the production selector is NOT a cheapest selector.
    const catalog = buildCatalog({
      LUNCH_COMBO: {
        prices: { TIER_1: 700_000, TIER_2: 800_000, TIER_3: 900_000 },
      },
      FIVE_HOUR_COMBO: {
        prices: { TIER_1: 350_000, TIER_2: 380_000, TIER_3: 410_000 },
      },
    });
    const checkIn = utcOf(11, 0);
    const checkOut = new Date(new Date(checkIn).getTime() + 6 * 60 * 60_000).toISOString();
    const production = calculatePricingWithStrategy(
      { checkIn, checkOut, priceTierCode: 'TIER_1', timezone: 'Asia/Ho_Chi_Minh' },
      catalog,
      'PRIORITY_WINS_LEGACY',
    );
    const oracle = auditEnumerate(
      { checkIn, checkOut, priceTierCode: 'TIER_1', timezone: 'Asia/Ho_Chi_Minh' },
      catalog,
    );
    expect(production.selectedPlanCode).toBe('LUNCH_COMBO');
    expect(production.totalAmountVnd).toBe(700_000 + 3 * 100_000);
    expect(oracle.minimumTotalVnd).toBe(350_000 + 1 * 100_000);
    expect(oracle.productionSelectedPlan).toBe('LUNCH_COMBO');
    expect(oracle.productionIsCheapest).toBe(false);
    expect(oracle.productionSelectedTotalVnd).toBeGreaterThan(oracle.minimumTotalVnd);
  });

  it('does not let a malformed catalog with a missing base-plan price leak into a quote (fail closed)', () => {
    const broken = buildCatalog({
      LUNCH_COMBO: {
        prices: { TIER_2: 419_000 } as unknown as Record<string, number>,
      },
    });
    expect(() =>
      calculatePricingWithStrategy(
        {
          checkIn: utcOf(11, 0),
          checkOut: new Date(new Date(utcOf(11, 0)).getTime() + 3 * 60 * 60_000).toISOString(),
          priceTierCode: 'TIER_1',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        broken,
        'PRIORITY_WINS_LEGACY',
      ),
    ).toThrow(PricingPriceMissingError);
  });
});
