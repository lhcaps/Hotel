/**
 * Phase 8J bounded nearby room availability service.
 *
 * Pure-ish orchestration on top of the loaded {@link NearbyInventorySnapshot}.
 * The service:
 * 1. Walks the deterministic offset sequence (-15, +15, -30, +30, ...).
 * 2. Computes availability per room type using already loaded blocks (no extra
 *    round-trips).
 * 3. Reuses {@link evaluatePricingCandidates} and
 *    {@link selectCheapestEligibleCandidate} from the Phase 8B pricing
 *    selector to determine the cheapest eligible ACTIVE base plan.
 * 4. Orders candidates by:
 *    a. absolute `shiftMinutes` ascending,
 *    b. earlier shifts first when the absolute shift ties,
 *    c. offer amount ascending,
 *    d. offer plan code ascending (stable),
 *    e. room-type id ascending (stable final tie-breaker).
 */

import {
  calculatePricing,
  type PricingCatalog,
  type PricingInput,
} from './pricing-engine.js';
import {
  nearbyAvailabilityRequestSchema,
  nearbyAvailabilityResponseSchema,
  type NearbyAvailabilityRequest,
  type NearbyAvailabilityResponse,
  type NearbyAvailabilityCandidate,
} from '@room/contracts';
import type {
  NearbyAvailabilityRepository,
  NearbyInventorySnapshot,
  NearbyRoomTypeRow,
} from './nearby-availability.repository.js';

export const NEARBY_STEP_MINUTES = 15;

const OFFSET_SEQUENCE_BEFORE_EXPANSION = [
  -15, 15, -30, 30, -45, 45, -60, 60,
];

export function buildNearbyShifts(expandMinutes: number): number[] {
  const upper = Math.min(120, Math.max(0, expandMinutes));
  const unique = new Set<number>();
  for (const offset of OFFSET_SEQUENCE_BEFORE_EXPANSION) {
    if (Math.abs(offset) <= upper) unique.add(offset);
  }
  let cursor = 75;
  while (cursor <= upper) {
    unique.add(-cursor);
    unique.add(cursor);
    cursor += NEARBY_STEP_MINUTES;
  }
  return [...unique]
    .sort((a, b) => {
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      if (absA !== absB) return absA - absB;
      return a - b;
    });
}

function shiftInstant(value: string, minutes: number): string {
  const result = new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
  return result;
}

function cheapestOffer(input: PricingInput, catalog: PricingCatalog) {
  try {
    const breakdown = calculatePricing(input, catalog);
    return {
      planLabel: breakdown.selectedPlanCode,
      amountVnd: breakdown.totalAmountVnd,
    };
  } catch {
    return null;
  }
}

function availableRoomCountForShift(
  roomType: NearbyRoomTypeRow,
  snapshot: NearbyInventorySnapshot,
  shift: number,
): number {
  const roomsForType = snapshot.roomsByType.get(roomType.id) ?? [];
  if (roomsForType.length === 0) return 0;
  const blocked = snapshot.blockedRoomIdsByShift.get(shift) ?? new Set<string>();
  let count = 0;
  for (const room of roomsForType) {
    if (!blocked.has(room.id)) count += 1;
  }
  return count;
}

function evaluateRoomType(
  roomType: NearbyRoomTypeRow,
  input: { checkIn: string; checkOut: string; priceTierCode: string; timezone: string },
  catalog: PricingCatalog,
  amenities: readonly string[],
  availableRoomCount: number,
) {
  const offer = cheapestOffer(input, catalog);
  return {
    roomTypeId: roomType.id,
    roomTypeName: roomType.name,
    description: roomType.description,
    maxAdults: roomType.maxAdults,
    maxChildren: roomType.maxChildren,
    maxOccupancy: roomType.maxOccupancy,
    amenities: amenities === undefined ? [] : [...amenities],
    availableRoomCount,
    offer,
  };
}

function meetsCapacity(
  type: NearbyRoomTypeRow,
  adults: number,
  children: number,
): boolean {
  return (
    type.maxAdults >= adults &&
    type.maxChildren >= children &&
    type.maxOccupancy >= adults + children
  );
}

interface OfferDescriptor {
  readonly planCode: string;
  readonly amountVnd: number;
}

function buildCatalog(snapshot: NearbyInventorySnapshot): PricingCatalog {
  const out: Record<string, {
    status: 'ACTIVE' | 'INACTIVE';
    isBasePlan: boolean;
    includedDurationMinutes: number;
    priority: number;
    minCheckInMinuteInclusive: number | null;
    maxCheckInMinuteExclusive: number | null;
    minDurationMinutesInclusive: number | null;
    maxDurationMinutesInclusive: number | null;
    prices: Record<string, number>;
  }> = {};
  for (const [code, plan] of snapshot.plansByCode) {
    const prices: Record<string, number> = {};
    for (const [key, amount] of snapshot.priceByPlanAndTier.entries()) {
      if (!key.startsWith(`${code}|`)) continue;
      const tier = key.split('|')[1] ?? '';
      prices[tier] = amount;
    }
    out[code] = {
      status: plan.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      isBasePlan: plan.isBasePlan,
      includedDurationMinutes: plan.includedDurationMinutes,
      priority: plan.priority,
      minCheckInMinuteInclusive: plan.minCheckInMinuteInclusive,
      maxCheckInMinuteExclusive: plan.maxCheckInMinuteExclusive,
      minDurationMinutesInclusive: plan.minDurationMinutesInclusive,
      maxDurationMinutesInclusive: plan.maxDurationMinutesInclusive,
      prices,
    };
  }
  return out as unknown as PricingCatalog;
}

