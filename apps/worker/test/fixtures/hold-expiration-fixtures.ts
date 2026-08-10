import { randomUUID } from 'node:crypto';

import { createDatabasePool, migrateDatabase, type DatabasePool } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

export interface ExpirationFixture {
  readonly database: GuardedTestDatabase;
  readonly pool: DatabasePool;
  createPool(applicationName: string): DatabasePool;
  close(): Promise<void>;
}

export interface HoldState {
  readonly booking: {
    readonly status: string;
    readonly holdExpiresAt: Date;
    readonly expiredAt: Date | null;
  };
  readonly block: {
    readonly status: string;
    readonly releasedAt: Date | null;
  };
  readonly audits: number;
  readonly outbox: number;
}

export interface SeedHoldOptions {
  readonly status?: 'HOLD' | 'EXPIRED' | 'CONFIRMED';
  readonly stale?: boolean;
  readonly checkInOffsetMinutes?: number;
  readonly durationMinutes?: number;
}

export async function createExpirationFixture(): Promise<ExpirationFixture> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (baseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL is required');
  }

  const database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
    await migrateDatabase(guarded.databaseUrl);
  });
  const pool = createDatabasePool(database.databaseUrl, {
    max: 8,
    applicationName: 'task5-fixture',
  });
  const extraPools: DatabasePool[] = [];

  return {
    database,
    pool,
    createPool(applicationName) {
      const result = createDatabasePool(database.databaseUrl, { max: 2, applicationName });
      extraPools.push(result);
      return result;
    },
    async close() {
      await Promise.all(extraPools.map((extraPool) => extraPool.end()));
      await pool.end();
      await database.dispose();
    },
  };
}

export async function seedHold(pool: DatabasePool, options: SeedHoldOptions = {}): Promise<string> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const bookingId = randomUUID();
  const status = options.status ?? 'HOLD';
  const stale = options.stale ?? true;
  const checkInOffsetMinutes = options.checkInOffsetMinutes ?? 24 * 60;
  const durationMinutes = options.durationMinutes ?? 3 * 60;

  await pool.query(
    `INSERT INTO properties (id, code, name)
     VALUES ($1, $2, 'Task 5 property')`,
    [propertyId, `TASK5_${propertyId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name)
     VALUES ($1, $2, 'TASK5_TIER', 'Task 5 tier')`,
    [tierId, propertyId],
  );
  await pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
     VALUES ($1, $2, $3, 'TASK5_ROOM', 'Task 5 room', 2, 0, 2)`,
    [roomTypeId, propertyId, tierId],
  );
  await pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number)
     VALUES ($1, $2, $3, 'TASK5-1')`,
    [roomId, propertyId, roomTypeId],
  );
  await pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status,
        check_in, check_out, adults, children, currency,
        gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
        price_snapshot, hold_expires_at, expired_at, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6::booking_status,
        CURRENT_TIMESTAMP + ($8::int * interval '1 minute'),
        CURRENT_TIMESTAMP + (($8::int + $9::int) * interval '1 minute'),
        1, 0, 'VND', 1000, 0, 1000,
        '{"source":"task5"}'::jsonb,
        CASE WHEN $7::boolean
          THEN CURRENT_TIMESTAMP - interval '1 minute'
          ELSE CURRENT_TIMESTAMP + interval '1 hour'
        END,
        CASE WHEN $6::text = 'EXPIRED' THEN CURRENT_TIMESTAMP - interval '30 seconds' ELSE NULL END,
        CURRENT_TIMESTAMP - interval '2 days', CURRENT_TIMESTAMP - interval '2 days')`,
    [
      bookingId,
      propertyId,
      roomTypeId,
      roomId,
      `TASK5-${bookingId.slice(0, 8)}`,
      status,
      stale,
      checkInOffsetMinutes,
      durationMinutes,
    ],
  );
  await pool.query(
    `INSERT INTO room_inventory_blocks
       (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
     VALUES
       ($1, $2, $3, 'BOOKING', 'ACTIVE',
        CURRENT_TIMESTAMP + ($4::int * interval '1 minute'),
        CURRENT_TIMESTAMP + (($4::int + $5::int) * interval '1 minute'))`,
    [propertyId, roomId, bookingId, checkInOffsetMinutes, durationMinutes],
  );

  return bookingId;
}

export async function seedMaintenanceBlock(pool: DatabasePool): Promise<string> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const maintenanceId = randomUUID();

  await pool.query(
    `INSERT INTO properties (id, code, name) VALUES ($1, $2, 'Maintenance property')`,
    [propertyId, `TASK5_${propertyId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name) VALUES ($1, $2, 'TASK5_TIER', 'Task 5 tier')`,
    [tierId, propertyId],
  );
  await pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
     VALUES ($1, $2, $3, 'TASK5_ROOM', 'Task 5 room', 2, 0, 2)`,
    [roomTypeId, propertyId, tierId],
  );
  await pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number)
     VALUES ($1, $2, $3, 'TASK5-M')`,
    [roomId, propertyId, roomTypeId],
  );
  await pool.query(
    `INSERT INTO maintenance_blocks
       (id, property_id, room_id, starts_at, ends_at, reason)
     VALUES
       ($1, $2, $3, date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day',
        date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day 3 hours', 'Task 5 maintenance')`,
    [maintenanceId, propertyId, roomId],
  );
  await pool.query(
    `INSERT INTO room_inventory_blocks
       (property_id, room_id, maintenance_block_id, block_type, status, starts_at, ends_at)
     VALUES
       ($1, $2, $3, 'MAINTENANCE', 'ACTIVE',
        date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day',
        date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day 3 hours')`,
    [propertyId, roomId, maintenanceId],
  );
  return maintenanceId;
}

