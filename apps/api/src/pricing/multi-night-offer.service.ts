import type { DatabaseClient } from '@room/database';
import {
  availabilitySearchResponseSchema,
  type CreateQuoteRequest,
  type AvailabilityPolicy,
  type AvailabilitySearchRequest,
  type AvailabilitySearchResponse,
} from '@room/contracts';

import {
  composeMultiNightPricing,
  MultiNightPricingError,
  type MultiNightPricingCandidate,
  type MultiNightPricingResult,
} from '../pricing-policy/pricing-policy.composer.js';
import { MultiNightPricingGate, MultiNightPublicGate } from '../pricing-policy/multi-night.gate.js';
import { PublishedPricingPolicyLookupService } from '../pricing-policy/pricing-policy.lookup.service.js';
import { isWithinPropertyStayPolicy, propertyStayPolicy } from './stay-policy.js';

function policyStateForInterval(
  input: AvailabilitySearchRequest,
  policy: AvailabilityPolicy,
): 'INVALID_INTERVAL' | 'BELOW_MINIMUM_STAY' | 'ABOVE_MAXIMUM_STAY' | undefined {
  const checkInMs = new Date(input.checkIn).getTime();
  const checkOutMs = new Date(input.checkOut).getTime();
  if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs) || checkOutMs <= checkInMs) {
    return 'INVALID_INTERVAL';
  }
  const durationMinutes = Math.ceil((checkOutMs - checkInMs) / 60_000);
  if (durationMinutes < policy.minimumStayMinutes) return 'BELOW_MINIMUM_STAY';
  if (durationMinutes > policy.maximumStayMinutes) return 'ABOVE_MAXIMUM_STAY';
  return undefined;
}

export interface MultiNightOfferServiceOptions {
  readonly database: Pick<DatabaseClient, 'query'>;
  readonly lookup: PublishedPricingPolicyLookupService;
  readonly pricingGate: MultiNightPricingGate;
  readonly publicGate: MultiNightPublicGate;
}

export interface MultiNightQuoteSource {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomTypeName: string;
  readonly propertyTimezone: string;
  readonly priceTierId: string;
  readonly available: boolean;
  readonly pricing: MultiNightPricingResult;
}

function offerSummary(candidate: MultiNightPricingCandidate) {
  const leadingExtraUnits = candidate.lines
    .filter((line) => line.boundaryPosition === 'LEADING')
    .reduce((sum, line) => sum + line.billingUnitQuantity, 0);
  const trailingExtraUnits = candidate.lines
    .filter((line) => line.boundaryPosition === 'TRAILING')
    .reduce((sum, line) => sum + line.billingUnitQuantity, 0);
  return {
    planLabel: 'Multi-night stay',
    amountVnd: candidate.finalAmountVnd,
    nightCount: candidate.displayNightCount,
    leadingExtraUnits,
    trailingExtraUnits,
    summary:
      leadingExtraUnits > 0 || trailingExtraUnits > 0
        ? `${candidate.displayNightCount} nights with ${leadingExtraUnits + trailingExtraUnits} extra-hour units`
        : `${candidate.displayNightCount} nights`,
  };
}

export class MultiNightOfferService {
  public constructor(private readonly options: MultiNightOfferServiceOptions) {}

