import { createHash } from 'node:crypto';

import {
  MAX_PRICING_POLICY_COMPONENT_LINES,
  MAX_PRICING_POLICY_SEARCH_STATES,
  type PublishedPricingPolicyAggregate,
  type DraftPricingPolicyComponent,
  type PricingPolicyJsonObject,
} from './pricing-policy.domain.js';

export const MULTI_NIGHT_PRICING_SNAPSHOT_VERSION =
  'operations-v3-b0.2-pricing-candidate-v1' as const;

export type MultiNightPricingFailureCode =
  | 'NO_VALID_PRICING'
  | 'POLICY_NOT_CONFIGURED'
  | 'INVALID_INTERVAL'
  | 'MAXIMUM_SEARCH_STATE_EXCEEDED'
  | 'LOCAL_TIME_UNRESOLVED';

export class MultiNightPricingError extends Error {
  public constructor(
    public readonly code: MultiNightPricingFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'MultiNightPricingError';
  }
}

export interface MultiNightPricingInput {
  readonly checkInAt: Date;
  readonly checkOutAt: Date;
  readonly propertyTimezone: string;
  readonly priceTierId: string;
  readonly policy: PublishedPricingPolicyAggregate;
  readonly applicabilityInstant: Date;
}

export interface MultiNightPricingLine {
  readonly componentId: string;
  readonly componentCode: string;
  readonly componentDigest: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly coverageModel: DraftPricingPolicyComponent['coverageModel'];
  readonly boundaryPosition: DraftPricingPolicyComponent['boundaryPosition'];
  readonly billingModel: DraftPricingPolicyComponent['billingModel'];
  readonly occurrenceCount: number;
  readonly billingUnitQuantity: number;
  readonly unitAmountVnd: number;
  readonly lineAmountVnd: number;
  readonly restrictions: PricingPolicyJsonObject;
  readonly sourceV1Provenance: PricingPolicyJsonObject | null;
}

export interface MultiNightPricingCandidate {
  readonly snapshotSchemaVersion: typeof MULTI_NIGHT_PRICING_SNAPSHOT_VERSION;
  readonly ruleVersion: typeof MULTI_NIGHT_PRICING_SNAPSHOT_VERSION;
  readonly selectedPlanCode: 'MULTI_NIGHT';
  readonly basePlanCode: 'MULTI_NIGHT';
  readonly policyId: string;
  readonly policyVersion: string;
  readonly applicabilityBasis: PublishedPricingPolicyAggregate['root']['applicabilityBasis'];
  readonly applicabilityInstant: Date;
  readonly observedPolicyInterval: {
    readonly effectiveFrom: Date;
    readonly effectiveUntil: Date | null;
  };
  readonly requestedInterval: { readonly checkInAt: Date; readonly checkOutAt: Date };
  readonly propertyTimezone: string;
  readonly lines: readonly MultiNightPricingLine[];
  readonly displayNightCount: number;
  readonly grossAmountVnd: number;
  readonly discountAmountVnd: number;
  readonly finalAmountVnd: number;
  readonly totalAmountVnd: number;
  readonly componentCount: number;
  readonly conditionComplexity: number;
  readonly restrictionRank: number;
  readonly stableCandidateId: string;
  readonly rationale: string;
}

export interface MultiNightPricingResult {
  readonly candidates: readonly MultiNightPricingCandidate[];
  readonly selected: MultiNightPricingCandidate;
}

interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

interface LocalCalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function localParts(instant: Date, timezone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localDateParts(instant: Date, timezone: string): LocalCalendarDate {
  const value = localParts(instant, timezone);
  return { year: value.year, month: value.month, day: value.day };
}

function localMinute(value: LocalDateParts): number {
  return value.hour * 60 + value.minute;
}

function localPseudoEpoch(value: LocalDateParts | LocalCalendarDate): number {
  return Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    'hour' in value ? value.hour : 0,
    'minute' in value ? value.minute : 0,
    'second' in value ? value.second : 0,
  );
}

function addCalendarDays(value: LocalCalendarDate, days: number): LocalCalendarDate {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  date.setUTCDate(date.getUTCDate() + days);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function sameLocalParts(actual: LocalDateParts, expected: LocalDateParts): boolean {
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === expected.second
  );
}

