/**
 * Phase 3B1 — Catalog archive/retype safety integration tests.
 *
 * Uses real PostgreSQL via the guarded database helper to prove that
 * the catalog service refuses every unsafe archive/retype combination
 * server-side, persists zero success audit events on failure, and writes
 * exactly one success audit event on the allowed cases.
 */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { AuditRepository } from '../../src/catalog/audit.repository.js';
import { CatalogRepository } from '../../src/catalog/catalog.repository.js';
import { CatalogService } from '../../src/catalog/catalog.service.js';

const staticIds = {
  property: '770e8400-e29b-41d4-a716-446655440101',
  tier: '770e8400-e29b-41d4-a716-446655440102',
  roomType: '770e8400-e29b-41d4-a716-446655440103',
  roomTypeAlt: '770e8400-e29b-41d4-a716-446655440104',
  customer: '770e8400-e29b-41d4-a716-446655440107',
};

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['catalog.room.manage', 'catalog.room_type.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'phase-3b1-integration',
  propertyIds: [staticIds.property],
};

/**
 * Round the current time to the nearest 15-minute boundary so the
 * bookings_quarter_hour_ck constraint is satisfied. Past offsets round
 * down; future offsets round up so the resulting timestamp is still
 * offsetDelta from the rounded now.
 */
function quarterHourMinutes(offset: number): Date {
  const FIFTEEN_MINUTES = 15 * 60_000;
  const now = Date.now();
  const target = now + offset * 60_000;
  const rounded = Math.ceil(target / FIFTEEN_MINUTES) * FIFTEEN_MINUTES;
  if (rounded - target > FIFTEEN_MINUTES / 2) {
    return new Date(rounded - FIFTEEN_MINUTES);
  }
  return new Date(rounded);
}

const priceSnapshot = {
  baseAmountVnd: 100_000,
  extraAmountVnd: 0,
  totalAmountVnd: 100_000,
};

