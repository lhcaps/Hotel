import { type DatabaseClient } from '@room/database';
import type { AvailabilitySearchRequest } from '@room/contracts';
import { offerSummary, type AvailabilityRepositoryPort } from './availability.service.js';
import type { PricingCatalog } from './pricing-engine.js';

type AvailabilityDatabase = Pick<DatabaseClient, 'query'>;
export class AvailabilityRepository implements AvailabilityRepositoryPort {
  public constructor(private readonly database: AvailabilityDatabase) {}
  public async search(input: AvailabilitySearchRequest) {
    const property = await this.database.query.properties.findFirst({
      where: (item, operators) => operators.eq(item.status, 'ACTIVE'),
      orderBy: (item, operators) => [operators.asc(item.createdAt), operators.asc(item.id)],
    });
    if (property === undefined) return [];
    const [roomTypes, rooms, blocks, plans, prices, tiers, assignments, amenities] =
      await Promise.all([
        this.database.query.roomTypes.findMany({
          where: (type, operators) =>
            operators.and(
              operators.eq(type.propertyId, property.id),
              operators.eq(type.status, 'ACTIVE'),
            ),
          orderBy: (type, operators) => [operators.asc(type.name), operators.asc(type.id)],
        }),
        this.database.query.rooms.findMany({
          where: (room, operators) =>
            operators.and(
              operators.eq(room.propertyId, property.id),
              operators.eq(room.status, 'ACTIVE'),
            ),
        }),
        this.database.query.roomInventoryBlocks.findMany({
          where: (block, operators) =>
            operators.and(
              operators.eq(block.propertyId, property.id),
              operators.eq(block.status, 'ACTIVE'),
              operators.lt(block.startsAt, new Date(input.checkOut)),
              operators.gt(block.endsAt, new Date(input.checkIn)),
            ),
        }),
        this.database.query.ratePlans.findMany({
          where: (plan, operators) => operators.eq(plan.propertyId, property.id),
        }),
        this.database.query.ratePlanPrices.findMany({
          where: (price, operators) => operators.eq(price.propertyId, property.id),
        }),
        this.database.query.priceTiers.findMany({
          where: (tier, operators) => operators.eq(tier.propertyId, property.id),
        }),
        this.database.query.roomTypeAmenities.findMany({
          where: (assignment, operators) => operators.eq(assignment.propertyId, property.id),
        }),
        this.database.query.amenities.findMany({
          where: (amenity, operators) =>
            operators.and(
              operators.eq(amenity.propertyId, property.id),
              operators.eq(amenity.status, 'ACTIVE'),
            ),
          orderBy: (amenity, operators) => [operators.asc(amenity.name), operators.asc(amenity.id)],
        }),
      ]);
    const blockedRoomIds = new Set(blocks.map((block) => block.roomId));
    const amenityNames = new Map(amenities.map((amenity) => [amenity.id, amenity.name]));
    const amenitiesByRoomType = new Map<string, string[]>();
    for (const assignment of assignments) {
      const name = amenityNames.get(assignment.amenityId);
      if (name === undefined) continue;
      const assigned = amenitiesByRoomType.get(assignment.roomTypeId) ?? [];
      assigned.push(name);
      amenitiesByRoomType.set(assignment.roomTypeId, assigned);
    }
    const catalog: PricingCatalog = Object.fromEntries(
      plans.map((plan) => [
        plan.code,
        {
          status: plan.status,
          isBasePlan: plan.isBasePlan,
          includedDurationMinutes: plan.includedDurationMinutes,
          priority: plan.priority,
          minCheckInMinuteInclusive: plan.minCheckInMinuteInclusive,
          maxCheckInMinuteExclusive: plan.maxCheckInMinuteExclusive,
          minDurationMinutesInclusive: plan.minDurationMinutesInclusive,
          maxDurationMinutesInclusive: plan.maxDurationMinutesInclusive,
          prices: Object.fromEntries(
            prices
              .filter((price) => price.ratePlanId === plan.id)
              .map((price) => [
                tiers.find((tier) => tier.id === price.priceTierId)?.code ?? price.priceTierId,
                Number(price.amountVnd),
              ]),
          ),
        },
      ]),
    );
    return roomTypes.flatMap((type) => {
      if (
        type.maxAdults < input.adults ||
        type.maxChildren < input.children ||
        type.maxOccupancy < input.adults + input.children
      ) {
        return [];
      }
      const availableRoomCount = rooms.filter(
        (room) => room.roomTypeId === type.id && !blockedRoomIds.has(room.id),
      ).length;
      if (availableRoomCount === 0) return [];
      const offer = offerSummary(input, {
        priceTierCode: tiers.find((tier) => tier.id === type.priceTierId)?.code ?? '',
        propertyTimezone: property.timezone,
        catalog,
        planLabels: Object.fromEntries(plans.map((plan) => [plan.code, plan.name])),
      });
      if (offer === null) return [];
      return [
        {
          roomTypeId: type.id,
          roomTypeName: type.name,
          maxAdults: type.maxAdults,
          maxChildren: type.maxChildren,
          maxOccupancy: type.maxOccupancy,
          amenities: amenitiesByRoomType.get(type.id) ?? [],
          availableRoomCount,
          offer,
        },
      ];
    });
  }
}