function resolveLocalDateTime(
  date: LocalCalendarDate,
  minuteOfDay: number,
  timezone: string,
): Date {
  const expected: LocalDateParts = {
    ...date,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    second: 0,
  };
  const targetPseudo = localPseudoEpoch(expected);
  const matches: Date[] = [];
  for (let offsetMinutes = -36 * 60; offsetMinutes <= 36 * 60; offsetMinutes += 15) {
    const candidate = new Date(targetPseudo - offsetMinutes * 60_000);
    if (sameLocalParts(localParts(candidate, timezone), expected)) matches.push(candidate);
  }
  if (matches.length !== 1) {
    throw new MultiNightPricingError(
      'LOCAL_TIME_UNRESOLVED',
      'The requested local pricing window cannot be resolved uniquely.',
    );
  }
  return matches[0] as Date;
}

function validateInstant(value: Date): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new MultiNightPricingError(
      'INVALID_INTERVAL',
      'Pricing interval contains an invalid instant.',
    );
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function digestComponent(component: DraftPricingPolicyComponent): string {
  return createHash('sha256')
    .update(
      stableJson({
        id: component.id,
        code: component.componentCode,
        kind: component.componentKind,
        coverage: component.coverageModel,
        billing: component.billingModel,
        fixedDurationMinutes: component.fixedDurationMinutes,
        localStartMinuteInclusive: component.localStartMinuteInclusive,
        localEndMinuteExclusive: component.localEndMinuteExclusive,
        localEndDayOffset: component.localEndDayOffset,
        boundaryPosition: component.boundaryPosition,
      }),
    )
    .digest('hex');
}

