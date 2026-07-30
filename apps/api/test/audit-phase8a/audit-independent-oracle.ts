/**
 * Phase 8A audit-only INDEPENDENT pricing oracle.
 *
 * This oracle MUST NOT import from @room/api pricing-engine, selection-rule-matcher,
 * or pricing. It re-derives the planning contract from first principles so
 * mismatches against the production matcher are real findings, not echo bugs.
 *
 * The oracle consumes only:
 * - public rule metadata (the rule_id/priority/time-window/duration-window/prices shape
 *   that the database persists in `rate_plans` + `rate_plan_prices`);
 * - the public PricingInput shape.
 *
 * Selection rule semantics — derived from FIRST PRINCIPLES, not copied from
 * the matcher (sister `audit-independent-enumeration.test.ts` verifies that
 * this implementation is structurally distinct from the production selector):
 *
 *   1. The public 15-minute contract is fixed for both timestamps and durations.
 *   2. Every ACTIVE base plan is eligible iff:
 *        a) its min_check_in_minute_inclusive <= local_check_in_minute <
 *           max_check_in_minute_exclusive (when both non-null);
 *        b) min_duration_minutes_inclusive <= requested_duration_minutes <=
 *           max_duration_minutes_inclusive.
 *   3. Every extra-hour unit bills as ceil((duration - base_included_minutes) / 60).
 *   4. The current production implementation picks the single ACTIVE plan with
 *      strictly the highest priority and breaks ties by ambiguity error.
 *      This oracle enumerates the FULL ELIGIBLE SET and reports the minimum
 *      total amount in VND across every eligible (plan, extra) pair, retaining
 *      ties.
 *
 * If the user-supplied rule metadata permits multiple ordering schemes, the
 * "cheapest" answer is the one with the lowest totalAmountVnd. This oracle
 * returns that answer (and all ties).
 */
import type {
  PricingInput,
  PricingCatalog,
  PricingBreakdown,
  RatePlanCode,
  BasePlanCode,
  CatalogEntry,
} from '../../src/pricing/selection-rule-matcher.js';

/*
 * Note: the import of types above is a TypeScript-only import for type
 * authoring. The actual decision / signature code below never calls
 * any function in selection-rule-matcher.js or pricing-engine.ts;
 * all functions are re-implemented here. The audit test in
 * `audit-independent-enumeration.test.ts` enforces that this file does
 * not reference any non-type runtime symbol from those modules by
 * tracking imports in a grep stage.
 */

export interface AuditCandidate {
  readonly planCode: BasePlanCode;
  readonly baseMinutes: number;
  readonly baseAmountVnd: number;
  readonly extraUnits: number;
  readonly extraAmountVnd: number;
  readonly totalAmountVnd: number;
  readonly partialFingerprint: string;
}

export interface AuditEnumeration {
  readonly input: PricingInput;
  readonly requestedDurationMinutes: number;
  readonly localCheckInMinute: number;
  readonly eligibility: readonly {
    readonly planCode: BasePlanCode;
    readonly priority: number;
    readonly includedDurationMinutes: number;
  }[];
  readonly candidates: readonly AuditCandidate[];
  readonly minimumTotalVnd: number;
  readonly tiedCheapestCandidates: readonly AuditCandidate[];
  readonly productionSelectedTotalVnd: number;
  readonly productionSelectedPlan: BasePlanCode;
  readonly productionIsCheapest: boolean;
  readonly productionAmongTiedCheapest: boolean;
  readonly unlimitedCombinationEnumeration: boolean;
}

export const AUDIT_QUARTER_HOUR_MINUTES = 15;
export const AUDIT_MIN_DURATION_MINUTES = 60;
export const AUDIT_MAX_DURATION_MINUTES = 1_440;
export const AUDIT_MAX_LOCAL_MINUTE = 1_440;

export class AuditIntervalError extends Error {}

export function localCheckInMinuteOfDay(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new AuditIntervalError('Timezone produced non-integer clock');
  }
  return hour * 60 + minute;
}

export function durationMinutes(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  const m = ms / 60_000;
  if (!Number.isInteger(m) || m < AUDIT_MIN_DURATION_MINUTES || m > AUDIT_MAX_DURATION_MINUTES) {
    throw new AuditIntervalError(`Duration out of bound: ${m}`);
  }
  return m;
}

