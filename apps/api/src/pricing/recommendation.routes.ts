import type { DatabaseClient } from '@room/database';
import {
  searchRecommendations,
  type AvailabilityProbe,
  type ProvisionalCouponProbe,
  type RecommendationResult,
} from './recommendation.service.js';
import {
  RecommendationRepository,
  parseRecommendationRequest,
} from './recommendation.repository.js';
import { QuoteRepository, type CatalogSource } from './quote.repository.js';
import { CouponRepository } from './coupon.repository.js';
import type { PricingCatalog } from './pricing-engine.js';

export interface RecommendationHandlerDeps {
  readonly database: Pick<DatabaseClient, 'execute' | 'query' | 'insert'>;
  readonly recommendationRepository: RecommendationRepository;
  readonly quoteRepository: QuoteRepository;
  readonly couponRepository?: CouponRepository;
  readonly now?: () => Date;
}

interface CouponPreviewInput {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly grossAmountVnd: number;
  readonly couponCode?: string;
  readonly checkIn?: string;
  readonly checkOut?: string;
}

/**
 * Functional entry point used by both the NestJS controller and the
 * integration test suite. The handler builds the catalog from the
 * authoritative PostgreSQL store, probes availability through the
 * recommendation repository, and previews coupons without reserving
 * quota.
 */
export async function recommendationStayTimes(
  request: ReturnType<typeof parseRecommendationRequest>,
  deps: RecommendationHandlerDeps,
): Promise<RecommendationResult> {
  const rawSource = await deps.quoteRepository.catalogFor({
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    adults: request.adults,
    children: request.children,
    roomTypeId: request.roomTypeId,
    ...(request.couponCode !== undefined ? { couponCode: request.couponCode } : {}),
  });
  const catalogSource = rawSource as CatalogSource | undefined;
  if (catalogSource === undefined || !catalogSource.available) {
    throw new Error('Unavailable for the requested room type.');
  }

  const availability: AvailabilityProbe = {
    isAvailable: async (candidate) =>
      deps.recommendationRepository.isCandidateAvailable({
        checkIn: candidate.checkIn,
        checkOut: candidate.checkOut,
        roomTypeId: request.roomTypeId,
        adults: request.adults,
        children: request.children,
      }),
  };

  const couponRepository = deps.couponRepository;
  const couponPreviewer: ((input: CouponPreviewInput) => Promise<number>) | undefined =
    couponRepository !== undefined
      ? async (input) => {
          try {
            const evaluation = await couponRepository.evaluateForQuote({
              propertyId: input.propertyId,
              roomTypeId: input.roomTypeId,
              grossAmountVnd: input.grossAmountVnd,
              couponCode: input.couponCode ?? request.couponCode ?? '',
            });
            return Number(evaluation.discountAmountVnd);
          } catch {
            return 0;
          }
        }
      : undefined;

  const coupon: ProvisionalCouponProbe | undefined =
    couponPreviewer !== undefined && request.couponCode !== undefined
      ? {
          preview: async (candidate, gross) => {
            if (request.couponCode === undefined) return 0;
            return couponPreviewer({
              propertyId: catalogSource.propertyId,
              roomTypeId: request.roomTypeId,
              grossAmountVnd: gross,
              couponCode: request.couponCode,
              checkIn: candidate.checkIn,
              checkOut: candidate.checkOut,
            });
          },
        }
      : undefined;

  return searchRecommendations(
    {
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      priceTierCode: catalogSource.priceTierCode,
      timezone: catalogSource.propertyTimezone,
      ...(request.couponCode !== undefined ? { couponCode: request.couponCode } : {}),
    },
    catalogSource.catalog satisfies PricingCatalog,
    {
      availability,
      ...(coupon !== undefined ? { coupon } : {}),
      ...(deps.now !== undefined ? { now: deps.now } : {}),
    },
  );
}

export function recommendationStayTimesHandler(deps: RecommendationHandlerDeps) {
  return async (request: { body: unknown }): Promise<RecommendationResult> => {
    const parsed = parseRecommendationRequest(request.body);
    return recommendationStayTimes(parsed, deps);
  };
}