  public async search(input: AvailabilitySearchRequest): Promise<AvailabilitySearchResponse> {
    if (input.mode !== 'multi_night') {
      throw new Error('MultiNightOfferService only accepts multi_night requests.');
    }
    if (!this.options.publicGate.enabled || !this.options.pricingGate.enabled) {
      return availabilitySearchResponseSchema.parse({
        state: 'SERVICE_UNAVAILABLE',
        requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
        items: [],
      });
    }
    this.options.publicGate.assertEnabled();
    this.options.pricingGate.assertEnabled();
    const property = await this.options.database.query.properties.findFirst({
      where: (row, operators) => operators.eq(row.status, 'ACTIVE'),
      orderBy: (row, operators) => [operators.asc(row.createdAt), operators.asc(row.id)],
    });
    if (property === undefined) {
      return availabilitySearchResponseSchema.parse({
        state: 'CATALOG_UNAVAILABLE',
        requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
        items: [],
      });
    }
    const policy: AvailabilityPolicy = propertyStayPolicy(property);
    const policyState = policyStateForInterval(input, policy);
    if (policyState !== undefined) {
      return availabilitySearchResponseSchema.parse({
        state: policyState,
        policy,
        requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
        items: [],
      });
    }
    if (
      !isWithinPropertyStayPolicy(
        input.checkIn,
        input.checkOut,
        policy,
        Date.now(),
        input.mode,
        property.timezone,
      )
    ) {
      return availabilitySearchResponseSchema.parse({
        state: 'INVALID_INTERVAL',
        policy,
        requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
        items: [],
      });
    }
    const lookup = await this.options.lookup.resolve(
      property.id,
      'STAY_START',
      new Date(input.checkIn),
    );
    if (lookup.kind === 'NOT_CONFIGURED') {
      return availabilitySearchResponseSchema.parse({
        state: 'POLICY_NOT_CONFIGURED',
        policy,
        requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
        items: [],
      });
    }
    const [roomTypes, rooms, blocks, maintenanceBlocks, tiers, assignments, amenities] =
      await Promise.all([
        this.options.database.query.roomTypes.findMany({
          where: (row, operators) =>
            operators.and(
              operators.eq(row.propertyId, property.id),
              operators.eq(row.status, 'ACTIVE'),
            ),
          orderBy: (row, operators) => [operators.asc(row.name), operators.asc(row.id)],
        }),
        this.options.database.query.rooms.findMany({
          where: (row, operators) =>
            operators.and(
              operators.eq(row.propertyId, property.id),
              operators.eq(row.status, 'ACTIVE'),
            ),
        }),
        this.options.database.query.roomInventoryBlocks.findMany({
          where: (row, operators) =>
            operators.and(
              operators.eq(row.propertyId, property.id),
              operators.eq(row.status, 'ACTIVE'),
              operators.lt(row.startsAt, new Date(input.checkOut)),
              operators.gt(row.endsAt, new Date(input.checkIn)),
            ),
        }),
        this.options.database.query.maintenanceBlocks.findMany({
          where: (row, operators) =>
            operators.and(
              operators.eq(row.propertyId, property.id),
              operators.eq(row.status, 'ACTIVE'),
              operators.lt(row.startsAt, new Date(input.checkOut)),
              operators.gt(row.endsAt, new Date(input.checkIn)),
            ),
        }),
        this.options.database.query.priceTiers.findMany({
          where: (row, operators) =>
            operators.and(
              operators.eq(row.propertyId, property.id),
              operators.eq(row.status, 'ACTIVE'),
            ),
        }),
        this.options.database.query.roomTypeAmenities.findMany({
          where: (row, operators) => operators.eq(row.propertyId, property.id),
        }),
        this.options.database.query.amenities.findMany({
          where: (row, operators) =>
            operators.and(
              operators.eq(row.propertyId, property.id),
              operators.eq(row.status, 'ACTIVE'),
            ),
          orderBy: (row, operators) => [operators.asc(row.name), operators.asc(row.id)],
        }),
      ]);
    const amenityNames = new Map(amenities.map((amenity) => [amenity.id, amenity.name]));
    let hadUnavailableEligibleRoomType = false;
    const items = roomTypes.flatMap((roomType) => {
      if (
        roomType.maxAdults < input.adults ||
        roomType.maxChildren < input.children ||
        roomType.maxOccupancy < input.adults + input.children
      ) {
        return [];
      }
      const tier = tiers.find((candidate) => candidate.id === roomType.priceTierId);
      if (tier === undefined) {
        return [];
      }
      const availableRoomCount = rooms.filter(
        (room) =>
          room.roomTypeId === roomType.id &&
          !blocks.some((block) => block.roomId === room.id) &&
          !maintenanceBlocks.some((block) => block.roomId === room.id),
      ).length;
      if (availableRoomCount === 0) {
        hadUnavailableEligibleRoomType = true;
        return [];
      }
      try {
        const composed = composeMultiNightPricing({
          checkInAt: new Date(input.checkIn),
          checkOutAt: new Date(input.checkOut),
          propertyTimezone: property.timezone,
          priceTierId: tier.id,
          policy: lookup.policy,
          applicabilityInstant: new Date(input.checkIn),
        });
        return [
          {
            roomTypeId: roomType.id,
            roomTypeName: roomType.name,
            maxAdults: roomType.maxAdults,
            maxChildren: roomType.maxChildren,
            maxOccupancy: roomType.maxOccupancy,
            amenities: assignments
              .filter((assignment) => assignment.roomTypeId === roomType.id)
              .map((assignment) => amenityNames.get(assignment.amenityId))
              .filter((name): name is string => name !== undefined),
            availableRoomCount,
            offer: offerSummary(composed.selected),
            offers: composed.candidates.map(offerSummary),
          },
        ];
      } catch (error) {
        if (error instanceof MultiNightPricingError) return [];
        throw error;
      }
    });
    const state =
      items.length > 0
        ? 'AVAILABLE'
        : hadUnavailableEligibleRoomType
          ? 'NO_CONTINUOUS_ROOM'
          : 'NO_VALID_PRICING';
    return availabilitySearchResponseSchema.parse({
      state,
      policy,
      requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
      items,
    });
  }

