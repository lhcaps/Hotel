import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';
import {
  applyMigrationsFromFolder,
  buildTrimmedDrizzleFolder,
  createTrimmedMigratedTestDatabase,
  disposeTrimmedDrizzleFolder,
  type TrimmedMigratedTestDatabase,
} from './migration-folder.js';

const ids = {
  property: '00190000-0000-4000-8000-000000000001',
  tier: '00190000-0000-4000-8000-000000000002',
  roomType: '00190000-0000-4000-8000-000000000003',
  room: '00190000-0000-4000-8000-000000000004',
  booking: '00190000-0000-4000-8000-000000000005',
  coupon: '00190000-0000-4000-8000-000000000006',
} as const;

async function seedPhase8cRows(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO properties (id, code, name, timezone) VALUES ($1, 'UPGRADE_0019', 'Upgrade 0019', 'Asia/Ho_Chi_Minh')`,
    [ids.property],
  );
  await database.pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'STANDARD', 'Standard', 1)`,
    [ids.tier, ids.property],
  );
  await database.pool.query(
    `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'DELUXE', 'Deluxe', 2, 1, 3)`,
    [ids.roomType, ids.property, ids.tier],
  );
  await database.pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number) VALUES ($1, $2, $3, 'U-101')`,
    [ids.room, ids.property, ids.roomType],
  );
  await database.pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children,
        currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot, hold_expires_at)
       VALUES ($1, $2, $3, $4, 'UPGRADE-0019', 'HOLD', '2027-02-10T04:00:00.000Z', '2027-02-10T07:00:00.000Z', 1, 0,
       'VND', 300000, 0, 300000, '{"ratePlanCode":"STANDARD"}'::jsonb, '2027-02-01T00:00:00.000Z')`,
    [ids.booking, ids.property, ids.roomType, ids.room],
  );
  await database.pool.query(
    `INSERT INTO coupons
       (id, property_id, normalized_code, discount_type, fixed_amount_vnd, minimum_order_amount_vnd,
        valid_from, valid_until, applies_to_all_room_types)
       VALUES ($1, $2, 'UPGRADE10', 'FIXED', 10000, 0, '2026-01-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z', true)`,
    [ids.coupon, ids.property],
  );
  await database.pool.query(
    `INSERT INTO outbox_events (property_id, aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, 'BOOKING', $2, 'booking.hold.created', '{}'::jsonb)`,
    [ids.property, ids.booking],
  );
}

describe('Phase 8D migration 0019 — fresh 0000 through 0019', () => {
  let database: TrimmedMigratedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createTrimmedMigratedTestDatabase(baseUrl, 19);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('creates coupon delivery storage and stamps the Phase 8D schema version', async () => {
    const result = await database.pool.query<{ table_name: string; schema_version: string }>(
      `SELECT table_name, (SELECT schema_version FROM schema_metadata WHERE id = 1) AS schema_version
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'coupon_delivery_requests'`,
    );
    expect(result.rows).toEqual([
      { table_name: 'coupon_delivery_requests', schema_version: 'phase-8d-client-acceptance-v1' },
    ]);
  });
});

describe('Phase 8D migration 0019 — populated 0018 upgrade', () => {
  let database: GuardedTestDatabase;
  let folder: string;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createGuardedTestDatabase(baseUrl);
    folder = buildTrimmedDrizzleFolder(18);
    await applyMigrationsFromFolder(database.databaseUrl, folder);
    await seedPhase8cRows(database);
    disposeTrimmedDrizzleFolder(folder);
    folder = buildTrimmedDrizzleFolder(19);
    await applyMigrationsFromFolder(database.databaseUrl, folder);
  });

  afterAll(async () => {
    disposeTrimmedDrizzleFolder(folder);
    await database?.dispose();
  });

  it('preserves bookings, coupons, and outbox rows while adding the request constraints', async () => {
    const counts = await database.pool.query<{ table_name: string; count: string }>(
      `SELECT 'bookings' AS table_name, count(*)::text FROM bookings
       UNION ALL SELECT 'coupons', count(*)::text FROM coupons
       UNION ALL SELECT 'outbox_events', count(*)::text FROM outbox_events
       ORDER BY table_name`,
    );
    expect(counts.rows).toEqual([
      { table_name: 'bookings', count: '1' },
      { table_name: 'coupons', count: '1' },
      { table_name: 'outbox_events', count: '1' },
    ]);
    const constraints = await database.pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'coupon_delivery_requests'::regclass ORDER BY conname`,
    );
    expect(constraints.rows.map((row) => row.conname)).toEqual(
      expect.arrayContaining([
        'coupon_delivery_requests_booking_fk',
        'coupon_delivery_requests_codes_ck',
        'coupon_delivery_requests_idempotency_ck',
        'coupon_delivery_requests_property_fk',
        'coupon_delivery_requests_status_ck',
      ]),
    );
  });

  it('enforces property-scoped idempotency while retaining the original coupon-code snapshot', async () => {
    const key = `upgrade-${randomUUID()}`;
    await database.pool.query(
      `INSERT INTO coupon_delivery_requests (property_id, booking_id, idempotency_key, coupon_codes)
       VALUES ($1, $2, $3, '["UPGRADE10"]'::jsonb)`,
      [ids.property, ids.booking, key],
    );
    await expect(
      database.pool.query(
        `INSERT INTO coupon_delivery_requests (property_id, booking_id, idempotency_key, coupon_codes)
         VALUES ($1, $2, $3, '["OTHER10"]'::jsonb)`,
        [ids.property, ids.booking, key],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    const snapshot = await database.pool.query<{ coupon_codes: string[] }>(
      `SELECT coupon_codes FROM coupon_delivery_requests WHERE property_id = $1 AND idempotency_key = $2`,
      [ids.property, key],
    );
    expect(snapshot.rows).toEqual([{ coupon_codes: ['UPGRADE10'] }]);
  });
});