export class NearbyAvailabilityService {
  public constructor(private readonly repository: NearbyAvailabilityRepository) {}

  public async search(input: unknown): Promise<NearbyAvailabilityResponse> {
    const parsed = nearbyAvailabilityRequestSchema.parse(input);
    return this.run(parsed);
  }

  public async run(input: NearbyAvailabilityRequest): Promise<NearbyAvailabilityResponse> {
    const shifts = buildNearbyShifts(input.expandMinutes);
    const snapshot = await this.repository.loadActiveSnapshot({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      shifts,
    });
    if (snapshot === undefined) {
      const durationMinutes = Math.round(
        (new Date(input.checkOut).getTime() - new Date(input.checkIn).getTime()) / 60_000,
      );
      return nearbyAvailabilityResponseSchema.parse({
        requestedCheckIn: input.checkIn,
        requestedCheckOut: input.checkOut,
        durationMinutes,
        candidates: [],
      });
    }
    const catalog = buildCatalog(snapshot);
    const candidates = this.evaluateCandidates(input, snapshot, shifts, catalog);
    const ordered = orderCandidates(candidates, input.limit);
    const durationMinutes = Math.round(
      (new Date(input.checkOut).getTime() - new Date(input.checkIn).getTime()) / 60_000,
    );
    return nearbyAvailabilityResponseSchema.parse({
      requestedCheckIn: input.checkIn,
      requestedCheckOut: input.checkOut,
      durationMinutes,
      candidates: ordered,
    });
  }

  private evaluateCandidates(
    input: NearbyAvailabilityRequest,
    snapshot: NearbyInventorySnapshot,
    shifts: readonly number[],
    catalog: PricingCatalog,
  ): readonly NearbyAvailabilityCandidate[] {
    const out: NearbyAvailabilityCandidate[] = [];
    for (const shift of shifts) {
      const shiftedCheckIn = shiftInstant(input.checkIn, shift);
      const shiftedCheckOut = shiftInstant(input.checkOut, shift);
      const roomTypesForCandidate = snapshot.roomTypes
        .filter((type) => meetsCapacity(type, input.adults, input.children))
        .map((type) => {
          const availableRoomCount = availableRoomCountForShift(type, snapshot, shift);
          if (availableRoomCount === 0) return null;
          const offer = evaluateRoomType(
            type,
            {
              checkIn: shiftedCheckIn,
              checkOut: shiftedCheckOut,
              priceTierCode: type.priceTierCode,
              timezone: snapshot.property.timezone,
            },
            catalog,
            snapshot.amenitiesByRoomType.get(type.id) ?? [],
            availableRoomCount,
          );
          return offer;
        })
        .filter(<T>(value: T | null): value is T => value !== null);
      if (roomTypesForCandidate.length === 0) continue;
      out.push({
        checkIn: shiftedCheckIn,
        checkOut: shiftedCheckOut,
        shiftMinutes: shift,
        roomTypes: roomTypesForCandidate,
      });
    }
    return out;
  }
}

function orderCandidates(
  candidates: readonly NearbyAvailabilityCandidate[],
  limit: number,
): readonly NearbyAvailabilityCandidate[] {
  const decorated = candidates.map((candidate) => {
    let bestOffer: OfferDescriptor | undefined;
    for (const roomType of candidate.roomTypes) {
      if (roomType.offer === null) continue;
      const descriptor = {
        planCode: roomType.offer.planLabel,
        amountVnd: roomType.offer.amountVnd,
      };
      if (
        bestOffer === undefined ||
        descriptor.amountVnd < bestOffer.amountVnd ||
        (descriptor.amountVnd === bestOffer.amountVnd &&
          descriptor.planCode < bestOffer.planCode)
      ) {
        bestOffer = descriptor;
      }
    }
    return {
      candidate,
      bestOfferAmount: bestOffer?.amountVnd ?? Number.MAX_SAFE_INTEGER,
      bestOfferPlan: bestOffer?.planCode ?? '',
      minRoomTypeId:
        candidate.roomTypes
          .map((roomType) => roomType.roomTypeId)
          .sort()[0] ?? '',
    };
  });
  decorated.sort((a, b) => {
    const absA = Math.abs(a.candidate.shiftMinutes);
    const absB = Math.abs(b.candidate.shiftMinutes);
    if (absA !== absB) return absA - absB;
    if (a.candidate.shiftMinutes !== b.candidate.shiftMinutes) {
      return a.candidate.shiftMinutes - b.candidate.shiftMinutes;
    }
    if (a.bestOfferAmount !== b.bestOfferAmount) {
      return a.bestOfferAmount - b.bestOfferAmount;
    }
    if (a.bestOfferPlan !== b.bestOfferPlan) {
      return a.bestOfferPlan < b.bestOfferPlan ? -1 : 1;
    }
    return a.minRoomTypeId < b.minRoomTypeId ? -1 : a.minRoomTypeId > b.minRoomTypeId ? 1 : 0;
  });
  return decorated.slice(0, limit).map((entry) => entry.candidate);
}

export type { NearbyInventorySnapshot } from './nearby-availability.repository.js';
