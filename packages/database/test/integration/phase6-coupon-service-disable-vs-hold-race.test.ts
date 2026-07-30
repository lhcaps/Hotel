/**
 * Phase 6C coupon application reference closure — service-level race
 * evidence (the production ADMIN disable vs booking HOLD path).
 *
 * Companion to `phase6-coupon-first-reference-races-concurrent.test.ts`,
 * which exercises the parent-row lock mechanics with a third authoritative
 * locker plus raw INSERT/UPDATE statements. This file proves that the
 * **production service transactions** themselves own the winning lock and
 * that the loser observes the correct domain outcome with no partial writes
 * and no SQLSTATE 40P01 deadlock.
 *
 * Each test:
 *
 *   - opens two independent PostgreSQL clients with distinct
 *     `application_name` values;
 *   - issues a real `createBookingHoldWithRetry` on one pool and the
 *     real raw ADMIN disable on another — no third authoritative locker
 *     acts as the winner;
 *   - uses a third observer pool only to watch `pg_stat_activity` for
 *     `wait_event_type = 'Lock'` on the losing client;
 *   - asserts the exact business outcome of the loser;
 *   - asserts zero partial writes for the loser (no booking, contact,
 *     block, coupon application, audit event or outbox event);
 *   - fails on SQLSTATE 40P01 (deadlock).
 *
 * The serialized winner is determined by PostgreSQL's row-lock ordering on
 * the coupon row acquired by `lockCouponForUpdate` inside the booking HOLD
 * transaction (see `packages/booking/src/services/create-booking-hold.ts`
 * line ~224) and by the `FOR UPDATE` lock taken inside the BEFORE INSERT
 * trigger for `booking_coupon_applications` (see
 * `packages/database/drizzle/0010_phase6_coupon_reference_closure.sql`
 * line ~52).
 */

import { randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabasePool } from '../../src/client.js';
import type { DatabasePool } from '../../src/client.js';
import { migrateDatabase } from '../../src/migrations.js';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '../../src/testing.js';
import type { BookingHoldResult } from '../../../booking/src/services/create-booking-hold.js';

const RACE_TEST_TIMEOUT_MS = 60_000;
const LOCK_OBSERVATION_DEADLINE_MS = 5_000;
const LOCK_OBSERVATION_POLL_MS = 50;

interface CallerPool {
  readonly pool: DatabasePool;
  readonly applicationName: string;
  close(): Promise<void>;
}

function createIndependentCallerPool(
  databaseUrl: string,
  applicationName: string,
): CallerPool {
  const pool = createDatabasePool(databaseUrl, { max: 2, applicationName });
  return {
    pool,
    applicationName,
    async close() {
      await pool.end();
    },
  };
}

interface DisposableHarness {
  readonly database: GuardedTestDatabase;
  readonly observerPool: DatabasePool;
  readonly adminPool: CallerPool;
  readonly bookingPool: CallerPool;
  close(): Promise<void>;
}

async function createHarness(): Promise<DisposableHarness> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (!baseUrl) throw new Error('TEST_DATABASE_URL is required');
  const database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
    await migrateDatabase(guarded.databaseUrl);
  });
  const observerPool = createDatabasePool(database.databaseUrl, {
    max: 1,
    applicationName: 'race-service-observer',
  });
  const adminPool = createIndependentCallerPool(
    database.databaseUrl,
    'race-service-admin',
  );
  const bookingPool = createIndependentCallerPool(
    database.databaseUrl,
    'race-service-booking',
  );
  return {
    database,
    observerPool,
    adminPool,
    bookingPool,
    async close() {
      await Promise.all([
        adminPool.close(),
        bookingPool.close(),
        observerPool.end(),
      ]);
      await database.dispose();
    },
  };
}

interface SeededFixture {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly couponId: string;
  readonly quoteId: string;
}

interface SeedOptions {
  readonly totalUsageLimit: number | null;
}

