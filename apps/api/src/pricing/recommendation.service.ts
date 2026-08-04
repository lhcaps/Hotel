/**
 * Phase 8B advisory flexible-time recommendation service.
 *
 * Pure module: does not allocate rooms, does not reserve coupon quota, does
 * not create HOLDs or persistent quotes. The customer must explicitly select
 * one of the recommendations and then go through the regular quote endpoint
 * which re-evaluates pricing, availability and coupons.
 *
 * The recommendation search preserves stay duration exactly, walks check-in
 * offsets from -60 to +60 minutes in 15-minute steps, and reuses the
 * cheapest-eligible pricing selector for every candidate.
 */

import { evaluatePricingCandidates, type PricingCandidate } from './cheapest-eligible-pricing.js';
import {
  InvalidPricingIntervalError,
  PricingConfigurationError,
  EXTRA_HOUR_CODE,
  type PricingBreakdown,
  type PricingCatalog,
  type PricingInput,
} from './selection-rule-matcher.js';

export const RECOMMENDATION_MAX_OFFSET_MINUTES = 60;
export const RECOMMENDATION_STEP_MINUTES = 15;
export const RECOMMENDATION_MAX_CANDIDATES = 3;

export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';

export interface AvailabilityProbe {
  /**
   * Returns true when the supplied candidate interval still has at least
   * one physical room available. Probe implementations MUST be pure for
   * a given timestamp; they must not allocate rooms.
   */
  isAvailable(input: PricingInput): Promise<boolean>;
}

export interface ProvisionalCouponProbe {
  /**
   * Returns the discount amount the customer would receive if a coupon
   * code is applied to the supplied gross. MUST NOT reserve quota.
   */
  preview(input: PricingInput, grossAmountVnd: number): Promise<number>;
}

export interface RecommendationInput {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly priceTierCode: string;
  readonly timezone: string;
  readonly couponCode?: string;
}

export interface RecommendationCandidate {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly shiftMinutes: number;
  readonly selectedPlanCode: PricingCandidate['planCode'];
  readonly grossAmountVnd: number;
  readonly discountAmountVnd: number;
  readonly finalAmountVnd: number;
  readonly savingsVnd: number;
  readonly availabilityStatus: AvailabilityStatus;
  readonly category: 'CLOSEST_CHEAPER' | 'CHEAPEST_NEARBY' | 'PARETO_ALTERNATIVE';
}

export interface RecommendationResult {
  readonly exactResult: {
    readonly pricing: PricingBreakdown;
    readonly finalAmountVnd: number;
    readonly discountAmountVnd: number;
  };
  readonly recommendations: readonly RecommendationCandidate[];
  readonly generatedAt: string;
  readonly advisoryExpiresAt: string;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const ADVISORY_VALIDITY_MINUTES = 5;

export class RecommendationUnavailableError extends Error {
  public readonly code = 'RECOMMENDATION_UNAVAILABLE';
}
export class RecommendationInvalidIntervalError extends InvalidPricingIntervalError {}

function ensureValidDuration(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new RecommendationInvalidIntervalError('Recommendation interval is invalid.');
  }
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0 || durationMs > 31 * 24 * 60 * MINUTE) {
    throw new RecommendationInvalidIntervalError(
      'Recommendation interval must be greater than zero and no longer than 31 days.',
    );
  }
  return Math.ceil(durationMs / MINUTE);
}

function shiftInstant(value: string, offsetMinutes: number): string {
  const date = new Date(value);
  return new Date(date.getTime() + offsetMinutes * MINUTE).toISOString();
}

export interface SearchRecommendationOptions {
  readonly availability: AvailabilityProbe;
  readonly coupon?: ProvisionalCouponProbe;
  readonly maxRecommendations?: number;
  readonly now?: () => Date;
}

interface CandidateScore {
  readonly candidate: PricingCandidate;
  readonly shiftMinutes: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly finalAmountVnd: number;
  readonly discountAmountVnd: number;
  readonly availabilityStatus: AvailabilityStatus;
}