export async function readHoldState(pool: DatabasePool, bookingId: string): Promise<HoldState> {
  const booking = await pool.query<{
    status: string;
    hold_expires_at: Date;
    expired_at: Date | null;
  }>('SELECT status, hold_expires_at, expired_at FROM bookings WHERE id = $1', [bookingId]);
  const block = await pool.query<{ status: string; released_at: Date | null }>(
    'SELECT status, released_at FROM room_inventory_blocks WHERE booking_id = $1',
    [bookingId],
  );
  const audits = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count
       FROM audit_events
      WHERE aggregate_id = $1 AND event_type = 'HOLD_EXPIRED'`,
    [bookingId],
  );
  const outbox = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count
       FROM outbox_events
      WHERE aggregate_id = $1 AND event_type = 'booking.hold.expired'`,
    [bookingId],
  );
  const bookingRow = booking.rows[0];
  const blockRow = block.rows[0];
  if (bookingRow === undefined || blockRow === undefined) {
    throw new Error('Task 5 fixture state is missing');
  }
  return {
    booking: {
      status: bookingRow.status,
      holdExpiresAt: bookingRow.hold_expires_at,
      expiredAt: bookingRow.expired_at,
    },
    block: { status: blockRow.status, releasedAt: blockRow.released_at },
    audits: audits.rows[0]?.count ?? 0,
    outbox: outbox.rows[0]?.count ?? 0,
  };
}

export function postgresErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}

export function synchronizeFirstConnections(
  first: DatabasePool,
  second: DatabasePool,
): readonly [DatabasePool, DatabasePool] {
  let arrivals = 0;
  let release: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });

  function synchronized(pool: DatabasePool): DatabasePool {
    let firstConnect = true;
    return new Proxy(pool, {
      get(target, property, receiver) {
        if (property !== 'connect') {
          return Reflect.get(target, property, receiver) as unknown;
        }
        return async () => {
          if (firstConnect) {
            firstConnect = false;
            arrivals += 1;
            if (arrivals === 2) release?.();
            await ready;
          }
          return target.connect();
        };
      },
    }) as DatabasePool;
  }

  return [synchronized(first), synchronized(second)];
}
