/**
 * Phase 8J bounded nearby room availability repository.
 *
 * Public, read-only, deterministic repository that loads a single property-scoped
 * batch of room types, rooms, inventory blocks, plans, prices, tiers and
 * amenities in one round-trip. The orchestration that walks every shifted
 * check-in candidate is performed by the service on top of this loaded batch to
 * avoid query amplification per offset.
 *
 * Mutations are explicitly forbidden: there are no `insert` / `update` callers
 * in this file, so the endpoint never persists anything.
 */

import { type DatabaseClient } from '@room/database';

export interface NearbyPropertyContext {
  readonly id: string;
  readonly timezone: string;
}

export interface NearbyRoomTypeRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly maxAdults: number;
  readonly maxChildren: number;
  readonly maxOccupancy: number;
  readonly priceTierCode: string;
}

export interface NearbyRoomRow {
  readonly id: string;
  readonly roomTypeId: string;
}

export interface NearbyPlanRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly isBasePlan: boolean;
  readonly priority: number;
  readonly includedDurationMinutes: number;
  readonly minCheckInMinuteInclusive: number | null;
  readonly maxCheckInMinuteExclusive: number | null;
  readonly minDurationMinutesInclusive: number | null;
  readonly maxDurationMinutesInclusive: number | null;
}

export interface NearbyPriceRow {
  readonly ratePlanCode: string;
  readonly priceTierCode: string;
  readonly amountVnd: number;
}

export interface NearbyAmenityRow {
  readonly roomTypeId: string;
  readonly amenityName: string;
}

export interface NearbyInventorySnapshot {
  readonly property: NearbyPropertyContext;
  readonly roomTypes: readonly NearbyRoomTypeRow[];
  readonly roomsByType: ReadonlyMap<string, readonly NearbyRoomRow[]>;
  readonly blockedRoomIdsByShift: ReadonlyMap<number, ReadonlySet<string>>;
  readonly plansByCode: ReadonlyMap<string, NearbyPlanRow>;
  readonly priceByPlanAndTier: ReadonlyMap<string, number>;
  readonly amenitiesByRoomType: ReadonlyMap<string, readonly string[]>;
}

type NearbyAvailabilityDatabase = Pick<DatabaseClient, 'query'>;

export class NearbyAvailabilityRepository {
  public constructor(private readonly database: NearbyAvailabilityDatabase) {}