async function scoreCandidate(
  input: RecommendationInput,
  candidate: PricingCandidate,
  shiftMinutes: number,
  availability: AvailabilityProbe,
  coupon: ProvisionalCouponProbe | undefined,
): Promise<CandidateScore | null> {
  const candidateInput: PricingInput = {
    checkIn: shiftInstant(input.checkIn, shiftMinutes),
    checkOut: shiftInstant(input.checkOut, shiftMinutes),
    priceTierCode: input.priceTierCode,
    timezone: input.timezone,
  };
  let availabilityStatus: AvailabilityStatus = 'UNKNOWN';
  try {
    availabilityStatus = (await availability.isAvailable(candidateInput))
      ? 'AVAILABLE'
      : 'UNAVAILABLE';
  } catch {
    availabilityStatus = 'UNKNOWN';
  }
  if (availabilityStatus === 'UNAVAILABLE') return null;
  let discount = 0;
  if (coupon !== undefined && input.couponCode !== undefined) {
    try {
      discount = await coupon.preview(candidateInput, candidate.grossAmountVnd);
    } catch {
      discount = 0;
    }
  }
  return {
    candidate,
    shiftMinutes,
    checkIn: candidateInput.checkIn,
    checkOut: candidateInput.checkOut,
    finalAmountVnd: Math.max(0, candidate.grossAmountVnd - discount),
    discountAmountVnd: discount,
    availabilityStatus,
  };
}

function pickCheapest(scores: readonly CandidateScore[]): CandidateScore | undefined {
  let best: CandidateScore | undefined;
  for (const score of scores) {
    if (best === undefined) {
      best = score;
      continue;
    }
    if (score.finalAmountVnd < best.finalAmountVnd) {
      best = score;
      continue;
    }
    if (
      score.finalAmountVnd === best.finalAmountVnd &&
      Math.abs(score.shiftMinutes) < Math.abs(best.shiftMinutes)
    ) {
      best = score;
    }
  }
  return best;
}

function pickClosestCheaper(
  scores: readonly CandidateScore[],
  baseline: number,
): CandidateScore | undefined {
  let best: CandidateScore | undefined;
  for (const score of scores) {
    if (score.finalAmountVnd >= baseline) continue;
    if (best === undefined) {
      best = score;
      continue;
    }
    if (Math.abs(score.shiftMinutes) < Math.abs(best.shiftMinutes)) {
      best = score;
      continue;
    }
    if (
      Math.abs(score.shiftMinutes) === Math.abs(best.shiftMinutes) &&
      score.finalAmountVnd < best.finalAmountVnd
    ) {
      best = score;
    }
  }
  return best;
}

function pickParetoAlternative(
  scores: readonly CandidateScore[],
  excluded: readonly CandidateScore[],
  baseline: number,
): CandidateScore | undefined {
  const excludedIds = new Set(
    excluded.map((score) => `${score.shiftMinutes}|${score.candidate.planCode}`),
  );
  let best: CandidateScore | undefined;
  for (const score of scores) {
    if (score.finalAmountVnd >= baseline) continue;
    const id = `${score.shiftMinutes}|${score.candidate.planCode}`;
    if (excludedIds.has(id)) continue;
    if (best === undefined) {
      best = score;
      continue;
    }
    if (score.finalAmountVnd < best.finalAmountVnd) {
      best = score;
      continue;
    }
    if (
      score.finalAmountVnd === best.finalAmountVnd &&
      Math.abs(score.shiftMinutes) < Math.abs(best.shiftMinutes)
    ) {
      best = score;
    }
  }
  return best;
}

function stableOrdering(scores: readonly CandidateScore[]): readonly CandidateScore[] {
  return [...scores].sort((a, b) => {
    if (a.finalAmountVnd !== b.finalAmountVnd) return a.finalAmountVnd - b.finalAmountVnd;
    if (a.shiftMinutes !== b.shiftMinutes)
      return Math.abs(a.shiftMinutes) - Math.abs(b.shiftMinutes);
    if (a.checkIn !== b.checkIn) return a.checkIn < b.checkIn ? -1 : 1;
    return a.candidate.planCode < b.candidate.planCode ? -1 : 1;
  });
}

