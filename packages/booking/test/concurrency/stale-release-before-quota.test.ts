import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabasePool, migrateDatabase, type DatabasePool } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { createBookingHoldWithRetry } from '../../src/services/create-booking-hold.js';
import { normalizeContact, type NormalizedContact } from '../../src/contact.js';
import { redeemCouponApplication } from '../../src/repository/coupon-reservation.js';
import { createDatabaseClient } from '@room/database';
import { requiredRow } from './concurrency-fixtures.js';

const DIGEST_SECRET = Buffer.from('task6c-test-secret-32-bytes-long');
const HOLD_DURATION_MS = 15 * 60 * 1000;
const COUPON_CODE = 'STALE-REL';

function normalizedContact(
  label: string,
  overrides: {
    readonly email?: string;
    readonly phone?: string;
    readonly fullName?: string;
  } = {},
): NormalizedContact {
  return normalizeContact(
    {
      fullName: overrides.fullName ?? `Stale Release ${label}`,
      email: overrides.email ?? `${label}@test.invalid`,
      phone: overrides.phone ?? '+84901234567',
    },
    DIGEST_SECRET,
  );
}

const PRICING_SNAPSHOT = {
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
} as const;

function buildCouponSnapshot(couponId: string) {
  return {
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
}

interface SeededFixture {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly roomIdB: string | null;
  readonly extraRoomIds: readonly string[];
  readonly couponId: string;
  readonly couponIdB: string | null;
  readonly freshQuoteId: string;
  readonly freshQuoteIdB: string | null;
  readonly freshRoomId: string;
  readonly extraQuoteIds: readonly string[];
}

async function seedFixture(
  pool: DatabasePool,
  options: {
    readonly totalUsageLimit: number | null;
    readonly perCustomerLimit?: number | null;
    readonly roomCount?: 1 | 2 | 4;
    readonly couponCount?: 1 | 2;
    readonly extraFreshQuotes?: number;
  },
): Promise<SeededFixture> {
  const roomCount = options.roomCount ?? 1;
  const couponCount = options.couponCount ?? 1;
  const extraFreshQuotes = options.extraFreshQuotes ?? 0;
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const roomIdB = roomCount >= 2 ? randomUUID() : null;
  const extraRoomIds: string[] = [];
  for (let i = 0; i < roomCount - 2; i += 1) extraRoomIds.push(randomUUID());
  const planId = randomUUID();
  const priceId = randomUUID();
  const couponId = randomUUID();
  const couponIdB = couponCount === 2 ? randomUUID() : null;
  const freshQuoteId = randomUUID();
  const freshQuoteIdB = couponCount === 2 ? randomUUID() : null;
  const freshRoomId = randomUUID();
  const extraQuoteIds: string[] = [];
  for (let i = 0; i < extraFreshQuotes; i += 1) {
    extraQuoteIds.push(randomUUID());
  }

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
    const roomNumbers: string[] = ['S-100'];
    if (roomCount >= 2) roomNumbers.push('S-101');
    for (let i = 2; i < roomCount; i += 1) roomNumbers.push(`S-10${i}`);
    await client.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [roomId, propertyId, roomTypeId, roomNumbers[0] ?? 'S-100'],
    );
    if (roomIdB !== null) {
      await client.query(
        `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [roomIdB, propertyId, roomTypeId, roomNumbers[1] ?? 'S-101'],
      );
    }
    for (let i = 0; i < extraRoomIds.length; i += 1) {
      const rid = extraRoomIds[i];
      if (rid === undefined) continue;
      await client.query(
        `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [rid, propertyId, roomTypeId, roomNumbers[i + 2] ?? `S-10${i + 2}`],
      );
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
    const insertCoupon = async (couponIdLocal: string, code: string): Promise<void> => {
      await client.query(
        `INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
         VALUES ($1, $2, $3, 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', true, $4, $5)`,
        [
          couponIdLocal,
          propertyId,
          code,
          options.totalUsageLimit,
          options.perCustomerLimit ?? null,
        ],
      );
    };
    await insertCoupon(couponId, COUPON_CODE);
    if (couponIdB !== null) {
      await insertCoupon(couponIdB, `${COUPON_CODE}-B`);
    }
    const insertQuote = async (qid: string, couponIdLocal: string): Promise<void> => {
      await client.query(
        `INSERT INTO quotes
         (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
          base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at,
          coupon_id, coupon_snapshot, created_at)
         VALUES ($1, $2, $3, '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', 1, 0, 'VND',
                 359000, 0, 359000, $4::jsonb, CURRENT_TIMESTAMP + interval '15 minutes',
                 $5, $6::jsonb, CURRENT_TIMESTAMP)`,
        [
          qid,
          propertyId,
          roomTypeId,
          JSON.stringify(PRICING_SNAPSHOT),
          couponIdLocal,
          JSON.stringify(buildCouponSnapshot(couponIdLocal)),
        ],
      );
    };
    await insertQuote(freshQuoteId, couponId);
    if (freshQuoteIdB !== null && couponIdB !== null) {
      await insertQuote(freshQuoteIdB, couponIdB);
    }
    for (const qid of extraQuoteIds) {
      await insertQuote(qid, couponId);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return {
    propertyId,
    roomTypeId,
    roomId,
    roomIdB,
    extraRoomIds,
    couponId,
    couponIdB,
    freshQuoteId,
    freshQuoteIdB,
    freshRoomId,
    extraQuoteIds,
  };
}

async function seedStaleHoldsForQuota(
  pool: DatabasePool,
  scenario: {
    readonly propertyId: string;
    readonly roomTypeId: string;
    readonly roomId: string;
    readonly roomIdB?: string | null;
    readonly extraRoomIds?: readonly string[];
    readonly couponId: string;
  },
  staleBookingCount: number,
  applicationStatus: 'ASSOCIATED' | 'RESERVED' = 'ASSOCIATED',
): Promise<readonly string[]> {
  const staleBookingIds: string[] = [];
  const roomIds: string[] = [scenario.roomId];
  if (scenario.roomIdB !== undefined && scenario.roomIdB !== null) roomIds.push(scenario.roomIdB);
  if (scenario.extraRoomIds) {
    for (const rid of scenario.extraRoomIds) roomIds.push(rid);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < staleBookingCount; i += 1) {
      const bookingId = randomUUID();
      const quoteId = randomUUID();
      staleBookingIds.push(bookingId);
      const assignedRoomId = roomIds[i % roomIds.length];
      if (assignedRoomId === undefined) throw new Error('No rooms available for stale hold');
      // Stagger start times so multiple stale holds on the same room do
      // not collide with `room_inventory_blocks_active_overlap_excl`. Each
      // slot moves forward by 15 minutes; an existing 3-hour interval
      // therefore never overlaps with the next 3-hour slot.
      const slotMinutes = i * 15;
      const checkIn = new Date(Date.parse('2027-01-10T04:00:00Z') + slotMinutes * 60_000);
      const checkOut = new Date(checkIn.getTime() + 3 * 60 * 60 * 1000);
      await client.query(
        `INSERT INTO quotes
         (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
          base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at,
          coupon_id, coupon_snapshot, created_at)
         VALUES ($1, $2, $3, $4, $5, 1, 0, 'VND',
                 359000, 0, 359000, $6::jsonb, CURRENT_TIMESTAMP + interval '15 minutes',
                 $7, $8::jsonb, CURRENT_TIMESTAMP)`,
        [
          quoteId,
          scenario.propertyId,
          scenario.roomTypeId,
          checkIn.toISOString(),
          checkOut.toISOString(),
          JSON.stringify(PRICING_SNAPSHOT),
          scenario.couponId,
          JSON.stringify(buildCouponSnapshot(scenario.couponId)),
        ],
      );
      await client.query(
        `INSERT INTO bookings
         (id, property_id, room_type_id, room_id, quote_id, booking_code, status,
          check_in, check_out, adults, children, currency,
          gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          pricing_rule_version, price_snapshot, hold_expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'HOLD',
                 $7, $8, 1, 0, 'VND',
                 359000, 10000, 349000,
                 'phase-4-pricing-availability-v1', $9::jsonb,
                 CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP - interval '5 minutes')`,
        [
          bookingId,
          scenario.propertyId,
          scenario.roomTypeId,
          assignedRoomId,
          quoteId,
          `STALE-${i}`,
          checkIn.toISOString(),
          checkOut.toISOString(),
          JSON.stringify(PRICING_SNAPSHOT),
        ],
      );
      await client.query(
        `INSERT INTO room_inventory_blocks
         (property_id, room_id, booking_id, block_type, starts_at, ends_at, status)
         VALUES ($1, $2, $3, 'BOOKING', $4, $5, 'ACTIVE')`,
        [
          scenario.propertyId,
          assignedRoomId,
          bookingId,
          checkIn.toISOString(),
          checkOut.toISOString(),
        ],
      );
      const isReserved = applicationStatus === 'RESERVED';
      const reservedAtSql = isReserved ? 'CURRENT_TIMESTAMP' : 'NULL::timestamptz';
      await client.query(
        `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest, application_status,
          quota_reserved, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'FIXED', 10000, NULL, NULL, 0, 359000, 10000, 349000, $7, ${reservedAtSql}, CURRENT_TIMESTAMP)`,
        [
          scenario.propertyId,
          bookingId,
          scenario.couponId,
          Buffer.alloc(32, 9),
          applicationStatus,
          isReserved,
          COUPON_CODE,
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
  return staleBookingIds;
}

describe('phase 6C stale-release before quota counting', () => {
  let database: GuardedTestDatabase;
  let adminPool: DatabasePool;
  let servicePool: DatabasePool;
  let observerPool: DatabasePool;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (!baseUrl) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
      await migrateDatabase(guarded.databaseUrl);
    });
    adminPool = createDatabasePool(database.databaseUrl, {
      max: 4,
      applicationName: 'stale-admin',
    });
    servicePool = createDatabasePool(database.databaseUrl, {
      max: 4,
      applicationName: 'stale-svc',
    });
    observerPool = createDatabasePool(database.databaseUrl, {
      max: 2,
      applicationName: 'stale-obs',
    });
  });

  afterAll(async () => {
    await observerPool.end();
    await servicePool.end();
    await adminPool.end();
    await database.dispose();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1. Limited quota=1 stale RESERVED application is released and replaced
  //    by one new RESERVED application.
  // ─────────────────────────────────────────────────────────────────────
  it('case 1: quota=1 stale RESERVED released and replaced by new RESERVED', async () => {
    const scenario = await seedFixture(adminPool, { totalUsageLimit: 1, roomCount: 1 });
    const stale = await seedStaleHoldsForQuota(adminPool, scenario, 1, 'RESERVED');
    const staleBookingId = stale[0];
    if (staleBookingId === undefined) throw new Error('Expected seeded stale booking id');

    const result = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case1'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case1-stale-replace',
    });
    expect(result.bookingId).toBeDefined();

    const reservationCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('ASSOCIATED','RESERVED','REDEEMED')`,
      [scenario.couponId],
    );
    expect(requiredRow(reservationCount, 'reservation count').count).toBe(1);

    const staleBooking = await adminPool.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [staleBookingId],
    );
    expect(requiredRow(staleBooking, 'stale booking').status).toBe('EXPIRED');

    const staleApplication = await adminPool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE booking_id = $1`,
      [staleBookingId],
    );
    expect(requiredRow(staleApplication, 'stale application').application_status).toBe('RELEASED');

    const releaseAudit = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM audit_events
        WHERE aggregate_type = 'BOOKING_COUPON_APPLICATION'
          AND event_type = 'COUPON_RELEASED'
          AND aggregate_id = $1`,
      [staleBookingId],
    );
    expect(requiredRow(releaseAudit, 'release audit count').count).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2. RELEASED application on a limited coupon does not count — proven
  //    through actual new HOLD success for a fresh contact, not by count.
  // ─────────────────────────────────────────────────────────────────────
  it('case 2: RELEASED application does not count — proven by actual new HOLD success', async () => {
    const scenario = await seedFixture(adminPool, {
      totalUsageLimit: 1,
      roomCount: 2,
      extraFreshQuotes: 1,
    });
    const first = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case2-first'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case2-first',
    });
    // Force the first application to RELEASED.
    await adminPool.query(
      `UPDATE bookings SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [first.bookingId],
    );
    await adminPool.query(
      `UPDATE booking_coupon_applications
          SET application_status = 'RELEASED', quota_reserved = false, released_at = CURRENT_TIMESTAMP
        WHERE booking_id = $1`,
      [first.bookingId],
    );

    const secondQuoteId = scenario.extraQuoteIds[0];
    if (secondQuoteId === undefined) throw new Error('Expected a second fresh quote');
    const second = await createBookingHoldWithRetry(servicePool, {
      quoteId: secondQuoteId,
      contact: normalizedContact('case2-second'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case2-second',
    });
    expect(second.bookingId).toBeDefined();
    expect(second.bookingId).not.toBe(first.bookingId);

    const newApplication = await adminPool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE booking_id = $1`,
      [second.bookingId],
    );
    expect(requiredRow(newApplication, 'new application').application_status).toBe('RESERVED');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 3. REDEEMED application on a limited coupon does count — second actual
  //    HOLD returns COUPON_LIMIT_REACHED.
  // ─────────────────────────────────────────────────────────────────────
  it('case 3: REDEEMED application counts — second HOLD returns COUPON_LIMIT_REACHED', async () => {
    const scenario = await seedFixture(adminPool, {
      totalUsageLimit: 1,
      roomCount: 2,
      extraFreshQuotes: 1,
    });
    const first = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case3-first'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case3-first',
    });
    // Mark the first application REDEEMED via the real production
    // redemption primitive (idempotent, transactionally-safe).
    const redemptionKey = `evt-${first.bookingId.slice(0, 8)}`;
    const dbClient = createDatabaseClient(servicePool);
    const redemptionResult = await dbClient.transaction(async (tx) =>
      redeemCouponApplication(tx, {
        bookingId: first.bookingId,
        verifiedPaymentEventKey: redemptionKey,
      }),
    );
    expect(redemptionResult.status).toBe('redeemed');
    expect(redemptionResult.alreadyRedeemed).toBe(false);

    const secondQuoteId = scenario.extraQuoteIds[0];
    if (secondQuoteId === undefined) throw new Error('Expected a second fresh quote');
    let caught: unknown;
    try {
      await createBookingHoldWithRetry(servicePool, {
        quoteId: secondQuoteId,
        contact: normalizedContact('case3-second'),
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: 'case3-second',
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const errorCode = (caught as { code?: string }).code;
    expect(errorCode).toBe('COUPON_LIMIT_REACHED');

    // No orphan rows: exactly the original REDEEMED application remains;
    // the second HOLD must not have committed any booking/contact/block/
    // application/audit/outbox for its quote.
    const reservationCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('RESERVED','REDEEMED')`,
      [scenario.couponId],
    );
    expect(requiredRow(reservationCount, 'quota count').count).toBe(1);

    const secondBooking = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM bookings WHERE quote_id = $1`,
      [secondQuoteId],
    );
    expect(requiredRow(secondBooking, 'no booking for second quote').count).toBe(0);

    const secondOutbox = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM outbox_events
        WHERE event_type = 'booking.hold.created' AND aggregate_id::text IN (SELECT id::text FROM bookings WHERE quote_id = $1)`,
      [secondQuoteId],
    );
    expect(requiredRow(secondOutbox, 'no outbox for second quote').count).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 4. Locked relevant stale HOLD: Pool A locks a single stale booking
  //    row, Pool B creates HOLD. Cleanup's SKIP LOCKED leaves the locked
  //    row undeleted, exhausting the safety bound and forcing
  //    STALE_HOLD_CLEANUP_RETRY — NOT COUPON_LIMIT_REACHED. After
  //    releasing the lock, a control HOLD must succeed.
  // ─────────────────────────────────────────────────────────────────────
  it('case 4: locked stale HOLD forces STALE_HOLD_CLEANUP_RETRY (not COUPON_LIMIT_REACHED); control HOLD succeeds after release', async () => {
    // One relevant stale RESERVED application on a fresh quote's room
    // and interval. Limit quota=1 so the new HOLD would otherwise be a
    // candidate for COUPON_LIMIT_REACHED; we must observe the cleaner
    // path instead.
    const scenario = await seedFixture(adminPool, {
      totalUsageLimit: 1,
      roomCount: 2,
    });
    const stale = await seedStaleHoldsForQuota(adminPool, scenario, 1, 'RESERVED');
    const staleBookingId = stale[0];
    if (staleBookingId === undefined) throw new Error('Expected seeded stale booking id');

    // Pool A locks the stale booking row. Cleanup runs with SKIP LOCKED,
    // so this row is undeleted and the safety bound (batchSize=50 *
    // maxBatches=4 = 200) is exhausted.
    const locker = await observerPool.connect();
    let lockedCaught: unknown;
    try {
      await locker.query('BEGIN');
      await locker.query(`SELECT id FROM bookings WHERE id = $1 FOR UPDATE`, [staleBookingId]);

      try {
        await createBookingHoldWithRetry(servicePool, {
          quoteId: scenario.freshQuoteId,
          contact: normalizedContact('case4-locked'),
          holdDurationMs: HOLD_DURATION_MS,
          correlationId: 'case4-locked',
        });
      } catch (error) {
        lockedCaught = error;
      }
    } finally {
      try {
        await locker.query('ROLLBACK');
      } catch {
        // ignore
      }
      locker.release();
    }

    // Exact code: STALE_HOLD_CLEANUP_RETRY — not COUPON_LIMIT_REACHED.
    expect(lockedCaught).toBeDefined();
    const lockedErrorCode = (lockedCaught as { code?: string }).code;
    expect(lockedErrorCode).toBe('STALE_HOLD_CLEANUP_RETRY');
    expect(lockedErrorCode).not.toBe('COUPON_LIMIT_REACHED');

    // Zero partial writes across every observable booking surface for
    // the fresh probe quote. The stale application pre-exists (seeded)
    // and must remain untouched.
    const zeroWrites = await adminPool.query<{
      bookings: string;
      contacts: string;
      blocks: string;
      applications: string;
      audits: string;
      outbox: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM bookings WHERE quote_id = $1) AS bookings,
         (SELECT COUNT(*)::text FROM booking_contacts bc JOIN bookings b ON b.id = bc.booking_id WHERE b.quote_id = $1) AS contacts,
         (SELECT COUNT(*)::text FROM room_inventory_blocks rib JOIN bookings b ON b.id = rib.booking_id WHERE b.quote_id = $1) AS blocks,
         (SELECT COUNT(*)::text FROM booking_coupon_applications bca JOIN bookings b ON b.id = bca.booking_id WHERE b.quote_id = $1) AS applications,
         (SELECT COUNT(*)::text FROM audit_events WHERE aggregate_type = 'BOOKING' AND aggregate_id::text IN (SELECT id::text FROM bookings WHERE quote_id = $1)) AS audits,
         (SELECT COUNT(*)::text FROM outbox_events WHERE event_type = 'booking.hold.created' AND aggregate_id::text IN (SELECT id::text FROM bookings WHERE quote_id = $1)) AS outbox`,
      [scenario.freshQuoteId],
    );
    const zw = requiredRow(zeroWrites, 'zero writes for case4 locked probe');
    expect(zw.bookings).toBe('0');
    expect(zw.contacts).toBe('0');
    expect(zw.blocks).toBe('0');
    expect(zw.applications).toBe('0');
    expect(zw.audits).toBe('0');
    expect(zw.outbox).toBe('0');

    // Release the lock and run a control proving the same fresh quote
    // can complete normally now that the locked stale row is gone.
    const control = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case4-control'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case4-control',
    });
    expect(control.bookingId).toBeDefined();
    expect(control.idempotent).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 5. Two concurrent new HOLDs after one stale quota holder: exactly one
  //    new reservation commits for quota=1.
  // ─────────────────────────────────────────────────────────────────────
  it('case 5: two concurrent new HOLDs after one stale quota holder — exactly one commits (quota=1)', async () => {
    const scenario = await seedFixture(adminPool, { totalUsageLimit: 1, roomCount: 2 });
    const stale = await seedStaleHoldsForQuota(adminPool, scenario, 1, 'RESERVED');
    if (stale[0] === undefined) throw new Error('Expected seeded stale booking id');

    // Use two distinct fresh quotes bound to the same coupon by reusing the
    // fixture's freshQuoteId via two rooms — actually we only have one
    // freshQuoteId. To simulate two concurrent HOLDs we duplicate the
    // seed by inserting a second fresh quote row.
    const secondQuoteId = randomUUID();
    const admin = await adminPool.connect();
    try {
      await admin.query('BEGIN');
      await admin.query(
        `INSERT INTO quotes
         (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
          base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at,
          coupon_id, coupon_snapshot, created_at)
         VALUES ($1, $2, $3, '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', 1, 0, 'VND',
                 359000, 0, 359000, $4::jsonb, CURRENT_TIMESTAMP + interval '15 minutes',
                 $5, $6::jsonb, CURRENT_TIMESTAMP)`,
        [
          secondQuoteId,
          scenario.propertyId,
          scenario.roomTypeId,
          JSON.stringify(PRICING_SNAPSHOT),
          scenario.couponId,
          JSON.stringify(buildCouponSnapshot(scenario.couponId)),
        ],
      );
      await admin.query('COMMIT');
    } finally {
      admin.release();
    }

    // Pre-clean the stale holder so the loser observes the quota gate
    // instead of racing the cleanup transaction. The cleanup is the
    // *test surface* we already locked in case 4 — here we want the
    // pure quota race after cleanup isolation.
    const cleanupClient = await servicePool.connect();
    try {
      await cleanupClient.query('BEGIN');
      const cleanupResult = await cleanupClient.query<{ id: string }>(
        `SELECT id FROM bookings WHERE status = 'HOLD' AND hold_expires_at <= CURRENT_TIMESTAMP FOR UPDATE OF bookings SKIP LOCKED`,
      );
      const removableIds = cleanupResult.rows.map((row) => row.id);
      if (removableIds.length > 0) {
        await cleanupClient.query(
          `UPDATE bookings SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])`,
          [removableIds],
        );
        await cleanupClient.query(
          `UPDATE room_inventory_blocks SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE booking_id = ANY($1::uuid[])`,
          [removableIds],
        );
        await cleanupClient.query(
          `UPDATE booking_coupon_applications
              SET application_status = 'RELEASED', quota_reserved = false, released_at = CURRENT_TIMESTAMP
            WHERE booking_id = ANY($1::uuid[]) AND application_status IN ('RESERVED','ASSOCIATED')`,
          [removableIds],
        );
      }
      await cleanupClient.query('COMMIT');
    } finally {
      cleanupClient.release();
    }

    const settledResults = await Promise.allSettled([
      createBookingHoldWithRetry(servicePool, {
        quoteId: scenario.freshQuoteId,
        contact: normalizedContact('case5-a'),
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: 'case5-a',
      }),
      createBookingHoldWithRetry(servicePool, {
        quoteId: secondQuoteId,
        contact: normalizedContact('case5-b'),
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: 'case5-b',
      }),
    ]);

    const successes = settledResults.filter((r) => r.status === 'fulfilled');
    const failures = settledResults.filter((r) => r.status === 'rejected');
    // Exactly one of the two must succeed; the other must fail with the
    // exact quota-exhausted domain code. 40P01 (deadlock) and retry
    // exhaustion are fatal for this case.
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    for (const failure of failures) {
      if (failure.status !== 'rejected') continue;
      const error = failure.reason as unknown;
      const code = (error as { code?: string }).code;
      const message = (error as { message?: string }).message ?? '';
      if (code === '40P01' || /40P01/.test(message)) {
        throw new Error(`deadlock detected in concurrent quota race: ${message}`);
      }
      if (/retry/i.test(message) && /exhaust/i.test(message)) {
        throw new Error(`retry exhaustion in concurrent quota race: ${message}`);
      }
      expect(code).toBe('COUPON_LIMIT_REACHED');
    }

    const reservedCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status = 'RESERVED'`,
      [scenario.couponId],
    );
    expect(requiredRow(reservedCount, 'reserved count').count).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 6. Failure after stale cleanup: stale booking/block/application/audit
  //    changes all roll back.
  // ─────────────────────────────────────────────────────────────────────
  it('case 6: stale release rolls back when subsequent insert fails', async () => {
    const scenario = await seedFixture(adminPool, { totalUsageLimit: null, roomCount: 1 });
    const stale = await seedStaleHoldsForQuota(adminPool, scenario, 1, 'ASSOCIATED');
    const staleBookingId = stale[0];
    if (staleBookingId === undefined) throw new Error('Expected seeded stale booking id');

    // Disable the coupon so the new application's INSERT fails.
    await adminPool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [scenario.couponId],
    );

    let caught: unknown;
    try {
      await createBookingHoldWithRetry(servicePool, {
        quoteId: scenario.freshQuoteId,
        contact: normalizedContact('case6'),
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: 'case6-rollback',
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();

    const booking = await adminPool.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [staleBookingId],
    );
    expect(requiredRow(booking, 'stale booking rollback').status).toBe('HOLD');

    const application = await adminPool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE booking_id = $1`,
      [staleBookingId],
    );
    expect(requiredRow(application, 'stale application rollback').application_status).toBe(
      'ASSOCIATED',
    );

    const block = await adminPool.query<{ status: string }>(
      `SELECT status FROM room_inventory_blocks WHERE booking_id = $1`,
      [staleBookingId],
    );
    expect(requiredRow(block, 'stale block rollback').status).toBe('ACTIVE');

    const releaseAudit = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM audit_events
        WHERE aggregate_type = 'BOOKING_COUPON_APPLICATION'
          AND event_type = 'COUPON_RELEASED'
          AND aggregate_id = $1`,
      [staleBookingId],
    );
    expect(requiredRow(releaseAudit, 'no release audit').count).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 7. Same quote, equivalent contact: second call returns the existing
  //    booking (no new application). Equivalent contact is the same person,
  //    just slightly different input — same email/phone after normalisation.
  // ─────────────────────────────────────────────────────────────────────
  it('case 7: same quote, equivalent contact — no second coupon application', async () => {
    const scenario = await seedFixture(adminPool, { totalUsageLimit: 1, roomCount: 1 });
    const first = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case7'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case7-first',
    });

    // Equivalent contact: same email/phone, name has different whitespace
    // and case but normalizes to the same value.
    const equivalent = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case7', {
        fullName: '  Stale   Release   case7 ',
      }),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case7-equivalent',
    });
    expect(equivalent.bookingId).toBe(first.bookingId);
    expect(equivalent.idempotent).toBe(true);

    const reservationCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('RESERVED','REDEEMED')`,
      [scenario.couponId],
    );
    expect(requiredRow(reservationCount, 'one reservation only').count).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 8. Same quote, different contact: QUOTE_ALREADY_USED and no second
  //    reservation.
  // ─────────────────────────────────────────────────────────────────────
  it('case 8: same quote, different contact — QUOTE_ALREADY_USED, no second reservation', async () => {
    const scenario = await seedFixture(adminPool, { totalUsageLimit: 1, roomCount: 1 });
    await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case8-first'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case8-first',
    });

    let caught: unknown;
    try {
      await createBookingHoldWithRetry(servicePool, {
        quoteId: scenario.freshQuoteId,
        contact: normalizedContact('case8-second', {
          email: 'different@test.invalid',
        }),
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: 'case8-second',
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const errorCode = (caught as { code?: string }).code;
    expect(errorCode).toBe('QUOTE_ALREADY_USED');

    const reservationCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('RESERVED','REDEEMED')`,
      [scenario.couponId],
    );
    expect(requiredRow(reservationCount, 'no second reservation').count).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 9. Per-customer stale release: keyed email digest quota becomes
  //    reusable once the stale application is RELEASED.
  // ─────────────────────────────────────────────────────────────────────
  it('case 9: per-customer quota released when stale application rolls to RELEASED', async () => {
    const scenario = await seedFixture(adminPool, {
      totalUsageLimit: null,
      perCustomerLimit: 1,
      roomCount: 2,
      extraFreshQuotes: 1,
    });
    const customer = normalizedContact('case9-customer');
    const first = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: customer,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case9-first',
    });

    // Force the first application to RELEASED (simulating stale cleanup).
    await adminPool.query(
      `UPDATE bookings SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [first.bookingId],
    );
    await adminPool.query(
      `UPDATE booking_coupon_applications
          SET application_status = 'RELEASED', quota_reserved = false, released_at = CURRENT_TIMESTAMP
        WHERE booking_id = $1`,
      [first.bookingId],
    );

    const secondQuoteId = scenario.extraQuoteIds[0];
    if (secondQuoteId === undefined) throw new Error('Expected a second fresh quote');

    // Same customer should be able to use the coupon again.
    const second = await createBookingHoldWithRetry(servicePool, {
      quoteId: secondQuoteId,
      contact: customer,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case9-second',
    });
    expect(second.bookingId).toBeDefined();
    expect(second.bookingId).not.toBe(first.bookingId);

    const application = await adminPool.query<{ application_status: string }>(
      `SELECT application_status FROM booking_coupon_applications WHERE booking_id = $1`,
      [second.bookingId],
    );
    expect(requiredRow(application, 'per-customer reused').application_status).toBe('RESERVED');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 10. Same normalised contact, equivalent normalised form: the
  //    booking service keys identity on the post-normalisation contact,
  //    a second call returns the existing booking (idempotent). Note:
  //    IP never enters the booking service contract; renaming reflects
  //    the actual contract under test.
  // ─────────────────────────────────────────────────────────────────────
  it('case 10: same normalized contact remains idempotent (no IP transport key)', async () => {
    const scenario = await seedFixture(adminPool, { totalUsageLimit: 1, roomCount: 1 });
    const customer = normalizedContact('case10');
    const first = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: customer,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case10-first',
    });

    // The same contact (normalised) must yield the same booking. The
    // booking service keys identity on the normalised contact, not on
    // network metadata: even if a caller were to attach a different IP,
    // it would not enter the booking service's identity key.
    const second = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: customer,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case10-second',
    });
    expect(second.bookingId).toBe(first.bookingId);
    expect(second.idempotent).toBe(true);

    // Only one application, one reservation.
    const reservationCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('RESERVED','REDEEMED')`,
      [scenario.couponId],
    );
    expect(requiredRow(reservationCount, 'one reservation across same contact').count).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 11. Different coupons do not block each other unnecessarily.
  // ─────────────────────────────────────────────────────────────────────
  it('case 11: different coupons on the same property do not block each other', async () => {
    const scenario = await seedFixture(adminPool, {
      totalUsageLimit: 1,
      roomCount: 2,
      couponCount: 2,
    });
    if (scenario.freshQuoteIdB === null || scenario.couponIdB === null) {
      throw new Error('Expected second coupon/quote for case 11');
    }

    const first = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteId,
      contact: normalizedContact('case11-a'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case11-a',
    });
    const second = await createBookingHoldWithRetry(servicePool, {
      quoteId: scenario.freshQuoteIdB,
      contact: normalizedContact('case11-b'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: 'case11-b',
    });
    expect(first.bookingId).toBeDefined();
    expect(second.bookingId).toBeDefined();
    expect(second.bookingId).not.toBe(first.bookingId);

    const firstCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('RESERVED','REDEEMED')`,
      [scenario.couponId],
    );
    expect(requiredRow(firstCount, 'coupon A reservation').count).toBe(1);

    const secondCount = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications
        WHERE coupon_id = $1 AND application_status IN ('RESERVED','REDEEMED')`,
      [scenario.couponIdB],
    );
    expect(requiredRow(secondCount, 'coupon B reservation').count).toBe(1);
  });
});
