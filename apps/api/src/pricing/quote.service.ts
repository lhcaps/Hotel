import {
  availabilityOfferRequestSchema,
  availabilityOfferResponseSchema,
  createQuoteRequestSchema,
  quoteSchema,
  type AvailabilityState,
  type CreateQuoteRequest,
} from '@room/contracts';
import type {
  MultiNightPricingCandidate,
  MultiNightPricingResult,
  MultiNightPricingSelectionReason,
} from '../pricing-policy/pricing-policy.composer.js';
import type { MultiNightOfferService } from './multi-night-offer.service.js';
import {
  calculatePricing,
  evaluatePricingCandidates,
  InvalidPricingIntervalError,
  PricingConfigurationError,
  PricingRuleNotFoundError,
  type PricingCatalog,
} from './pricing-engine.js';
import { CouponRepository, type ProvisionalCouponEvaluation } from './coupon.repository.js';

export class QuoteUnavailableError extends Error {
  public readonly code = 'AVAILABILITY_UNAVAILABLE';
}
export class QuoteServiceUnavailableError extends Error {
  public readonly code = 'SERVICE_UNAVAILABLE';
}
export class QuoteNoValidPricingError extends Error {
  public readonly code = 'NO_VALID_PRICING';
}
export class QuoteNotFoundError extends Error {
  public readonly code = 'QUOTE_NOT_FOUND';
}
export class QuoteExpiredError extends Error {
  public readonly code = 'QUOTE_EXPIRED';
}
export class QuotePricingConfigurationError extends Error {
  public readonly code = 'PRICING_CONFIGURATION_UNAVAILABLE';
}

export type MultiNightQuoteState = Extract<
  AvailabilityState,
  | 'INVALID_INTERVAL'
  | 'BELOW_MINIMUM_STAY'
  | 'ABOVE_MAXIMUM_STAY'
  | 'INVALID_GUEST_COUNT'
  | 'NO_CONTINUOUS_ROOM'
  | 'NO_VALID_PRICING'
  | 'POLICY_NOT_CONFIGURED'
  | 'SERVICE_UNAVAILABLE'
>;

export class QuoteMultiNightStateError extends Error {
  public readonly code: MultiNightQuoteState;

  public constructor(code: MultiNightQuoteState) {
    super(code);
    this.name = 'QuoteMultiNightStateError';
    this.code = code;
  }
}

export class CouponNotApplicableError extends Error {
  public readonly code = 'COUPON_NOT_APPLICABLE';
}

export class CouponExpiredError extends Error {
  public readonly code = 'COUPON_EXPIRED';
}

export class CouponMinimumNotMetError extends Error {
  public readonly code = 'COUPON_MINIMUM_NOT_MET';
}

export class CouponInvalidInputError extends Error {
  public readonly code = 'COUPON_INVALID_INPUT';
}
export interface QuoteRepositoryPort {
  issue(
    input: CreateQuoteRequest,
    pricing: ReturnType<typeof calculatePricing> | MultiNightPricingCandidate,
    coupon: ProvisionalCouponEvaluation | undefined,
  ): Promise<unknown>;
  get(id: string): Promise<{ readonly snapshot: unknown; readonly expired: boolean } | undefined>;
  catalogFor(input: CreateQuoteRequest): Promise<
    | {
        readonly available: boolean;
        readonly priceTierCode: string;
        readonly propertyTimezone: string;
        readonly catalog: PricingCatalog;
        readonly planLabels: Readonly<Record<string, string>>;
        readonly propertyId: string;
        readonly roomTypeName: string;
      }
    | undefined
  >;
}

