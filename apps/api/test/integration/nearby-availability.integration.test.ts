import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { NearbyAvailabilityRepository } from '../../src/pricing/nearby-availability.repository.js';
import { NearbyAvailabilityService } from '../../src/pricing/nearby-availability.service.js';

const ids = {
  property: '550e8400-e29b-41d4-a716-446655440010',
  tier: '550e8400-e29b-41d4-a716-446655440020',
  type: '550e8400-e29b-41d4-a716-446655440030',
  typeSecond: '550e8400-e29b-41d4-a716-446655440031',
  typeCapacityShort: '550e8400-e29b-41d4-a716-446655440032',
  typeArchived: '550e8400-e29b-41d4-a716-446655440033',
  typeSecondProperty: '550e8400-e29b-41d4-a716-446655440034',
  room: '550e8400-e29b-41d4-a716-446655440040',
  roomSecond: '550e8400-e29b-41d4-a716-446655440041',
  roomInactive: '550e8400-e29b-41d4-a716-446655440042',
  roomArchivedType: '550e8400-e29b-41d4-a716-446655440043',
  roomSecondProperty: '550e8400-e29b-41d4-a716-446655440044',
  roomCapacityShort: '550e8400-e29b-41d4-a716-446655440045',
  roomExtraDeluxe: '550e8400-e29b-41d4-a716-446655440046',
  roomExtraStudio: '550e8400-e29b-41d4-a716-446655440047',
  plan: '550e8400-e29b-41d4-a716-446655440060',
  planPrice: '550e8400-e29b-41d4-a716-446655440061',
  planDraft: '550e8400-e29b-41d4-a716-446655440062',
  planDraftPrice: '550e8400-e29b-41d4-a716-446655440063',
  secondaryProperty: '550e8400-e29b-41d4-a716-446655440070',
  secondaryTier: '550e8400-e29b-41d4-a716-446655440071',
  maintenancePrefix: '550e8400-e29b-41d4-a716-44665544',
  planPriceMissing: '550e8400-e29b-41d4-a716-446655440064',
};

