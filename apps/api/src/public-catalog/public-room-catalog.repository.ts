import { type DatabaseClient } from '@room/database';

import type { PublicRoomCatalogRepositoryPort } from './public-room-catalog.service.js';

type PublicCatalogDatabase = Pick<DatabaseClient, 'query'>;

export class PublicRoomCatalogRepository implements PublicRoomCatalogRepositoryPort {
  public constructor(private readonly database: PublicCatalogDatabase) {}

  public async list() {
    const property = await this.database.query.properties.findFirst({
      where: (item, operators) => operators.eq(item.status, 'ACTIVE'),
      orderBy: (item, operators) => [operators.asc(item.createdAt), operators.asc(item.id)],
    });
    if (property === undefined) return [];

    const [types, assignments, amenities, tiers, plans, prices] = await Promise.all([
      this.database.query.roomTypes.findMany({
        where: (item, operators) =>
          operators.and(
            operators.eq(item.propertyId, property.id),
            operators.eq(item.status, 'ACTIVE'),
          ),
        orderBy: (item, operators) => [operators.asc(item.name), operators.asc(item.id)],
      }),
      this.database.query.roomTypeAmenities.findMany({
        where: (item, operators) => operators.eq(item.propertyId, property.id),
      }),
      this.database.query.amenities.findMany({
        where: (item, operators) =>
          operators.and(
            operators.eq(item.propertyId, property.id),
            operators.eq(item.status, 'ACTIVE'),
          ),
        orderBy: (item, operators) => [operators.asc(item.name), operators.asc(item.id)],
      }),
      this.database.query.priceTiers.findMany({
        where: (item, operators) => operators.eq(item.propertyId, property.id),
      }),
      this.database.query.ratePlans.findMany({
        where: (item, operators) =>
          operators.and(
            operators.eq(item.propertyId, property.id),
            operators.eq(item.status, 'ACTIVE'),
          ),
      }),
      this.database.query.ratePlanPrices.findMany({
        where: (item, operators) => operators.eq(item.propertyId, property.id),
      }),
    ]);
    const tierById = new Map(tiers.map((tier) => [tier.id, tier]));
    const minPriceByTier = new Map<string, number>();
    for (const price of prices) {
      if (!plans.some((plan) => plan.id === price.ratePlanId)) continue;
      const tier = tierById.get(price.priceTierId);
      const amount = Number(price.amountVnd);
      if (tier === undefined || !Number.isSafeInteger(amount) || amount <= 0) continue;
      const current = minPriceByTier.get(tier.id);
      if (current === undefined || amount < current) minPriceByTier.set(tier.id, amount);
    }
    const amenityNames = new Map(amenities.map((amenity) => [amenity.id, amenity.name]));
    const amenitiesByType = new Map<string, { name: string }[]>();
    for (const assignment of assignments) {
      const name = amenityNames.get(assignment.amenityId);
      if (name === undefined) continue;
      const assigned = amenitiesByType.get(assignment.roomTypeId) ?? [];
      assigned.push({ name });
      amenitiesByType.set(assignment.roomTypeId, assigned);
    }

    return types.map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
      description: type.description,
      maxAdults: type.maxAdults,
      maxChildren: type.maxChildren,
      maxOccupancy: type.maxOccupancy,
      amenities: amenitiesByType.get(type.id) ?? [],
      ...(tierById.get(type.priceTierId) !== undefined
        ? {
            priceTier: {
              code: tierById.get(type.priceTierId)?.code ?? '',
              name: tierById.get(type.priceTierId)?.name ?? '',
              sortOrder: tierById.get(type.priceTierId)?.sortOrder ?? 0,
            },
          }
        : {}),
      startingFromVnd: minPriceByTier.get(type.priceTierId) ?? null,
    }));
  }
}