export async function searchRecommendations(
  input: RecommendationInput,
  catalog: PricingCatalog,
  options: SearchRecommendationOptions,
): Promise<RecommendationResult> {
  ensureValidDuration(input.checkIn, input.checkOut);
  let exactPricingCandidates: readonly PricingCandidate[];
  try {
    exactPricingCandidates = evaluatePricingCandidates(
      {
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        priceTierCode: input.priceTierCode,
        timezone: input.timezone,
      },
      catalog,
    );
  } catch (error) {
    if (error instanceof InvalidPricingIntervalError) {
      throw new RecommendationUnavailableError(
        'Pricing is not configured for the requested interval.',
      );
    }
    throw error;
  }
  if (exactPricingCandidates.length === 0) {
    throw new RecommendationUnavailableError('No eligible base plan for the requested interval.');
  }
  const exactSelected = exactPricingCandidates.reduce((best, current) =>
    current.grossAmountVnd < best.grossAmountVnd ? current : best,
  );
  const offsetValues: number[] = [];
  for (
    let offset = -RECOMMENDATION_MAX_OFFSET_MINUTES;
    offset <= RECOMMENDATION_MAX_OFFSET_MINUTES;
    offset += RECOMMENDATION_STEP_MINUTES
  ) {
    if (offset === 0) continue;
    offsetValues.push(offset);
  }
  const scored: CandidateScore[] = [];
  for (const offset of offsetValues) {
    const candidates = evaluatePricingCandidates(
      {
        checkIn: shiftInstant(input.checkIn, offset),
        checkOut: shiftInstant(input.checkOut, offset),
        priceTierCode: input.priceTierCode,
        timezone: input.timezone,
      },
      catalog,
    );
    if (candidates.length === 0) continue;
    const cheapest = candidates.reduce((best, current) =>
      current.grossAmountVnd < best.grossAmountVnd ? current : best,
    );
    const score = await scoreCandidate(
      input,
      cheapest,
      offset,
      options.availability,
      options.coupon,
    );
    if (score !== null) scored.push(score);
  }

  const exactDiscount =
    options.coupon !== undefined && input.couponCode !== undefined
      ? await options.coupon
          .preview(
            {
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              priceTierCode: input.priceTierCode,
              timezone: input.timezone,
            },
            exactSelected.grossAmountVnd,
          )
          .catch(() => 0)
      : 0;

  const exactFinal = Math.max(0, exactSelected.grossAmountVnd - exactDiscount);
  const baseline = exactFinal;
  const maxRecommendations = options.maxRecommendations ?? RECOMMENDATION_MAX_CANDIDATES;

  const closest = pickClosestCheaper(scored, baseline);
  const cheapest = pickCheapest(scored.filter((score) => score.finalAmountVnd < baseline));
  const pareto = pickParetoAlternative(
    scored,
    [...(closest ? [closest] : []), ...(cheapest ? [cheapest] : [])],
    baseline,
  );

  const picked: CandidateScore[] = [];
  if (closest !== undefined) picked.push(closest);
  if (cheapest !== undefined && !picked.includes(cheapest)) picked.push(cheapest);
  if (pareto !== undefined && !picked.includes(pareto)) picked.push(pareto);

  const dedup = stableOrdering(picked).slice(0, maxRecommendations);
  const recs: RecommendationCandidate[] = [];
  const categoryFor = (score: CandidateScore): RecommendationCandidate['category'] => {
    if (closest !== undefined && score === closest) return 'CLOSEST_CHEAPER';
    if (cheapest !== undefined && score === cheapest) return 'CHEAPEST_NEARBY';
    return 'PARETO_ALTERNATIVE';
  };
  for (const score of dedup) {
    recs.push({
      checkIn: score.checkIn,
      checkOut: score.checkOut,
      shiftMinutes: score.shiftMinutes,
      selectedPlanCode: score.candidate.planCode,
      grossAmountVnd: score.candidate.grossAmountVnd,
      discountAmountVnd: score.discountAmountVnd,
      finalAmountVnd: score.finalAmountVnd,
      savingsVnd: baseline - score.finalAmountVnd,
      availabilityStatus: score.availabilityStatus,
      category: categoryFor(score),
    });
  }

  const now = (options.now ?? (() => new Date()))();
  const expires = new Date(now.getTime() + ADVISORY_VALIDITY_MINUTES * MINUTE);
  const exactBreakdown: PricingBreakdown = Object.freeze({
    ruleVersion: 'phase-8b-cheapest-eligible-pricing-v1',
    selectedPlanCode: exactSelected.planCode,
    basePlanCode: exactSelected.planCode,
    baseMinutes: exactSelected.includedDurationMinutes,
    extraUnits: exactSelected.extraUnits,
    baseAmountVnd: exactSelected.baseAmountVnd,
    extraAmountVnd: exactSelected.extraAmountVnd,
    totalAmountVnd: exactSelected.grossAmountVnd,
    lineItems: Object.freeze([
      Object.freeze({
        code: exactSelected.planCode,
        amountVnd: exactSelected.baseAmountVnd,
        units: 1,
      }),
      ...(exactSelected.extraUnits === 0
        ? []
        : [
            Object.freeze({
              code: EXTRA_HOUR_CODE,
              amountVnd: exactSelected.extraAmountVnd,
              units: exactSelected.extraUnits,
            }),
          ]),
    ]),
  });

  return Object.freeze({
    exactResult: Object.freeze({
      pricing: exactBreakdown,
      finalAmountVnd: exactFinal,
      discountAmountVnd: exactDiscount,
    }),
    recommendations: Object.freeze(recs),
    generatedAt: now.toISOString(),
    advisoryExpiresAt: expires.toISOString(),
  });
}

// Re-export pricing errors so callers can centralize error mapping.
export { PricingConfigurationError };