export interface QuoteServiceOptions {
  readonly couponRepository?: CouponRepository;
  readonly multiNight?: Pick<MultiNightOfferService, 'quote'> &
    Partial<Pick<MultiNightOfferService, 'search'>>;
}
export class QuoteService {
  public constructor(
    private readonly repository: QuoteRepositoryPort,
    private readonly options: QuoteServiceOptions = {},
  ) {}
  public async eligibleOffers(input: unknown) {
    const request = availabilityOfferRequestSchema.parse(input);
    if (request.mode === 'multi_night') {
      if (this.options.multiNight === undefined) throw new QuoteServiceUnavailableError();
      const source = await this.options.multiNight.quote({
        ...request,
        roomTypeId: request.roomTypeId,
      });
      if (source === undefined || !source.available) {
        throw new QuoteNoValidPricingError();
      }
      return availabilityOfferResponseSchema.parse({
        items: source.pricing.candidates.map((candidate) => ({
          planCode: 'MULTI_NIGHT',
          planLabel: 'Multi-night stay',
          includedDurationMinutes: Math.min(
            1_440,
            Math.max(
              60,
              Math.round(
                (candidate.requestedInterval.checkOutAt.getTime() -
                  candidate.requestedInterval.checkInAt.getTime()) /
                  60_000,
              ),
            ),
          ),
          extraUnits: candidate.lines
            .filter((line) => line.billingModel === 'STARTED_UNIT')
            .reduce((sum, line) => sum + line.billingUnitQuantity, 0),
          totalAmountVnd: candidate.finalAmountVnd,
          nightCount: candidate.displayNightCount,
          leadingExtraUnits: candidate.lines
            .filter((line) => line.boundaryPosition === 'LEADING')
            .reduce((sum, line) => sum + line.billingUnitQuantity, 0),
          trailingExtraUnits: candidate.lines
            .filter((line) => line.boundaryPosition === 'TRAILING')
            .reduce((sum, line) => sum + line.billingUnitQuantity, 0),
          summary: candidate.rationale,
          minCheckInMinuteInclusive: null,
          maxCheckInMinuteExclusive: null,
        })),
      });
    }
    const source = await this.repository.catalogFor(request);
    if (source === undefined || !source.available) {
      return availabilityOfferResponseSchema.parse({ items: [] });
    }
    const plans = [
      ...evaluatePricingCandidates(
        {
          checkIn: request.checkIn,
          checkOut: request.checkOut,
          priceTierCode: source.priceTierCode,
          timezone: source.propertyTimezone,
        },
        source.catalog,
      ),
    ]
      .sort((a, b) => a.grossAmountVnd - b.grossAmountVnd || b.priority - a.priority)
      .map((candidate) => {
        const plan = source.catalog[candidate.planCode];
        return {
          planCode: candidate.planCode,
          planLabel: source.planLabels[candidate.planCode] ?? candidate.planCode,
          includedDurationMinutes: candidate.includedDurationMinutes,
          extraUnits: candidate.extraUnits,
          totalAmountVnd: candidate.grossAmountVnd,
          minCheckInMinuteInclusive: plan?.minCheckInMinuteInclusive ?? null,
          maxCheckInMinuteExclusive: plan?.maxCheckInMinuteExclusive ?? null,
        };
      });
    return availabilityOfferResponseSchema.parse({ items: plans });
  }

  public async issue(input: unknown) {
    const parsed = createQuoteRequestSchema.safeParse(input);
    if (!parsed.success && isRawMultiNightRequest(input)) {
      throw new QuoteMultiNightStateError(rawMultiNightValidationState(input, parsed.error));
    }
    const request = parsed.success ? parsed.data : createQuoteRequestSchema.parse(input);
    if (request.mode === 'multi_night') {
      if (this.options.multiNight === undefined) throw new QuoteServiceUnavailableError();
      const source = await this.options.multiNight.quote(request);
      if (source === undefined || !source.available) {
        const state = await this.multiNightState({ ...request, mode: 'multi_night' });
        if (state !== undefined) {
          throw new QuoteMultiNightStateError(state);
        }
        if (source === undefined) throw new QuoteNoValidPricingError();
        throw new QuoteUnavailableError();
      }
      const pricing = withMultiNightSelection(source.pricing);
      let provisionalEvaluation: ProvisionalCouponEvaluation | undefined;
      if (request.couponCode !== undefined && this.options.couponRepository !== undefined) {
        provisionalEvaluation = await this.options.couponRepository.evaluateForQuote({
          propertyId: source.propertyId,
          roomTypeId: request.roomTypeId,
          grossAmountVnd: pricing.finalAmountVnd,
          couponCode: request.couponCode,
        });
      }
      return quoteSchema.parse(
        await this.repository.issue(request, pricing, provisionalEvaluation),
      );
    }
    const source = await this.repository.catalogFor(request);
    if (source === undefined || !source.available) throw new QuoteUnavailableError();
    try {
      const pricingInput = {
        checkIn: request.checkIn,
        checkOut: request.checkOut,
        priceTierCode: source.priceTierCode,
        timezone: source.propertyTimezone,
      };
      const eligible = evaluatePricingCandidates(pricingInput, source.catalog);
      const selected =
        request.selectedPlanCode === undefined
          ? undefined
          : eligible.find((candidate) => candidate.planCode === request.selectedPlanCode);
      if (request.selectedPlanCode !== undefined && selected === undefined) {
        throw new PricingRuleNotFoundError('Selected plan is not eligible for this interval.');
      }
      const pricing =
        selected === undefined
          ? calculatePricing(pricingInput, source.catalog)
          : {
              ruleVersion: 'phase-8b-cheapest-eligible-pricing-v1' as const,
              selectedPlanCode: selected.planCode,
              basePlanCode: selected.planCode,
              baseMinutes: selected.includedDurationMinutes,
              extraUnits: selected.extraUnits,
              baseAmountVnd: selected.baseAmountVnd,
              extraAmountVnd: selected.extraAmountVnd,
              totalAmountVnd: selected.grossAmountVnd,
              lineItems: [
                { code: selected.planCode, amountVnd: selected.baseAmountVnd, units: 1 },
                ...(selected.extraUnits === 0
                  ? []
                  : [
                      {
                        code: 'EXTRA_HOUR' as const,
                        amountVnd: selected.extraAmountVnd,
                        units: selected.extraUnits,
                      },
                    ]),
              ],
            };
      let provisionalEvaluation: ProvisionalCouponEvaluation | undefined;
      if (request.couponCode !== undefined && this.options.couponRepository !== undefined) {
        provisionalEvaluation = await this.options.couponRepository.evaluateForQuote({
          propertyId: source.propertyId,
          roomTypeId: request.roomTypeId,
          grossAmountVnd: Math.trunc(pricing.totalAmountVnd),
          couponCode: request.couponCode,
        });
      }
      return quoteSchema.parse(
        await this.repository.issue(request, pricing, provisionalEvaluation),
      );
    } catch (error) {
      if (
        error instanceof PricingConfigurationError ||
        error instanceof InvalidPricingIntervalError
      ) {
        throw new QuotePricingConfigurationError();
      }
      if (error instanceof Error && error.name === 'CouponInvalidInputError') {
        throw new CouponInvalidInputError();
      }
      if (error instanceof Error && error.name === 'CouponExpiredError') {
        throw new CouponExpiredError();
      }
      if (error instanceof Error && error.name === 'CouponNotApplicableError') {
        throw new CouponNotApplicableError();
      }
      if (error instanceof Error && error.name === 'CouponMinimumNotMetError') {
        throw new CouponMinimumNotMetError();
      }
      throw error;
    }
  }
  public async get(id: string) {
    const found = await this.repository.get(id);
    if (found === undefined) throw new QuoteNotFoundError();
    if (found.expired) throw new QuoteExpiredError();
    return quoteSchema.parse(found.snapshot);
  }

