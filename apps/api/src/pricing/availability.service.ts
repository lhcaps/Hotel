import {
  availabilitySearchRequestSchema,
  availabilitySearchResponseSchema,
  type AvailabilityPolicy,
  type AvailabilityState,
  type AvailabilitySearchRequest,
  type AvailabilitySearchResponse,
} from '@room/contracts';
import { calculatePricing, type PricingCatalog } from './pricing-engine.js';

export interface AvailabilitySearchRoomType {
  readonly roomTypeId: string;
  readonly roomTypeName: string;
  readonly maxAdults: number;
  readonly maxChildren: number;
  readonly maxOccupancy: number;
  readonly amenities: readonly string[];
  readonly availableRoomCount: number;
  readonly offer: { readonly planLabel: string; readonly amountVnd: number } | null;
}

export interface AvailabilityRepositoryPort {
  search(input: AvailabilitySearchRequest): Promise<readonly AvailabilitySearchRoomType[]>;
  searchWithState?(input: AvailabilitySearchRequest): Promise<{
    readonly state: AvailabilityState;
    readonly items: readonly AvailabilitySearchRoomType[];
    readonly policy?: AvailabilityPolicy;
  }>;
}

export function offerSummary(
  input: AvailabilitySearchRequest,
  source: {
    readonly priceTierCode: string;
    readonly propertyTimezone: string;
    readonly catalog: PricingCatalog;
    readonly planLabels: Readonly<Record<string, string>>;
  },
) {
  const pricing = calculatePricing(
    {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      priceTierCode: source.priceTierCode,
      timezone: source.propertyTimezone,
    },
    source.catalog,
  );
  return {
    planLabel: source.planLabels[pricing.selectedPlanCode] ?? pricing.selectedPlanCode,
    amountVnd: pricing.totalAmountVnd,
  };
}

export class AvailabilityService {
  public constructor(private readonly repository: AvailabilityRepositoryPort) {}
  public async search(input: unknown): Promise<AvailabilitySearchResponse> {
    const request = availabilitySearchRequestSchema.parse(input);
    const result = this.repository.searchWithState
      ? await this.repository.searchWithState(request)
      : {
          state: undefined,
          policy: undefined,
          items: await this.repository.search(request),
        };
    return availabilitySearchResponseSchema.parse({
      state: result.state ?? (result.items.length > 0 ? 'AVAILABLE' : 'NO_EXACT_AVAILABILITY'),
      ...(result.policy ? { policy: result.policy } : {}),
      requestedInterval: { checkIn: request.checkIn, checkOut: request.checkOut },
      items: result.items,
    });
  }
}