  public async quote(input: CreateQuoteRequest): Promise<MultiNightQuoteSource | undefined> {
    this.options.publicGate.assertEnabled();
    return this.quoteInternal(input);
  }

  /** Internal/admin pricing reads remain available behind the pricing gate
   * without implicitly exposing the public multi-night contract. */
  public async quoteInternal(
    input: CreateQuoteRequest,
  ): Promise<MultiNightQuoteSource | undefined> {
    if (input.mode !== 'multi_night') return undefined;
    this.options.pricingGate.assertEnabled();
    const property = await this.options.database.query.properties.findFirst({
      where: (row, operators) => operators.eq(row.status, 'ACTIVE'),
      orderBy: (row, operators) => [operators.asc(row.createdAt), operators.asc(row.id)],
    });
    if (property === undefined) return undefined;
    const policy = propertyStayPolicy(property);
    if (
      !isWithinPropertyStayPolicy(
        input.checkIn,
        input.checkOut,
        policy,
        Date.now(),
        input.mode,
        property.timezone,
      )
    ) {
      return undefined;
    }
    const roomType = await this.options.database.query.roomTypes.findFirst({
      where: (row, operators) =>
        operators.and(
          operators.eq(row.id, input.roomTypeId),
          operators.eq(row.propertyId, property.id),
          operators.eq(row.status, 'ACTIVE'),
        ),
    });
    if (roomType === undefined) return undefined;
    const tier = await this.options.database.query.priceTiers.findFirst({
      where: (row, operators) =>
        operators.and(
          operators.eq(row.id, roomType.priceTierId),
          operators.eq(row.propertyId, property.id),
          operators.eq(row.status, 'ACTIVE'),
        ),
    });
    if (tier === undefined) return undefined;
    const lookup = await this.options.lookup.resolve(
      property.id,
      'STAY_START',
      new Date(input.checkIn),
    );
    if (lookup.kind === 'NOT_CONFIGURED') return undefined;
    const [rooms, blocks, maintenanceBlocks] = await Promise.all([
      this.options.database.query.rooms.findMany({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.propertyId, property.id),
            operators.eq(row.roomTypeId, roomType.id),
            operators.eq(row.status, 'ACTIVE'),
          ),
      }),
      this.options.database.query.roomInventoryBlocks.findMany({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.propertyId, property.id),
            operators.eq(row.status, 'ACTIVE'),
            operators.lt(row.startsAt, new Date(input.checkOut)),
            operators.gt(row.endsAt, new Date(input.checkIn)),
          ),
      }),
      this.options.database.query.maintenanceBlocks.findMany({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.propertyId, property.id),
            operators.eq(row.status, 'ACTIVE'),
            operators.lt(row.startsAt, new Date(input.checkOut)),
            operators.gt(row.endsAt, new Date(input.checkIn)),
          ),
      }),
    ]);
    if (
      roomType.maxAdults < input.adults ||
      roomType.maxChildren < input.children ||
      roomType.maxOccupancy < input.adults + input.children
    ) {
      return undefined;
    }
    const available = rooms.some(
      (room) =>
        !blocks.some((block) => block.roomId === room.id) &&
        !maintenanceBlocks.some((block) => block.roomId === room.id),
    );
    let pricing: MultiNightPricingResult;
    try {
      pricing = composeMultiNightPricing({
        checkInAt: new Date(input.checkIn),
        checkOutAt: new Date(input.checkOut),
        propertyTimezone: property.timezone,
        priceTierId: tier.id,
        policy: lookup.policy,
        applicabilityInstant: new Date(input.checkIn),
      });
    } catch (error) {
      if (error instanceof MultiNightPricingError) return undefined;
      throw error;
    }
    return {
      propertyId: property.id,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      propertyTimezone: property.timezone,
      priceTierId: tier.id,
      available,
      pricing,
    };
  }
}
