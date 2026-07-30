import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { expireStaleHolds } from '../src/jobs/expire-stale-holds.js';
import {
  createExpirationFixture,
  type ExpirationFixture,
} from './fixtures/hold-expiration-fixtures.js';

interface QueryResultLike<T> {
  readonly rows: readonly T[];
}

function requireRow<T>(result: QueryResultLike<T>, label: string): T {
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Expected ${label}`);
  return row;
}

let fixture: ExpirationFixture | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

interface CouponHold {
  readonly bookingId: string;
  readonly couponId: string;
}

async function seedCouponHold(
  pool: {
    query: (
      sql: string,
      params: unknown[],
    ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
  },
  applicationStatus: 'ASSOCIATED' | 'RESERVED',
): Promise<CouponHold> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const bookingId = randomUUID();
  const couponId = randomUUID();
  const quoteId = randomUUID();
  const customerEmailDigest = Buffer.alloc(32, 7);

  await pool.query(
    `INSERT INTO properties (id, code, name, timezone, status) VALUES ($1, $2, 'Phase 6 test', 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
    [propertyId, `P6_${propertyId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status) VALUES ($1, $2, 'P6_TIER', 'P6', 1, 'ACTIVE')`,
    [tierId, propertyId],
  );
  await pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
     VALUES ($1, $2, $3, 'P6_RT', 'P6 room', 2, 0, 2, 'ACTIVE')`,
    [roomTypeId, propertyId, tierId],
  );
  await pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, 'P6-1', 'ACTIVE')`,
    [roomId, propertyId, roomTypeId],
  );
  await pool.query(
    `INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
     VALUES ($1, $2, $3, 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', true, $4, $5)`,
    [couponId, propertyId, `P6-${couponId.slice(0, 6).toUpperCase()}`, 10, 1],
  );
  const pricingSnapshot = {
    pricing: {
      ruleVersion: 'phase-4-pricing-availability-v1',
      totalAmountVnd: 359000,
    },
  };
  const couponSnapshot = {
    couponId,
    normalizedCode: `P6-${couponId.slice(0, 6).toUpperCase()}`,
    discountType: 'FIXED',
    fixedAmountVnd: '10000',
    percentageBasisPoints: null,
    maximumDiscountVnd: null,
    minimumOrderAmountVnd: '0',
    grossAmountVnd: '359000',
    discountAmountVnd: '10000',
    finalAmountVnd: '349000',
  };
  await pool.query(
    `INSERT INTO quotes
       (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
        base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at,
        coupon_id, coupon_snapshot, created_at)
     VALUES ($1, $2, $3, '2027-04-10T04:00:00Z', '2027-04-10T07:00:00Z', 1, 0, 'VND',
             359000, 0, 359000, $4::jsonb, CURRENT_TIMESTAMP + interval '1 hour',
             $5, $6::jsonb, CURRENT_TIMESTAMP)`,
    [
      quoteId,
      propertyId,
      roomTypeId,
      JSON.stringify(pricingSnapshot),
      couponId,
      JSON.stringify(couponSnapshot),
    ],
  );
  await pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, quote_id, booking_code, status,
        check_in, check_out, adults, children, currency,
        gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
        price_snapshot, hold_expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'HOLD',
             '2027-04-10T04:00:00Z', '2027-04-10T07:00:00Z', 1, 0, 'VND',
             359000, 10000, 349000,
             '{"source":"phase6-coupon"}'::jsonb,
             CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP - interval '2 days', CURRENT_TIMESTAMP - interval '2 days')`,
    [bookingId, propertyId, roomTypeId, roomId, quoteId, `P6-${bookingId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO room_inventory_blocks
       (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
     VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE',
             '2027-04-10T04:00:00Z', '2027-04-10T07:00:00Z')`,
    [propertyId, roomId, bookingId],
  );
  await pool.query(
    `INSERT INTO booking_coupon_applications
       (id, property_id, booking_id, coupon_id, customer_email_digest, application_status, quota_reserved,
        discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd,
        gross_amount_vnd, discount_amount_vnd, final_amount_vnd, coupon_code_snapshot,
        reserved_at, redeemed_at, released_at, redemption_event_key, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6,
             'FIXED', 10000, NULL, NULL, 0,
             359000, 10000, 349000, $7,
             $8, NULL, NULL, NULL, CURRENT_TIMESTAMP)`,
    [
      propertyId,
      bookingId,
      couponId,
      customerEmailDigest,
      applicationStatus,
      applicationStatus === 'RESERVED',
      `P6-${couponId.slice(0, 6).toUpperCase()}`,
      applicationStatus === 'RESERVED' ? new Date() : null,
    ],
  );
  return { bookingId, couponId };
}

describe('expire stale holds releases coupon applications', () => {
  it('releases a RESERVED coupon application to RELEASED when its HOLD expires', async () => {
    fixture = await createExpirationFixture();
    const { bookingId } = await seedCouponHold(fixture.pool, 'RESERVED');

    const result = await expireStaleHolds({ pool: fixture.pool, batchSize: 10, maxBatches: 1 });
    expect(result.processed).toBe(1);

    const booking = await fixture.pool.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [bookingId],
    );
    expect(booking.rows[0]?.status).toBe('EXPIRED');

    const block = await fixture.pool.query<{ status: string }>(
      `SELECT status FROM room_inventory_blocks WHERE booking_id = $1`,
      [bookingId],
    );
    expect(block.rows[0]?.status).toBe('RELEASED');

    const application = await fixture.pool.query<{
      application_status: string;
      quota_reserved: boolean;
      released_at: Date | null;
    }>(
      `SELECT application_status, quota_reserved, released_at
         FROM booking_coupon_applications
        WHERE booking_id = $1`,
      [bookingId],
    );
    const row = requireRow(application, 'expired application row');
    expect(row.application_status).toBe('RELEASED');
    expect(row.quota_reserved).toBe(false);
    expect(row.released_at).not.toBeNull();

    const audit = await fixture.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM audit_events
        WHERE aggregate_id = $1 AND event_type = 'COUPON_RELEASED'`,
      [bookingId],
    );
    expect(audit.rows[0]?.count).toBe(1);
  });

  it('is idempotent: a second run does not double-release', async () => {
    fixture = await createExpirationFixture();
    const { bookingId } = await seedCouponHold(fixture.pool, 'RESERVED');

    await expireStaleHolds({ pool: fixture.pool, batchSize: 10, maxBatches: 1 });
    await expireStaleHolds({ pool: fixture.pool, batchSize: 10, maxBatches: 1 });

    const application = await fixture.pool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE booking_id = $1`,
      [bookingId],
    );
    expect(requireRow(application, 'idempotent second-run row').application_status).toBe(
      'RELEASED',
    );

    const audit = await fixture.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM audit_events
        WHERE aggregate_id = $1 AND event_type = 'COUPON_RELEASED'`,
      [bookingId],
    );
    expect(audit.rows[0]?.count).toBe(1);
  });

  it('does not release a REDEEMED application', async () => {
    fixture = await createExpirationFixture();
    const { bookingId } = await seedCouponHold(fixture.pool, 'RESERVED');
    await fixture.pool.query(
      `UPDATE booking_coupon_applications
          SET application_status = 'REDEEMED', quota_reserved = true,
              redeemed_at = CURRENT_TIMESTAMP,
              redemption_event_key = 'test-event'
        WHERE booking_id = $1`,
      [bookingId],
    );

    await expireStaleHolds({ pool: fixture.pool, batchSize: 10, maxBatches: 1 });

    const application = await fixture.pool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE booking_id = $1`,
      [bookingId],
    );
    expect(requireRow(application, 'redeemed-untouched row').application_status).toBe('REDEEMED');
  });
});
