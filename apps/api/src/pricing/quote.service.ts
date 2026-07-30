import {
  availabilityOfferRequestSchema,
  availabilityOfferResponseSchema,
  createQuoteRequestSchema,
  quoteSchema,
  type CreateQuoteRequest,
} from '@room/contracts';
import {
  calculatePricing,
  evaluatePricingCandidates,
  PricingConfigurationError,
  PricingRuleNotFoundError,
  type PricingCatalog,
} from './pricing-engine.js';
import { CouponRepository, type ProvisionalCouponEvaluation } from './coupon.repository.js';

export class QuoteUnavailableError extends Error {
  public readonly code = 'AVAILABILITY_UNAVAILABLE';
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
    pricing: ReturnType<typeof calculatePricing>,
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
}
export class QuoteService {
  public constructor(
    private readonly repository: QuoteRepositoryPort,
    private readonly options: QuoteServiceOptions = {},
  ) {}
  public async eligibleOffers(input: unknown) {
    const request = availabilityOfferRequestSchema.parse(input);
    const source = await this.repository.catalogFor(request);
    if (source === undefined || !source.available) {
      return availabilityOfferResponseSchema.parse({ items: [] });
    }
    const plans = [...evaluatePricingCandidates(
      {
        checkIn: request.checkIn,
        checkOut: request.checkOut,
        priceTierCode: source.priceTierCode,
        timezone: source.propertyTimezone,
      },
      source.catalog,
    )]
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
    const request = createQuoteRequestSchema.parse(input);
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
        await this.repository.issue(
          request,
          pricing,
          provisionalEvaluation,
        ),
      );
    } catch (error) {
      if (error instanceof PricingConfigurationError) throw new QuotePricingConfigurationError();
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
}
