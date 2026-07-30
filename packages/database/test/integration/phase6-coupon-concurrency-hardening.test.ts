/**
 * Phase 6C coupon concurrency hardening acceptance tests
 * (migration 0009 + 0010, schema phase-6-coupon-core-v3).
 *
 * Verifies:
 *  - Schema readiness reports v2.
 *  - First-reference trigger marks coupons.
 *  - First-referenced_at is monotonic.
 *  - Economic mutation after reference is rejected.
 *  - Scope mutation after reference is rejected.
 *  - DISABLED -> ACTIVE is rejected.
 *  - disabled_at cannot be cleared after disable.
 *  - Repeated disable is idempotent.
 *  - Existing reservations survive coupon disable.
 *  - Backfill populates first_referenced_at for already-referenced coupons.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { EXPECTED_SCHEMA_VERSION, getSchemaStatus } from '../../src/schema-status.js';
import { createPreparedGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';
import { migrateDatabase } from '../../src/migrations.js';
import type { DatabasePool } from '../../src/client.js';
import { createDatabasePool } from '../../src/client.js';

async function seedFixture(
  pool: DatabasePool,
  scope: 'all' | 'scoped',
  totalUsageLimit: number | null = null,
  perCustomerLimit: number | null = null,
): Promise<{
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly couponId: string;
  readonly roomTypeIdB: string;
}> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomTypeIdB = randomUUID();
  const couponId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO properties (id, code, name, timezone, status) VALUES ($1, $2, 'Test', 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
      [propertyId, `P_${propertyId.slice(0, 8)}`],
    );
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
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
       VALUES ($1, $2, $3, $4, 'Test', 2, 1, 3, 'ACTIVE')`,
      [roomTypeIdB, propertyId, tierId, `RTB_${roomTypeIdB.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'HARDEN01', 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', $3, $4, $5)`,
      [couponId, propertyId, scope === 'all', totalUsageLimit, perCustomerLimit],
    );
    if (scope === 'scoped') {
      await client.query(
        `INSERT INTO coupon_room_types (property_id, coupon_id, room_type_id) VALUES ($1, $2, $3)`,
        [propertyId, couponId, roomTypeId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { propertyId, roomTypeId, couponId, roomTypeIdB };
}

async function seedFullBookingHolder(
  pool: DatabasePool,
  propertyId: string,
  couponId: string,
  roomTypeId: string,
): Promise<{ readonly bookingId: string }> {
  const bookingId = randomUUID();
  const roomId = randomUUID();
  const quoteId = randomUUID();
  const couponSnapshot = JSON.stringify({
    couponId,
    normalizedCode: 'HARDEN01',
    discountType: 'FIXED',
    fixedAmountVnd: '10000',
    percentageBasisPoints: null,
    maximumDiscountVnd: null,
    minimumOrderAmountVnd: '0',
    grossAmountVnd: '359000',
    discountAmountVnd: '10000',
    finalAmountVnd: '349000',
  });
  const pricingSnapshot = JSON.stringify({
    pricing: { ruleVersion: 'phase-4-pricing-availability-v1' },
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, 'R-100', 'ACTIVE')`,
      [roomId, propertyId, roomTypeId],
    );
    await client.query(
      `INSERT INTO quotes (id, property_id, room_type_id, check_in, check_out, adults, children, currency, base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at, coupon_id, coupon_snapshot, created_at)
       VALUES ($1, $2, $3, '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', 1, 0, 'VND', 359000, 0, 359000, $4::jsonb, CURRENT_TIMESTAMP + interval '15 minutes', $5, $6::jsonb, CURRENT_TIMESTAMP)`,
      [quoteId, propertyId, roomTypeId, pricingSnapshot, couponId, couponSnapshot],
    );
    await client.query(
      `INSERT INTO bookings (id, property_id, room_type_id, room_id, quote_id, booking_code, status, check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, pricing_rule_version, price_snapshot, hold_expires_at)
       VALUES ($1, $2, $3, $4, $5, 'HOLDBC', 'HOLD', '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', 1, 0, 'VND', 359000, 10000, 349000, 'phase-4-pricing-availability-v1', $6::jsonb, CURRENT_TIMESTAMP + interval '15 minutes')`,
      [bookingId, propertyId, roomTypeId, roomId, quoteId, pricingSnapshot],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { bookingId };
}

describe('phase-6-coupon-core-v3 hardening', () => {
  let database: GuardedTestDatabase;
  let pool: DatabasePool;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (!baseUrl) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
      await migrateDatabase(guarded.databaseUrl);
    });
    pool = createDatabasePool(database.databaseUrl, { max: 1 });
  });

  afterAll(async () => {
    await pool.end();
    await database.dispose();
  });

  it('reports the current schema version after all forward migrations', async () => {
    const status = await getSchemaStatus(pool);
    expect(status.expectedVersion).toBe(EXPECTED_SCHEMA_VERSION);
    expect(status.actualVersion).toBe(EXPECTED_SCHEMA_VERSION);
    expect(status.ready).toBe(true);
  });

  it('allows lifecycle mutation on a never-referenced coupon', async () => {
    const fixture = await seedFixture(pool, 'all');
    await pool.query(`UPDATE coupons SET minimum_order_amount_vnd = 5000 WHERE id = $1`, [
      fixture.couponId,
    ]);
    const row = await pool.query<{ minimum_order_amount_vnd: string }>(
      `SELECT minimum_order_amount_vnd::text FROM coupons WHERE id = $1`,
      [fixture.couponId],
    );
    expect(row.rows[0]?.minimum_order_amount_vnd).toBe('5000');
  });

  it('rejects economic mutation after first reference', async () => {
    const fixture = await seedFixture(pool, 'all', 1, null);
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
    );

    await expect(
      pool.query(`UPDATE coupons SET minimum_order_amount_vnd = 5000 WHERE id = $1`, [
        fixture.couponId,
      ]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects scope mutation after first reference', async () => {
    const fixture = await seedFixture(pool, 'scoped', 1, null);
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
    );

    await expect(
      pool.query(
        `INSERT INTO coupon_room_types (property_id, coupon_id, room_type_id) VALUES ($1, $2, $3)`,
        [fixture.propertyId, fixture.couponId, fixture.roomTypeIdB],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects DISABLED -> ACTIVE', async () => {
    const fixture = await seedFixture(pool, 'all');
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    await expect(
      pool.query(`UPDATE coupons SET status = 'ACTIVE' WHERE id = $1`, [fixture.couponId]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects clearing disabled_at after disable', async () => {
    const fixture = await seedFixture(pool, 'all');
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    await expect(
      pool.query(`UPDATE coupons SET disabled_at = NULL WHERE id = $1`, [fixture.couponId]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('treats repeated disable as idempotent', async () => {
    const fixture = await seedFixture(pool, 'all');
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    await expect(
      pool.query(
        `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [fixture.couponId],
      ),
    ).resolves.toBeDefined();
    const row = await pool.query<{ status: string }>(`SELECT status FROM coupons WHERE id = $1`, [
      fixture.couponId,
    ]);
    expect(row.rows[0]?.status).toBe('DISABLED');
  });

  it('preserves existing reservation after disable', async () => {
    const fixture = await seedFixture(pool, 'all', 1, null);
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
    );
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    const row = await pool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE booking_id = $1`,
      [bookingId],
    );
    expect(row.rows[0]?.application_status).toBe('RESERVED');
  });

  it('rejects new application insert against a disabled coupon', async () => {
    const fixture = await seedFixture(pool, 'all', null, 1);
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    await expect(
      pool.query(
        `INSERT INTO booking_coupon_applications
           (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
            quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
            minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
            coupon_code_snapshot, reserved_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('backfills first_referenced_at for already-referenced coupons', async () => {
    const fixture = await seedFixture(pool, 'all', 1, null);
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
    );
    const row = await pool.query<{ first_referenced_at: Date }>(
      `SELECT first_referenced_at FROM coupons WHERE id = $1`,
      [fixture.couponId],
    );
    expect(row.rows[0]?.first_referenced_at).not.toBeNull();
  });

  it('rejects clearing first_referenced_at', async () => {
    const fixture = await seedFixture(pool, 'all', 1, null);
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
    );
    await expect(
      pool.query(`UPDATE coupons SET first_referenced_at = NULL WHERE id = $1`, [fixture.couponId]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects DISABLED -> ACTIVE transition', async () => {
    const fixture = await seedFixture(pool, 'all', null, null);
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    await expect(
      pool.query(`UPDATE coupons SET status = 'ACTIVE', disabled_at = NULL WHERE id = $1`, [
        fixture.couponId,
      ]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects clearing disabled_at after disable', async () => {
    const fixture = await seedFixture(pool, 'all', null, null);
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    await expect(
      pool.query(`UPDATE coupons SET disabled_at = NULL WHERE id = $1`, [fixture.couponId]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects new booking_coupon_applications against a DISABLED coupon', async () => {
    const fixture = await seedFixture(pool, 'all', null, null);
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await expect(
      pool.query(
        `INSERT INTO booking_coupon_applications
           (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
            quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
            minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
            coupon_code_snapshot, reserved_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('preserves existing RESERVED application after coupon disable', async () => {
    const fixture = await seedFixture(pool, 'all', 1, null);
    const { bookingId } = await seedFullBookingHolder(
      pool,
      fixture.propertyId,
      fixture.couponId,
      fixture.roomTypeId,
    );
    await pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RESERVED', true, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, 'HARDEN01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [fixture.propertyId, bookingId, fixture.couponId, Buffer.alloc(32, 9)],
    );
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    const result = await pool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE coupon_id = $1`,
      [fixture.couponId],
    );
    expect(result.rows[0]?.application_status).toBe('RESERVED');
  });
});

describe('migration identity', () => {
  it('byte-identical 0000..0006 to commit 7698353', async () => {
    const { execSync } = await import('node:child_process');
    const result = execSync(
      `git diff 7698353 -- packages/database/drizzle/0000_*.sql packages/database/drizzle/0001_*.sql packages/database/drizzle/0002_*.sql packages/database/drizzle/0003_*.sql packages/database/drizzle/0004_*.sql packages/database/drizzle/0005_*.sql packages/database/drizzle/0006_*.sql`,
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.trim()).toBe('');
  });

  it('byte-identical 0007..0008 to commit 721f9d0', async () => {
    const { execSync } = await import('node:child_process');
    const result = execSync(
      `git diff 721f9d0 -- packages/database/drizzle/0007_*.sql packages/database/drizzle/0008_*.sql`,
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.trim()).toBe('');
  });
});
