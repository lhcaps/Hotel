import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { AvailabilityRepository } from '../../src/pricing/availability.repository.js';
import { AvailabilityService } from '../../src/pricing/availability.service.js';

const ids = {
  property: '550e8400-e29b-41d4-a716-446655440010',
  tier: '550e8400-e29b-41d4-a716-446655440020',
  type: '550e8400-e29b-41d4-a716-446655440030',
  roomA: '550e8400-e29b-41d4-a716-446655440040',
  roomB: '550e8400-e29b-41d4-a716-446655440041',
  roomInactive: '550e8400-e29b-41d4-a716-446655440042',
  typeAlpha: '550e8400-e29b-41d4-a716-446655440031',
  roomAlpha: '550e8400-e29b-41d4-a716-446655440043',
  typeArchived: '550e8400-e29b-41d4-a716-446655440032',
  roomArchived: '550e8400-e29b-41d4-a716-446655440044',
  maintenanceA: '550e8400-e29b-41d4-a716-446655440050',
  maintenanceB: '550e8400-e29b-41d4-a716-446655440051',
  plan: '550e8400-e29b-41d4-a716-446655440060',
  planPrice: '550e8400-e29b-41d4-a716-446655440061',
  secondaryProperty: '550e8400-e29b-41d4-a716-446655440070',
  secondaryTier: '550e8400-e29b-41d4-a716-446655440071',
  secondaryType: '550e8400-e29b-41d4-a716-446655440072',
  secondaryRoom: '550e8400-e29b-41d4-a716-446655440073',
  secondaryPlan: '550e8400-e29b-41d4-a716-446655440074',
  secondaryPrice: '550e8400-e29b-41d4-a716-446655440075',
};
describe('availability inventory search', () => {
  let database: GuardedTestDatabase;
  let service: AvailabilityService;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    service = new AvailabilityService(new AvailabilityRepository(client));
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone) VALUES ($1,'MAIN','Main','Asia/Ho_Chi_Minh')`,
      [ids.property],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES ($1,$2,'TIER_1','Tier',1)`,
      [ids.tier, ids.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy) VALUES ($1,$2,$3,'DLX','Deluxe',2,1,3)`,
      [ids.type, ids.property, ids.tier],
    );
    await database.pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy,status)
       VALUES ($1,$2,$3,'ALP','Alpha',2,1,3,'ACTIVE'),($4,$2,$3,'OLD','Archived',2,1,3,'INACTIVE')`,
      [ids.typeAlpha, ids.property, ids.tier, ids.typeArchived],
    );
    await database.pool.query(
      `INSERT INTO rooms (id,property_id,room_type_id,room_number,status) VALUES
       ($1,$2,$3,'101','ACTIVE'),($4,$2,$3,'102','ACTIVE'),($5,$2,$3,'103','INACTIVE'),
       ($6,$2,$7,'201','ACTIVE'),($8,$2,$9,'901','ACTIVE')`,
      [
        ids.roomA,
        ids.property,
        ids.type,
        ids.roomB,
        ids.roomInactive,
        ids.roomAlpha,
        ids.typeAlpha,
        ids.roomArchived,
        ids.typeArchived,
      ],
    );
    await database.pool.query(
      `INSERT INTO rate_plans
       (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'THREE_HOUR_COMBO','Three-hour combo','ACTIVE',180,1,true,60,240)`,
      [ids.plan, ids.property],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd)
       VALUES ($1,$2,$3,$4,300000)`,
      [ids.planPrice, ids.property, ids.plan, ids.tier],
    );
  });
  afterAll(async () => database?.dispose());
  const request = {
    checkIn: '2027-01-10T04:00:00.000Z',
    checkOut: '2027-01-10T07:00:00.000Z',
    adults: 2,
    children: 1,
  };
  it('returns active room types in deterministic name order, ignores inactive data, and creates no reservation', async () => {
    const before = await database.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM room_inventory_blocks`,
    );
    const result = await service.search(request);
    expect(result.items).toEqual([
      expect.objectContaining({
        roomTypeId: ids.typeAlpha,
        roomTypeName: 'Alpha',
        availableRoomCount: 1,
        offer: { planLabel: 'Three-hour combo', amountVnd: 300000 },
      }),
      expect.objectContaining({
        roomTypeId: ids.type,
        roomTypeName: 'Deluxe',
        availableRoomCount: 2,
        offer: { planLabel: 'Three-hour combo', amountVnd: 300000 },
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/101|102|103|201|901|roomId|room_id/);
    const after = await database.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM room_inventory_blocks`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });
  it('selects the earliest active property and never mixes a second active property into its result', async () => {
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone) VALUES ($1,'SECOND','Second','Asia/Ho_Chi_Minh')`,
      [ids.secondaryProperty],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES ($1,$2,'SECOND_TIER','Second tier',1)`,
      [ids.secondaryTier, ids.secondaryProperty],
    );
    await database.pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy)
       VALUES ($1,$2,$3,'SECOND','Second Deluxe',2,1,3)`,
      [ids.secondaryType, ids.secondaryProperty, ids.secondaryTier],
    );
    await database.pool.query(
      `INSERT INTO rooms (id,property_id,room_type_id,room_number) VALUES ($1,$2,$3,'201')`,
      [ids.secondaryRoom, ids.secondaryProperty, ids.secondaryType],
    );
    await database.pool.query(
      `INSERT INTO rate_plans
       (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'THREE_HOUR_COMBO','Second property plan','ACTIVE',180,1,true,60,240)`,
      [ids.secondaryPlan, ids.secondaryProperty],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd)
       VALUES ($1,$2,$3,$4,999000)`,
      [ids.secondaryPrice, ids.secondaryProperty, ids.secondaryPlan, ids.secondaryTier],
    );

    const result = await service.search(request);

    expect(result.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ roomTypeId: ids.secondaryType })]),
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomTypeId: ids.type,
          offer: expect.objectContaining({ amountVnd: 300000 }) as unknown as {
            amountVnd: number;
          },
        }),
      ]),
    );
  });

  it('uses [) inventory blocks, excludes only blocked rooms, and exposes no physical IDs', async () => {
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id,property_id,room_id,starts_at,ends_at,reason) VALUES ($1,$2,$3,$4,$5,'Test maintenance')`,
      [ids.maintenanceA, ids.property, ids.roomA, request.checkIn, request.checkOut],
    );
    await database.pool.query(
      `INSERT INTO room_inventory_blocks (property_id,room_id,maintenance_block_id,block_type,starts_at,ends_at) VALUES ($1,$2,$3,'MAINTENANCE',$4,$5)`,
      [ids.property, ids.roomA, ids.maintenanceA, request.checkIn, request.checkOut],
    );
    const result = await service.search(request);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roomTypeId: ids.type, availableRoomCount: 1 }),
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(/101|102|roomId|room_id/);
    const touching = await service.search({
      ...request,
      checkIn: request.checkOut,
      checkOut: '2027-01-10T10:00:00.000Z',
    });
    expect(touching.items.find((item) => item.roomTypeId === ids.type)).toMatchObject({
      availableRoomCount: 2,
    });
  });
  it('reports an exhausted type, then restores it after the source block is released', async () => {
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id,property_id,room_id,starts_at,ends_at,reason) VALUES ($1,$2,$3,$4,$5,'Second maintenance')`,
      [ids.maintenanceB, ids.property, ids.roomB, request.checkIn, request.checkOut],
    );
    await database.pool.query(
      `INSERT INTO room_inventory_blocks (property_id,room_id,maintenance_block_id,block_type,starts_at,ends_at) VALUES ($1,$2,$3,'MAINTENANCE',$4,$5)`,
      [ids.property, ids.roomB, ids.maintenanceB, request.checkIn, request.checkOut],
    );
    const exhausted = await service.search(request);
    expect(exhausted.items.find((item) => item.roomTypeId === ids.type)).toBeUndefined();
    await database.pool.query(
      `UPDATE room_inventory_blocks SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE maintenance_block_id = $1`,
      [ids.maintenanceB],
    );
    const released = await service.search(request);
    expect(released.items.find((item) => item.roomTypeId === ids.type)).toMatchObject({
      availableRoomCount: 1,
    });
  });
  it('returns no eligible room type for capacity beyond its public capacity', async () => {
    await expect(service.search({ ...request, adults: 3, children: 1 })).resolves.toEqual({
      items: [],
    });
  });
});