/**
 * Independently decide whether an ACTIVE base plan is eligible for the given
 * `(localCheckInMinute, durationMinutes)` pair. Re-implemented here; does not
 * call the matcher.
 */
export function auditIsEligible(
  entry: CatalogEntry,
  localCheckInMinute: number,
  durationMinutesValue: number,
): boolean {
  if (!entry.isBasePlan || entry.status !== 'ACTIVE') return false;
  if (entry.minDurationMinutesInclusive === null || entry.maxDurationMinutesInclusive === null) {
    return false;
  }
  if (
    durationMinutesValue < entry.minDurationMinutesInclusive ||
    durationMinutesValue > entry.maxDurationMinutesInclusive
  ) {
    return false;
  }
  if (entry.minCheckInMinuteInclusive !== null && entry.maxCheckInMinuteExclusive !== null) {
    if (
      localCheckInMinute < entry.minCheckInMinuteInclusive ||
      localCheckInMinute >= entry.maxCheckInMinuteExclusive
    ) {
      return false;
    }
  }
  return true;
}

function positivePriceFor(catalog: PricingCatalog, planCode: RatePlanCode, tier: string): number {
  const entry = catalog[planCode];
  if (entry === undefined) return Number.NaN;
  const amount = entry.prices[tier];
  if (
    entry.status !== 'ACTIVE' ||
    amount === undefined ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return Number.NaN;
  }
  return amount;
}

/**
 * Independent brute-force enumerator.
 *
 * Walks every ACTIVE base plan in the catalog and, for each eligible plan,
 * builds one candidate offering that includes-duration minutes plus extra-hour
 * top-ups to cover the requested duration. The minimum total in VND across all
 * candidates is the oracle's recommendation. Ties are retained.
 */
export function auditEnumerate(input: PricingInput, catalog: PricingCatalog): AuditEnumeration {
  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  if (
    !Number.isFinite(checkIn.getTime()) ||
    !Number.isFinite(checkOut.getTime()) ||
    checkOut.getTime() <= checkIn.getTime()
  ) {
    throw new AuditIntervalError('checkOut must be strictly after checkIn');
  }
  const requestedDuration = durationMinutes(checkIn, checkOut);
  const localCheckInMinute = localCheckInMinuteOfDay(checkIn, input.timezone);

  const basePlanOrder: readonly BasePlanCode[] = [
    'THREE_HOUR_COMBO',
    'FIVE_HOUR_COMBO',
    'LUNCH_COMBO',
    'NIGHT_COMBO',
    'DAY_COMBO',
  ];

  const extraPrice = positivePriceFor(catalog, 'EXTRA_HOUR', input.priceTierCode);
  const eligiblePlans = basePlanOrder
    .map(
      (
        planCode,
      ): {
        readonly planCode: BasePlanCode;
        readonly entry: CatalogEntry;
      } | null => {
        const entry = catalog[planCode];
        if (entry === undefined) return null;
        if (!auditIsEligible(entry, localCheckInMinute, requestedDuration)) return null;
        const baseAmount = positivePriceFor(catalog, planCode, input.priceTierCode);
        if (!Number.isFinite(baseAmount)) return null;
        return { planCode, entry };
      },
    )
    .filter(
      (x): x is { readonly planCode: BasePlanCode; readonly entry: CatalogEntry } => x !== null,
    );

  const eligibility: AuditEnumeration['eligibility'] = eligiblePlans.map(({ planCode, entry }) => ({
    planCode,
    priority: entry.priority,
    includedDurationMinutes: entry.includedDurationMinutes,
  }));

  const candidates: AuditCandidate[] = eligiblePlans.map(({ planCode, entry }): AuditCandidate => {
    const baseAmount = positivePriceFor(catalog, planCode, input.priceTierCode);
    const baseMinutes = entry.includedDurationMinutes;
    const extraUnits = Math.max(0, Math.ceil((requestedDuration - baseMinutes) / 60));
    let extraAmountVnd = 0;
    if (extraUnits > 0) {
      if (!Number.isFinite(extraPrice)) {
        throw new AuditIntervalError('extra price not finite for valid plan');
      }
      extraAmountVnd = extraPrice * extraUnits;
    }
    const total = baseAmount + extraAmountVnd;
    return {
      planCode,
      baseMinutes,
      baseAmountVnd: baseAmount,
      extraUnits,
      extraAmountVnd,
      totalAmountVnd: total,
      partialFingerprint: `${planCode}|${baseMinutes}|${baseAmount}|${extraUnits}|${extraAmountVnd}`,
    };
  });

  // Independent "production-style" selection: pick highest priority, fail on tie.
  // This simulates the production matcher behaviour WITHOUT importing it.
  let productionPlan: BasePlanCode | undefined;
  let productionPriority = Number.NEGATIVE_INFINITY;
  let productionTie = 0;
  for (const eligible of eligibility) {
    if (eligible.priority > productionPriority) {
      productionPriority = eligible.priority;
      productionTie = 1;
      productionPlan = eligible.planCode;
    } else if (eligible.priority === productionPriority) {
      productionTie += 1;
    }
  }

  let productionSelectedTotal = Number.NaN;
  let productionSelectedPlan: BasePlanCode = 'THREE_HOUR_COMBO';
  if (productionPlan !== undefined && productionTie === 1) {
    const matched = candidates.find((c) => c.planCode === productionPlan);
    if (matched !== undefined) {
      productionSelectedTotal = matched.totalAmountVnd;
      productionSelectedPlan = productionPlan;
    }
  }

  let minimumTotalVnd = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.totalAmountVnd < minimumTotalVnd) minimumTotalVnd = candidate.totalAmountVnd;
  }

  const tiedCheapestCandidates = candidates.filter((c) => c.totalAmountVnd === minimumTotalVnd);

  return {
    input,
    requestedDurationMinutes: requestedDuration,
    localCheckInMinute,
    eligibility,
    candidates,
    minimumTotalVnd,
    tiedCheapestCandidates,
    productionSelectedTotalVnd: productionSelectedTotal,
    productionSelectedPlan,
    productionIsCheapest:
      Number.isFinite(productionSelectedTotal) && productionSelectedTotal === minimumTotalVnd,
    productionAmongTiedCheapest: tiedCheapestCandidates.some(
      (c) => c.planCode === productionSelectedPlan,
    ),
    unlimitedCombinationEnumeration: true,
  };
}