  private async multiNightState(
    request: CreateQuoteRequest & { readonly mode: 'multi_night' },
  ): Promise<MultiNightQuoteState | undefined> {
    if (this.options.multiNight?.search === undefined) return undefined;
    const result = await this.options.multiNight.search(request);
    const state = result.state;
    if (
      state === 'INVALID_INTERVAL' ||
      state === 'BELOW_MINIMUM_STAY' ||
      state === 'ABOVE_MAXIMUM_STAY' ||
      state === 'INVALID_GUEST_COUNT' ||
      state === 'NO_CONTINUOUS_ROOM' ||
      state === 'NO_VALID_PRICING' ||
      state === 'POLICY_NOT_CONFIGURED' ||
      state === 'SERVICE_UNAVAILABLE'
    ) {
      return state;
    }
    return undefined;
  }
}

function withMultiNightSelection(result: MultiNightPricingResult): MultiNightPricingCandidate {
  const selected = result.selected;
  const next = result.candidates.find(
    (candidate) => candidate.stableCandidateId !== selected.stableCandidateId,
  );
  const selectionReason: MultiNightPricingSelectionReason =
    next === undefined || selected.finalAmountVnd !== next.finalAmountVnd
      ? 'LOWEST_VALID_CUSTOMER_TOTAL'
      : selected.componentCount !== next.componentCount
        ? 'FEWER_COMPONENTS_TIE_BREAK'
        : selected.conditionComplexity !== next.conditionComplexity
          ? 'LOWER_CONDITION_COMPLEXITY_TIE_BREAK'
          : selected.restrictionRank !== next.restrictionRank
            ? 'LOWER_RESTRICTION_RANK_TIE_BREAK'
            : 'STABLE_CANDIDATE_TIE_BREAK';
  return {
    ...selected,
    selectionReason,
    alternatives: result.candidates
      .filter((candidate) => candidate.stableCandidateId !== selected.stableCandidateId)
      .map((candidate) => ({
        stableCandidateId: candidate.stableCandidateId,
        finalAmountVnd: candidate.finalAmountVnd,
        componentCount: candidate.componentCount,
        conditionComplexity: candidate.conditionComplexity,
        restrictionRank: candidate.restrictionRank,
        rationale: candidate.rationale,
      })),
  };
}

function isRawMultiNightRequest(input: unknown): input is Record<string, unknown> {
  return (
    typeof input === 'object' &&
    input !== null &&
    (input as { readonly mode?: unknown }).mode === 'multi_night'
  );
}

function rawMultiNightValidationState(
  input: Record<string, unknown>,
  error: { readonly issues: readonly { readonly path: readonly PropertyKey[] }[] },
): MultiNightQuoteState {
  if (error.issues.some((issue) => issue.path[0] === 'adults' || issue.path[0] === 'children')) {
    return 'INVALID_GUEST_COUNT';
  }
  const checkIn = typeof input.checkIn === 'string' ? new Date(input.checkIn).getTime() : NaN;
  const checkOut = typeof input.checkOut === 'string' ? new Date(input.checkOut).getTime() : NaN;
  if (
    Number.isFinite(checkIn) &&
    Number.isFinite(checkOut) &&
    checkOut - checkIn > 31 * 86_400_000
  ) {
    return 'ABOVE_MAXIMUM_STAY';
  }
  return 'INVALID_INTERVAL';
}