describe('nearby availability bounded search', () => {
  let database: GuardedTestDatabase;
  let client: DatabaseClient;
  let service: NearbyAvailabilityService;
  let repository: NearbyAvailabilityRepository;
  let maintenanceCounter = 1;

  function nextMaintenanceId(): string {
    const value = maintenanceCounter;
    maintenanceCounter += 1;
    return `${ids.maintenancePrefix}${value.toString(16).padStart(4, '0')}-9999-9999-9999-999999999999`.slice(0, 36);
  }

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    client = createDatabaseClient(database.pool);
    repository = new NearbyAvailabilityRepository(client);
    service = new NearbyAvailabilityService(repository);
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone) VALUES ($1,'MAIN','Main','Asia/Ho_Chi_Minh')`,
      [ids.property],
    );
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone,status) VALUES ($1,'SEC','Secondary','Asia/Ho_Chi_Minh','ACTIVE')`,
      [ids.secondaryProperty],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES
       ($1,$2,'TIER_MAIN','Tier Main',1),
       ($3,$4,'TIER_SECOND','Tier Second',1)`,
      [ids.tier, ids.property, ids.secondaryTier, ids.secondaryProperty],
    );
    await database.pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy,status) VALUES
       ($1,$2,$3,'DLX','Deluxe',2,1,3,'ACTIVE'),
       ($4,$2,$3,'STE','Studio',2,1,3,'ACTIVE'),
       ($5,$2,$3,'ECO','Economy',1,0,1,'ACTIVE'),
       ($6,$2,$3,'ARC','Archived',2,0,2,'INACTIVE'),
       ($7,$8,$9,'FOR','Foreign',2,0,2,'ACTIVE')`,
      [
        ids.type,
        ids.property,
        ids.tier,
        ids.typeSecond,
        ids.typeCapacityShort,
        ids.typeArchived,
        ids.typeSecondProperty,
        ids.secondaryProperty,
        ids.secondaryTier,
      ],
    );
    await database.pool.query(
      `INSERT INTO rooms (id,property_id,room_type_id,room_number,status) VALUES
       ($1,$2,$3,'101','ACTIVE'),
       ($4,$2,$5,'201','ACTIVE'),
       ($6,$2,$7,'301','INACTIVE'),
       ($8,$9,$10,'901','ACTIVE'),
       ($11,$2,$12,'401','ACTIVE'),
       ($13,$2,$3,'102','ACTIVE'),
       ($14,$2,$5,'202','ACTIVE')`,
      [
        ids.room,
        ids.property,
        ids.type,
        ids.roomSecond,
        ids.typeSecond,
        ids.roomInactive,
        ids.typeArchived,
        ids.roomSecondProperty,
        ids.secondaryProperty,
        ids.typeSecondProperty,
        ids.roomCapacityShort,
        ids.typeCapacityShort,
        ids.roomExtraDeluxe,
        ids.roomExtraStudio,
      ],
    );
    await database.pool.query(
      `INSERT INTO rate_plans
       (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES
       ($1,$2,'THREE_HOUR_COMBO','Three-hour combo','ACTIVE',180,1,true,60,240),
       ($3,$4,'TWO_HOUR_DRAFT','Two-hour draft','DRAFT',120,5,true,60,240)`,
      [ids.plan, ids.property, ids.planDraft, ids.property],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd) VALUES
       ($1,$2,$3,$4,300000),
       ($5,$6,$7,$4,150000)`,
      [
        ids.planPrice,
        ids.property,
        ids.plan,
        ids.tier,
        ids.planDraftPrice,
        ids.property,
        ids.planDraft,
      ],
    );
  });

  afterAll(async () => database?.dispose());

  const exactRequest = {
    checkIn: '2027-01-10T04:00:00.000Z',
    checkOut: '2027-01-10T07:00:00.000Z',
    adults: 2,
    children: 1,
  };

  async function resetBlocks() {
    await database.pool.query(`DELETE FROM room_inventory_blocks`);
    await database.pool.query(`DELETE FROM maintenance_blocks`);
  }

  async function addMaintenanceBlock(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
  ) {
    const maintenanceId = nextMaintenanceId();
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id,property_id,room_id,starts_at,ends_at,reason) VALUES ($1,$2,$3,$4,$5,'Test')`,
      [maintenanceId, ids.property, roomId, checkIn, checkOut],
    );
    await database.pool.query(
      `INSERT INTO room_inventory_blocks (property_id,room_id,maintenance_block_id,block_type,starts_at,ends_at) VALUES ($1,$2,$3,'MAINTENANCE',$4,$5)`,
      [ids.property, roomId, maintenanceId, checkIn, checkOut],
    );
  }

  it('still returns nearby candidates while mutating nothing in the database', async () => {
    await resetBlocks();
    const beforeBlocks = await database.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM room_inventory_blocks',
    );
    const beforeMaintenance = await database.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM maintenance_blocks',
    );
    const beforeQuotes = await database.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM quotes',
    );
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    expect(result.durationMinutes).toBe(180);
    expect(result.requestedCheckIn).toBe(exactRequest.checkIn);
    expect(result.requestedCheckOut).toBe(exactRequest.checkOut);
    expect(result.candidates.length).toBeGreaterThan(0);
    const afterBlocks = await database.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM room_inventory_blocks',
    );
    const afterMaintenance = await database.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM maintenance_blocks',
    );
    const afterQuotes = await database.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM quotes',
    );
    expect(afterBlocks.rows[0]?.count).toBe(beforeBlocks.rows[0]?.count);
    expect(afterMaintenance.rows[0]?.count).toBe(beforeMaintenance.rows[0]?.count);
    expect(afterQuotes.rows[0]?.count).toBe(beforeQuotes.rows[0]?.count);
  });

  it('returns a -15 / +15 minute candidate pair when the exact interval is blocked for at least one room type', async () => {
    await resetBlocks();
    await addMaintenanceBlock(
      ids.room,
      new Date(exactRequest.checkIn),
      new Date(exactRequest.checkOut),
    );
    await addMaintenanceBlock(
      ids.roomSecond,
      new Date(exactRequest.checkIn),
      new Date(exactRequest.checkOut),
    );
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    expect(result.candidates.length).toBeGreaterThan(0);
    const shifts = result.candidates.map((candidate) => candidate.shiftMinutes);
    expect(shifts).toContain(-15);
    expect(shifts).toContain(15);
    const first = shifts[0] as number;
    const second = shifts[1] as number;
    expect(Math.abs(first)).toBeLessThanOrEqual(Math.abs(second));
    for (const candidate of result.candidates) {
      const duration =
        (new Date(candidate.checkOut).getTime() - new Date(candidate.checkIn).getTime()) / 60_000;
      expect(duration).toBe(180);
    }
    for (const candidate of result.candidates) {
      for (const roomType of candidate.roomTypes) {
        const serialised = JSON.stringify(roomType);
        expect(serialised).not.toMatch(/101|201|301|401|901|roomId|room_id|roomNumber/);
      }
    }
  });

  it('falls back to ±30 / ±45 / ±60 when earlier offsets have no available rooms', async () => {
    await resetBlocks();
    const intervals: Array<[string, string, string]> = [
      [ids.room, '2027-01-10T03:45:00.000Z', '2027-01-10T06:45:00.000Z'],
      [ids.roomSecond, '2027-01-10T04:15:00.000Z', '2027-01-10T07:15:00.000Z'],
      [ids.roomCapacityShort, '2027-01-10T03:30:00.000Z', '2027-01-10T06:30:00.000Z'],
    ];
    for (const [room, start, end] of intervals) {
      await addMaintenanceBlock(room, new Date(start), new Date(end));
    }
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    const shifts = result.candidates.map((candidate) => candidate.shiftMinutes);
    expect(shifts.length).toBeGreaterThan(0);
    const sorted = [...shifts].sort((a, b) => Math.abs(a) - Math.abs(b));
    expect(Math.abs(sorted[0] ?? 0)).toBeGreaterThanOrEqual(15);
  });

  it('honors expandMinutes bound by stopping once the window is exhausted', async () => {
    await resetBlocks();
    const result = await service.search({ ...exactRequest, expandMinutes: 30, limit: 6 });
    const shifts = result.candidates.map((candidate) => candidate.shiftMinutes);
    for (const shift of shifts) {
      expect(Math.abs(shift)).toBeLessThanOrEqual(30);
    }
  });

  it('honors limit bound by returning no more candidates than requested', async () => {
    await resetBlocks();
    for (const room of [ids.room, ids.roomSecond, ids.roomCapacityShort]) {
      await addMaintenanceBlock(
        room,
        new Date(exactRequest.checkIn),
        new Date(exactRequest.checkOut),
      );
    }
    const result = await service.search({ ...exactRequest, expandMinutes: 120, limit: 2 });
    expect(result.candidates.length).toBeLessThanOrEqual(2);
  });

  it('preserves the exact requested duration across every candidate interval', async () => {
    await resetBlocks();
    for (const room of [ids.room, ids.roomSecond, ids.roomCapacityShort]) {
      await addMaintenanceBlock(
        room,
        new Date(exactRequest.checkIn),
        new Date(exactRequest.checkOut),
      );
    }
    const result = await service.search({ ...exactRequest, expandMinutes: 120, limit: 6 });
    for (const candidate of result.candidates) {
      const duration =
        (new Date(candidate.checkOut).getTime() - new Date(candidate.checkIn).getTime()) / 60_000;
      expect(duration).toBe(180);
    }
  });

  it('excludes room types whose capacity is too small for the requested guests', async () => {
    await resetBlocks();
    for (const room of [ids.room, ids.roomSecond, ids.roomCapacityShort]) {
      await addMaintenanceBlock(
        room,
        new Date(exactRequest.checkIn),
        new Date(exactRequest.checkOut),
      );
    }
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    for (const candidate of result.candidates) {
      for (const roomType of candidate.roomTypes) {
        expect(roomType.maxAdults).toBeGreaterThanOrEqual(exactRequest.adults);
        expect(roomType.maxChildren).toBeGreaterThanOrEqual(exactRequest.children);
        expect(roomType.maxOccupancy).toBeGreaterThanOrEqual(
          exactRequest.adults + exactRequest.children,
        );
      }
    }
  });

  it('excludes maintenance-blocked rooms from availability counts', async () => {
    await resetBlocks();
    await addMaintenanceBlock(
      ids.roomSecond,
      new Date(exactRequest.checkIn),
      new Date(exactRequest.checkOut),
    );
    await addMaintenanceBlock(
      ids.room,
      new Date('2027-01-10T03:45:00.000Z'),
      new Date('2027-01-10T06:45:00.000Z'),
    );
    await addMaintenanceBlock(
      ids.roomCapacityShort,
      new Date('2027-01-10T04:15:00.000Z'),
      new Date('2027-01-10T07:15:00.000Z'),
    );
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    const deluxeCandidate = result.candidates
      .flatMap((candidate) => candidate.roomTypes)
      .find((roomType) => roomType.roomTypeName === 'Deluxe');
    expect(deluxeCandidate).toBeDefined();
  });

  it('does not surface DRAFT rate plans inside any candidate offer', async () => {
    await resetBlocks();
    for (const room of [ids.room, ids.roomSecond, ids.roomCapacityShort]) {
      await addMaintenanceBlock(
        room,
        new Date(exactRequest.checkIn),
        new Date(exactRequest.checkOut),
      );
    }
    const result = await service.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    for (const candidate of result.candidates) {
      for (const roomType of candidate.roomTypes) {
        if (roomType.offer !== null) {
          expect(roomType.offer.planLabel).not.toBe('TWO_HOUR_DRAFT');
        }
      }
    }
  });

  it('bounds repository work to a single property-scoped batch', async () => {
    await resetBlocks();
    const observed = await repository.observeBatchSize((repo) => {
      const freshService = new NearbyAvailabilityService(repo);
      return freshService.search({ ...exactRequest, expandMinutes: 60, limit: 6 });
    });
    expect(observed).toBeLessThanOrEqual(9);
  });
});