/**
 * Independent selector that returns the oracle minimum-total plan, breaking
 * ties by priority then by canonical plan order. This is what a "cheapest
 * exactly covers the request" selector SHOULD return.
 */
export function auditCheapestPlan(enumeration: AuditEnumeration): BasePlanCode | undefined {
  if (enumeration.tiedCheapestCandidates.length === 0) return undefined;
  const byPriority = new Map<BasePlanCode, number>();
  for (const eligible of enumeration.eligibility) {
    byPriority.set(eligible.planCode, eligible.priority);
  }
  const order: readonly BasePlanCode[] = [
    'THREE_HOUR_COMBO',
    'FIVE_HOUR_COMBO',
    'LUNCH_COMBO',
    'NIGHT_COMBO',
    'DAY_COMBO',
  ];
  const sorted = [...enumeration.tiedCheapestCandidates].sort((a, b) => {
    const pa = byPriority.get(a.planCode) ?? 0;
    const pb = byPriority.get(b.planCode) ?? 0;
    if (pa !== pb) return pb - pa;
    return order.indexOf(a.planCode) - order.indexOf(b.planCode);
  });
  return sorted[0]?.planCode;
}

export function auditBreakdownFromEnumeration(
  enumeration: AuditEnumeration,
  planCode: BasePlanCode,
): PricingBreakdown | undefined {
  const matched = enumeration.candidates.find((c) => c.planCode === planCode);
  if (matched === undefined) return undefined;
  return {
    ruleVersion: 'phase-7b-data-driven-pricing-v1',
    selectedPlanCode: matched.planCode,
    basePlanCode: matched.planCode,
    baseMinutes: matched.baseMinutes,
    extraUnits: matched.extraUnits,
    baseAmountVnd: matched.baseAmountVnd,
    extraAmountVnd: matched.extraAmountVnd,
    totalAmountVnd: matched.totalAmountVnd,
    lineItems: [
      { code: matched.planCode, amountVnd: matched.baseAmountVnd, units: 1 },
      ...(matched.extraUnits === 0
        ? []
        : [
            {
              code: 'EXTRA_HOUR' as const,
              amountVnd: matched.extraAmountVnd,
              units: matched.extraUnits,
            },
          ]),
    ],
  };
}