  public async loadActiveSnapshot(input: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly shifts: readonly number[];
  }): Promise<NearbyInventorySnapshot | undefined> {
    const property = await this.database.query.properties.findFirst({
      where: (item, operators) => operators.eq(item.status, 'ACTIVE'),
      orderBy: (item, operators) => [operators.asc(item.createdAt), operators.asc(item.id)],
    });
    if (property === undefined) return undefined;
    const earliestShift = Math.min(...input.shifts);
    const latestShift = Math.max(...input.shifts);
    const lowerWindowStart = new Date(new Date(input.checkIn).getTime() + earliestShift * 60_000);
    const upperWindowEnd = new Date(new Date(input.checkOut).getTime() + latestShift * 60_000);

    const [roomTypes, rooms, plans, prices, tiers, amenities, assignments, allBlocks] =
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
        this.database.query.ratePlans.findMany({
          where: (plan, operators) => operators.eq(plan.propertyId, property.id),
        }),
        this.database.query.ratePlanPrices.findMany({
          where: (price, operators) => operators.eq(price.propertyId, property.id),
        }),
        this.database.query.priceTiers.findMany({
          where: (tier, operators) => operators.eq(tier.propertyId, property.id),
        }),
        this.database.query.amenities.findMany({
          where: (amenity, operators) =>
            operators.and(
              operators.eq(amenity.propertyId, property.id),
              operators.eq(amenity.status, 'ACTIVE'),
            ),
          orderBy: (amenity, operators) => [operators.asc(amenity.name), operators.asc(amenity.id)],
        }),
        this.database.query.roomTypeAmenities.findMany({
          where: (assignment, operators) => operators.eq(assignment.propertyId, property.id),
        }),
        this.database.query.roomInventoryBlocks.findMany({
          where: (block, operators) =>
            operators.and(
              operators.eq(block.propertyId, property.id),
              operators.eq(block.status, 'ACTIVE'),
              operators.lt(block.startsAt, upperWindowEnd),
              operators.gt(block.endsAt, lowerWindowStart),
            ),
        }),
      ]);

    const tierCodeById = new Map(tiers.map((tier) => [tier.id, tier.code]));
    const plansByCode = new Map<string, NearbyPlanRow>();
    for (const plan of plans) {
      plansByCode.set(plan.code, {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        status: plan.status,
        isBasePlan: plan.isBasePlan,
        priority: plan.priority,
        includedDurationMinutes: plan.includedDurationMinutes,
        minCheckInMinuteInclusive: plan.minCheckInMinuteInclusive,
        maxCheckInMinuteExclusive: plan.maxCheckInMinuteExclusive,
        minDurationMinutesInclusive: plan.minDurationMinutesInclusive,
        maxDurationMinutesInclusive: plan.maxDurationMinutesInclusive,
      });
    }
    const priceByPlanAndTier = new Map<string, number>();
    for (const price of prices) {
      const plan = plans.find((row) => row.id === price.ratePlanId);
      const tier = tierCodeById.get(price.priceTierId);
      if (plan === undefined || tier === undefined) continue;
      priceByPlanAndTier.set(`${plan.code}|${tier}`, Number(price.amountVnd));
    }
    const roomsByType = new Map<string, NearbyRoomRow[]>();
    for (const room of rooms) {
      const list = roomsByType.get(room.roomTypeId) ?? [];
      list.push({ id: room.id, roomTypeId: room.roomTypeId });
      roomsByType.set(room.roomTypeId, list);
    }
    const amenityNames = new Map(amenities.map((amenity) => [amenity.id, amenity.name]));
    const amenitiesByRoomType = new Map<string, string[]>();
    for (const assignment of assignments) {
      const name = amenityNames.get(assignment.amenityId);
      if (name === undefined) continue;
      const list = amenitiesByRoomType.get(assignment.roomTypeId) ?? [];
      list.push(name);
      amenitiesByRoomType.set(assignment.roomTypeId, list);
    }

    const blockedRoomIdsByShift = computeBlockedRoomIdsByShift({
      shifts: input.shifts,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      blocks: allBlocks.map((block) => ({
        roomId: block.roomId,
        startsAt: new Date(block.startsAt),
        endsAt: new Date(block.endsAt),
      })),
      rooms,
    });

    return {
      property: { id: property.id, timezone: property.timezone },
      roomTypes: roomTypes.map((type) => ({
        id: type.id,
        name: type.name,
        description: type.description,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        maxOccupancy: type.maxOccupancy,
        priceTierCode: tierCodeById.get(type.priceTierId) ?? '',
      })),
      roomsByType,
      blockedRoomIdsByShift,
      plansByCode,
      priceByPlanAndTier,
      amenitiesByRoomType,
    };
  }

  /**
   * Test-only regression helper: counts queries executed while running a probe.
   * Implementation relies on the database client being wrapped in a counter;
   * when not wrapped this returns NaN so the assertion fails closed.
   */
  public async databaseCallCount(probe: () => Promise<unknown>): Promise<number> {
    const counter = this.database as unknown as { __queryCount?: number };
    if (typeof counter.__queryCount !== 'number') {
      await probe();
      return Number.NaN;
    }
    const before = counter.__queryCount;
    await probe();
    return counter.__queryCount - before;
  }

  /**
   * Test-only harness: wraps the database client so each call into a Drizzle
   * RelationalQueryBuilder's `findFirst` / `findMany` (which are bound methods
   * on the per-table proxy) increments a counter. Asserts query amplification
   * per request.
   */
  public async observeBatchSize(
    probe: (repo: NearbyAvailabilityRepository) => Promise<unknown>,
  ): Promise<number> {
    const counter = { value: 0 };
    const countable = new Set(['findFirst', 'findMany', 'findFirstOrThrow']);
    const wrapTable = (table: unknown): unknown =>
      new Proxy(table as object, {
        get(target, property, receiver) {
          const value: unknown = Reflect.get(target, property, receiver);
          if (typeof value === 'function' && countable.has(String(property))) {
            return (...args: unknown[]) => {
              counter.value += 1;
              return (value as (...a: unknown[]) => unknown).apply(target, args);
            };
          }
          return value;
        },
      });
    const real = this.database as unknown as Record<string, unknown>;
    const realQuery = real['query'] as Record<string, unknown>;
    const wrappedQuery: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(realQuery)) {
      wrappedQuery[key] = wrapTable(value);
    }
    const wrapped = { ...real, query: wrappedQuery };
    const repo = new NearbyAvailabilityRepository(wrapped as NearbyAvailabilityDatabase);
    await probe(repo);
    return counter.value;
  }

  public async propertyById(
    id: string,
  ): Promise<{ id: string; code: string; status: string } | undefined> {
    const property = await this.database.query.properties.findFirst({
      where: (row, operators) =>
        operators.and(operators.eq(row.id, id), operators.eq(row.status, 'ACTIVE')),
    });
    return property === undefined
      ? undefined
      : { id: property.id, code: property.code, status: property.status };
  }
}

function computeBlockedRoomIdsByShift(input: {
  readonly shifts: readonly number[];
  readonly checkIn: string;
  readonly checkOut: string;
  readonly blocks: readonly { roomId: string; startsAt: Date; endsAt: Date }[];
  readonly rooms: readonly { id: string; status: string }[];
}) {
  const activeRoomIds = new Set(
    input.rooms.filter((room) => room.status === 'ACTIVE').map((room) => room.id),
  );
  const result = new Map<number, Set<string>>();
  const startMs = new Date(input.checkIn).getTime();
  const endMs = new Date(input.checkOut).getTime();
  for (const shift of input.shifts) {
    const shiftedStart = new Date(startMs + shift * 60_000);
    const shiftedEnd = new Date(endMs + shift * 60_000);
    const blocked = new Set<string>();
    for (const block of input.blocks) {
      if (block.startsAt < shiftedEnd && block.endsAt > shiftedStart) {
        if (activeRoomIds.has(block.roomId)) blocked.add(block.roomId);
      }
    }
    result.set(shift, blocked);
  }
  return result;
}
