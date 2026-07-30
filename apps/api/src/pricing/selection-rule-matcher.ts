/**
 * Phase 7B pure rule matcher.
 *
 * The matcher accepts an immutable PricingCatalog derived from PostgreSQL
 * (`ratePlans` + `ratePlanPrices`) and a {@link PricingInput} describing a
 * customer booking interval. It returns the highest-priority matching base
 * plan together with the extra-hour count, or raises a safe pricing error.
 *
 * The matcher is **pure**:
 *   - it never reads the database, environment variables, or web APIs;
 *   - it never logs;
 *   - it never mutates its arguments.
 *
 * Time-of-day semantics use the property timezone supplied by the quote
 * service, keeping the matcher deterministic across server hosts.
 */

export const KNOWN_BASE_PLAN_CODES = [
  'THREE_HOUR_COMBO',
  'FIVE_HOUR_COMBO',
  'LUNCH_COMBO',
  'NIGHT_COMBO',
  'DAY_COMBO',
] as const;
export type KnownBasePlanCode = (typeof KNOWN_BASE_PLAN_CODES)[number];

export const EXTRA_HOUR_CODE = 'EXTRA_HOUR' as const;

/**
 * `RatePlanCode` accepts any uppercase ASCII rate-plan code registered
 * through ADMIN. The historical constants are still exported for places
 * that compare against the known seed plan codes.
 */
export type RatePlanCode = string;
export type BasePlanCode = string;

export const RULE_VERSION_PHASE_7B = 'phase-7b-data-driven-pricing-v1' as const;
export const RULE_VERSION_PHASE_4 = 'phase-4-pricing-availability-v1' as const;
export const RULE_VERSION_PHASE_8B = 'phase-8b-cheapest-eligible-pricing-v1' as const;

export type PricingRuleVersion =
  | typeof RULE_VERSION_PHASE_4
  | typeof RULE_VERSION_PHASE_7B
  | typeof RULE_VERSION_PHASE_8B;

export interface PricingInput {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly priceTierCode: string;
  readonly timezone: string;
}

export interface CatalogEntry {
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly isBasePlan: boolean;
  readonly includedDurationMinutes: number;
  readonly priority: number;
  readonly minCheckInMinuteInclusive: number | null;
  readonly maxCheckInMinuteExclusive: number | null;
  readonly minDurationMinutesInclusive: number | null;
  readonly maxDurationMinutesInclusive: number | null;
  readonly prices: Readonly<Record<string, number>>;
}

export interface PricingCatalog {
  readonly [code: string]: CatalogEntry;
}

export interface PricingBreakdown {
  readonly ruleVersion: PricingRuleVersion;
  readonly selectedPlanCode: BasePlanCode;
  readonly basePlanCode: BasePlanCode;
  readonly baseMinutes: number;
  readonly extraUnits: number;
  readonly baseAmountVnd: number;
  readonly extraAmountVnd: number;
  readonly totalAmountVnd: number;
  readonly lineItems: readonly {
    readonly code: RatePlanCode;
    readonly amountVnd: number;
    readonly units: number;
  }[];
}

export const TIMEZONE_ASIA_HO_CHI_MINH = 'Asia/Ho_Chi_Minh';
export const MIN_DURATION_MINUTES = 60;
export const MAX_DURATION_MINUTES = 1_440;
export const QUARTER_HOUR_MINUTES = 15;
export const MAX_LOCAL_MINUTE = 1_440;

export class InvalidPricingIntervalError extends Error {}
export class PricingConfigurationError extends Error {}
export class PricingRuleNotFoundError extends PricingConfigurationError {
  public readonly code = 'PRICING_RULE_NOT_FOUND';
}
export class PricingRuleAmbiguousError extends PricingConfigurationError {
  public readonly code = 'PRICING_RULE_AMBIGUOUS';
}
export class PricingRuleInvalidError extends PricingConfigurationError {
  public readonly code = 'PRICING_RULE_INVALID';
}
export class PricingPriceMissingError extends PricingConfigurationError {
  public readonly code = 'PRICING_PRICE_MISSING';
}
export class PricingExtraPriceMissingError extends PricingConfigurationError {
  public readonly code = 'PRICING_EXTRA_PRICE_MISSING';
}

function parseInstant(value: string): Date {
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCSeconds() !== 0 ||
    date.getUTCMilliseconds() !== 0 ||
    date.getUTCMinutes() % QUARTER_HOUR_MINUTES !== 0
  ) {
    throw new InvalidPricingIntervalError('Pricing timestamps must use a 15-minute increment.');
  }
  return date;
}

