/**
 * Phase 6C coupon application reference closure — ordered-semantics tests.
 *
 * These tests exercise the deterministic ordering of the protected
 * operations (ADMIN economic mutation / scope mutation / booking HOLD
 * vs first reference). They are valuable evidence because they show
 * the post-0010 outcome for every legal ordering without depending on
 * timing.
 *
 * IMPORTANT: these tests are NOT concurrent race tests. Each branch
 * runs the two operations sequentially (`await ...; await ...;`).
 * The companion file `phase6-coupon-first-reference-races-concurrent.test.ts`
 * contains the overlapping-transaction evidence with lock-wait
 * observation. Both files together provide the full acceptance case
 * for migration 0010.
 *
 * Branches:
 *
 *   - ordered-semantics E1: ADMIN economic mutation vs first quote
 *     reference. The raw-SQL UPDATE is the same path used by the
 *     ADMIN repository. The mutation commits first or last; either
 *     ordering must produce the documented outcome.
 *   - ordered-semantics E2: scope mutation vs first reference,
 *     independently exercised for INSERT roomTypeIdB, UPDATE existing
 *     scope, and DELETE existing scope. No pre-existing pair is
 *     re-inserted.
 *   - ordered-semantics E3: ADMIN disable vs first coupon application
 *     insert. The booking HOLD path is the real production path
 *     (@room/booking createBookingHoldWithRetry). Both orderings are
 *     exercised.
 *   - ordered-semantics E4: repeated runs of E1–E3 across multiple
 *     Pools do not produce unexplained SQLSTATE 40P01 deadlocks.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createPreparedGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';
import { migrateDatabase } from '../../src/migrations.js';
import { createDatabasePool } from '../../src/client.js';
import type { DatabasePool } from '../../src/client.js';

const RACE_TEST_TIMEOUT_MS = 60_000;

interface CallerPool {
  readonly pool: DatabasePool;
  readonly applicationName: string;
  close(): Promise<void>;
}

function createIndependentCallerPool(databaseUrl: string, applicationName: string): CallerPool {
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
    applicationName: 'race-admin',
  });
  const callerOne = createIndependentCallerPool(database.databaseUrl, 'race-caller-one');
  const callerTwo = createIndependentCallerPool(database.databaseUrl, 'race-caller-two');
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
  readonly roomTypeIdB: string;
  readonly couponId: string;
  readonly roomId: string;
}

async function seedFixture(
  pool: DatabasePool,
  options: {
    readonly scope: 'all' | 'scoped';
    readonly initialMinimumOrderVnd?: number;
    readonly totalUsageLimit?: number | null;
  },
): Promise<SeededCouponFixture> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomTypeIdB = randomUUID();
  const couponId = randomUUID();
  const roomId = randomUUID();
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
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, 'RACE-R', 'ACTIVE')`,
      [roomId, propertyId, roomTypeId],
    );
    const minimum = options.initialMinimumOrderVnd ?? 0;
    await client.query(
      `INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'RACE01', 'ACTIVE', 'FIXED', 10000, NULL, NULL, $5, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', $3, $4, NULL)`,
      [couponId, propertyId, options.scope === 'all', options.totalUsageLimit ?? null, minimum],
    );
    if (options.scope === 'scoped') {
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
  return { propertyId, tierId, roomTypeId, roomTypeIdB, couponId, roomId };
}

/**
 * Same as seedFixture but seeds a scoped coupon with TWO room types so
 * DELETE of one scope row is allowed by the scope-consistency trigger
 * (the coupon still has one room type left).
 */
async function seedMultiScopeFixture(pool: DatabasePool): Promise<SeededCouponFixture> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomTypeIdB = randomUUID();
  const couponId = randomUUID();
  const roomId = randomUUID();
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
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, 'RACE-R', 'ACTIVE')`,
      [roomId, propertyId, roomTypeId],
    );
    await client.query(
      `INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'RACE01', 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', false, NULL, NULL)`,
      [couponId, propertyId],
    );
    await client.query(
      `INSERT INTO coupon_room_types (property_id, coupon_id, room_type_id) VALUES ($1, $2, $3), ($1, $2, $4)`,
      [propertyId, couponId, roomTypeId, roomTypeIdB],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { propertyId, tierId, roomTypeId, roomTypeIdB, couponId, roomId };
}

