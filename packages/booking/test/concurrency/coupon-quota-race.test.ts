import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createDatabasePool,
  migrateDatabase,
  type DatabasePool,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import type { ConcurrencyFixture } from './concurrency-fixtures.js';
import {
  bookingInput,
  bookingState,
  createConcurrencyFixture,
  createSqlBarrier,
  normalizedContact,
  requiredValue,
  runCaller,
} from './concurrency-fixtures.js';
import { normalizeContact, type NormalizedContact } from '../../src/contact.js';
import { createBookingHoldWithRetry } from '../../src/services/create-booking-hold.js';

const couponLockQuery = (statement: string) =>
  /FROM\s+"coupons".*FOR UPDATE/is.test(statement);

const COUPON_CODE = 'QUOTA-RACE';
const HOLD_DURATION_MS = 15 * 60 * 1000;
const DIGEST_SECRET = Buffer.from('task6-test-secret-32-bytes-long');

const SNAPSHOT_OBJECT = (couponId: string, code: string) => ({
  pricing: { ruleVersion: 'phase-4-pricing-availability-v1', totalAmountVnd: 359_000 },
  coupon: { id: couponId, code },
});

interface CouponScenario {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly quoteIds: readonly string[];
  readonly couponId: string;
  readonly couponCode: string;
}

async function seedCouponScenario(
  pool: DatabasePool,
  totalUsageLimit: number | null,
  perCustomerLimit: number | null,
  quoteCount: 1 | 2,
  roomCount: 1 | 2 = 1,
): Promise<CouponScenario> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomIds: string[] = [randomUUID()];
  if (roomCount === 2) roomIds.push(randomUUID());
  const roomId = requiredValue(roomIds, 0, 'primary room');
  const planId = randomUUID();
  const priceId = randomUUID();
  const couponId = randomUUID();
  const quoteIds: string[] = [];
  for (let i = 0; i < quoteCount; i += 1) quoteIds.push(randomUUID());
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
    let roomNumber = 100;
    for (const rid of roomIds) {
      await client.query(
        `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [rid, propertyId, roomTypeId, `T-${roomNumber}`],
      );
      roomNumber += 1;
    }
    await client.query(
      `INSERT INTO rate_plans (id, property_id, code, name, status, included_duration_minutes, priority,
                                is_base_plan, min_check_in_minute_inclusive, max_check_in_minute_exclusive,
                                min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES ($1, $2, $3, 'Test', 'ACTIVE', 180, 1, true, NULL, NULL, 60, 240)`,
      [planId, propertyId, 'THREE_HOUR_COMBO'],
    );
    await client.query(
      `INSERT INTO rate_plan_prices (id, property_id, rate_plan_id, price_tier_id, amount_vnd) VALUES ($1, $2, $3, $4, 359000)`,
      [priceId, propertyId, planId, tierId],
    );
    await client.query(
      `INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, $3, 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', true, $4, $5)`,
      [couponId, propertyId, COUPON_CODE, totalUsageLimit, perCustomerLimit],
    );
    const couponSnapshot = {
      couponId,
      normalizedCode: COUPON_CODE,
      discountType: 'FIXED',
      fixedAmountVnd: '10000',
      percentageBasisPoints: null,
      maximumDiscountVnd: null,
      minimumOrderAmountVnd: '0',
      grossAmountVnd: '359000',
      discountAmountVnd: '10000',
      finalAmountVnd: '349000',
    };
    const pricingSnapshot = {
      pricing: {
        ruleVersion: 'phase-4-pricing-availability-v1',
        selectedPlanCode: 'THREE_HOUR_COMBO',
        basePlanCode: 'THREE_HOUR_COMBO',
        baseMinutes: 180,
        extraUnits: 0,
        baseAmountVnd: 359000,
        extraAmountVnd: 0,
        totalAmountVnd: 359000,
        lineItems: [{ code: 'THREE_HOUR_COMBO', amountVnd: 359000, units: 1 }],
      },
    };
    for (const quoteId of quoteIds) {
      await client.query(
        `INSERT INTO quotes
         (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
          base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at,
          coupon_id, coupon_snapshot, created_at)
         VALUES ($1, $2, $3, '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', 1, 0, 'VND',
                 359000, 0, 359000, $4::jsonb, CURRENT_TIMESTAMP + interval '15 minutes',
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
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { propertyId, roomTypeId, roomId, quoteIds, couponId, couponCode: COUPON_CODE };
}

describe('coupon quota race', () => {
  let fixture: ConcurrencyFixture;
  let barrier: ReturnType<typeof createSqlBarrier>;
  let firstStatements: string[];
  let secondStatements: string[];

  beforeAll(async () => {
    barrier = createSqlBarrier(2);
    firstStatements = [];
    secondStatements = [];
    fixture = await createConcurrencyFixture({
      statements: [firstStatements, secondStatements],
      barriers: [
        { matches: couponLockQuery, value: barrier },
        { matches: couponLockQuery, value: barrier },
      ],
    });
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('serializes a quota=1 race so only one booking commits', async () => {
    const scenario = await seedCouponScenario(fixture.adminPool, 1, null, 2, 2);
    const contact = normalizedContact('quota-one');
    const first = runCaller(
      fixture.callers[0],
      bookingInput(requiredValue(scenario.quoteIds, 0, 'first coupon quote'), contact),
    );
    const second = runCaller(
      fixture.callers[1],
      bookingInput(requiredValue(scenario.quoteIds, 1, 'second coupon quote'), contact),
    );
    await barrier.reached;
    barrier.release();

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected.length === 1) {
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
        code: 'COUPON_LIMIT_REACHED',
      });
    }

    // Sanity: ensure both callers reached the coupon-lock statement so
    // the barrier actually exercised the serialization point.
    expect(
      firstStatements.some((s) => /from\s+"coupons"/i.test(s) && /for\s+update/i.test(s)),
    ).toBe(true);
    expect(
      secondStatements.some((s) => /from\s+"coupons"/i.test(s) && /for\s+update/i.test(s)),
    ).toBe(true);

    const reservationCount = await fixture.adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('ASSOCIATED','RESERVED','REDEEMED')`,
      [scenario.couponId],
    );
    expect(reservationCount.rows[0]?.count).toBe(1);

    const state = await bookingState(fixture.adminPool, scenario.propertyId);
    expect(state.bookings).toBe(1);
    expect(state.contacts).toBe(1);
    expect(state.blocks).toBe(1);
    expect(state.audits).toBe(1);
    expect(state.outbox).toBe(1);

    const auditCount = await fixture.adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM audit_events
        WHERE aggregate_type = 'BOOKING_COUPON_APPLICATION' AND event_type = 'COUPON_RESERVED'`,
    );
    expect(auditCount.rows[0]?.count).toBe(1);

    const losserHasNothing = await fixture.adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM audit_events ae
         JOIN quotes q ON q.id::text = ae.payload->>'quoteId'
        WHERE q.id = ANY($1::uuid[]) AND event_type = 'COUPON_LIMIT_REJECTED'`,
      [scenario.quoteIds],
    );
    expect(losserHasNothing.rows[0]?.count).toBe(0);
  });
});

