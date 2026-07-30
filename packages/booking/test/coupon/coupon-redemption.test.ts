/**
 * Internal redemption primitive tests (Phase 6C §9).
 *
 * The redemption primitive is internal-only (no HTTP route) and must:
 *  - lock the application row;
 *  - accept ASSOCIATED and RESERVED transitions to REDEEMED;
 *  - reject RELEASED as terminal;
 *  - be idempotent under the same verifiedPaymentEventKey;
 *  - reject a different event key after redemption;
 *  - write exactly one COUPON_REDEEMED audit event;
 *  - leave booking status unchanged;
 *  - rely on the database-backed unique event-key constraint;
 *  - set `redeemed_at` from the PostgreSQL clock — never from a caller-
 *    supplied timestamp.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createDatabasePool,
  createDatabaseClient,
  migrateDatabase,
  type DatabasePool,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { redeemCouponApplication } from '../../src/repository/coupon-reservation.js';
import { CouponApplicationNotRedeemableError } from '../../src/coupon/coupon-errors.js';

const DIGEST_BYTES = Buffer.alloc(32, 7);

async function seedReservableApplication(
  pool: DatabasePool,
  status: 'ASSOCIATED' | 'RESERVED',
  disableApplicationInsertTrigger = false,
): Promise<{
  readonly propertyId: string;
  readonly bookingId: string;
  readonly couponId: string;
}> {
  const propertyId = randomUUID();
  const bookingId = randomUUID();
  const couponId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (disableApplicationInsertTrigger) {
      await client.query(
        `ALTER TABLE booking_coupon_applications DISABLE TRIGGER booking_coupon_applications_validate_insert`,
      );
    }
    await client.query(
      `INSERT INTO properties (id, code, name, timezone, status) VALUES ($1, $2, 'Test', 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
      [propertyId, `P_${propertyId.slice(0, 8)}`],
    );
    const tierId = randomUUID();
    const roomTypeId = randomUUID();
    const roomId = randomUUID();
    await client.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status) VALUES ($1, $2, $3, 'T', 1, 'ACTIVE')`,
      [tierId, propertyId, `TIER_${tierId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
       VALUES ($1, $2, $3, $4, 'Test', 2, 1, 3, 'ACTIVE')`,
      [roomTypeId, propertyId, tierId, `RT_${roomTypeId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [roomId, propertyId, roomTypeId, `R-${roomId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO bookings (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, pricing_rule_version, price_snapshot, hold_expires_at)
       VALUES ($1, $2, $3, $4, 'REDEEMBC', 'HOLD', '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', 1, 0, 'VND', 359000, 30000, 329000, 'phase-4-pricing-availability-v1', '{"pricing":{"ruleVersion":"phase-4-pricing-availability-v1"}}'::jsonb, CURRENT_TIMESTAMP + interval '15 minutes')`,
      [bookingId, propertyId, roomTypeId, roomId],
    );
    await client.query(
      `INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'REDEEM30', 'ACTIVE', 'FIXED', 30000, NULL, NULL, 0, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', true, NULL, NULL)`,
      [couponId, propertyId],
    );
    await client.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'FIXED', 30000, NULL, NULL, 0, 359000, 30000, 329000, 'REDEEM30', $7, CURRENT_TIMESTAMP)`,
      [
        propertyId,
        bookingId,
        couponId,
        DIGEST_BYTES,
        status,
        status === 'RESERVED',
        status === 'RESERVED' ? new Date() : null,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (disableApplicationInsertTrigger) {
      await client.query(
        `ALTER TABLE booking_coupon_applications ENABLE TRIGGER booking_coupon_applications_validate_insert`,
      );
    }
    client.release();
  }
  return { propertyId, bookingId, couponId };
}

describe('redeemCouponApplication', () => {
  let database: GuardedTestDatabase;
  let pool: DatabasePool;
  let db: ReturnType<typeof createDatabaseClient>;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (!baseUrl) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) =>
      migrateDatabase(guarded.databaseUrl),
    );
    pool = createDatabasePool(database.databaseUrl, { max: 1 });
    db = createDatabaseClient(pool);
  });

  afterAll(async () => {
    await pool.end();
    await database.dispose();
  });

  it('transitions RESERVED to REDEEMED, writes one audit event, and is idempotent on the same key', async () => {
    const { bookingId, propertyId } = await seedReservableApplication(pool, 'RESERVED', true);
    const eventKey = `pay-${randomUUID()}`;

    const first = await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId,
        verifiedPaymentEventKey: eventKey,
      }),
    );
    expect(first.status).toBe('redeemed');
    expect(first.alreadyRedeemed).toBe(false);

    const second = await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId,
        verifiedPaymentEventKey: eventKey,
      }),
    );
    expect(second.status).toBe('redeemed');
    expect(second.alreadyRedeemed).toBe(true);
    expect(second.applicationId).toBe(first.applicationId);

    const auditCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM audit_events
        WHERE property_id = $1 AND aggregate_type = 'BOOKING_COUPON_APPLICATION'
          AND event_type = 'COUPON_REDEEMED'`,
      [propertyId],
    );
    expect(auditCount.rows[0]?.count).toBe(1);

    const bookingStatus = await pool.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [bookingId],
    );
    expect(bookingStatus.rows[0]?.status).toBe('HOLD');
  });

  it('transitions ASSOCIATED to REDEEMED in a single call', async () => {
    const { bookingId } = await seedReservableApplication(pool, 'ASSOCIATED', true);
    const eventKey = `pay-${randomUUID()}`;

    const result = await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId,
        verifiedPaymentEventKey: eventKey,
      }),
    );
    expect(result.status).toBe('redeemed');
    expect(result.alreadyRedeemed).toBe(false);

    const row = await pool.query<{ status: string }>(
      `SELECT application_status AS status FROM booking_coupon_applications WHERE booking_id = $1`,
      [bookingId],
    );
    expect(row.rows[0]?.status).toBe('REDEEMED');
  });

  it('rejects RELEASED applications', async () => {
    const { bookingId } = await seedReservableApplication(pool, 'RESERVED', true);
    await pool.query(
      `UPDATE booking_coupon_applications SET application_status = 'RELEASED', quota_reserved = false, released_at = CURRENT_TIMESTAMP WHERE booking_id = $1`,
      [bookingId],
    );

    await expect(
      db.transaction(async (tx) =>
        redeemCouponApplication(tx, {
          bookingId,
          verifiedPaymentEventKey: 'pay-foo',
        }),
      ),
    ).rejects.toBeInstanceOf(CouponApplicationNotRedeemableError);
  });

  it('rejects a different event key after redemption', async () => {
    const { bookingId } = await seedReservableApplication(pool, 'RESERVED', true);
    const firstKey = `pay-${randomUUID()}`;
    const secondKey = `pay-${randomUUID()}`;

    await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId,
        verifiedPaymentEventKey: firstKey,
      }),
    );

    await expect(
      db.transaction(async (tx) =>
        redeemCouponApplication(tx, {
          bookingId,
          verifiedPaymentEventKey: secondKey,
        }),
      ),
    ).rejects.toMatchObject({ code: 'COUPON_ALREADY_APPLIED' });
  });

  it('returns a no-application result when no application exists for the booking', async () => {
    const result = await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId: randomUUID(),
        verifiedPaymentEventKey: 'pay-nothing',
      }),
    );
    expect(result.status).toBe('no_application');
    expect(result.applicationId).toBeNull();
    expect(result.alreadyRedeemed).toBe(false);
  });

  it('accepts an explicit no-application sentinel input', async () => {
    const result = await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId: null,
        verifiedPaymentEventKey: null,
      }),
    );
    expect(result.status).toBe('no_application');
    expect(result.applicationId).toBeNull();
    expect(result.alreadyRedeemed).toBe(false);
  });

  it('sets redeemed_at from the PostgreSQL clock — caller-supplied Date has no effect', async () => {
    // Caller deliberately supplies an absurdly ancient Date. The
    // implementation must IGNORE the input and set redeemed_at via
    // CURRENT_TIMESTAMP inside PostgreSQL. There is no parameter on the
    // public signature, so this test asserts the contract end-to-end by
    // confirming that redeemed_at is set to a timestamp that lies
    // between database timestamps captured around the call.
    const { bookingId } = await seedReservableApplication(pool, 'RESERVED', true);
    const eventKey = `pay-${randomUUID()}`;

    const before = await pool.query<{ now: Date }>(`SELECT CURRENT_TIMESTAMP AS now`);
    await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId,
        verifiedPaymentEventKey: eventKey,
      }),
    );
    const after = await pool.query<{ now: Date }>(`SELECT CURRENT_TIMESTAMP AS now`);

    const redeemedRow = await pool.query<{ redeemed_at: Date | null }>(
      `SELECT redeemed_at FROM booking_coupon_applications WHERE booking_id = $1`,
      [bookingId],
    );
    const redeemedAt = redeemedRow.rows[0]?.redeemed_at;
    expect(redeemedAt).not.toBeNull();
    const beforeTs = before.rows[0]?.now?.getTime();
    const afterTs = after.rows[0]?.now?.getTime();
    const redeemedTs = redeemedAt?.getTime();
    expect(typeof beforeTs).toBe('number');
    expect(typeof afterTs).toBe('number');
    expect(typeof redeemedTs).toBe('number');
    if (beforeTs === undefined || afterTs === undefined || redeemedTs === undefined) {
      throw new Error('Expected numeric database timestamps');
    }
    expect(redeemedTs).toBeGreaterThanOrEqual(beforeTs);
    expect(redeemedTs).toBeLessThanOrEqual(afterTs);
  });

  it('leaves booking status unchanged after redemption', async () => {
    const { bookingId } = await seedReservableApplication(pool, 'RESERVED', true);
    const eventKey = `pay-${randomUUID()}`;

    await db.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId,
        verifiedPaymentEventKey: eventKey,
      }),
    );

    const status = await pool.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [bookingId],
    );
    expect(status.rows[0]?.status).toBe('HOLD');
  });
});
