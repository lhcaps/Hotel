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

    const [types, assignments, amenities] = await Promise.all([
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
    ]);
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
      name: type.name,
      description: type.description,
      maxAdults: type.maxAdults,
      maxChildren: type.maxChildren,
      maxOccupancy: type.maxOccupancy,
      amenities: amenitiesByType.get(type.id) ?? [],
    }));
  }
}