async function seedQuoteWithCoupon(
  pool: DatabasePool,
  fixture: SeededCouponFixture,
  grossAmountVnd: number,
  minimumOrderAmountVnd: number,
  fixedAmountVnd: number,
): Promise<{
  readonly quoteId: string;
  readonly couponSnapshot: Record<string, unknown>;
}> {
  const quoteId = randomUUID();
  const couponSnapshot = {
    couponId: fixture.couponId,
    normalizedCode: 'RACE01',
    discountType: 'FIXED',
    fixedAmountVnd: String(fixedAmountVnd),
    percentageBasisPoints: null,
    maximumDiscountVnd: null,
    minimumOrderAmountVnd: String(minimumOrderAmountVnd),
    grossAmountVnd: String(grossAmountVnd),
    discountAmountVnd: String(fixedAmountVnd),
    finalAmountVnd: String(grossAmountVnd - fixedAmountVnd),
  };
  await pool.query(
    `INSERT INTO quotes
       (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
        base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at,
        coupon_id, coupon_snapshot, created_at)
     VALUES ($1, $2, $3, '2027-08-10T04:00:00Z', '2027-08-10T07:00:00Z', 1, 0, 'VND',
             $4, 0, $4, '{"pricing":{"ruleVersion":"phase-4-pricing-availability-v1"}}'::jsonb,
             CURRENT_TIMESTAMP + interval '15 minutes',
             $5, $6::jsonb, CURRENT_TIMESTAMP)`,
    [
      quoteId,
      fixture.propertyId,
      fixture.roomTypeId,
      grossAmountVnd,
      fixture.couponId,
      JSON.stringify(couponSnapshot),
    ],
  );
  return { quoteId, couponSnapshot };
}

async function attemptScopeMutation<T>(operation: Promise<T>): Promise<'succeeded' | 'rejected'> {
  try {
    await operation;
    return 'succeeded';
  } catch (error) {
    if ((error as { code?: string }).code === '40P01') {
      throw new Error(`deadlock detected: ${(error as Error).message}`);
    }
    return 'rejected';
  }
}

function hasPostgresCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === code) return true;
  return hasPostgresCode(candidate.cause, code);
}

async function expectNoDeadlock<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (hasPostgresCode(error, '40P01')) {
      throw new Error(`deadlock detected: ${(error as Error).message}`);
    }
    throw error;
  }
}

async function attemptAdminDisable(
  pool: DatabasePool,
  couponId: string,
): Promise<'disabled' | 'rejected'> {
  try {
    await pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [couponId],
    );
    return 'disabled';
  } catch (error) {
    if ((error as { code?: string }).code === '40P01') {
      throw new Error(`deadlock detected: ${(error as Error).message}`);
    }
    return 'rejected';
  }
}

