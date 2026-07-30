import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabasePool, migrateDatabase, type DatabasePool } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import { CouponDeliveryRepository } from '../../src/booking/repositories/coupon-delivery.repository.js';
import { CouponDeliveryError } from '../../src/booking/coupon-delivery.errors.js';

const ids = {
  property: '8d0e8400-e29b-41d4-a716-446655440101',
  tier: '8d0e8400-e29b-41d4-a716-446655440102',
  roomType: '8d0e8400-e29b-41d4-a716-446655440103',
  room: '8d0e8400-e29b-41d4-a716-446655440104',
};

async function seed(database: GuardedTestDatabase): Promise<{ bookingCode: string }> {
  const bookingId = randomUUID();
  const bookingCode = `DELIVERY-${bookingId.slice(0, 8).toUpperCase()}`;
  await database.pool.query(
    `INSERT INTO properties (id, code, name, timezone) VALUES ($1, 'MAIN', 'Main', 'Asia/Ho_Chi_Minh')`,
    [ids.property],
  );
  await database.pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'STANDARD', 'Standard', 1)`,
    [ids.tier, ids.property],
  );
  await database.pool.query(
    `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'DLX', 'Deluxe', 2, 1, 3)`,
    [ids.roomType, ids.property, ids.tier],
  );
  await database.pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number) VALUES ($1, $2, $3, 'D-101')`,
    [ids.room, ids.property, ids.roomType],
  );
  await database.pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children,
        currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot, hold_expires_at)
     VALUES ($1, $2, $3, $4, $5, 'HOLD', '2027-02-10T04:00:00.000Z', '2027-02-10T07:00:00.000Z', 1, 0,
       'VND', 300000, 0, 300000, '{"ratePlanCode":"TEST"}'::jsonb, '2027-02-01T00:00:00.000Z')`,
    [bookingId, ids.property, ids.roomType, ids.room, bookingCode],
  );
  await database.pool.query(
    `INSERT INTO booking_contacts (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
     VALUES ($1, 'Guest', 'guest@example.test', '+84909000001', $2)`,
    [bookingId, randomBytes(32)],
  );
  await database.pool.query(
    `INSERT INTO coupons
       (id, property_id, normalized_code, discount_type, fixed_amount_vnd, minimum_order_amount_vnd,
        valid_from, valid_until, applies_to_all_room_types)
     VALUES ($1, $2, 'WELCOME10', 'FIXED', 10000, 0, '2026-01-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z', true),
            ($3, $2, 'STAY20', 'FIXED', 20000, 0, '2026-01-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z', true)`,
    [randomUUID(), ids.property, randomUUID()],
  );
  return { bookingCode };
}

describe('coupon delivery repository', () => {
  let database: GuardedTestDatabase;
  let pool: DatabasePool;
  let bookingCode: string;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    ({ bookingCode } = await seed(database));
    pool = createDatabasePool(database.databaseUrl, {
      max: 4,
      applicationName: 'coupon-delivery-test',
    });
  });

  afterAll(async () => {
    await pool?.end();
    await database?.dispose();
  });

  it('writes one outbox and safe audit event without mutating coupon lifecycle state', async () => {
    const repository = new CouponDeliveryRepository(pool);
    const command = {
      actorId: '8d0e8400-e29b-41d4-a716-446655440199',
      bookingCode,
      couponCodes: ['WELCOME10', 'STAY20'],
      idempotencyKey: 'coupon-delivery-request-0001',
    };

    const first = await repository.queue(command);
    const repeated = await repository.queue(command);

    expect(repeated).toEqual(first);
    const delivery = await database.pool.query<{ coupon_codes: string[]; status: string }>(
      `SELECT coupon_codes, status FROM coupon_delivery_requests`,
    );
    expect(delivery.rows).toEqual([{ coupon_codes: ['WELCOME10', 'STAY20'], status: 'PENDING' }]);
    const events = await database.pool.query<{ event_type: string; payload: unknown }>(
      `SELECT event_type, payload FROM outbox_events ORDER BY created_at`,
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]?.event_type).toBe('coupon.delivery.requested');
    expect(JSON.stringify(events.rows[0]?.payload)).not.toContain('guest@example.test');
    const audit = await database.pool.query<{ payload: unknown }>(
      `SELECT payload FROM audit_events WHERE event_type = 'COUPON_DELIVERY_QUEUED'`,
    );
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows[0]?.payload)).toBe('{"couponCount":2}');
    const coupons = await database.pool.query<{ status: string }>(
      `SELECT status FROM coupons ORDER BY normalized_code`,
    );
    expect(coupons.rows).toEqual([{ status: 'ACTIVE' }, { status: 'ACTIVE' }]);
  });

  it('rejects unavailable coupon codes without creating a delivery request', async () => {
    const repository = new CouponDeliveryRepository(pool);
    await expect(
      repository.queue({
        actorId: '8d0e8400-e29b-41d4-a716-446655440199',
        bookingCode,
        couponCodes: ['UNKNOWN10'],
        idempotencyKey: 'coupon-delivery-request-0002',
      }),
    ).rejects.toEqual(new CouponDeliveryError('COUPON_DELIVERY_COUPON_UNAVAILABLE'));
    const result = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM coupon_delivery_requests`,
    );
    expect(result.rows[0]?.count).toBe('1');
  });
});
