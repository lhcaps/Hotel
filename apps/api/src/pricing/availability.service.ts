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
  readonly roomTypeCode: string;
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
    if (request.mode === undefined) return this.searchFlexible(request);
    return this.searchCatalog(request);
  }

  private async searchCatalog(request: AvailabilitySearchRequest) {
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

  private async searchFlexible(request: AvailabilitySearchRequest) {
    const [catalog, policy] = await Promise.all([
      this.searchCatalog(request),
      this.multiNight?.search(request) ?? Promise.resolve(undefined),
    ]);
    const items = mergeFlexibleItems(catalog.items, policy?.items ?? []);
    const state =
      items.length > 0 ? 'AVAILABLE' : selectFlexibleState(catalog.state, policy?.state);
    return availabilitySearchResponseSchema.parse({
      state,
      ...(catalog.policy === undefined && policy?.policy === undefined
        ? {}
        : { policy: catalog.policy ?? policy?.policy }),
      requestedInterval: { checkIn: request.checkIn, checkOut: request.checkOut },
      items,
    });
  }
}

function mergeFlexibleItems(
  catalog: readonly AvailabilitySearchRoomType[],
  policy: readonly AvailabilitySearchRoomType[],
): readonly AvailabilitySearchRoomType[] {
  const policyByRoomType = new Map(policy.map((item) => [item.roomTypeId, item]));
  const catalogByRoomType = new Map(catalog.map((item) => [item.roomTypeId, item]));
  const roomTypeIds = [
    ...new Set([...catalogByRoomType.keys(), ...policyByRoomType.keys()]),
  ].sort();
  return roomTypeIds.flatMap((roomTypeId) => {
    const catalogItem = catalogByRoomType.get(roomTypeId);
    const policyItem = policyByRoomType.get(roomTypeId);
    if (catalogItem === undefined) return policyItem === undefined ? [] : [policyItem];
    if (policyItem === undefined) return [catalogItem];
    // Equal totals retain catalog ordering; the quote resolver uses the same
    // deterministic representation tie-break rather than a client decision.
    return policyItem.offer !== null &&
      (catalogItem.offer === null || policyItem.offer.amountVnd < catalogItem.offer.amountVnd)
      ? [policyItem]
      : [catalogItem];
  });
}

function selectFlexibleState(
  catalog: AvailabilityState | undefined,
  policy: AvailabilityState | undefined,
): AvailabilityState {
  const candidates = [catalog, policy].filter(
    (state): state is AvailabilityState => state !== undefined,
  );
  return (
    candidates.find(
      (state) =>
        state !== 'AVAILABLE' && state !== 'NO_EXACT_AVAILABILITY' && state !== 'NO_VALID_PRICING',
    ) ??
    candidates.find((state) => state === 'NO_VALID_PRICING') ??
    candidates[0] ??
    'NO_EXACT_AVAILABILITY'
  );
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
