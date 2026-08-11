/**
 * Phase 8B cheapest-eligible pricing selector.
 *
 * Pure, deterministic module that selects the cheapest valid ACTIVE base plan
 * for an exact customer interval, with priority / extra-unit / stable plan
 * identity used only as deterministic tie-breakers.
 *
 * Policy identifier: CHEAPEST_ELIGIBLE_THEN_PRIORITY.
 *
 * This module never reads the database, never logs, and never mutates its
 * arguments. It is callable from the public quote path and from the advisory
 * recommendation search.
 */

import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  PricingConfigurationError,
  PricingExtraPriceMissingError,
  PricingPriceMissingError,
  PricingRuleAmbiguousError,
  PricingRuleInvalidError,
  PricingRuleNotFoundError,
  InvalidPricingIntervalError,
  RULE_VERSION_PHASE_7B,
  QUARTER_HOUR_MINUTES,
  MAX_LOCAL_MINUTE,
  localMinuteOfDay,
  activeBasePlanCodes,
  EXTRA_HOUR_CODE,
  type BasePlanCode,
  type CatalogEntry,
  type PricingBreakdown,
  type PricingCatalog,
  type PricingInput,
  type RatePlanCode,
} from './selection-rule-matcher.js';

export const RULE_VERSION_PHASE_8B = 'phase-8b-cheapest-eligible-pricing-v1' as const;

export type CheapestRuleVersion = typeof RULE_VERSION_PHASE_8B;
export type PricingRuleVersionPhase8B =
  | typeof import('./selection-rule-matcher.js').RULE_VERSION_PHASE_4
  | typeof RULE_VERSION_PHASE_7B
  | typeof RULE_VERSION_PHASE_8B;

export interface PricingCandidate {
  readonly planCode: BasePlanCode;
  readonly priority: number;
  readonly includedDurationMinutes: number;
  readonly extraUnits: number;
  readonly baseAmountVnd: number;
  readonly extraAmountVnd: number;
  readonly grossAmountVnd: number;
}

export interface PricingSelectionResult {
  readonly selected: PricingCandidate;
  readonly candidates: readonly PricingCandidate[];
  readonly policy: 'CHEAPEST_ELIGIBLE_THEN_PRIORITY';
  readonly tieReason:
    'LOWEST_GROSS' | 'PRIORITY_TIE_BREAK' | 'EXTRA_UNITS_TIE_BREAK' | 'STABLE_PLAN_TIE_BREAK';
}

const KNOWN_ORDER = [
  'THREE_HOUR_COMBO',
  'FIVE_HOUR_COMBO',
  'LUNCH_COMBO',
  'NIGHT_COMBO',
  'DAY_COMBO',
] as const;

