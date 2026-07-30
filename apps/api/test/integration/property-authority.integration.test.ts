import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { CatalogRepository } from '../../src/catalog/catalog.repository.js';
import { AvailabilityRepository } from '../../src/pricing/availability.repository.js';
import { PublicRoomCatalogRepository } from '../../src/public-catalog/public-room-catalog.repository.js';

const ids = {
  propertyA: '550e8400-e29b-41d4-a716-446655440010',
  propertyB: '550e8400-e29b-41d4-a716-446655440011',
  tierA: '550e8400-e29b-41d4-a716-446655440020',
  tierB: '550e8400-e29b-41d4-a716-446655440021',
  typeA: '550e8400-e29b-41d4-a716-446655440030',
  typeB: '550e8400-e29b-41d4-a716-446655440031',
  typeAAmenity: '550e8400-e29b-41d4-a716-446655440032',
  amenityB: '550e8400-e29b-41d4-a716-446655440040',
  roomA: '550e8400-e29b-41d4-a716-446655440050',
  roomB: '550e8400-e29b-41d4-a716-446655440051',
  plan: '550e8400-e29b-41d4-a716-446655440060',
  planPrice: '550e8400-e29b-41d4-a716-446655440061',
};

describe('active property authority parity', () => {
  let database: GuardedTestDatabase;
  let client: DatabaseClient;
  let catalog: CatalogRepository;
  let availability: AvailabilityRepository;
  let publicCatalog: PublicRoomCatalogRepository;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    client = createDatabaseClient(database.pool);
    catalog = new CatalogRepository(client);
    availability = new AvailabilityRepository(client);
    publicCatalog = new PublicRoomCatalogRepository(client);
    // Property A is created first, then archived.
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone,status,created_at) VALUES
       ($1,'A','Property A','Asia/Ho_Chi_Minh','ACTIVE','2020-01-01 00:00:00+00'),
       ($2,'B','Property B','Asia/Ho_Chi_Minh','ACTIVE','2025-01-01 00:00:00+00')`,
      [ids.propertyA, ids.propertyB],
    );
    await database.pool.query(
      `UPDATE properties SET status='INACTIVE', updated_at=NOW() WHERE id=$1`,
      [ids.propertyA],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES
       ($1,$2,'TIER_A','A',1),
       ($3,$4,'TIER_B','B',1)`,
      [ids.tierA, ids.propertyA, ids.tierB, ids.propertyB],
    );
    await database.pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy,status) VALUES
       ($1,$2,$3,'DLX','Deluxe',2,1,3,'ACTIVE'),
       ($4,$5,$6,'STE','Studio',2,1,3,'ACTIVE')`,
      [ids.typeA, ids.propertyA, ids.tierA, ids.typeB, ids.propertyB, ids.tierB],
    );
    await database.pool.query(
      `INSERT INTO rooms (id,property_id,room_type_id,room_number,status) VALUES
       ($1,$2,$3,'101','ACTIVE'),
       ($4,$5,$6,'201','ACTIVE')`,
      [ids.roomA, ids.propertyA, ids.typeA, ids.roomB, ids.propertyB, ids.typeB],
    );
    await database.pool.query(
      `INSERT INTO amenities (id,property_id,code,name,status) VALUES
       ($1,$2,'A_AMENT_A','Amenity A','ACTIVE'),
       ($3,$4,'B_AMENT_B','Amenity B','ACTIVE')`,
      [ids.typeAAmenity, ids.propertyA, ids.amenityB, ids.propertyB],
    );
    await database.pool.query(
      `INSERT INTO rate_plans
       (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'THREE_HOUR_COMBO','Three-hour combo','ACTIVE',180,1,true,60,240)`,
      [ids.plan, ids.propertyB],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd) VALUES ($1,$2,$3,$4,300000)`,
      [ids.planPrice, ids.propertyB, ids.plan, ids.tierB],
    );
  });

  afterAll(async () => database?.dispose());

  it('ADMIN catalog resolves the active property even when an older inactive one exists', async () => {
    const resolved = await catalog.getCurrentProperty();
    expect(resolved?.id).toBe(ids.propertyB);
    expect(resolved?.status).toBe('ACTIVE');
  });

  it('public availability search resolves the active property only', async () => {
    const items = await availability.search({
      checkIn: '2027-01-10T04:00:00.000Z',
      checkOut: '2027-01-10T07:00:00.000Z',
      adults: 2,
      children: 1,
    });
    const roomTypeIds = items.map((item) => item.roomTypeId);
    expect(roomTypeIds).toContain(ids.typeB);
    expect(roomTypeIds).not.toContain(ids.typeA);
  });

  it('public room catalog resolves only active room types from the active property', async () => {
    const items = await publicCatalog.list();
    const roomTypeIds = items.map((item) => item.id);
    expect(roomTypeIds).toContain(ids.typeB);
    expect(roomTypeIds).not.toContain(ids.typeA);
  });
});
