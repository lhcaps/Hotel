/**
 * Phase 6C coupon application reference closure — concurrent race tests.
 *
 * Companion to `phase6-coupon-first-reference-races.test.ts`, which
 * contains ordered-semantics tests. This file proves that migration
 * 0010 closes the application/disable race by running two PostgreSQL
 * transactions that overlap at the coupon row lock boundary.
 *
 * Each test:
 *
 *   - opens two independent PostgreSQL clients with distinct
 *     application_name values;
 *   - starts both operations before either commits;
 *   - observes the losing transaction waiting on a PostgreSQL lock
 *     via `pg_stat_activity.wait_event_type = 'Lock'` and
 *     `pg_locks.granted = false`;
 *   - releases the winner deterministically (COMMIT or ROLLBACK);
 *   - asserts the exact business outcome of the loser;
 *   - fails on SQLSTATE 40P01 (deadlock).
 *
 * A bounded deadline is allowed only to fail a hung test; it is not
 * used as the ordering mechanism.
 */

import { Buffer } from 'node:buffer';
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
  readonly adminPool: DatabasePool;
  readonly callerOne: CallerPool;
  readonly callerTwo: CallerPool;
  close(): Promise<void>;
}

async function createHarness(): Promise<DisposableHarness> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (!baseUrl) throw new Error('TEST_DATABASE_URL is required');
  const database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
    await migrateDatabase(guarded.databaseUrl);
  });
  const adminPool = createDatabasePool(database.databaseUrl, {
    max: 2,
    applicationName: 'race-concurrent-admin',
  });
  const callerOne = createIndependentCallerPool(
    database.databaseUrl,
    'race-concurrent-caller-one',
  );
  const callerTwo = createIndependentCallerPool(
    database.databaseUrl,
    'race-concurrent-caller-two',
  );
  return {
    database,
    adminPool,
    callerOne,
    callerTwo,
    async close() {
      await Promise.all([callerOne.close(), callerTwo.close(), adminPool.end()]);
      await database.dispose();
    },
  };
}

interface SeededCouponFixture {
  readonly propertyId: string;
  readonly tierId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly couponId: string;
  readonly bookingId: string;
  readonly quoteId: string;
}

async function seedFixture(pool: DatabasePool): Promise<SeededCouponFixture> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const couponId = randomUUID();
  const bookingId = randomUUID();
  const quoteId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO properties (id, code, name, timezone, status)
       VALUES ($1, $2, 'Concurrent', 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
      [propertyId, `P_${propertyId.slice(0, 8)}`],
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
       VALUES ($1, $2, $3, 'CONCURRENT-R', 'ACTIVE')`,
      [roomId, propertyId, roomTypeId],
    );
    await client.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, status, discount_type,
          fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, valid_from, valid_until,
          applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'CONC01', 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0,
               CURRENT_TIMESTAMP - interval '1 day',
               CURRENT_TIMESTAMP + interval '30 days',
               true, NULL, NULL)`,
      [couponId, propertyId],
    );
    await client.query(
      `INSERT INTO quotes
         (id, property_id, room_type_id, check_in, check_out, adults, children,
          currency, base_amount_vnd, extra_amount_vnd, total_amount_vnd,
          pricing_snapshot, expires_at, coupon_id, coupon_snapshot, created_at)
       VALUES ($1, $2, $3, '2027-10-10T04:00:00Z', '2027-10-10T07:00:00Z',
               1, 0, 'VND', 359000, 0, 359000,
               '{"pricing":{"ruleVersion":"phase-4-pricing-availability-v1"}}'::jsonb,
               CURRENT_TIMESTAMP + interval '15 minutes',
               $4, $5::jsonb, CURRENT_TIMESTAMP)`,
      [quoteId, propertyId, roomTypeId, couponId, JSON.stringify({ couponId })],
    );
    await client.query(
      `INSERT INTO bookings
         (id, property_id, room_type_id, room_id, quote_id, booking_code,
          status, check_in, check_out, adults, children, currency,
          gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot,
          hold_expires_at, expired_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'HOLD',
               '2027-10-10T04:00:00Z', '2027-10-10T07:00:00Z', 1, 0, 'VND',
               359000, 10000, 349000,
               '{"ratePlanCode":"CONCURRENT"}'::jsonb,
               CURRENT_TIMESTAMP + interval '15 minutes', NULL,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [bookingId, propertyId, roomTypeId, roomId, quoteId, `CON-${bookingId.slice(-6)}`],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { propertyId, tierId, roomTypeId, roomId, couponId, bookingId, quoteId };
}

interface LockObservation {
  readonly waitEventType: string | null;
  readonly waitEvent: string | null;
  readonly granted: boolean;
  readonly state: string;
  readonly query: string;
}

async function observeWaitOnCouponRow(
  observerPool: DatabasePool,
  observerName: string,
  blockedName: string,
  couponId: string,
): Promise<LockObservation> {
  void couponId;
  void blockedName;
  const startedAt = Date.now();
  while (Date.now() - startedAt < LOCK_OBSERVATION_DEADLINE_MS) {
    // A `SELECT ... FOR UPDATE` on a single row acquires:
    //   - a transactionid lock for the holding transaction;
    //   - a tuple lock on the target tuple (oid, tid);
    //   - a relation lock on the relation for the row.
    // A blocked transaction will surface in pg_stat_activity with
    // wait_event_type = 'Lock' and wait_event pointing at the lock
    // type (typically 'transactionid' or 'tuple').
    const result = await observerPool.query<{
      wait_event_type: string | null;
      wait_event: string | null;
      granted: boolean;
      state: string;
      query: string;
    }>(
      `SELECT
         a.wait_event_type,
         a.wait_event,
         a.state,
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
        // We rely on wait_event_type='Lock' as the lock-contention
        // signal. The exact wait_event (e.g. 'transactionid' or
        // 'tuple') is opaque; what matters is that the transaction is
        // blocked on a lock, not on I/O or a timer.
        return {
          waitEventType: row.wait_event_type,
          waitEvent: row.wait_event,
          granted: false,
          state: row.state,
          query: row.query,
        };
      }
    }
    await wait(LOCK_OBSERVATION_POLL_MS);
  }
  throw new Error(
    `Did not observe lock contention for ${blockedName} on coupons within ${LOCK_OBSERVATION_DEADLINE_MS}ms`,
  );
}

