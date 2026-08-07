import {
  availabilitySearchRequestSchema,
  availabilitySearchResponseSchema,
  type AvailabilityPolicy,
  type AvailabilityState,
  type AvailabilitySearchRequest,
  type AvailabilitySearchResponse,
} from '@room/contracts';
import { calculatePricing, type PricingCatalog } from './pricing-engine.js';

export interface MultiNightAvailabilityPort {
  search(input: AvailabilitySearchRequest): Promise<AvailabilitySearchResponse>;
}

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
  public constructor(
    private readonly repository: AvailabilityRepositoryPort,
    private readonly multiNight?: MultiNightAvailabilityPort,
  ) {}
  public async search(input: unknown): Promise<AvailabilitySearchResponse> {
    const parsed = availabilitySearchRequestSchema.safeParse(input);
    if (!parsed.success && isMultiNightRequest(input)) {
      const requestedInterval = readRequestedInterval(input);
      const hasGuestError = parsed.error.issues.some(
        (issue) => issue.path[0] === 'adults' || issue.path[0] === 'children',
      );
      const isStructuralOverflow =
        requestedInterval !== undefined &&
        Number.isFinite(requestedInterval.checkIn) &&
        Number.isFinite(requestedInterval.checkOut) &&
        requestedInterval.checkOut - requestedInterval.checkIn > 31 * 86_400_000;
      return availabilitySearchResponseSchema.parse({
        state: hasGuestError
          ? 'INVALID_GUEST_COUNT'
          : isStructuralOverflow
            ? 'ABOVE_MAXIMUM_STAY'
            : 'INVALID_INTERVAL',
        ...(readIntervalStrings(input) ?? {}),
        items: [],
      });
    }
    const request = parsed.success ? parsed.data : availabilitySearchRequestSchema.parse(input);
    if (request.mode === 'multi_night') {
      if (this.multiNight === undefined) {
        return availabilitySearchResponseSchema.parse({
          state: 'SERVICE_UNAVAILABLE',
          requestedInterval: { checkIn: request.checkIn, checkOut: request.checkOut },
          items: [],
        });
      }
      return this.multiNight.search(request);
    }
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

function isMultiNightRequest(input: unknown): input is Record<string, unknown> {
  return (
    typeof input === 'object' &&
    input !== null &&
    (input as { readonly mode?: unknown }).mode === 'multi_night'
  );
}

function readIntervalStrings(
  input: unknown,
):
  | { readonly requestedInterval: { readonly checkIn: string; readonly checkOut: string } }
  | undefined {
  if (!isMultiNightRequest(input)) return undefined;
  const value = input as Record<string, unknown>;
  if (typeof value.checkIn !== 'string' || typeof value.checkOut !== 'string') return undefined;
  return { requestedInterval: { checkIn: value.checkIn, checkOut: value.checkOut } };
}

function readRequestedInterval(
  input: unknown,
): { readonly checkIn: number; readonly checkOut: number } | undefined {
  if (!isMultiNightRequest(input)) return undefined;
  const value = input as Record<string, unknown>;
  if (typeof value.checkIn !== 'string' || typeof value.checkOut !== 'string') return undefined;
  return {
    checkIn: new Date(value.checkIn).getTime(),
    checkOut: new Date(value.checkOut).getTime(),
  };
}