function priceFor(
  policy: PublishedPricingPolicyAggregate,
  componentId: string,
  priceTierId: string,
): number | undefined {
  const row = policy.prices.find(
    (price) => price.componentId === componentId && price.priceTierId === priceTierId,
  );
  if (row === undefined || row.amountVnd > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(row.amountVnd);
}

function restrictionRank(component: DraftPricingPolicyComponent): number {
  const value = component.restrictionMetadata.restrictionRank;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function allowedEdge(
  policy: PublishedPricingPolicyAggregate,
  predecessorId: string,
  successorId: string,
): boolean {
  return policy.edges.some(
    (edge) =>
      edge.predecessorComponentId === predecessorId && edge.successorComponentId === successorId,
  );
}

function displayNightCount(checkIn: Date, checkOut: Date, timezone: string): number {
  const start = localDateParts(checkIn, timezone);
  const end = localDateParts(checkOut, timezone);
  return Math.max(1, Math.round((localPseudoEpoch(end) - localPseudoEpoch(start)) / 86_400_000));
}

function makeLine(
  component: DraftPricingPolicyComponent,
  startAt: Date,
  endAt: Date,
  unitAmountVnd: number,
  occurrenceCount: number,
  billingUnitQuantity: number,
): MultiNightPricingLine {
  return {
    componentId: component.id,
    componentCode: component.componentCode,
    componentDigest: digestComponent(component),
    startAt,
    endAt,
    coverageModel: component.coverageModel,
    boundaryPosition: component.boundaryPosition,
    billingModel: component.billingModel,
    occurrenceCount,
    billingUnitQuantity,
    unitAmountVnd,
    lineAmountVnd: unitAmountVnd * billingUnitQuantity,
    restrictions: component.restrictionMetadata,
    sourceV1Provenance: component.legacyProvenance,
  };
}

function exactBoundaryUnits(startAt: Date, endAt: Date, unitMinutes: number): number {
  const elapsedMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return 0;
  return Math.ceil(elapsedMinutes / unitMinutes);
}

function candidateFor(
  input: MultiNightPricingInput,
  lines: readonly MultiNightPricingLine[],
): MultiNightPricingCandidate {
  const grossAmountVnd = lines.reduce((sum, line) => sum + line.lineAmountVnd, 0);
  if (!Number.isSafeInteger(grossAmountVnd)) {
    throw new MultiNightPricingError(
      'NO_VALID_PRICING',
      'Pricing total is outside safe integer VND.',
    );
  }
  const conditionComplexity = lines.reduce(
    (sum, line) =>
      sum +
      (input.policy.components.find((component) => component.id === line.componentId)
        ?.conditionComplexityRank ?? 0),
    0,
  );
  const restrictionRankValue = lines.reduce(
    (sum, line) =>
      sum +
      (input.policy.components.find((component) => component.id === line.componentId)
        ? restrictionRank(
            input.policy.components.find(
              (component) => component.id === line.componentId,
            ) as DraftPricingPolicyComponent,
          )
        : 0),
    0,
  );
  const candidateSeed = {
    policyId: input.policy.root.id,
    policyVersion: input.policy.root.versionNumber.toString(),
    priceTierId: input.priceTierId,
    effectiveFrom: input.policy.root.effectiveFrom.toISOString(),
    effectiveUntil: input.policy.root.effectiveUntil?.toISOString() ?? null,
    checkInAt: input.checkInAt.toISOString(),
    checkOutAt: input.checkOutAt.toISOString(),
    lines: lines.map((line) => ({
      componentId: line.componentId,
      startAt: line.startAt.toISOString(),
      endAt: line.endAt.toISOString(),
      quantity: line.billingUnitQuantity,
      amount: line.lineAmountVnd,
    })),
  };
  const stableCandidateId = createHash('sha256').update(stableJson(candidateSeed)).digest('hex');
  return {
    snapshotSchemaVersion: MULTI_NIGHT_PRICING_SNAPSHOT_VERSION,
    ruleVersion: MULTI_NIGHT_PRICING_SNAPSHOT_VERSION,
    selectedPlanCode: 'MULTI_NIGHT',
    basePlanCode: 'MULTI_NIGHT',
    policyId: input.policy.root.id,
    policyVersion: input.policy.root.versionNumber.toString(),
    applicabilityBasis: input.policy.root.applicabilityBasis,
    applicabilityInstant: new Date(input.applicabilityInstant.getTime()),
    observedPolicyInterval: {
      effectiveFrom: new Date(input.policy.root.effectiveFrom.getTime()),
      effectiveUntil:
        input.policy.root.effectiveUntil === null
          ? null
          : new Date(input.policy.root.effectiveUntil.getTime()),
    },
    requestedInterval: {
      checkInAt: new Date(input.checkInAt.getTime()),
      checkOutAt: new Date(input.checkOutAt.getTime()),
    },
    propertyTimezone: input.propertyTimezone,
    lines,
    displayNightCount: displayNightCount(input.checkInAt, input.checkOutAt, input.propertyTimezone),
    grossAmountVnd,
    discountAmountVnd: 0,
    finalAmountVnd: grossAmountVnd,
    totalAmountVnd: grossAmountVnd,
    componentCount: lines.length,
    conditionComplexity,
    restrictionRank: restrictionRankValue,
    stableCandidateId,
    rationale: 'Exact continuous coverage using one published policy release.',
  };
}

function candidateSort(a: MultiNightPricingCandidate, b: MultiNightPricingCandidate): number {
  return (
    a.componentCount - b.componentCount ||
    a.conditionComplexity - b.conditionComplexity ||
    a.restrictionRank - b.restrictionRank ||
    a.finalAmountVnd - b.finalAmountVnd ||
    a.stableCandidateId.localeCompare(b.stableCandidateId)
  );
}

function validateLineSequence(
  policy: PublishedPricingPolicyAggregate,
  lines: readonly MultiNightPricingLine[],
  checkInAt: Date,
  checkOutAt: Date,
): boolean {
  if (lines.length < 1 || lines.length > MAX_PRICING_POLICY_COMPONENT_LINES) return false;
  if (lines[0]?.startAt.getTime() !== checkInAt.getTime()) return false;
  if (lines[lines.length - 1]?.endAt.getTime() !== checkOutAt.getTime()) return false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.endAt <= line.startAt) return false;
    if (index === 0) continue;
    const previous = lines[index - 1];
    if (previous === undefined || previous.endAt.getTime() !== line.startAt.getTime()) return false;
    if (!allowedEdge(policy, previous.componentId, line.componentId)) return false;
  }
  return true;
}