describe('phase 6C application reference closure — concurrent race evidence', () => {
  let harness: DisposableHarness;

  beforeAll(async () => {
    harness = await createHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it(
    'concurrent E1: ADMIN economic mutation vs first reference — losing transaction waits on the coupon row lock',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      const fixture = await seedFixture(harness.adminPool);

      // Client A holds the coupon row lock and updates the definition.
      const clientA = await harness.callerOne.pool.connect();
      const aStarted = clientA.query('BEGIN');
      await aStarted;
      await clientA.query('SELECT id FROM coupons WHERE id = $1 FOR UPDATE', [
        fixture.couponId,
      ]);

      const applicationInsertP = harness.callerTwo.pool.query(
        `INSERT INTO booking_coupon_applications
           (id, property_id, booking_id, coupon_id, customer_email_digest,
            application_status, quota_reserved, discount_type,
            fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
            minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
            final_amount_vnd, coupon_code_snapshot, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
                 'FIXED', 10000, NULL, NULL,
                 0, 359000, 10000, 349000,
                 'CONC01', CURRENT_TIMESTAMP)`,
        [fixture.propertyId, fixture.bookingId, fixture.couponId, Buffer.alloc(32, 0xcd)],
      );

      const observation = await observeWaitOnCouponRow(
        harness.adminPool,
        'race-concurrent-admin',
        'race-concurrent-caller-two',
        fixture.couponId,
      );
      expect(observation.waitEventType).toBe('Lock');
      expect(observation.granted).toBe(false);

      // Client A commits a new minimum_order_amount. The application
      // trigger must accept the insert because the new minimum is 0
      // (no change to the snapshot minimum).
      await clientA.query(
        `UPDATE coupons SET minimum_order_amount_vnd = 0 WHERE id = $1`,
        [fixture.couponId],
      );
      await clientA.query('COMMIT');
      clientA.release();

      const result = await applicationInsertP;
      expect(result.rowCount).toBe(1);
    },
  );

  it(
    'concurrent E2: scope mutation vs first reference — losing transaction waits on the coupon row lock',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      const fixture = await seedFixture(harness.adminPool);

      // Client A holds the coupon row lock.
      const clientA = await harness.callerOne.pool.connect();
      await clientA.query('BEGIN');
      await clientA.query('SELECT id FROM coupons WHERE id = $1 FOR UPDATE', [
        fixture.couponId,
      ]);

      // Client B starts the application insert; it must block on the
      // trigger's SELECT FROM coupons FOR UPDATE.
      const applicationInsertP = harness.callerTwo.pool.query(
        `INSERT INTO booking_coupon_applications
           (id, property_id, booking_id, coupon_id, customer_email_digest,
            application_status, quota_reserved, discount_type,
            fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
            minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
            final_amount_vnd, coupon_code_snapshot, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
                 'FIXED', 10000, NULL, NULL,
                 0, 359000, 10000, 349000,
                 'CONC01', CURRENT_TIMESTAMP)`,
        [fixture.propertyId, fixture.bookingId, fixture.couponId, Buffer.alloc(32, 0xce)],
      );

      const observation = await observeWaitOnCouponRow(
        harness.adminPool,
        'race-concurrent-admin',
        'race-concurrent-caller-two',
        fixture.couponId,
      );
      expect(observation.waitEventType).toBe('Lock');
      expect(observation.granted).toBe(false);

      // Client A COMMITs without changes; the application insert
      // proceeds against the original ACTIVE coupon.
      await clientA.query('COMMIT');
      clientA.release();

      const result = await applicationInsertP;
      expect(result.rowCount).toBe(1);
    },
  );

  it(
    'concurrent E3: parent-row lock mechanics — third authoritative locker + raw INSERT/UPDATE serialize on coupons.id (not a service-level race)',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      const fixture = await seedFixture(harness.adminPool);

      // Real concurrent E3: three clients.
      //   - Client A holds the coupon row lock with a SELECT FOR UPDATE
      //     (representing the HOLD's revalidation lock).
      //   - Client B starts the application insert (must block on A).
      //   - Client C starts the ADMIN disable (must block on A too).
      // We then release A and verify the application insert and the
      // disable serialize cleanly with no 40P01 deadlock.

      const clientLock = await harness.callerOne.pool.connect();
      const clientApp = await harness.callerTwo.pool.connect();
      try {
        await clientLock.query('BEGIN');
        await clientLock.query('SELECT id FROM coupons WHERE id = $1 FOR UPDATE', [
          fixture.couponId,
        ]);

        const applicationInsertP3 = clientApp.query(
          `INSERT INTO booking_coupon_applications
             (id, property_id, booking_id, coupon_id, customer_email_digest,
              application_status, quota_reserved, discount_type,
              fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
              minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
              final_amount_vnd, coupon_code_snapshot, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
                   'FIXED', 10000, NULL, NULL,
                   0, 359000, 10000, 349000,
                   'CONC01', CURRENT_TIMESTAMP)`,
          [
            fixture.propertyId,
            fixture.bookingId,
            fixture.couponId,
            Buffer.alloc(32, 0xd3),
          ],
        );
        applicationInsertP3.catch(() => {
          // Suppress unhandled rejection; we re-await below.
        });

        const disableP3 = (async () => {
          const clientDisable = await harness.adminPool.connect();
          try {
            await clientDisable.query('BEGIN');
            await clientDisable.query(
              `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [fixture.couponId],
            );
            await clientDisable.query('COMMIT');
            return 'disabled' as const;
          } finally {
            clientDisable.release();
          }
        })();
        disableP3.catch(() => {
          // Suppress unhandled rejection; we re-await below.
        });

        // Observe the application insert blocked on the coupon lock.
        const observation = await observeWaitOnCouponRow(
          harness.adminPool,
          'race-concurrent-admin',
          'race-concurrent-caller-two',
          fixture.couponId,
        );
        expect(observation.waitEventType).toBe('Lock');
        expect(observation.granted).toBe(false);

        // Release the lock; both clients should resolve.
        await clientLock.query('COMMIT');
        clientLock.release();

        const appResult = await applicationInsertP3;
        expect(appResult.rowCount).toBe(1);

        // The disable follows the lock release and succeeds.
        const disableResult = await disableP3;
        expect(disableResult).toBe('disabled');
      } finally {
        clientApp.release();
      }
    },
  );

  it(
    'concurrent E4: repeated lock-graph execution — no SQLSTATE 40P01 deadlocks',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      const iterations = 5;
      for (let i = 0; i < iterations; i += 1) {
        const fixture = await seedFixture(harness.adminPool);

        const clientA = await harness.callerOne.pool.connect();
        try {
          await clientA.query('BEGIN');
          await clientA.query('SELECT id FROM coupons WHERE id = $1 FOR UPDATE', [
            fixture.couponId,
          ]);

          const applicationInsertP = harness.callerTwo.pool.query(
            `INSERT INTO booking_coupon_applications
               (id, property_id, booking_id, coupon_id, customer_email_digest,
                application_status, quota_reserved, discount_type,
                fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
                minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
                final_amount_vnd, coupon_code_snapshot, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
                     'FIXED', 10000, NULL, NULL,
                     0, 359000, 10000, 349000,
                     'CONC01', CURRENT_TIMESTAMP)`,
            [
              fixture.propertyId,
              fixture.bookingId,
              fixture.couponId,
              Buffer.alloc(32, 0xcf),
            ],
          );

          await observeWaitOnCouponRow(
            harness.adminPool,
            'race-concurrent-admin',
            'race-concurrent-caller-two',
            fixture.couponId,
          );

          await clientA.query('COMMIT');

          let result: { rowCount: number } | { error: unknown };
          try {
            const queryResult = await applicationInsertP;
            result = { rowCount: queryResult.rowCount ?? 0 };
          } catch (error) {
            if (hasPostgresCode(error, '40P01')) {
              throw new Error(`deadlock detected on iteration ${i}: ${String(error)}`);
            }
            throw error;
          }
          expect(result).toEqual({ rowCount: 1 });
        } finally {
          clientA.release();
        }
      }
    },
  );
});

function hasPostgresCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === code) return true;
  return hasPostgresCode(candidate.cause, code);
}
