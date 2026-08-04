import {
  availabilitySearchRequestSchema,
  availabilitySearchResponseSchema,
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
    return availabilitySearchResponseSchema.parse({
      items: await this.repository.search(availabilitySearchRequestSchema.parse(input)),
    });
  }
}