function planOrder(code: string): number {
  const index = KNOWN_ORDER.indexOf(code as (typeof KNOWN_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function parseInstant(value: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new InvalidPricingIntervalError('Pricing timestamps must be valid ISO-8601 instants.');
  }
  return date;
}

function matchesWindow(
  entry: CatalogEntry,
  localCheckInMinute: number,
  durationMinutes: number,
): boolean {
  if (!entry.isBasePlan) return false;
  if (
    (entry.minCheckInMinuteInclusive !== null &&
      localCheckInMinute < entry.minCheckInMinuteInclusive) ||
    (entry.maxCheckInMinuteExclusive !== null &&
      localCheckInMinute >= entry.maxCheckInMinuteExclusive)
  ) {
    return false;
  }
  if (entry.minDurationMinutesInclusive === null || entry.maxDurationMinutesInclusive === null) {
    return false;
  }
  return (
    durationMinutes >= entry.minDurationMinutesInclusive &&
    durationMinutes <= entry.maxDurationMinutesInclusive
  );
}

function validateSelectionRuleForCatalog(catalog: PricingCatalog, code: RatePlanCode): void {
  const entry = catalog[code];
  if (entry === undefined) return;
  if (!Number.isSafeInteger(entry.priority) || entry.priority < 0 || entry.priority > 1_000) {
    throw new PricingRuleInvalidError(`Pricing rule ${code} has an invalid priority.`);
  }
  if (
    !Number.isSafeInteger(entry.includedDurationMinutes) ||
    entry.includedDurationMinutes < MIN_DURATION_MINUTES ||
    entry.includedDurationMinutes > MAX_DURATION_MINUTES ||
    entry.includedDurationMinutes % QUARTER_HOUR_MINUTES !== 0
  ) {
    throw new PricingRuleInvalidError(`Pricing rule ${code} has an invalid included duration.`);
  }
  if (entry.isBasePlan) {
    if (
      entry.minDurationMinutesInclusive === null ||
      entry.maxDurationMinutesInclusive === null ||
      entry.minDurationMinutesInclusive < MIN_DURATION_MINUTES ||
      entry.maxDurationMinutesInclusive > MAX_DURATION_MINUTES ||
      entry.minDurationMinutesInclusive > entry.maxDurationMinutesInclusive
    ) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} has an invalid duration selection range.`,
      );
    }
  }
}

function positivePrice(
  catalog: PricingCatalog,
  code: RatePlanCode,
  tier: string,
  ErrorType: typeof PricingPriceMissingError | typeof PricingExtraPriceMissingError,
): number {
  const plan = catalog[code];
  const amount = plan?.prices[tier];
  if (
    plan?.status !== 'ACTIVE' ||
    amount === undefined ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    throw new ErrorType('An active price is required for the selected pricing rule.');
  }
  return amount;
}

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();
  } catch {
    throw new PricingRuleInvalidError('Property timezone is invalid.');
  }
}

export function evaluatePricingCandidates(
  input: PricingInput,
  catalog: PricingCatalog,
): readonly PricingCandidate[] {
  const checkIn = parseInstant(input.checkIn);
  const checkOut = parseInstant(input.checkOut);
  const durationSeconds = (checkOut.getTime() - checkIn.getTime()) / 1_000;
  const durationMinutes = Math.ceil(durationSeconds / 60);
  if (
    !Number.isInteger(durationSeconds) ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new InvalidPricingIntervalError('Pricing duration must be between 1 and 24 hours.');
  }
  validateTimezone(input.timezone);
  const localCheckIn = localMinuteOfDay(checkIn, input.timezone);

  const out: PricingCandidate[] = [];
  const orderedCodes = activeBasePlanCodes(catalog);
  for (const code of orderedCodes) {
    const entry = catalog[code];
    if (entry === undefined || entry.status !== 'ACTIVE' || !entry.isBasePlan) continue;
    validateSelectionRuleForCatalog(catalog, code);
    if (!matchesWindow(entry, localCheckIn, durationMinutes)) continue;
    let baseAmountVnd: number;
    try {
      baseAmountVnd = positivePrice(catalog, code, input.priceTierCode, PricingPriceMissingError);
    } catch {
      continue;
    }
    const baseMinutes = entry.includedDurationMinutes;
    const extraUnits = Math.max(0, Math.ceil((durationMinutes - baseMinutes) / 60));
    let extraAmountVnd = 0;
    if (extraUnits > 0) {
      try {
        validateSelectionRuleForCatalog(catalog, EXTRA_HOUR_CODE);
        extraAmountVnd =
          positivePrice(
            catalog,
            EXTRA_HOUR_CODE,
            input.priceTierCode,
            PricingExtraPriceMissingError,
          ) * extraUnits;
      } catch {
        continue;
      }
    }
    out.push(
      Object.freeze({
        planCode: code,
        priority: entry.priority,
        includedDurationMinutes: baseMinutes,
        extraUnits,
        baseAmountVnd,
        extraAmountVnd,
        grossAmountVnd: baseAmountVnd + extraAmountVnd,
      }),
    );
  }
  return out;
}

function compareCandidates(
  a: PricingCandidate,
  b: PricingCandidate,
): { readonly winner: PricingCandidate; readonly reason: PricingSelectionResult['tieReason'] } {
  if (a.grossAmountVnd !== b.grossAmountVnd) {
    return a.grossAmountVnd < b.grossAmountVnd
      ? { winner: a, reason: 'LOWEST_GROSS' }
      : { winner: b, reason: 'LOWEST_GROSS' };
  }
  if (a.priority !== b.priority) {
    return a.priority > b.priority
      ? { winner: a, reason: 'PRIORITY_TIE_BREAK' }
      : { winner: b, reason: 'PRIORITY_TIE_BREAK' };
  }
  if (a.extraUnits !== b.extraUnits) {
    return a.extraUnits < b.extraUnits
      ? { winner: a, reason: 'EXTRA_UNITS_TIE_BREAK' }
      : { winner: b, reason: 'EXTRA_UNITS_TIE_BREAK' };
  }
  const orderA = planOrder(a.planCode);
  const orderB = planOrder(b.planCode);
  if (orderA !== orderB) {
    return orderA < orderB
      ? { winner: a, reason: 'STABLE_PLAN_TIE_BREAK' }
      : { winner: b, reason: 'STABLE_PLAN_TIE_BREAK' };
  }
  if (a.planCode !== b.planCode) {
    return a.planCode < b.planCode
      ? { winner: a, reason: 'STABLE_PLAN_TIE_BREAK' }
      : { winner: b, reason: 'STABLE_PLAN_TIE_BREAK' };
  }
  return { winner: a, reason: 'STABLE_PLAN_TIE_BREAK' };
}

export function selectCheapestEligibleCandidate(
  input: PricingInput,
  catalog: PricingCatalog,
): PricingSelectionResult {
  const candidates = evaluatePricingCandidates(input, catalog);
  if (candidates.length === 0) {
    throw new PricingRuleNotFoundError(
      'No active base plan matches the requested check-in and duration.',
    );
  }
  let winner = candidates[0];
  if (winner === undefined) {
    throw new PricingRuleNotFoundError('No active base plan matched.');
  }
  let reason: PricingSelectionResult['tieReason'] = 'LOWEST_GROSS';
  for (let i = 1; i < candidates.length; i += 1) {
    const challenger = candidates[i];
    if (challenger === undefined) continue;
    const result = compareCandidates(winner, challenger);
    winner = result.winner;
    reason = result.reason;
  }
  return Object.freeze({
    selected: winner,
    candidates: Object.freeze(candidates),
    policy: 'CHEAPEST_ELIGIBLE_THEN_PRIORITY',
    tieReason: reason,
  });
}

export function calculateCheapestPricing(
  input: PricingInput,
  catalog: PricingCatalog,
): PricingBreakdown {
  const result = selectCheapestEligibleCandidate(input, catalog);
  const selected = result.selected;
  const lineItems = [
    {
      code: selected.planCode as RatePlanCode,
      amountVnd: selected.baseAmountVnd,
      units: 1,
    },
    ...(selected.extraUnits === 0
      ? []
      : [
          {
            code: EXTRA_HOUR_CODE,
            amountVnd: selected.extraAmountVnd,
            units: selected.extraUnits,
          },
        ]),
  ];
  // ORIG-G-004: the non-selected valid candidates, each carrying its own
  // total, so the explanation contract can show what else was eligible.
  const alternatives = result.candidates
    .filter((candidate) => candidate.planCode !== selected.planCode)
    .map((candidate) => ({
      planCode: candidate.planCode,
      totalAmountVnd: candidate.grossAmountVnd,
    }));
  return Object.freeze({
    ruleVersion: RULE_VERSION_PHASE_8B,
    selectedPlanCode: selected.planCode,
    basePlanCode: selected.planCode,
    baseMinutes: selected.includedDurationMinutes,
    extraUnits: selected.extraUnits,
    baseAmountVnd: selected.baseAmountVnd,
    extraAmountVnd: selected.extraAmountVnd,
    totalAmountVnd: selected.grossAmountVnd,
    lineItems: Object.freeze(lineItems),
    selectionReason: result.tieReason,
    alternatives: Object.freeze(alternatives),
  });
}

export function ruleSetValidationFromCatalog(
  catalog: PricingCatalog,
  requiredPriceTierCodes: readonly string[],
): void {
  for (const code of Object.keys(catalog)) {
    validateSelectionRuleForCatalog(catalog, code as RatePlanCode);
  }
  const checkInMinutes: number[] = [];
  for (
    let minute = 0;
    minute <= MAX_LOCAL_MINUTE - QUARTER_HOUR_MINUTES;
    minute += QUARTER_HOUR_MINUTES
  ) {
    checkInMinutes.push(minute);
  }
  const durationMinutes: number[] = [];
  for (let dur = MIN_DURATION_MINUTES; dur <= MAX_DURATION_MINUTES; dur += QUARTER_HOUR_MINUTES) {
    durationMinutes.push(dur);
  }
  for (const localCheckIn of checkInMinutes) {
    for (const duration of durationMinutes) {
      const matched: BasePlanCode[] = [];
      const orderedCodes = activeBasePlanCodes(catalog);
      for (const code of orderedCodes) {
        const entry = catalog[code];
        if (entry === undefined || entry.status !== 'ACTIVE' || !entry.isBasePlan) continue;
        if (matchesWindow(entry, localCheckIn, duration)) matched.push(code);
      }
      if (matched.length === 0) {
        throw new PricingRuleNotFoundError(
          `No active base plan matches check-in ${localCheckIn} with duration ${duration}.`,
        );
      }
      const ambiguousGroups = new Map<BasePlanCode, number>();
      for (const code of matched) {
        const entry = catalog[code];
        if (entry === undefined) continue;
        ambiguousGroups.set(code, entry.priority);
      }
      const priorityMap = new Map<number, BasePlanCode[]>();
      for (const [code, priority] of ambiguousGroups) {
        const list = priorityMap.get(priority) ?? [];
        list.push(code);
        priorityMap.set(priority, list);
      }
      for (const list of priorityMap.values()) {
        if (list.length > 1) {
          throw new PricingRuleAmbiguousError(
            `Multiple active base plans share the same priority ${list[0]} for check-in ${localCheckIn} and duration ${duration}.`,
          );
        }
      }
      const winnerEntry = matched
        .map((code) => catalog[code])
        .filter((entry): entry is CatalogEntry => entry !== undefined)
        .sort((a, b) => b.priority - a.priority)[0];
      if (winnerEntry === undefined) continue;
      const baseMinutes = winnerEntry.includedDurationMinutes;
      const extraUnits = Math.max(0, Math.ceil((duration - baseMinutes) / 60));
      for (const tierCode of requiredPriceTierCodes) {
        for (const code of matched) {
          positivePrice(catalog, code, tierCode, PricingPriceMissingError);
        }
        if (extraUnits > 0) {
          positivePrice(catalog, EXTRA_HOUR_CODE, tierCode, PricingExtraPriceMissingError);
        }
      }
    }
  }
}

// Re-export the selectors' configuration errors so callers can `import`
// every error type from one place.
export {
  PricingConfigurationError,
  PricingExtraPriceMissingError,
  PricingPriceMissingError,
  PricingRuleAmbiguousError,
  PricingRuleInvalidError,
  PricingRuleNotFoundError,
  InvalidPricingIntervalError,
};
