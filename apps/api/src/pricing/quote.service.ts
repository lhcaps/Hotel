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
  type PricingBreakdown,
} from './pricing-engine.js';
import { CouponRepository, type ProvisionalCouponEvaluation } from './coupon.repository.js';
import { resolveFlexibleStay } from './flexible-stay-resolver.js';

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
  catalogFor(input: CreateQuoteRequest): Promise<QuoteCatalogSource | undefined>;
}

export interface QuoteCatalogSource {
  readonly available: boolean;
  readonly priceTierCode: string;
  readonly propertyTimezone: string;
  readonly catalog: PricingCatalog;
  readonly planLabels: Readonly<Record<string, string>>;
  readonly propertyId: string;
  readonly roomTypeName: string;
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
    if (request.mode === 'multi_night') return this.multiNightEligibleOffers(request);
    if (request.mode === undefined) return this.flexibleEligibleOffers(request);
    return this.catalogEligibleOffers(request);
  }

  private async catalogEligibleOffers(request: CreateQuoteRequest) {
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

  private async multiNightEligibleOffers(request: CreateQuoteRequest) {
    if (this.options.multiNight === undefined) throw new QuoteServiceUnavailableError();
    const source = await this.options.multiNight.quote(request);
    if (source === undefined || !source.available) throw new QuoteNoValidPricingError();
    return availabilityOfferResponseSchema.parse({
      items: source.pricing.candidates.map((candidate) => multiNightOffer(candidate)),
    });
  }

  private async flexibleEligibleOffers(request: CreateQuoteRequest) {
    const [catalogSource, multiNightSource] = await Promise.all([
      this.repository.catalogFor(request),
      this.options.multiNight?.quote(request) ?? Promise.resolve(undefined),
    ]);
    let catalogPricing: PricingBreakdown | undefined;
    if (catalogSource?.available) {
      try {
        catalogPricing = this.catalogPricing(request, catalogSource);
      } catch (error) {
        if (
          !(error instanceof PricingConfigurationError) &&
          !(error instanceof InvalidPricingIntervalError)
        ) {
          throw error;
        }
      }
    }
    const winner = resolveFlexibleStay({
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      ...(catalogPricing === undefined ? {} : { catalog: catalogPricing }),
      ...(multiNightSource?.available ? { policy: multiNightSource.pricing.candidates } : {}),
    });
    if (winner === undefined) return availabilityOfferResponseSchema.parse({ items: [] });
    if (winner.family === 'POLICY') {
      return availabilityOfferResponseSchema.parse({ items: [multiNightOffer(winner.pricing)] });
    }
    if (catalogSource === undefined) return availabilityOfferResponseSchema.parse({ items: [] });
    return availabilityOfferResponseSchema.parse({
      items: [catalogOffer(winner.pricing, catalogSource)],
    });
  }

  public async issue(input: unknown) {
    const parsed = createQuoteRequestSchema.safeParse(input);
    if (!parsed.success && isRawMultiNightRequest(input)) {
      throw new QuoteMultiNightStateError(rawMultiNightValidationState(input, parsed.error));
    }
    const request = parsed.success ? parsed.data : createQuoteRequestSchema.parse(input);
    if (request.mode === 'multi_night') return this.issueMultiNight(request);
    if (request.mode === undefined) return this.issueFlexible(request);
    return this.issueCatalog(request);
  }

  private async issueCatalog(request: CreateQuoteRequest) {
    const source = await this.repository.catalogFor(request);
    if (source === undefined || !source.available) throw new QuoteUnavailableError();
    try {
      return this.issueResolvedPricing(
        request,
        this.catalogPricing(request, source),
        source.propertyId,
      );
    } catch (error) {
      throw this.mapPricingError(error);
    }
  }

  private async issueMultiNight(request: CreateQuoteRequest) {
    if (this.options.multiNight === undefined) throw new QuoteServiceUnavailableError();
    const source = await this.options.multiNight.quote(request);
    if (source === undefined || !source.available) {
      const state = await this.multiNightState(request);
      if (state !== undefined) throw new QuoteMultiNightStateError(state);
      if (source === undefined) throw new QuoteNoValidPricingError();
      throw new QuoteUnavailableError();
    }
    return this.issueResolvedPricing(
      request,
      withMultiNightSelection(source.pricing),
      source.propertyId,
    );
  }

  private async issueFlexible(request: CreateQuoteRequest) {
    const [catalogSource, multiNightSource] = await Promise.all([
      this.repository.catalogFor(request),
      this.options.multiNight?.quote(request) ?? Promise.resolve(undefined),
    ]);
    let catalogPricing: PricingBreakdown | undefined;
    let catalogError: unknown;
    if (catalogSource?.available) {
      try {
        catalogPricing = this.catalogPricing(request, catalogSource);
      } catch (error) {
        catalogError = error;
      }
    }
    const winner = resolveFlexibleStay({
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      ...(catalogPricing === undefined ? {} : { catalog: catalogPricing }),
      ...(multiNightSource?.available ? { policy: multiNightSource.pricing.candidates } : {}),
    });
    if (winner !== undefined) {
      if (winner.family === 'CATALOG') {
        if (catalogSource === undefined) throw new QuoteUnavailableError();
        return this.issueResolvedPricing(request, winner.pricing, catalogSource.propertyId);
      }
      if (multiNightSource === undefined || !multiNightSource.available) {
        throw new QuoteUnavailableError();
      }
      return this.issueResolvedPricing(
        request,
        withMultiNightSelection(multiNightSource.pricing),
        multiNightSource.propertyId,
      );
    }
    if (catalogError !== undefined) throw this.mapPricingError(catalogError);
    if (multiNightSource === undefined && this.options.multiNight !== undefined) {
      const state = await this.multiNightState(request);
      if (state !== undefined) throw new QuoteMultiNightStateError(state);
    }
    throw new QuoteUnavailableError();
  }

  private catalogPricing(
    request: CreateQuoteRequest,
    source: QuoteCatalogSource,
  ): PricingBreakdown {
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
    return selected === undefined
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
  }

  private async issueResolvedPricing(
    request: CreateQuoteRequest,
    pricing: PricingBreakdown | MultiNightPricingCandidate,
    propertyId: string,
  ) {
    let provisionalEvaluation: ProvisionalCouponEvaluation | undefined;
    if (request.couponCode !== undefined && this.options.couponRepository !== undefined) {
      provisionalEvaluation = await this.options.couponRepository.evaluateForQuote({
        propertyId,
        roomTypeId: request.roomTypeId,
        grossAmountVnd:
          'finalAmountVnd' in pricing ? pricing.finalAmountVnd : Math.trunc(pricing.totalAmountVnd),
        couponCode: request.couponCode,
      });
    }
    return quoteSchema.parse(await this.repository.issue(request, pricing, provisionalEvaluation));
  }

  private mapPricingError(error: unknown): Error {
    if (
      error instanceof PricingConfigurationError ||
      error instanceof InvalidPricingIntervalError
    ) {
      return new QuotePricingConfigurationError();
    }
    if (error instanceof Error && error.name === 'CouponInvalidInputError')
      return new CouponInvalidInputError();
    if (error instanceof Error && error.name === 'CouponExpiredError')
      return new CouponExpiredError();
    if (error instanceof Error && error.name === 'CouponNotApplicableError')
      return new CouponNotApplicableError();
    if (error instanceof Error && error.name === 'CouponMinimumNotMetError') {
      return new CouponMinimumNotMetError();
    }
    return error instanceof Error ? error : new Error('Pricing failed unexpectedly.');
  }
  public async get(id: string) {
    const found = await this.repository.get(id);
    if (found === undefined) throw new QuoteNotFoundError();
    if (found.expired) throw new QuoteExpiredError();
    return quoteSchema.parse(found.snapshot);
  }

  private async multiNightState(
    request: CreateQuoteRequest,
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

function multiNightOffer(candidate: MultiNightPricingCandidate) {
  return {
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
  };
}

function catalogOffer(pricing: PricingBreakdown, source: QuoteCatalogSource) {
  const plan = source.catalog[pricing.selectedPlanCode];
  return {
    planCode: pricing.selectedPlanCode,
    planLabel: source.planLabels[pricing.selectedPlanCode] ?? pricing.selectedPlanCode,
    includedDurationMinutes: pricing.baseMinutes,
    extraUnits: pricing.extraUnits,
    totalAmountVnd: pricing.totalAmountVnd,
    minCheckInMinuteInclusive: plan?.minCheckInMinuteInclusive ?? null,
    maxCheckInMinuteExclusive: plan?.maxCheckInMinuteExclusive ?? null,
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