export function composeMultiNightPricing(input: MultiNightPricingInput): MultiNightPricingResult {
  validateInstant(input.checkInAt);
  validateInstant(input.checkOutAt);
  validateInstant(input.applicabilityInstant);
  if (input.checkOutAt <= input.checkInAt) {
    throw new MultiNightPricingError('INVALID_INTERVAL', 'Check-out must be after check-in.');
  }
  if (input.policy.root.applicabilityBasis !== 'STAY_START') {
    throw new MultiNightPricingError(
      'NO_VALID_PRICING',
      'B0 multi-night pricing requires the STAY_START applicability basis.',
    );
  }
  if (input.applicabilityInstant.getTime() !== input.checkInAt.getTime()) {
    throw new MultiNightPricingError(
      'NO_VALID_PRICING',
      'STAY_START pricing requires the exact check-in instant as applicability instant.',
    );
  }
  const components = [...input.policy.components].sort(
    (a, b) => a.componentCode.localeCompare(b.componentCode) || a.id.localeCompare(b.id),
  );
  const leading = components.filter(
    (component) =>
      component.componentKind === 'EXTENSION' &&
      component.coverageModel === 'REQUEST_BOUNDARY' &&
      component.boundaryPosition === 'LEADING',
  );
  const trailing = components.filter(
    (component) =>
      component.componentKind === 'EXTENSION' &&
      component.coverageModel === 'REQUEST_BOUNDARY' &&
      component.boundaryPosition === 'TRAILING',
  );
  const continuations = components.filter(
    (component) =>
      component.componentKind === 'BASE_STAY' &&
      component.coverageModel === 'FIXED_ELAPSED' &&
      component.billingModel === 'FIXED_OCCURRENCE' &&
      component.fixedDurationMinutes === 1_440,
  );
  const finalWindows = components.filter(
    (component) =>
      component.componentKind === 'BASE_STAY' &&
      component.coverageModel === 'LOCAL_CLOCK_WINDOW' &&
      component.billingModel === 'FIXED_OCCURRENCE',
  );
  const checkInLocal = localParts(input.checkInAt, input.propertyTimezone);
  const checkInLocalMinute = localMinute(checkInLocal);
  const candidates: MultiNightPricingCandidate[] = [];
  let searchStates = 0;

  for (const finalComponent of finalWindows) {
    const startMinute = finalComponent.localStartMinuteInclusive;
    const endMinute = finalComponent.localEndMinuteExclusive;
    const endDayOffset = finalComponent.localEndDayOffset;
    if (startMinute === null || endMinute === null || endDayOffset === null) continue;
    const startDate: LocalCalendarDate = {
      year: checkInLocal.year,
      month: checkInLocal.month,
      day: checkInLocal.day,
    };
    if (checkInLocalMinute > startMinute) continue;
    let firstWindowStart: Date;
    let firstWindowEnd: Date;
    try {
      firstWindowStart = resolveLocalDateTime(startDate, startMinute, input.propertyTimezone);
      firstWindowEnd = resolveLocalDateTime(
        addCalendarDays(startDate, endDayOffset),
        endMinute,
        input.propertyTimezone,
      );
    } catch (error) {
      if (error instanceof MultiNightPricingError) throw error;
      throw new MultiNightPricingError('LOCAL_TIME_UNRESOLVED', 'Local pricing window failed.');
    }
    const leadingOptions =
      input.checkInAt.getTime() === firstWindowStart.getTime() ? [undefined] : leading;
    for (const leadingComponent of leadingOptions) {
      if (leadingComponent !== undefined && input.checkInAt >= firstWindowStart) continue;
      const leadingUnits =
        leadingComponent === undefined
          ? 0
          : exactBoundaryUnits(
              input.checkInAt,
              firstWindowStart,
              leadingComponent.billingUnitMinutes ?? 60,
            );
      if (
        leadingComponent !== undefined &&
        (leadingUnits < (leadingComponent.minimumBillingUnits ?? 1) ||
          leadingUnits > (leadingComponent.maximumBillingUnits ?? Number.MAX_SAFE_INTEGER) ||
          firstWindowStart.getTime() - input.checkInAt.getTime() <
            (leadingComponent.boundaryMinDurationMinutes ?? 0) * 60_000 ||
          firstWindowStart.getTime() - input.checkInAt.getTime() >
            (leadingComponent.boundaryMaxDurationMinutes ?? Number.MAX_SAFE_INTEGER) * 60_000 ||
          (!allowedEdge(
            leadingComponent.policyVersionId === input.policy.root.id ? input.policy : input.policy,
            leadingComponent.id,
            finalComponent.id,
          ) &&
            continuations.length === 0))
      ) {
        continue;
      }
      for (const continuationComponent of [undefined, ...continuations]) {
        for (let continuationCount = 0; continuationCount <= 31; continuationCount += 1) {
          searchStates += 1;
          if (searchStates > MAX_PRICING_POLICY_SEARCH_STATES) {
            throw new MultiNightPricingError(
              'MAXIMUM_SEARCH_STATE_EXCEEDED',
              'Multi-night pricing search state bound was exceeded.',
            );
          }
          const finalStart = new Date(
            firstWindowStart.getTime() + continuationCount * 1_440 * 60_000,
          );
          if (continuationCount > 0 && continuationComponent === undefined) continue;
          if (
            continuationComponent !== undefined &&
            continuationCount > continuationComponent.maximumOccurrencesPerCandidate - 1
          ) {
            continue;
          }
          const finalEnd = new Date(
            finalStart.getTime() + (firstWindowEnd.getTime() - firstWindowStart.getTime()),
          );
          if (finalEnd > input.checkOutAt) continue;
          const trailingOptions =
            finalEnd.getTime() === input.checkOutAt.getTime() ? [undefined] : trailing;
          for (const trailingComponent of trailingOptions) {
            const trailingUnits =
              trailingComponent === undefined
                ? 0
                : exactBoundaryUnits(
                    finalEnd,
                    input.checkOutAt,
                    trailingComponent.billingUnitMinutes ?? 60,
                  );
            if (
              trailingComponent !== undefined &&
              (trailingUnits < (trailingComponent.minimumBillingUnits ?? 1) ||
                trailingUnits >
                  (trailingComponent.maximumBillingUnits ?? Number.MAX_SAFE_INTEGER) ||
                input.checkOutAt.getTime() - finalEnd.getTime() <
                  (trailingComponent.boundaryMinDurationMinutes ?? 0) * 60_000 ||
                input.checkOutAt.getTime() - finalEnd.getTime() >
                  (trailingComponent.boundaryMaxDurationMinutes ?? Number.MAX_SAFE_INTEGER) *
                    60_000)
            ) {
              continue;
            }
            const selectedComponents = [
              ...(leadingComponent === undefined ? [] : [leadingComponent]),
              ...(continuationCount === 0 || continuationComponent === undefined
                ? []
                : Array.from({ length: continuationCount }, () => continuationComponent)),
              finalComponent,
              ...(trailingComponent === undefined ? [] : [trailingComponent]),
            ];
            const lineIntervals: Array<readonly [Date, Date]> = [];
            if (leadingComponent !== undefined)
              lineIntervals.push([input.checkInAt, firstWindowStart]);
            for (let index = 0; index < continuationCount; index += 1) {
              const start = new Date(firstWindowStart.getTime() + index * 1_440 * 60_000);
              lineIntervals.push([start, new Date(start.getTime() + 1_440 * 60_000)]);
            }
            lineIntervals.push([finalStart, finalEnd]);
            if (trailingComponent !== undefined) lineIntervals.push([finalEnd, input.checkOutAt]);
            if (lineIntervals.length !== selectedComponents.length) continue;
            const lines = selectedComponents.map((component, index) => {
              const interval = lineIntervals[index] as readonly [Date, Date];
              const amount = priceFor(input.policy, component.id, input.priceTierId);
              if (amount === undefined) return undefined;
              const quantity =
                component.billingModel === 'STARTED_UNIT'
                  ? exactBoundaryUnits(interval[0], interval[1], component.billingUnitMinutes ?? 60)
                  : 1;
              if (quantity <= 0) return undefined;
              return makeLine(component, interval[0], interval[1], amount, 1, quantity);
            });
            if (lines.some((line) => line === undefined)) continue;
            const validLines = lines as MultiNightPricingLine[];
            if (!validateLineSequence(input.policy, validLines, input.checkInAt, input.checkOutAt))
              continue;
            candidates.push(candidateFor(input, validLines));
          }
        }
      }
    }
  }
  const sorted = candidates.sort(candidateSort);
  if (sorted.length === 0) {
    throw new MultiNightPricingError(
      'NO_VALID_PRICING',
      'No published pricing policy candidate covers the complete requested interval.',
    );
  }
  return { candidates: sorted.slice(0, 24), selected: sorted[0] as MultiNightPricingCandidate };
}