describe('per-customer coupon limit', () => {
  let database: GuardedTestDatabase;
  let adminPool: DatabasePool;
  let contact: NormalizedContact;
  let altContact: NormalizedContact;
  let couponId: string;
  let propertyId: string;
  let quote1Id: string;
  let quote2Id: string;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (!baseUrl) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) =>
      migrateDatabase(guarded.databaseUrl),
    );
    adminPool = createDatabasePool(database.databaseUrl, { max: 1 });
    contact = normalizeContact(
      { fullName: 'Same Customer', email: 'same-customer@test.invalid', phone: '+84901234567' },
      DIGEST_SECRET,
    );
    altContact = normalizeContact(
      { fullName: 'Other Customer', email: 'other-customer@test.invalid', phone: '+84901234568' },
      DIGEST_SECRET,
    );
    const scenario = await seedCouponScenario(adminPool, null, 1, 2, 2);
    couponId = scenario.couponId;
    propertyId = scenario.propertyId;
    quote1Id = requiredValue(scenario.quoteIds, 0, 'first per-cust quote');
    quote2Id = requiredValue(scenario.quoteIds, 1, 'second per-cust quote');
  });

  afterAll(async () => {
    await adminPool.end();
    await database.dispose();
  });

  it('rejects a second booking by the same email digest when perCustomerLimit=1', async () => {
    const first = await createBookingHoldWithRetry(adminPool, {
      quoteId: quote1Id,
      contact,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });
    expect(first.status).toBe('HOLD');

    await expect(
      createBookingHoldWithRetry(adminPool, {
        quoteId: quote2Id,
        contact,
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'COUPON_CUSTOMER_LIMIT_REACHED' });

    // A different email digest can still use the same coupon.
    const other = await createBookingHoldWithRetry(adminPool, {
      quoteId: quote2Id,
      contact: altContact,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });
    expect(other.status).toBe('HOLD');

    const applications = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications WHERE coupon_id = $1`,
      [couponId],
    );
    expect(applications.rows[0]?.count).toBe(2);

    const reservationCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM booking_coupon_applications
        WHERE coupon_id = $1
          AND application_status = 'RESERVED'
          AND customer_email_digest = $2`,
      [couponId, contact.emailDigest],
    );
    expect(reservationCount.rows[0]?.count).toBe(1);

    const samePropertyBookings = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM bookings WHERE property_id = $1`,
      [propertyId],
    );
    expect(samePropertyBookings.rows[0]?.count).toBe(2);
  });
});