describe('Phase 3B1 catalog archive and retype safety', () => {
  let database: GuardedTestDatabase;
  let catalog: CatalogService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) {
      throw new Error('TEST_DATABASE_URL is required for Phase 3B1 integration tests');
    }
    database = await createPreparedGuardedTestDatabase(url, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const client: DatabaseClient = createDatabaseClient(database.pool);
    catalog = new CatalogService(client, new CatalogRepository(client), new AuditRepository());
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone) VALUES ($1, 'MAIN', 'Main', 'Asia/Ho_Chi_Minh')`,
      [staticIds.property],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'STANDARD', 'Standard', 0)`,
      [staticIds.tier, staticIds.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'DLX', 'Deluxe', 2, 0, 2)`,
      [staticIds.roomType, staticIds.property, staticIds.tier],
    );
    await database.pool.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'STD', 'Standard', 2, 0, 2)`,
      [staticIds.roomTypeAlt, staticIds.property, staticIds.tier],
    );
    await database.pool.query(
      `INSERT INTO users (id, email, name, role) VALUES ($1, 'guest@example.test', 'Guest', 'CUSTOMER')`,
      [staticIds.customer],
    );
  });

  afterAll(async () => {
    await database?.dispose();
  });

  async function insertRoom(roomId: string, roomTypeId: string, roomNumber: string): Promise<void> {
    await database.pool.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number) VALUES ($1, $2, $3, $4)`,
      [roomId, staticIds.property, roomTypeId, roomNumber],
    );
  }

  async function insertBooking(options: {
    bookingId: string;
    roomId: string;
    roomTypeId?: string;
    status: 'HOLD' | 'CONFIRMED' | 'CHECKED_IN';
    checkIn: Date;
    checkOut: Date;
  }): Promise<void> {
    const checkedInAt = options.status === 'CHECKED_IN' ? options.checkIn : null;
    // For HOLD bookings, hold_expires_at must be in the future and after
    // the implicit created_at. For other statuses, set it well past the
    // checkout to keep the constraint satisfied without affecting the
    // archive-safety semantics under test.
    const holdExpiresAt = new Date(Date.now() + 60 * 60_000);
    await database.pool.query(
      `INSERT INTO bookings (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot, hold_expires_at, checked_in_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 0, 'VND', 100000, 0, 100000, $9, $10, $11)`,
      [
        options.bookingId,
        staticIds.property,
        options.roomTypeId ?? staticIds.roomType,
        options.roomId,
        options.bookingId,
        options.status,
        options.checkIn,
        options.checkOut,
        priceSnapshot,
        holdExpiresAt,
        checkedInAt,
      ],
    );
    await database.pool.query(
      `INSERT INTO room_inventory_blocks (property_id, room_id, booking_id, block_type, starts_at, ends_at)
       VALUES ($1, $2, $3, 'BOOKING', $4, $5)`,
      [staticIds.property, options.roomId, options.bookingId, options.checkIn, options.checkOut],
    );
  }

  async function insertMaintenanceBlock(options: {
    blockId: string;
    roomId: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<void> {
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id, property_id, room_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, $4, $5, 'Phase 3B1 maintenance')`,
      [options.blockId, staticIds.property, options.roomId, options.startsAt, options.endsAt],
    );
    await database.pool.query(
      `INSERT INTO room_inventory_blocks (property_id, room_id, maintenance_block_id, block_type, starts_at, ends_at)
       VALUES ($1, $2, $3, 'MAINTENANCE', $4, $5)`,
      [staticIds.property, options.roomId, options.blockId, options.startsAt, options.endsAt],
    );
  }

  async function auditCount(aggregateId: string, eventType: string): Promise<number> {
    const result = await database.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM audit_events WHERE aggregate_id = $1 AND event_type = $2`,
      [aggregateId, eventType],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async function roomStatus(roomId: string): Promise<string> {
    const result = await database.pool.query<{ status: string }>(
      `SELECT status FROM rooms WHERE id = $1`,
      [roomId],
    );
    return result.rows[0]?.status ?? '';
  }

  it('archives an unused physical room and writes exactly one success audit event', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'U-101');
    const result = await catalog.archiveRoom(actor, roomId, { archive: true });
    expect(result.status).toBe('INACTIVE');
    expect(await auditCount(roomId, 'ROOM_ARCHIVED')).toBe(1);
    expect(await auditCount(roomId, 'ROOM_ARCHIVED_FAILED')).toBe(0);
  });

  it('rejects room archive with ROOM_ARCHIVE_ACTIVE_BOOKING when a CHECKED_IN booking exists', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'AB-101');
    const checkIn = quarterHourMinutes(-30);
    const checkOut = quarterHourMinutes(120);
    await insertBooking({
      bookingId: randomUUID(),
      roomId,
      status: 'CHECKED_IN',
      checkIn,
      checkOut,
    });
    await expect(catalog.archiveRoom(actor, roomId, { archive: true })).rejects.toMatchObject({
      code: 'ROOM_ARCHIVE_ACTIVE_BOOKING',
    });
    expect(await roomStatus(roomId)).toBe('ACTIVE');
    expect(await auditCount(roomId, 'ROOM_ARCHIVED')).toBe(0);
  });

  it('rejects room archive with ROOM_ARCHIVE_FUTURE_BOOKING when a future CONFIRMED booking exists', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'FB-101');
    const checkIn = quarterHourMinutes(180);
    const checkOut = quarterHourMinutes(360);
    await insertBooking({
      bookingId: randomUUID(),
      roomId,
      status: 'CONFIRMED',
      checkIn,
      checkOut,
    });
    await expect(catalog.archiveRoom(actor, roomId, { archive: true })).rejects.toMatchObject({
      code: 'ROOM_ARCHIVE_FUTURE_BOOKING',
    });
    expect(await roomStatus(roomId)).toBe('ACTIVE');
  });

  it('rejects room archive with ROOM_ARCHIVE_FUTURE_BOOKING when a future HOLD blocks inventory', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'FH-101');
    const checkIn = quarterHourMinutes(180);
    const checkOut = quarterHourMinutes(360);
    await insertBooking({
      bookingId: randomUUID(),
      roomId,
      status: 'HOLD',
      checkIn,
      checkOut,
    });
    await expect(catalog.archiveRoom(actor, roomId, { archive: true })).rejects.toMatchObject({
      code: 'ROOM_ARCHIVE_FUTURE_BOOKING',
    });
    expect(await roomStatus(roomId)).toBe('ACTIVE');
  });

  it('rejects room archive with ROOM_ARCHIVE_ACTIVE_MAINTENANCE', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'AM-101');
    await insertMaintenanceBlock({
      blockId: randomUUID(),
      roomId,
      startsAt: quarterHourMinutes(-15),
      endsAt: quarterHourMinutes(45),
    });
    await expect(catalog.archiveRoom(actor, roomId, { archive: true })).rejects.toMatchObject({
      code: 'ROOM_ARCHIVE_ACTIVE_MAINTENANCE',
    });
    expect(await roomStatus(roomId)).toBe('ACTIVE');
  });

  it('rejects room archive with ROOM_ARCHIVE_FUTURE_MAINTENANCE', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'FM-101');
    await insertMaintenanceBlock({
      blockId: randomUUID(),
      roomId,
      startsAt: quarterHourMinutes(60),
      endsAt: quarterHourMinutes(180),
    });
    await expect(catalog.archiveRoom(actor, roomId, { archive: true })).rejects.toMatchObject({
      code: 'ROOM_ARCHIVE_FUTURE_MAINTENANCE',
    });
  });

  it('retype succeeds when an unused room is moved to another room type in the same property', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'RT-101');
    const updated = await catalog.updateRoom(actor, roomId, { roomTypeId: staticIds.roomTypeAlt });
    expect(updated.roomTypeId).toBe(staticIds.roomTypeAlt);
  });

  it('rejects retype with ROOM_RETYPE_FUTURE_BOOKING when a future booking exists', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'RT-301');
    await insertBooking({
      bookingId: randomUUID(),
      roomId,
      status: 'CONFIRMED',
      checkIn: quarterHourMinutes(180),
      checkOut: quarterHourMinutes(360),
    });
    await expect(
      catalog.updateRoom(actor, roomId, { roomTypeId: staticIds.roomTypeAlt }),
    ).rejects.toMatchObject({ code: 'ROOM_RETYPE_FUTURE_BOOKING' });
  });

  it('rejects retype with ROOM_RETYPE_ACTIVE_MAINTENANCE when an active maintenance exists', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'RT-401');
    await insertMaintenanceBlock({
      blockId: randomUUID(),
      roomId,
      startsAt: quarterHourMinutes(-15),
      endsAt: quarterHourMinutes(45),
    });
    await expect(
      catalog.updateRoom(actor, roomId, { roomTypeId: staticIds.roomTypeAlt }),
    ).rejects.toMatchObject({ code: 'ROOM_RETYPE_ACTIVE_MAINTENANCE' });
  });

  it('archives a room-type after all dependent state is removed', async () => {
    const roomTypeId = randomUUID();
    const tierId = randomUUID();
    const roomId = randomUUID();
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'TEMP', 'Temp', 0)`,
      [tierId, staticIds.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'TMP', 'Tmp', 2, 0, 2)`,
      [roomTypeId, staticIds.property, tierId],
    );
    await insertRoom(roomId, roomTypeId, 'TP-101');
    const archivedRoom = await catalog.archiveRoom(actor, roomId, { archive: true });
    expect(archivedRoom.status).toBe('INACTIVE');
    expect(await auditCount(roomId, 'ROOM_ARCHIVED')).toBe(1);

    const archivedType = await catalog.archiveRoomType(actor, roomTypeId, { archive: true });
    expect(archivedType.status).toBe('INACTIVE');
    expect(await auditCount(roomTypeId, 'ROOM_TYPE_ARCHIVED')).toBe(1);
  });

  it('rejects room-type archive with ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS when an active room still references it', async () => {
    const roomTypeId = randomUUID();
    const tierId = randomUUID();
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'TEMP2', 'Temp2', 0)`,
      [tierId, staticIds.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'TMP2', 'Tmp2', 2, 0, 2)`,
      [roomTypeId, staticIds.property, tierId],
    );
    await insertRoom(randomUUID(), roomTypeId, 'AR-101');
    await expect(
      catalog.archiveRoomType(actor, roomTypeId, { archive: true }),
    ).rejects.toMatchObject({ code: 'ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS' });
  });

  it('rejects room-type archive with ROOM_TYPE_ARCHIVE_FUTURE_BOOKING when a future booking references the type', async () => {
    const roomTypeId = randomUUID();
    const tierId = randomUUID();
    const roomId = randomUUID();
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'TEMP3', 'Temp3', 0)`,
      [tierId, staticIds.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'TMP3', 'Tmp3', 2, 0, 2)`,
      [roomTypeId, staticIds.property, tierId],
    );
    await insertRoom(roomId, roomTypeId, 'FB-201');
    // Archive the room first so the active-rooms check is satisfied. The
    // room-type still has a future booking referencing its id, which is the
    // blocking dependency that the safety check must surface.
    const archivedRoom = await catalog.archiveRoom(actor, roomId, { archive: true });
    expect(archivedRoom.status).toBe('INACTIVE');
    await insertBooking({
      bookingId: randomUUID(),
      roomId,
      roomTypeId,
      status: 'CONFIRMED',
      checkIn: quarterHourMinutes(120),
      checkOut: quarterHourMinutes(240),
    });
    await expect(
      catalog.archiveRoomType(actor, roomTypeId, { archive: true }),
    ).rejects.toMatchObject({ code: 'ROOM_TYPE_ARCHIVE_FUTURE_BOOKING' });
  });

  it('rejects room-type archive with ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE when a future maintenance references the type', async () => {
    const roomTypeId = randomUUID();
    const tierId = randomUUID();
    const roomId = randomUUID();
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'TEMP4', 'Temp4', 0)`,
      [tierId, staticIds.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'TMP4', 'Tmp4', 2, 0, 2)`,
      [roomTypeId, staticIds.property, tierId],
    );
    await insertRoom(roomId, roomTypeId, 'FM-201');
    // Archive the room first; the type still has a future maintenance
    // block referencing its room, which the safety check must surface.
    const archivedRoom = await catalog.archiveRoom(actor, roomId, { archive: true });
    expect(archivedRoom.status).toBe('INACTIVE');
    await insertMaintenanceBlock({
      blockId: randomUUID(),
      roomId,
      startsAt: quarterHourMinutes(60),
      endsAt: quarterHourMinutes(180),
    });
    await expect(
      catalog.archiveRoomType(actor, roomTypeId, { archive: true }),
    ).rejects.toMatchObject({ code: 'ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE' });
  });

  it('concurrent archive attempts are safe (ACID): audit events for the target is exactly one', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'CC-101');
    const results = await Promise.allSettled([
      catalog.archiveRoom(actor, roomId, { archive: true }),
      catalog.archiveRoom(actor, roomId, { archive: true }),
      catalog.archiveRoom(actor, roomId, { archive: true }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
    expect(await auditCount(roomId, 'ROOM_ARCHIVED')).toBe(1);
    expect(await auditCount(roomId, 'ROOM_ARCHIVED_FAILED')).toBe(0);
  });

  it('failed archive writes zero success audit events for the target room', async () => {
    const roomId = randomUUID();
    await insertRoom(roomId, staticIds.roomType, 'FL-101');
    await insertBooking({
      bookingId: randomUUID(),
      roomId,
      status: 'CHECKED_IN',
      checkIn: quarterHourMinutes(-30),
      checkOut: quarterHourMinutes(120),
    });
    await expect(catalog.archiveRoom(actor, roomId, { archive: true })).rejects.toMatchObject({
      code: 'ROOM_ARCHIVE_ACTIVE_BOOKING',
    });
    expect(await auditCount(roomId, 'ROOM_ARCHIVED')).toBe(0);
  });

  it('failure audit policy matches the documented domain (no *_FAILED events written)', async () => {
    const failure = await database.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM audit_events WHERE event_type LIKE 'ROOM_%_FAILED'`,
    );
    expect(Number(failure.rows[0]?.count ?? 0)).toBe(0);
  });
});