describe('phase 6C application reference closure — ordered-semantics evidence', () => {
  let harness: DisposableHarness;

  beforeAll(async () => {
    harness = await createHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it(
    'ordered-semantics E1: ADMIN economic mutation vs first quote reference — quote snapshot matches the winning definition',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      // Exercise both orderings. The serialized winner is determined by
      // PostgreSQL row-lock ordering; here we make the ordering explicit
      // to verify both outcomes without depending on timing.
      const gross = 359_000;
      const fixed = 10_000;

      // Ordering A: mutation first, reference second.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, {
            scope: 'all',
            initialMinimumOrderVnd: 0,
          });
          // Mutation commits first via callerOne.
          await expectNoDeadlock(
            localHarness.callerOne.pool.query(
              `UPDATE coupons SET minimum_order_amount_vnd = $1 WHERE id = $2`,
              [7_000, fixture.couponId],
            ),
          );
          // Reference (quote) commits second via callerTwo with the new
          // definition (minimum 7000, fixed 10000).
          await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, gross, 7_000, fixed),
          );

          const couponRow = await localHarness.adminPool.query<{
            minimum_order_amount_vnd: string;
            first_referenced_at: Date | null;
          }>(
            `SELECT minimum_order_amount_vnd::text, first_referenced_at FROM coupons WHERE id = $1`,
            [fixture.couponId],
          );
          const row = couponRow.rows[0];
          expect(row).toBeDefined();
          expect(row?.minimum_order_amount_vnd).toBe('7000');
          expect(row?.first_referenced_at).not.toBeNull();

          // Subsequent economic mutation must be rejected (immutable).
          await expect(
            localHarness.adminPool.query(
              `UPDATE coupons SET minimum_order_amount_vnd = 9000 WHERE id = $1`,
              [fixture.couponId],
            ),
          ).rejects.toMatchObject({ code: 'P0001' });
        } finally {
          await localHarness.close();
        }
      }

      // Ordering B: reference first, mutation second (must be rejected).
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, {
            scope: 'all',
            initialMinimumOrderVnd: 0,
          });
          await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, gross, 0, fixed),
          );
          // Mutation must be rejected because the coupon is now referenced.
          await expect(
            localHarness.callerOne.pool.query(
              `UPDATE coupons SET minimum_order_amount_vnd = $1 WHERE id = $2`,
              [7_000, fixture.couponId],
            ),
          ).rejects.toMatchObject({ code: 'P0001' });

          const couponRow = await localHarness.adminPool.query<{
            minimum_order_amount_vnd: string;
            first_referenced_at: Date | null;
          }>(
            `SELECT minimum_order_amount_vnd::text, first_referenced_at FROM coupons WHERE id = $1`,
            [fixture.couponId],
          );
          const row = couponRow.rows[0];
          expect(row).toBeDefined();
          expect(row?.minimum_order_amount_vnd).toBe('0');
          expect(row?.first_referenced_at).not.toBeNull();
        } finally {
          await localHarness.close();
        }
      }
    },
  );

  it(
    'ordered-semantics E2: scope mutation vs first reference — independent INSERT/UPDATE/DELETE',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      // 2.1: INSERT roomTypeIdB before reference → succeeds, then reference succeeds.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, { scope: 'scoped' });
          const insertResult = await expectNoDeadlock(
            attemptScopeMutation(
              localHarness.callerOne.pool.query(
                `INSERT INTO coupon_room_types (property_id, coupon_id, room_type_id) VALUES ($1, $2, $3)`,
                [fixture.propertyId, fixture.couponId, fixture.roomTypeIdB],
              ),
            ),
          );
          const referenceResult = await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, 359_000, 0, 10_000).then(
              () => 'reference' as const,
            ),
          );
          expect(insertResult).toBe('succeeded');
          expect(referenceResult).toBe('reference');
          const couponRow = await localHarness.adminPool.query<{
            first_referenced_at: Date | null;
            applies_to_all_room_types: boolean;
          }>(`SELECT first_referenced_at, applies_to_all_room_types FROM coupons WHERE id = $1`, [
            fixture.couponId,
          ]);
          const row = couponRow.rows[0];
          expect(row).toBeDefined();
          expect(row?.first_referenced_at).not.toBeNull();
        } finally {
          await localHarness.close();
        }
      }

      // 2.1b: INSERT roomTypeIdB AFTER reference → must be rejected.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, { scope: 'scoped' });
          await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, 359_000, 0, 10_000),
          );
          const insertResult = await expectNoDeadlock(
            attemptScopeMutation(
              localHarness.callerOne.pool.query(
                `INSERT INTO coupon_room_types (property_id, coupon_id, room_type_id) VALUES ($1, $2, $3)`,
                [fixture.propertyId, fixture.couponId, fixture.roomTypeIdB],
              ),
            ),
          );
          expect(insertResult).toBe('rejected');
        } finally {
          await localHarness.close();
        }
      }

      // 2.2: UPDATE existing scope to roomTypeIdB before reference → succeeds.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, { scope: 'scoped' });
          const updateResult = await expectNoDeadlock(
            attemptScopeMutation(
              localHarness.callerOne.pool.query(
                `UPDATE coupon_room_types SET room_type_id = $1 WHERE coupon_id = $2`,
                [fixture.roomTypeIdB, fixture.couponId],
              ),
            ),
          );
          const referenceResult = await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, 359_000, 0, 10_000).then(
              () => 'reference' as const,
            ),
          );
          expect(updateResult).toBe('succeeded');
          expect(referenceResult).toBe('reference');
          const couponRow = await localHarness.adminPool.query<{
            first_referenced_at: Date | null;
          }>(`SELECT first_referenced_at FROM coupons WHERE id = $1`, [fixture.couponId]);
          const row = couponRow.rows[0];
          expect(row).toBeDefined();
          expect(row?.first_referenced_at).not.toBeNull();
        } finally {
          await localHarness.close();
        }
      }

      // 2.2b: UPDATE existing scope AFTER reference → must be rejected.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, { scope: 'scoped' });
          await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, 359_000, 0, 10_000),
          );
          const updateResult = await expectNoDeadlock(
            attemptScopeMutation(
              localHarness.callerOne.pool.query(
                `UPDATE coupon_room_types SET room_type_id = $1 WHERE coupon_id = $2`,
                [fixture.roomTypeIdB, fixture.couponId],
              ),
            ),
          );
          expect(updateResult).toBe('rejected');
        } finally {
          await localHarness.close();
        }
      }

      // 2.3: DELETE existing scope before reference → succeeds (scope has multiple rooms).
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedMultiScopeFixture(localHarness.adminPool);
          const deleteResult = await expectNoDeadlock(
            attemptScopeMutation(
              localHarness.callerOne.pool.query(
                `DELETE FROM coupon_room_types WHERE coupon_id = $1 AND room_type_id = $2`,
                [fixture.couponId, fixture.roomTypeIdB],
              ),
            ),
          );
          const referenceResult = await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, 359_000, 0, 10_000).then(
              () => 'reference' as const,
            ),
          );
          expect(deleteResult).toBe('succeeded');
          expect(referenceResult).toBe('reference');
          const couponRow = await localHarness.adminPool.query<{
            first_referenced_at: Date | null;
          }>(`SELECT first_referenced_at FROM coupons WHERE id = $1`, [fixture.couponId]);
          const row = couponRow.rows[0];
          expect(row).toBeDefined();
          expect(row?.first_referenced_at).not.toBeNull();
        } finally {
          await localHarness.close();
        }
      }

      // 2.3b: DELETE existing scope AFTER reference → must be rejected.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedMultiScopeFixture(localHarness.adminPool);
          await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, 359_000, 0, 10_000),
          );
          const deleteResult = await expectNoDeadlock(
            attemptScopeMutation(
              localHarness.callerOne.pool.query(
                `DELETE FROM coupon_room_types WHERE coupon_id = $1 AND room_type_id = $2`,
                [fixture.couponId, fixture.roomTypeIdB],
              ),
            ),
          );
          expect(deleteResult).toBe('rejected');
        } finally {
          await localHarness.close();
        }
      }
    },
  );

  it(
    'ordered-semantics E3: booking HOLD (coupon-aware) vs ADMIN disable — exactly one serialized winner (the gap closed by migration 0010)',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      // The booking HOLD service is the real production path that inserts
      // booking/contact/block/booking_coupon_application atomically. The
      // application INSERT is the operation protected by migration 0010's
      // combined FOR UPDATE + first-reference trigger.
      const { createBookingHoldWithRetry } =
        await import('../../../booking/src/services/create-booking-hold.js');
      const { normalizeContact } = await import('../../../booking/src/contact.js');

      const DIGEST_SECRET = Buffer.from('phase6c-race-secret-32-bytes-long');

      // E3 — disable vs real booking HOLD. The serialized winner is
      // determined by PostgreSQL's row-lock ordering on the coupon row
      // (acquired by `lockCouponForUpdate` inside the booking HOLD
      // transaction). We exercise both orderings without using an
      // arbitrary sleep: a deterministic sequential ordering tests the
      // production semantics directly.
      //
      // Run the race three times per ordering to ensure both
      // paths survive repeated execution.

      // Ordering A: ADMIN disable commits first, then booking HOLD is
      // attempted. The HOLD must reject with a safe coupon-unavailable
      // code and write nothing.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, {
            scope: 'all',
            totalUsageLimit: 1,
          });
          const { quoteId } = await seedQuoteWithCoupon(
            localHarness.adminPool,
            fixture,
            359_000,
            0,
            10_000,
          );
          const contact = normalizeContact(
            {
              fullName: `Race E3-A ${iteration}`,
              email: `race-e3a-${iteration}@test.invalid`,
              phone: '+84901234567',
            },
            DIGEST_SECRET,
          );
          // Step 1: ADMIN disable commits first on callerOne.
          const disableResult = await expectNoDeadlock(
            attemptAdminDisable(localHarness.callerOne.pool, fixture.couponId),
          );
          expect(disableResult).toBe('disabled');
          // Step 2: booking HOLD on callerTwo observes DISABLED and rejects.
          const holdResult = await expectNoDeadlock(
            createBookingHoldWithRetry(
              localHarness.callerTwo.pool,
              {
                quoteId,
                contact,
                holdDurationMs: 15 * 60 * 1000,
                correlationId: `race-e3a-${iteration}`,
              },
              { maxAttempts: 1 },
            ).then(
              () => 'hold' as const,
              (error: unknown) => {
                if (hasPostgresCode(error, '40P01')) {
                  throw new Error(`deadlock detected: ${(error as Error).message}`);
                }
                return 'hold-rejected' as const;
              },
            ),
          );
          expect(holdResult).toBe('hold-rejected');

          // Verify zero partial writes for the quote.
          const counts = await localHarness.adminPool.query<{
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
               (SELECT COUNT(*)::text FROM booking_coupon_applications WHERE coupon_id = $2) AS applications,
               (SELECT COUNT(*)::text FROM audit_events WHERE aggregate_type = 'BOOKING' AND aggregate_id::text IN (SELECT id::text FROM bookings WHERE quote_id = $1)) AS audits,
               (SELECT COUNT(*)::text FROM outbox_events WHERE event_type = 'booking.hold.created' AND aggregate_id::text IN (SELECT id::text FROM bookings WHERE quote_id = $1)) AS outbox`,
            [quoteId, fixture.couponId],
          );
          const c = counts.rows[0];
          expect(c?.bookings).toBe('0');
          expect(c?.contacts).toBe('0');
          expect(c?.blocks).toBe('0');
          expect(c?.applications).toBe('0');
          expect(c?.audits).toBe('0');
          expect(c?.outbox).toBe('0');
        } finally {
          await localHarness.close();
        }
      }

      // Ordering B: booking HOLD commits first on callerTwo, then
      // ADMIN disable commits on callerOne. The HOLD application must
      // survive; the coupon is referenced and remains ACTIVE at HOLD
      // commit time, then transitions to DISABLED while the application
      // row is preserved.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, {
            scope: 'all',
            totalUsageLimit: 1,
          });
          const { quoteId } = await seedQuoteWithCoupon(
            localHarness.adminPool,
            fixture,
            359_000,
            0,
            10_000,
          );
          const contact = normalizeContact(
            {
              fullName: `Race E3-B ${iteration}`,
              email: `race-e3b-${iteration}@test.invalid`,
              phone: '+84901234567',
            },
            DIGEST_SECRET,
          );
          // Step 1: booking HOLD on callerTwo succeeds and commits.
          const holdResult = await expectNoDeadlock(
            createBookingHoldWithRetry(
              localHarness.callerTwo.pool,
              {
                quoteId,
                contact,
                holdDurationMs: 15 * 60 * 1000,
                correlationId: `race-e3b-${iteration}`,
              },
              { maxAttempts: 1 },
            ).then(
              () => 'hold' as const,
              (error: unknown) => {
                if (hasPostgresCode(error, '40P01')) {
                  throw new Error(`deadlock detected: ${(error as Error).message}`);
                }
                throw error;
              },
            ),
          );
          expect(holdResult).toBe('hold');

          // Step 2: ADMIN disable commits after the HOLD on callerOne.
          const disableResult = await expectNoDeadlock(
            attemptAdminDisable(localHarness.callerOne.pool, fixture.couponId),
          );
          expect(disableResult).toBe('disabled');

          // The booking and application must persist after the disable.
          const counts = await localHarness.adminPool.query<{
            bookings: string;
            applications: string;
          }>(
            `SELECT
               (SELECT COUNT(*)::text FROM bookings WHERE quote_id = $1) AS bookings,
               (SELECT COUNT(*)::text FROM booking_coupon_applications WHERE coupon_id = $2) AS applications`,
            [quoteId, fixture.couponId],
          );
          const c = counts.rows[0];
          expect(c?.bookings).toBe('1');
          expect(c?.applications).toBe('1');

          const applicationRow = await localHarness.adminPool.query<{
            application_status: string;
            quota_reserved: boolean;
          }>(
            `SELECT application_status, quota_reserved FROM booking_coupon_applications WHERE coupon_id = $1 LIMIT 1`,
            [fixture.couponId],
          );
          const app = applicationRow.rows[0];
          expect(app?.application_status).toBe('RESERVED');
          expect(app?.quota_reserved).toBe(true);
        } finally {
          await localHarness.close();
        }
      }
    },
  );

  it(
    'ordered-semantics E4: repeated lock-graph execution — no unexplained SQLSTATE 40P01 deadlocks',
    { timeout: RACE_TEST_TIMEOUT_MS },
    async () => {
      // Repeated execution of the corrected lock-graph paths in both
      // orderings. Any 40P01 here would surface as a deadlock; the helper
      // rejects and reports the exact failing statements. The test simply
      // verifies that the operations complete cleanly under the corrected
      // migration 0010 serialization.
      const { createBookingHoldWithRetry } =
        await import('../../../booking/src/services/create-booking-hold.js');
      const { normalizeContact } = await import('../../../booking/src/contact.js');
      const DIGEST_SECRET = Buffer.from('phase6c-race-e4-secret-32-bytes-long');

      // E1 variant: mutation then reference (must succeed).
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, {
            scope: 'all',
            initialMinimumOrderVnd: 0,
          });
          await expectNoDeadlock(
            localHarness.callerOne.pool.query(
              `UPDATE coupons SET minimum_order_amount_vnd = $1 WHERE id = $2`,
              [9_000, fixture.couponId],
            ),
          );
          await expectNoDeadlock(
            seedQuoteWithCoupon(localHarness.callerTwo.pool, fixture, 359_000, 0, 10_000),
          );
        } finally {
          await localHarness.close();
        }
      }

      // E3 variant: disable then booking HOLD (must reject cleanly).
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, {
            scope: 'all',
            totalUsageLimit: 1,
          });
          const { quoteId } = await seedQuoteWithCoupon(
            localHarness.adminPool,
            fixture,
            359_000,
            0,
            10_000,
          );
          await expectNoDeadlock(
            attemptAdminDisable(localHarness.callerOne.pool, fixture.couponId),
          );
          const contact = normalizeContact(
            {
              fullName: `Race E4-A ${iteration}`,
              email: `race-e4a-${iteration}@test.invalid`,
              phone: '+84901234567',
            },
            DIGEST_SECRET,
          );
          const holdResult = await expectNoDeadlock(
            createBookingHoldWithRetry(
              localHarness.callerTwo.pool,
              {
                quoteId,
                contact,
                holdDurationMs: 15 * 60 * 1000,
                correlationId: `race-e4a-${iteration}`,
              },
              { maxAttempts: 1 },
            ).then(
              () => 'hold' as const,
              (error: unknown) => {
                if (hasPostgresCode(error, '40P01')) {
                  throw new Error(`deadlock detected: ${(error as Error).message}`);
                }
                return 'hold-rejected' as const;
              },
            ),
          );
          expect(holdResult).toBe('hold-rejected');
        } finally {
          await localHarness.close();
        }
      }

      // E3 variant: booking HOLD then disable (both commit; app survives).
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const localHarness = await createHarness();
        try {
          const fixture = await seedFixture(localHarness.adminPool, {
            scope: 'all',
            totalUsageLimit: 1,
          });
          const { quoteId } = await seedQuoteWithCoupon(
            localHarness.adminPool,
            fixture,
            359_000,
            0,
            10_000,
          );
          const contact = normalizeContact(
            {
              fullName: `Race E4-B ${iteration}`,
              email: `race-e4b-${iteration}@test.invalid`,
              phone: '+84901234567',
            },
            DIGEST_SECRET,
          );
          await expectNoDeadlock(
            createBookingHoldWithRetry(
              localHarness.callerTwo.pool,
              {
                quoteId,
                contact,
                holdDurationMs: 15 * 60 * 1000,
                correlationId: `race-e4b-${iteration}`,
              },
              { maxAttempts: 1 },
            ).then(() => 'hold' as const),
          );
          await expectNoDeadlock(
            attemptAdminDisable(localHarness.callerOne.pool, fixture.couponId),
          );
        } finally {
          await localHarness.close();
        }
      }
    },
  );
});
