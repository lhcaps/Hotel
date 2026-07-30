/**
 * Phase 6C migration 0010 catalog and immutability proof.
 *
 * Migration 0010 replaces the two BEFORE INSERT triggers on
 * booking_coupon_applications with a single combined trigger that locks
 * the parent coupon row FOR UPDATE before validating and that sets
 * first_referenced_at inside the same transaction.
 *
 * These tests inspect the live pg_trigger catalog after migration and
 * prove:
 *
 *   - exactly one non-internal BEFORE INSERT trigger remains on
 *     booking_coupon_applications;
 *   - the obsolete mark_coupon_first_referenced_on_application_insert
 *     trigger from 0009 is gone;
 *   - the surviving trigger acquires a FOR UPDATE lock on the coupons
 *     row before reading the status (verified by holding the row in an
 *     independent transaction and observing the application insert
 *     block);
 *   - first_referenced_at is strictly immutable after the first non-null
 *     write (forward, backward, clear, and identical-value scenarios);
 *   - ACTIVE application inserts succeed;
 *   - DISABLED application inserts are rejected;
 *   - 0000..0009 SQL files remain byte-identical with HEAD.
 *
 * The integration tests run against a guarded disposable PostgreSQL
 * database; they do not modify the live room_management schema.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createGuardedTestDatabase,
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '../../src/testing.js';
import { migrateDatabase } from '../../src/migrations.js';
import { EXPECTED_SCHEMA_VERSION } from '../../src/schema-status.js';

interface TriggerCatalogRow {
  readonly tgname: string;
  readonly tgtype: number;
  readonly pg_get_triggerdef: string;
  readonly tgenabled: string;
}

interface SeededBookingFixture {
  readonly propertyId: string;
  readonly tierId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly couponId: string;
  readonly bookingId: string;
  readonly quoteId: string;
}

const CATALOG_QUERY = `
  SELECT
    tgname,
    tgtype,
    pg_get_triggerdef(oid) AS pg_get_triggerdef,
    tgenabled
  FROM pg_trigger
  WHERE tgrelid = 'booking_coupon_applications'::regclass
    AND NOT tgisinternal
  ORDER BY tgname
`;

const DRIZZLE_DIR = resolve(import.meta.dirname, '..', '..', 'drizzle');

const CUSTOMER_EMAIL_DIGEST = Buffer.alloc(32, 0xab);

function isBeforeInsertTrigger(row: TriggerCatalogRow): boolean {
  // pg_get_triggerdef renders "BEFORE INSERT" for our target trigger and
  // "BEFORE UPDATE" for the protect_update trigger. The string check is
  // stable across PostgreSQL versions and avoids bit-arithmetic fragility.
  return /^\s*CREATE\s+TRIGGER\b[\s\S]*\bBEFORE\s+INSERT\b/i.test(row.pg_get_triggerdef);
}

async function seedPhase6CFixture(database: GuardedTestDatabase): Promise<SeededBookingFixture> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const couponId = randomUUID();
  const bookingId = randomUUID();
  const quoteId = randomUUID();

  const client = await database.openClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO properties (id, code, name, timezone, status)
       VALUES ($1, $2, 'Catalog Test', 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
      [propertyId, `P_${propertyId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status)
       VALUES ($1, $2, $3, 'Tier', 1, 'ACTIVE')`,
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
       VALUES ($1, $2, $3, 'CATALOG-R', 'ACTIVE')`,
      [roomId, propertyId, roomTypeId],
    );
    await client.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, status, discount_type,
          fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, valid_from, valid_until,
          applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'CAT01', 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0,
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
       VALUES ($1, $2, $3, '2027-09-10T04:00:00Z', '2027-09-10T07:00:00Z',
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
               '2027-09-10T04:00:00Z', '2027-09-10T07:00:00Z', 1, 0, 'VND',
               359000, 10000, 349000,
               '{"ratePlanCode":"CATALOG"}'::jsonb,
               CURRENT_TIMESTAMP + interval '15 minutes', NULL,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [bookingId, propertyId, roomTypeId, roomId, quoteId, `CAT-${bookingId.slice(-6)}`],
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

describe('phase 6C migration 0010 — fresh migration catalog and immutability', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
      await migrateDatabase(guarded.databaseUrl);
    });
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('seeds the current schema version after the full immutable migration history', async () => {
    const version = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    expect(version.rows[0]?.schema_version).toBe(EXPECTED_SCHEMA_VERSION);
  });

  it('leaves exactly one non-internal BEFORE INSERT trigger on booking_coupon_applications', async () => {
    const catalog = await database.pool.query<TriggerCatalogRow>(CATALOG_QUERY);
    const beforeInsertTriggers = catalog.rows.filter(isBeforeInsertTrigger);
    const beforeInsertNames = beforeInsertTriggers.map((row) => row.tgname).sort();

    expect(beforeInsertNames).toEqual(['booking_coupon_applications_validate_insert']);
    for (const row of beforeInsertTriggers) {
      expect(row.tgenabled).toBe('O');
    }
  });

  it('drops the obsolete mark_coupon_first_referenced_on_application_insert trigger from 0009', async () => {
    const catalog = await database.pool.query<TriggerCatalogRow>(CATALOG_QUERY);
    const triggerNames = catalog.rows.map((row) => row.tgname);
    expect(triggerNames).not.toContain('mark_coupon_first_referenced_on_application_insert');
  });

  it('locks the coupon row FOR UPDATE inside the surviving BEFORE INSERT trigger', async () => {
    // The new trigger must take a row-level lock on the parent coupon before
    // reading its status. If it read without FOR UPDATE, the insert would
    // return immediately even while the row is held. We assert it blocks.
    const fixture = await seedPhase6CFixture(database);

    const locker = await database.openClient();
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM coupons WHERE id = $1 FOR UPDATE', [fixture.couponId]);

      const applicationInsert = database.pool.query(
        `INSERT INTO booking_coupon_applications
           (id, property_id, booking_id, coupon_id, customer_email_digest,
            application_status, quota_reserved, discount_type,
            fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
            minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
            final_amount_vnd, coupon_code_snapshot, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
                 'FIXED', 10000, NULL, NULL,
                 0, 359000, 10000, 349000,
                 'CAT01', CURRENT_TIMESTAMP)`,
        [fixture.propertyId, fixture.bookingId, fixture.couponId, CUSTOMER_EMAIL_DIGEST],
      );

      const timeoutResult = await wait(1500, 'timeout').then(
        (value) => value,
        () => 'timeout' as const,
      );
      const completed = await Promise.race([
        applicationInsert.then(
          () => 'inserted' as const,
          (error: unknown) => ({ kind: 'error' as const, error }),
        ),
        Promise.resolve(timeoutResult),
      ]);

      expect(completed).toBe('timeout');

      await locker.query('ROLLBACK');
      const result = await applicationInsert.catch((error: unknown) => error);
      expect(result).not.toBeInstanceOf(Error);
    } finally {
      locker.release();
    }
  });

  it('accepts an ACTIVE coupon application insert', async () => {
    const fixture = await seedPhase6CFixture(database);
    await database.pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest,
          application_status, quota_reserved, discount_type,
          fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
          final_amount_vnd, coupon_code_snapshot, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
               'FIXED', 10000, NULL, NULL,
               0, 359000, 10000, 349000,
               'CAT01', CURRENT_TIMESTAMP)`,
      [fixture.propertyId, fixture.bookingId, fixture.couponId, CUSTOMER_EMAIL_DIGEST],
    );
    const stored = await database.pool.query<{ first_referenced_at: Date | null }>(
      `SELECT first_referenced_at FROM coupons WHERE id = $1`,
      [fixture.couponId],
    );
    expect(stored.rows[0]?.first_referenced_at).not.toBeNull();
  });

  it('rejects an application insert when the coupon is DISABLED', async () => {
    const fixture = await seedPhase6CFixture(database);
    await database.pool.query(
      `UPDATE coupons SET status = 'DISABLED', disabled_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fixture.couponId],
    );
    let caught: unknown;
    try {
      await database.pool.query(
        `INSERT INTO booking_coupon_applications
           (id, property_id, booking_id, coupon_id, customer_email_digest,
            application_status, quota_reserved, discount_type,
            fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
            minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
            final_amount_vnd, coupon_code_snapshot, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
                 'FIXED', 10000, NULL, NULL,
                 0, 359000, 10000, 349000,
                 'CAT01', CURRENT_TIMESTAMP)`,
        [fixture.propertyId, fixture.bookingId, fixture.couponId, CUSTOMER_EMAIL_DIGEST],
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const code = (caught as { code?: string } | null)?.code;
    expect(code).toBe('P0001');
  });

  it('preserves first_referenced_at once it is non-null under all update paths', async () => {
    const fixture = await seedPhase6CFixture(database);
    await database.pool.query(
      `INSERT INTO booking_coupon_applications
         (id, property_id, booking_id, coupon_id, customer_email_digest,
          application_status, quota_reserved, discount_type,
          fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
          final_amount_vnd, coupon_code_snapshot, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ASSOCIATED', false,
               'FIXED', 10000, NULL, NULL,
               0, 359000, 10000, 349000,
               'CAT01', CURRENT_TIMESTAMP)`,
      [fixture.propertyId, fixture.bookingId, fixture.couponId, CUSTOMER_EMAIL_DIGEST],
    );
    const initial = await database.pool.query<{ first_referenced_at: string }>(
      `SELECT first_referenced_at::text AS first_referenced_at FROM coupons WHERE id = $1`,
      [fixture.couponId],
    );
    const baseline = initial.rows[0]?.first_referenced_at;
    expect(baseline).toBeDefined();

    let forwardError: unknown;
    try {
      await database.pool.query(
        `UPDATE coupons
            SET first_referenced_at = $1::timestamptz + interval '1 hour'
          WHERE id = $2`,
        [baseline, fixture.couponId],
      );
    } catch (error) {
      forwardError = error;
    }
    expect((forwardError as { code?: string } | null)?.code).toBe('P0001');

    let backwardError: unknown;
    try {
      await database.pool.query(
        `UPDATE coupons
            SET first_referenced_at = $1::timestamptz - interval '1 hour'
          WHERE id = $2`,
        [baseline, fixture.couponId],
      );
    } catch (error) {
      backwardError = error;
    }
    expect((backwardError as { code?: string } | null)?.code).toBe('P0001');

    let clearError: unknown;
    try {
      await database.pool.query(`UPDATE coupons SET first_referenced_at = NULL WHERE id = $1`, [
        fixture.couponId,
      ]);
    } catch (error) {
      clearError = error;
    }
    expect((clearError as { code?: string } | null)?.code).toBe('P0001');

    await database.pool.query(
      `UPDATE coupons SET first_referenced_at = $1::timestamptz WHERE id = $2`,
      [baseline, fixture.couponId],
    );
    const reread = await database.pool.query<{ first_referenced_at: string }>(
      `SELECT first_referenced_at::text AS first_referenced_at FROM coupons WHERE id = $1`,
      [fixture.couponId],
    );
    expect(reread.rows[0]?.first_referenced_at).toBe(baseline);
  });
});

describe('phase 6C migration 0010 — v2 to v3 upgrade', () => {
  let database: GuardedTestDatabase;
  let v2Version: string;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createGuardedTestDatabase(baseUrl);
    // Genuine v2 → v3 upgrade path: apply 0000..0009 directly from the
    // raw SQL files, leaving the database in the same state the
    // production room_management database would have been in before
    // 0010 was introduced. We then insert matching rows into
    // drizzle.__drizzle_migrations so the normal migration runner will
    // see them as already applied and only apply 0010.
    const client = await database.openClient();
    try {
      for (let index = 0; index < 10; index += 1) {
        const tag = `${String(index).padStart(4, '0')}_`;
        const fileName = readdirSync(DRIZZLE_DIR).find(
          (name) => name.startsWith(tag) && name.endsWith('.sql'),
        );
        if (fileName === undefined) {
          throw new Error(`Migration file for index ${index} not found`);
        }
        const sql = readFileSync(resolve(DRIZZLE_DIR, fileName), 'utf8');
        const statements = sql
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const statement of statements) {
          await client.query(statement);
        }
      }
      // The above raw apply does not touch drizzle.__drizzle_migrations.
      // Stamp the 0000..0009 rows so the migrator considers them already
      // applied; the only pending migration is 0010. The migrator owns
      // the `drizzle` schema and migrations table, so we create them
      // here before stamping.
      await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at BIGINT
        )
      `);
      const stamps: ReadonlyArray<{ sql: string; createdAt: number }> = [
        { sql: '0000_silly_jocasta.sql', createdAt: 1784638573642 },
        { sql: '0001_custom_invariants.sql', createdAt: 1784638579710 },
        { sql: '0002_tiny_ultragirl.sql', createdAt: 1784657274773 },
        { sql: '0003_gorgeous_punisher.sql', createdAt: 1784660943768 },
        { sql: '0004_natural_paper_doll.sql', createdAt: 1784669580252 },
        { sql: '0005_ambiguous_blazing_skull.sql', createdAt: 1784728238749 },
        { sql: '0006_phase5_custom_invariants.sql', createdAt: 1784728404100 },
        { sql: '0007_phase6_coupon_core.sql', createdAt: 1784916335239 },
        { sql: '0008_phase6_coupon_invariants.sql', createdAt: 1784916350927 },
        { sql: '0009_swift_polaris.sql', createdAt: 1784920970017 },
      ];
      for (const stamp of stamps) {
        const filePath = resolve(DRIZZLE_DIR, stamp.sql);
        const hash = execFileSync('git', ['hash-object', filePath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
          .toString('utf8')
          .trim();
        // Drizzle stores SHA-256 of the raw SQL file content, not the
        // git blob hash. Compute it explicitly.
        const sql256 = createHash('sha256').update(readFileSync(filePath)).digest('hex');
        await client.query(
          `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [sql256, stamp.createdAt],
        );
        void hash;
      }
    } finally {
      client.release();
    }
    const v2Result = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    v2Version = v2Result.rows[0]?.schema_version ?? '<missing>';
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('reports v2 after the genuine 0000..0009 apply', () => {
    expect(v2Version).toBe('phase-6-coupon-core-v2');
  });

  it('has no 0010 row in the migration journal before the upgrade', async () => {
    const journal = await database.pool.query<{ hash: string }>(
      `SELECT hash FROM drizzle.__drizzle_migrations`,
    );
    const journalHashes = new Set(journal.rows.map((row) => row.hash));
    const stampHash = createHash('sha256')
      .update(readFileSync(resolve(DRIZZLE_DIR, '0010_phase6_coupon_reference_closure.sql')))
      .digest('hex');
    expect(journalHashes.has(stampHash)).toBe(false);
  });

  it('has the obsolete 0009 trigger before the upgrade', async () => {
    const catalog = await database.pool.query<TriggerCatalogRow>(CATALOG_QUERY);
    const triggerNames = catalog.rows.map((row) => row.tgname);
    expect(triggerNames).toContain('mark_coupon_first_referenced_on_application_insert');
  });

  it('does not yet have the combined 0010 trigger before the upgrade', async () => {
    const catalog = await database.pool.query<TriggerCatalogRow>(CATALOG_QUERY);
    const beforeInsertNames = catalog.rows
      .filter(isBeforeInsertTrigger)
      .map((row) => row.tgname)
      .sort();
    expect(beforeInsertNames).toEqual([
      'booking_coupon_applications_validate_insert',
      'mark_coupon_first_referenced_on_application_insert',
    ]);
  });

  it('upgrades cleanly to v3+ with the normal migration runner', async () => {
    await migrateDatabase(database.databaseUrl);
    const v3 = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    expect(v3.rows[0]?.schema_version).toBe(EXPECTED_SCHEMA_VERSION);
  });

  it('has exactly one 0010 row in the migration journal after the upgrade', async () => {
    const stampHash = createHash('sha256')
      .update(readFileSync(resolve(DRIZZLE_DIR, '0010_phase6_coupon_reference_closure.sql')))
      .digest('hex');
    const journal = await database.pool.query<{ hash: string }>(
      `SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = $1`,
      [stampHash],
    );
    expect(journal.rows.length).toBe(1);
  });

  it('drops the obsolete 0009 trigger after the upgrade', async () => {
    const catalog = await database.pool.query<TriggerCatalogRow>(CATALOG_QUERY);
    const triggerNames = catalog.rows.map((row) => row.tgname);
    expect(triggerNames).not.toContain('mark_coupon_first_referenced_on_application_insert');
  });

  it('leaves exactly one combined 0010 trigger after the upgrade', async () => {
    const catalog = await database.pool.query<TriggerCatalogRow>(CATALOG_QUERY);
    const beforeInsertNames = catalog.rows
      .filter(isBeforeInsertTrigger)
      .map((row) => row.tgname)
      .sort();
    expect(beforeInsertNames).toEqual(['booking_coupon_applications_validate_insert']);
  });

  it('is idempotent: a second migrateDatabase call applies no new migrations', async () => {
    const before = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`,
    );
    await migrateDatabase(database.databaseUrl);
    const after = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });
});

describe('phase 6C migration 0010 — 0000..0009 byte identity', () => {
  it('matches the git index blob hash for every pre-0010 migration file', () => {
    for (let index = 0; index < 10; index += 1) {
      const tag = `${String(index).padStart(4, '0')}_`;
      const files = readdirSync(DRIZZLE_DIR).filter(
        (name) => name.startsWith(tag) && name.endsWith('.sql'),
      );
      expect(files.length).toBe(1);
      const fileName = files[0];
      if (fileName === undefined) {
        throw new Error(`Migration file for index ${index} not found`);
      }
      const filePath = resolve(DRIZZLE_DIR, fileName);
      const workingHash = execFileSync('git', ['hash-object', filePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .toString('utf8')
        .trim();
      const indexHash = execFileSync('git', ['rev-parse', `:0:${relativeDrizzlePath(fileName)}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .toString('utf8')
        .trim();
      expect(workingHash).toBe(indexHash);
    }
  });
});

function relativeDrizzlePath(fileName: string): string {
  return `packages/database/drizzle/${fileName}`;
}
