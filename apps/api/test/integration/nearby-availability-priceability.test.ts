import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';

import { NearbyAvailabilityService } from '../../src/pricing/nearby-availability.service.js';
import { NearbyAvailabilityRepository } from '../../src/pricing/nearby-availability.repository.js';

const ids = {
  property: '550e8400-e29b-41d4-a716-446655440110',
  tier: '550e8400-e29b-41d4-a716-446655440111',
  activePlan: '550e8400-e29b-41d4-a716-446655440112',
  activePrice: '550e8400-e29b-41d4-a716-446655440113',
  noPlanType: '550e8400-e29b-41d4-a716-446655440114',
  noPlanRoom: '550e8400-e29b-41d4-a716-446655440115',
  pricedType: '550e8400-e29b-41d4-a716-446655440116',
  pricedRoom: '550e8400-e29b-41d4-a716-446655440117',
};

describe('nearby availability priceability filter', () => {
  let database: GuardedTestDatabase;
  let client: DatabaseClient;
  let service: NearbyAvailabilityService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    client = createDatabaseClient(database.pool);
    service = new NearbyAvailabilityService(new NearbyAvailabilityRepository(client));
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone) VALUES ($1,'NOPRC','Noprice','Asia/Ho_Chi_Minh')`,
      [ids.property],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES ($1,$2,'TIER_NP','Tier Np',1)`,
      [ids.tier, ids.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy,status) VALUES
       ($1,$2,$3,'UNP','Unpriced',2,1,3,'ACTIVE'),
       ($4,$2,$3,'PRC','Priced',2,1,3,'ACTIVE')`,
      [ids.noPlanType, ids.property, ids.tier, ids.pricedType],
    );
    await database.pool.query(
      `INSERT INTO rooms (id,property_id,room_type_id,room_number,status) VALUES
       ($1,$2,$3,'601','ACTIVE'),
       ($4,$2,$5,'602','ACTIVE')`,
      [ids.noPlanRoom, ids.property, ids.noPlanType, ids.pricedRoom, ids.pricedType],
    );
    await database.pool.query(
      `INSERT INTO rate_plans
       (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'PRICED_3H','Three-hour priced','ACTIVE',180,1,true,60,240)`,
      [ids.activePlan, ids.property],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd) VALUES ($1,$2,$3,$4,300000)`,
      [ids.activePrice, ids.property, ids.activePlan, ids.tier],
    );
  });

  afterAll(async () => {
    await database?.dispose();
  });

  const exactRequest = {
    checkIn: '2027-02-10T04:00:00.000Z',
    checkOut: '2027-02-10T07:00:00.000Z',
    adults: 2,
    children: 0,
  };

  it('returns at least one priced candidate within the requested search window', async () => {
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    expect(result.requestedCheckIn).toBe(exactRequest.checkIn);
    expect(result.requestedCheckOut).toBe(exactRequest.checkOut);
    expect(result.durationMinutes).toBe(180);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      expect(candidate.shiftMinutes === 0 || Math.abs(candidate.shiftMinutes) >= 15).toBe(true);
      for (const roomType of candidate.roomTypes) {
        expect(roomType.availableRoomCount).toBeGreaterThan(0);
        expect(roomType.offer).not.toBeNull();
        expect(roomType.offer?.amountVnd).toBeGreaterThan(0);
      }
    }
  });

  it('returns no candidate when every room type is unavailable', async () => {
    await database.pool.query(`UPDATE rooms SET status = 'MAINTENANCE' WHERE property_id = $1`, [
      ids.property,
    ]);
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    expect(result.candidates).toHaveLength(0);
  });
});