export function localMinuteOfDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

function isQuarterHour(value: number): boolean {
  return value >= 0 && value <= MAX_LOCAL_MINUTE && value % QUARTER_HOUR_MINUTES === 0;
}

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();
  } catch {
    throw new PricingRuleInvalidError('Property timezone is invalid.');
  }
}

function activePrice(
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
      entry.minDurationMinutesInclusive > entry.maxDurationMinutesInclusive ||
      !Number.isSafeInteger(entry.minDurationMinutesInclusive) ||
      !Number.isSafeInteger(entry.maxDurationMinutesInclusive)
    ) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} has an invalid duration selection range.`,
      );
    }
    if (
      entry.minDurationMinutesInclusive % QUARTER_HOUR_MINUTES !== 0 ||
      entry.maxDurationMinutesInclusive % QUARTER_HOUR_MINUTES !== 0
    ) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} duration values must use 15-minute increments.`,
      );
    }
    if (entry.includedDurationMinutes > entry.maxDurationMinutesInclusive) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} included duration must not exceed its maximum duration.`,
      );
    }
    if ((entry.minCheckInMinuteInclusive === null) !== (entry.maxCheckInMinuteExclusive === null)) {
      throw new PricingRuleInvalidError(
        `Base plan ${code} check-in window must be set as a pair or both null.`,
      );
    }
    if (entry.minCheckInMinuteInclusive !== null && entry.maxCheckInMinuteExclusive !== null) {
      if (
        !isQuarterHour(entry.minCheckInMinuteInclusive) ||
        !isQuarterHour(entry.maxCheckInMinuteExclusive)
      ) {
        throw new PricingRuleInvalidError(
          `Base plan ${code} check-in window must use 15-minute increments.`,
        );
      }
      if (entry.maxCheckInMinuteExclusive <= entry.minCheckInMinuteInclusive) {
        throw new PricingRuleInvalidError(`Base plan ${code} check-in window must have max > min.`);
      }
      if (entry.minCheckInMinuteInclusive >= MAX_LOCAL_MINUTE) {
        throw new PricingRuleInvalidError(
          `Base plan ${code} check-in window must not wrap midnight.`,
        );
      }
    }
  } else {
    if (
      entry.minCheckInMinuteInclusive !== null ||
      entry.maxCheckInMinuteExclusive !== null ||
      entry.minDurationMinutesInclusive !== null ||
      entry.maxDurationMinutesInclusive !== null
    ) {
      throw new PricingRuleInvalidError(
        `Non-base plan ${code} must not declare a selection window.`,
      );
    }
  }
}

function matchesWindow(
  entry: CatalogEntry,
  localCheckInMinute: number,
  durationMinutes: number,
): boolean {
  if (!entry.isBasePlan) return false;
  if (
    entry.minCheckInMinuteInclusive !== null &&
    entry.maxCheckInMinuteExclusive !== null &&
    (localCheckInMinute < entry.minCheckInMinuteInclusive ||
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

export function activeBasePlanCodes(catalog: PricingCatalog): readonly BasePlanCode[] {
  const ordered: BasePlanCode[] = [];
  for (const code of KNOWN_BASE_PLAN_CODES) ordered.push(code);
  for (const code of Object.keys(catalog)) {
    const entry = catalog[code];
    if (entry === undefined || !entry.isBasePlan) continue;
    if (ordered.includes(code)) continue;
    ordered.push(code);
  }
  return ordered;
}

export function calculatePricing(input: PricingInput, catalog: PricingCatalog): PricingBreakdown {
  const checkIn = parseInstant(input.checkIn);
  const checkOut = parseInstant(input.checkOut);
  const durationMinutes = (checkOut.getTime() - checkIn.getTime()) / 60_000;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new InvalidPricingIntervalError('Pricing duration must be between 1 and 24 hours.');
  }

  validateTimezone(input.timezone);
  const localCheckIn = localMinuteOfDay(checkIn, input.timezone);

  const basePlanCodes = activeBasePlanCodes(catalog);

  const matched: { code: BasePlanCode; priority: number }[] = [];
  for (const code of basePlanCodes) {
    const entry = catalog[code];
    if (entry === undefined || entry.status !== 'ACTIVE' || !entry.isBasePlan) continue;
    validateSelectionRuleForCatalog(catalog, code);
    if (matchesWindow(entry, localCheckIn, durationMinutes)) {
      matched.push({ code, priority: entry.priority });
    }
  }

  if (matched.length === 0) {
    throw new PricingRuleNotFoundError(
      'No active base plan matches the requested check-in and duration.',
    );
  }

  const highestPriority = matched.reduce(
    (max, current) => (current.priority > max ? current.priority : max),
    -Infinity,
  );
  const topMatches = matched.filter((m) => m.priority === highestPriority);
  if (topMatches.length > 1) {
    throw new PricingRuleAmbiguousError(
      `Multiple active base plans share the highest priority (${highestPriority}).`,
    );
  }

  const winner = topMatches[0];
  if (winner === undefined) {
    throw new PricingRuleNotFoundError('No active base plan matched.');
  }

  const selectedEntry = catalog[winner.code];
  if (selectedEntry === undefined) {
    throw new PricingRuleInvalidError(`Selected plan ${winner.code} not found in catalog.`);
  }

  const baseMinutes = selectedEntry.includedDurationMinutes;
  const extraUnits = Math.max(0, Math.ceil((durationMinutes - baseMinutes) / 60));

  const baseAmountVnd = activePrice(
    catalog,
    winner.code,
    input.priceTierCode,
    PricingPriceMissingError,
  );
  const extraAmountVnd =
    extraUnits === 0
      ? 0
      : (validateSelectionRuleForCatalog(catalog, EXTRA_HOUR_CODE),
        activePrice(
          catalog,
          EXTRA_HOUR_CODE,
          input.priceTierCode,
          PricingExtraPriceMissingError,
        ) * extraUnits);
  const lineItems = [
    { code: winner.code as RatePlanCode, amountVnd: baseAmountVnd, units: 1 },
    ...(extraUnits === 0
      ? []
      : [
          {
            code: EXTRA_HOUR_CODE,
            amountVnd: extraAmountVnd,
            units: extraUnits,
          },
        ]),
  ];

  return Object.freeze({
    ruleVersion: RULE_VERSION_PHASE_7B,
    selectedPlanCode: winner.code,
    basePlanCode: winner.code,
    baseMinutes,
    extraUnits,
    baseAmountVnd,
    extraAmountVnd,
    totalAmountVnd: baseAmountVnd + extraAmountVnd,
    lineItems: Object.freeze(lineItems),
  });
}

export interface RuleSetValidationOptions {
  readonly requiredPriceTierCodes: readonly string[];
}

/**
 * Validate the tentative active rule set against every reachable public
 * input. Throws when coverage or priority uniqueness is violated.
 *
 * The grid is finite (96 check-in minutes × 93 duration steps) so this
 * runs at ADMIN update/activation time only, never on the public quote
 * path.
 */
export function validateActiveRuleSet(
  catalog: PricingCatalog,
  options: RuleSetValidationOptions,
): void {
  for (const code of Object.keys(catalog)) {
    validateSelectionRuleForCatalog(catalog, code);
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

  const basePlanCodes = activeBasePlanCodes(catalog);

  for (const localCheckIn of checkInMinutes) {
    for (const duration of durationMinutes) {
      const matched: { code: BasePlanCode; priority: number }[] = [];
      for (const code of basePlanCodes) {
        const entry = catalog[code];
        if (entry === undefined || entry.status !== 'ACTIVE' || !entry.isBasePlan) continue;
        if (matchesWindow(entry, localCheckIn, duration)) {
          matched.push({ code, priority: entry.priority });
        }
      }
      if (matched.length === 0) {
        throw new PricingRuleNotFoundError(
          `No active base plan matches check-in ${localCheckIn} with duration ${duration}.`,
        );
      }
      const highestPriority = matched.reduce(
        (max, current) => (current.priority > max ? current.priority : max),
        -Infinity,
      );
      const topMatches = matched.filter((m) => m.priority === highestPriority);
      if (topMatches.length > 1) {
        throw new PricingRuleAmbiguousError(
          `Multiple active base plans share the highest priority ${highestPriority} for check-in ${localCheckIn} and duration ${duration}.`,
        );
      }
      const winner = topMatches[0];
      if (winner === undefined) continue;
      const winnerEntry = catalog[winner.code];
      if (winnerEntry === undefined) continue;
      const baseMinutes = winnerEntry.includedDurationMinutes;
      const extraUnits = Math.max(0, Math.ceil((duration - baseMinutes) / 60));
      for (const tierCode of options.requiredPriceTierCodes) {
        activePrice(catalog, winner.code, tierCode, PricingPriceMissingError);
        if (extraUnits > 0) {
          activePrice(catalog, EXTRA_HOUR_CODE, tierCode, PricingExtraPriceMissingError);
        }
      }
    }
  }
}