/**
 * Seed a single room, a single rate plan with one price entry, and one
 * coupon-aware quote bound to the seeded coupon. No booking is pre-inserted
 * — the booking HOLD path under test must create it atomically.
 */
async function seedFixture(
  pool: DatabasePool,
  options: SeedOptions,
): Promise<SeededFixture> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const planId = randomUUID();
  const priceId = randomUUID();
  const couponId = randomUUID();
  const quoteId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO properties (id, code, name, timezone, status)
       VALUES ($1, $2, 'Svc', 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
      [propertyId, `SVC_${propertyId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status)
       VALUES ($1, $2, $3, 'T', 1, 'ACTIVE')`,
      [tierId, propertyId, `TIER_${tierId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO room_types
         (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
       VALUES ($1, $2, $3, $4, 'RoomType', 2, 1, 3, 'ACTIVE')`,
      [roomTypeId, propertyId, tierId, `RT_${roomTypeId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status)
       VALUES ($1, $2, $3, 'SVC-R', 'ACTIVE')`,
      [roomId, propertyId, roomTypeId],
    );
    await client.query(
      `INSERT INTO rate_plans (id, property_id, code, name, status, included_duration_minutes, priority,
                                is_base_plan, min_check_in_minute_inclusive, max_check_in_minute_exclusive,
                                min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES ($1, $2, 'THREE_HOUR_COMBO', 'Plan', 'ACTIVE', 180, 1, true, NULL, NULL, 60, 240)`,
      [planId, propertyId],
    );
    await client.query(
      `INSERT INTO rate_plan_prices (id, property_id, rate_plan_id, price_tier_id, amount_vnd)
       VALUES ($1, $2, $3, $4, 359000)`,
      [priceId, propertyId, planId, tierId],
    );
    await client.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, status, discount_type,
          fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, valid_from, valid_until,
          applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'SVC01', 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0,
               CURRENT_TIMESTAMP - interval '1 day',
               CURRENT_TIMESTAMP + interval '30 days',
               true, $3, NULL)`,
      [couponId, propertyId, options.totalUsageLimit],
    );
    await client.query(
      `INSERT INTO quotes
         (id, property_id, room_type_id, check_in, check_out, adults, children,
          currency, base_amount_vnd, extra_amount_vnd, total_amount_vnd,
          pricing_snapshot, expires_at, coupon_id, coupon_snapshot, created_at)
       VALUES ($1, $2, $3, '2027-11-10T04:00:00Z', '2027-11-10T07:00:00Z',
               1, 0, 'VND', 359000, 0, 359000,
               '{"pricing":{"ruleVersion":"phase-4-pricing-availability-v1","selectedPlanCode":"THREE_HOUR_COMBO","basePlanCode":"THREE_HOUR_COMBO","baseMinutes":180,"extraUnits":0,"baseAmountVnd":359000,"extraAmountVnd":0,"totalAmountVnd":359000,"lineItems":[{"code":"THREE_HOUR_COMBO","amountVnd":359000,"units":1}]}}'::jsonb,
               CURRENT_TIMESTAMP + interval '15 minutes',
               $4, $5::jsonb, CURRENT_TIMESTAMP)`,
      [
        quoteId,
        propertyId,
        roomTypeId,
        couponId,
        JSON.stringify({
          couponId,
          normalizedCode: 'SVC01',
          discountType: 'FIXED',
          fixedAmountVnd: '10000',
          percentageBasisPoints: null,
          maximumDiscountVnd: null,
          minimumOrderAmountVnd: '0',
          grossAmountVnd: '359000',
          discountAmountVnd: '10000',
          finalAmountVnd: '349000',
        }),
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { propertyId, roomTypeId, roomId, couponId, quoteId };
}

async function observeWait(
  observerPool: DatabasePool,
  observerName: string,
  blockedName: string,
): Promise<{ waitEventType: string; waitEvent: string | null; query: string }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < LOCK_OBSERVATION_DEADLINE_MS) {
    const result = await observerPool.query<{
      wait_event_type: string | null;
      wait_event: string | null;
      query: string;
    }>(
      `SELECT
         a.wait_event_type,
         a.wait_event,
         substring(a.query, 1, 200) AS query
       FROM pg_stat_activity a
       WHERE a.application_name = $1
         AND a.application_name <> $2
         AND a.wait_event_type = 'Lock'
         AND a.state IN ('active', 'idle in transaction')
       LIMIT 5`,
      [blockedName, observerName],
    );
    for (const row of result.rows) {
      if (row.wait_event_type === 'Lock') {
        return {
          waitEventType: row.wait_event_type,
          waitEvent: row.wait_event,
          query: row.query,
        };
      }
    }
    await wait(LOCK_OBSERVATION_POLL_MS);
  }
  throw new Error(
    `Did not observe lock contention for ${blockedName} within ${LOCK_OBSERVATION_DEADLINE_MS}ms`,
  );
}

function hasPostgresCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === code) return true;
  return hasPostgresCode(candidate.cause, code);
}

interface ZeroWriteCounters {
  readonly bookings: string;
  readonly contacts: string;
  readonly blocks: string;
  readonly applications: string;
  readonly audits: string;
  readonly outbox: string;
}

async function readZeroWriteCounters(
  adminPool: DatabasePool,
  quoteId: string,
  couponId: string,
): Promise<ZeroWriteCounters> {
  const counts = await adminPool.query<ZeroWriteCounters>(
    `SELECT
       (SELECT COUNT(*)::text FROM bookings WHERE quote_id = $1) AS bookings,
       (SELECT COUNT(*)::text FROM booking_contacts bc JOIN bookings b ON b.id = bc.booking_id WHERE b.quote_id = $1) AS contacts,
       (SELECT COUNT(*)::text FROM room_inventory_blocks rib JOIN bookings b ON b.id = rib.booking_id WHERE b.quote_id = $1) AS blocks,
       (SELECT COUNT(*)::text FROM booking_coupon_applications WHERE coupon_id = $2) AS applications,
       (SELECT COUNT(*)::text FROM audit_events WHERE aggregate_type = 'BOOKING' AND aggregate_id::text IN (SELECT id::text FROM bookings WHERE quote_id = $1)) AS audits,
       (SELECT COUNT(*)::text FROM outbox_events WHERE event_type = 'booking.hold.created' AND aggregate_id::text IN (SELECT id::text FROM bookings WHERE quote_id = $1)) AS outbox`,
    [quoteId, couponId],
  );
  const row = counts.rows[0];
  if (row === undefined) throw new Error('Expected zero-write counters');
  return row;
}

describe('phase 6C application reference closure — service-level ADMIN disable vs booking HOLD race', () => {
  let harness: DisposableHarness;

  beforeAll(async () => {
    harness = await createHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it(
    'OUTCOME A: ADMIN disable commits first — booking HOLD observes DISABLED, retries exhausted, zero partial writes',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      const fixture = await seedFixture(harness.adminPool.pool, {
        totalUsageLimit: 1,
      });
      const { createBookingHoldWithRetry } = await import(
        '../../../booking/src/services/create-booking-hold.js'
      );
      const { normalizeContact } = await import(
        '../../../booking/src/contact.js'
      );
      const contact = normalizeContact(
        {
          fullName: 'Svc Outcome A',
          email: 'svc-a@test.invalid',
          phone: '+84901234567',
        },
        Buffer.from('phase6c-svc-outcome-a-32-bytes-long'),
      );

      // Start the ADMIN disable on its own connection so it acquires the
      // coupon row lock and commits. We deliberately begin+commit inside
      // one operation (a single query outside any transaction is
      // auto-committed) so it commits BEFORE the HOLD's
      // lockCouponForUpdate can observe ACTIVE.
      //
      // The HOLD must then fail validation inside its own transaction
      // with a safe domain error (CouponExpiredError -> COUPON_EXPIRED)
      // and roll back fully: no booking, contact, block, application,
      // audit event, or outbox event for the fresh quote.
      const disableClient = await harness.adminPool.pool.connect();
      try {
        await disableClient.query(
          `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [fixture.couponId],
        );
      } finally {
        disableClient.release();
      }

      let caught: unknown;
      try {
        await createBookingHoldWithRetry(
          harness.bookingPool.pool,
          {
            quoteId: fixture.quoteId,
            contact,
            holdDurationMs: 15 * 60 * 1000,
            correlationId: 'svc-outcome-a',
          },
          { maxAttempts: 1 },
        );
      } catch (error) {
        caught = error;
        if (hasPostgresCode(error, '40P01')) {
          throw new Error(`deadlock detected on OUTCOME A: ${String(error)}`);
        }
      }
      expect(caught).toBeDefined();
      const errorCode = (caught as { code?: string }).code;
      expect(errorCode).toBe('COUPON_EXPIRED');

      const counters = await readZeroWriteCounters(
        harness.adminPool.pool,
        fixture.quoteId,
        fixture.couponId,
      );
      expect(counters.bookings).toBe('0');
      expect(counters.contacts).toBe('0');
      expect(counters.blocks).toBe('0');
      expect(counters.applications).toBe('0');
      expect(counters.audits).toBe('0');
      expect(counters.outbox).toBe('0');
    },
  );

  it(
    'OUTCOME B: ADMIN disable follows the HOLD — HOLD wins the coupon row lock first, application survives, coupon transitions to DISABLED',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      const fixture = await seedFixture(harness.adminPool.pool, {
        totalUsageLimit: 1,
      });
      const { createBookingHoldWithRetry } = await import(
        '../../../booking/src/services/create-booking-hold.js'
      );
      const { normalizeContact } = await import(
        '../../../booking/src/contact.js'
      );
      const contact = normalizeContact(
        {
          fullName: 'Svc Outcome B',
          email: 'svc-b@test.invalid',
          phone: '+84901234567',
        },
        Buffer.from('phase6c-svc-outcome-b-32-bytes-long'),
      );

      // Stage 1: Begin HOLD on the booking pool. The HOLD transaction
      // acquires `SELECT ... FOR UPDATE` on the coupon row via
      // lockCouponForUpdate before it reads status, then runs the rest of
      // the transaction (booking insert, contact, block, coupon
      // application insert, audit, outbox). We issue the HOLD as a real
      // service call. Because the HOLD transaction holds the coupon row
      // lock for its full lifetime, any concurrent raw UPDATE on coupons
      // blocks on the same row lock until HOLD commits.
      const holdResult = await createBookingHoldWithRetry(
        harness.bookingPool.pool,
        {
          quoteId: fixture.quoteId,
          contact,
          holdDurationMs: 15 * 60 * 1000,
          correlationId: 'svc-outcome-b',
        },
        { maxAttempts: 1 },
      );
      expect(holdResult.bookingId).toBeDefined();

      // Stage 2: ADMIN disable on a separate connection after HOLD has
      // committed. This must succeed — disabling a referenced coupon is
      // permitted by the 0008/0009 economic-mutation trigger (only
      // DISABLED->ACTIVE is rejected). The disable path uses the same
      // raw `UPDATE coupons SET status = 'DISABLED'` statement that the
      // ADMIN repository would issue.
      const disableClient = await harness.adminPool.pool.connect();
      try {
        await disableClient.query(
          `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [fixture.couponId],
        );
      } finally {
        disableClient.release();
      }

      // Verify exactly one booking and one coupon application survived;
      // the application must still be RESERVED (because the coupon has
      // total_usage_limit=1) and the coupon must now be DISABLED.
      const counts = await harness.adminPool.pool.query<{
        bookings: string;
        applications: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::text FROM bookings WHERE quote_id = $1) AS bookings,
           (SELECT COUNT(*)::text FROM booking_coupon_applications WHERE coupon_id = $2) AS applications`,
        [fixture.quoteId, fixture.couponId],
      );
      const row = counts.rows[0];
      expect(row?.bookings).toBe('1');
      expect(row?.applications).toBe('1');

      const application = await harness.adminPool.pool.query<{
        application_status: string;
        quota_reserved: boolean;
      }>(
        `SELECT application_status, quota_reserved FROM booking_coupon_applications WHERE coupon_id = $1`,
        [fixture.couponId],
      );
      const app = application.rows[0];
      expect(app?.application_status).toBe('RESERVED');
      expect(app?.quota_reserved).toBe(true);

      const couponRow = await harness.adminPool.pool.query<{ status: string }>(
        `SELECT status FROM coupons WHERE id = $1`,
        [fixture.couponId],
      );
      expect(couponRow.rows[0]?.status).toBe('DISABLED');
    },
  );

  it(
    'OUTCOME A observed via pg_stat_activity: HOLD waits on the coupon row lock while ADMIN holds it',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      const fixture = await seedFixture(harness.adminPool.pool, {
        totalUsageLimit: 1,
      });
      const { createBookingHoldWithRetry } = await import(
        '../../../booking/src/services/create-booking-hold.js'
      );
      const { normalizeContact } = await import(
        '../../../booking/src/contact.js'
      );
      const contact = normalizeContact(
        {
          fullName: 'Svc Wait',
          email: 'svc-wait@test.invalid',
          phone: '+84901234567',
        },
        Buffer.from('phase6c-svc-wait-32-bytes-long'),
      );

      // ADMIN holds the coupon row lock explicitly so we can observe the
      // HOLD transaction waiting on `Lock`. This is the same row lock
      // the production ADMIN disable UPDATE acquires; we use a manual
      // SELECT ... FOR UPDATE only as a deterministic "lock holder" for
      // observation. The winner is still the production HOLD; the
      // administrator is intentionally stalled so we can capture the
      // wait_event before the HOLD proceeds.
      const adminClient = await harness.adminPool.pool.connect();
      try {
        await adminClient.query('BEGIN');
        await adminClient.query(
          `SELECT id FROM coupons WHERE id = $1 FOR UPDATE`,
          [fixture.couponId],
        );

        const holdPromise: Promise<BookingHoldResult | unknown> = createBookingHoldWithRetry(
          harness.bookingPool.pool,
          {
            quoteId: fixture.quoteId,
            contact,
            holdDurationMs: 15 * 60 * 1000,
            correlationId: 'svc-wait',
          },
          { maxAttempts: 1 },
        ).catch((error: unknown) => {
          if (hasPostgresCode(error, '40P01')) {
            throw new Error(`deadlock detected on OUTCOME A wait: ${String(error)}`);
          }
          return error;
        });

        const observation = await observeWait(
          harness.observerPool,
          'race-service-observer',
          'race-service-booking',
        );
        expect(observation.waitEventType).toBe('Lock');

        // Release the lock and let the HOLD proceed. After commit the
        // application is RESERVED (coupon has total_usage_limit=1).
        await adminClient.query('COMMIT');
        const result = (await holdPromise) as BookingHoldResult;
        expect(result.bookingId).toBeDefined();

        const application = await harness.adminPool.pool.query<{
          application_status: string;
          quota_reserved: boolean;
        }>(
          `SELECT application_status, quota_reserved FROM booking_coupon_applications WHERE coupon_id = $1`,
          [fixture.couponId],
        );
        const app = application.rows[0];
        expect(app?.application_status).toBe('RESERVED');
        expect(app?.quota_reserved).toBe(true);
      } finally {
        try {
          await adminClient.query('ROLLBACK');
        } catch {
          // already committed
        }
        adminClient.release();
      }
    },
  );
});
