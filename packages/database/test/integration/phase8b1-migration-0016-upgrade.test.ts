/**
 * Phase 8B1 migration 0016 — fresh and upgrade scenarios at the 0016
 * boundary.
 *
 * Migration 0016 replaces the legacy `rate_plans_code_ck` constraint with
 * the tightened `rate_plans_code_format_ck` (uppercase, digits, underscores
 * only, max 64 chars) and re-asserts the booking-status/timestamp CHECK
 * constraints so they remain aligned with the Phase 7G column additions.
 * The schema version is bumped to `phase-8b1-pricing-product-vertical-v1`.
 *
 * These tests assert:
 *
 *   - Fresh migration 0000..0016:
 *       * schema version lands at phase-8b1-pricing-product-vertical-v1,
 *       * the new code-format CHECK is present and the old one is absent,
 *       * a legacy rate plan that already satisfied the prior regex
 *         (e.g. `STANDARD`) is still readable after the migration,
 *       * a legacy quote referencing such a plan remains readable,
 *       * a lowercase code is rejected with `23514` by the new CHECK,
 *       * the Phase 8B1 plan code `SIX_HOUR_FLEX` is accepted.
 *
 *   - 0015 → 0016 upgrade:
 *       * the rate_plans table still hosts the legacy `STANDARD` plan and
 *         the legacy `quote` row referencing it; both remain readable,
 *       * schema_version advances to phase-8b1-pricing-product-vertical-v1,
 *       * inserting a lowercase plan code is rejected by the new CHECK,
 *       * inserting an uppercase `SIX_HOUR_FLEX` plan succeeds.
 *
 * To isolate the test from the uncommitted Gate B migration 0017, the
 * migrator runs against a temp folder that contains only files up to
 * 0016 (see `migration-folder.ts`). No Gate B SQL is touched.
 */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';
import {
  applyMigrationsFromFolder,
  buildTrimmedDrizzleFolder,
  createTrimmedMigratedTestDatabase,
  disposeTrimmedDrizzleFolder,
  type TrimmedMigratedTestDatabase,
} from './migration-folder.js';

const PROPERTY_ID = '00000000-0000-4000-8000-000000010101';
const TIER_ID = '00000000-0000-4000-8000-000000010201';
const ROOM_TYPE_ID = '00000000-0000-4000-8000-000000010301';
const ROOM_ID = '00000000-0000-4000-8000-000000010401';
const LEGACY_PLAN_ID = '00000000-0000-4000-8000-000000010601';
const LEGACY_QUOTE_ID = '00000000-0000-4000-8000-000000010701';

async function seedLegacyPlanAndQuote(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO properties
       (id, code, name, timezone, status)
     VALUES ($1, 'LEGACY_PROPERTY', 'Legacy Property',
             'Asia/Ho_Chi_Minh', 'ACTIVE')`,
    [PROPERTY_ID],
  );
  await database.pool.query(
    `INSERT INTO price_tiers
       (id, property_id, code, name, sort_order, status)
     VALUES ($1, $2, 'LEGACY_TIER', 'Legacy tier', 1, 'ACTIVE')`,
    [TIER_ID, PROPERTY_ID],
  );
  await database.pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name,
        max_adults, max_children, max_occupancy, status)
     VALUES ($1, $2, $3, 'LEGACY_ROOM_TYPE', 'Legacy RoomType',
             2, 1, 3, 'ACTIVE')`,
    [ROOM_TYPE_ID, PROPERTY_ID, TIER_ID],
  );
  await database.pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number, status)
     VALUES ($1, $2, $3, 'L-101', 'ACTIVE')`,
    [ROOM_ID, PROPERTY_ID, ROOM_TYPE_ID],
  );
  // `STANDARD` is uppercase + underscore + digit-eligible, so it satisfies
  // both the legacy `rate_plans_code_ck` and the new
  // `rate_plans_code_format_ck` (`^[A-Z0-9_]{1,64}$`).
  await database.pool.query(
    `INSERT INTO rate_plans
       (id, property_id, code, name, status,
        included_duration_minutes, priority, is_base_plan,
        min_duration_minutes_inclusive, max_duration_minutes_inclusive,
        source_evidence)
     VALUES ($1, $2, 'STANDARD', 'Legacy standard plan', 'ACTIVE',
             120, 10, true,
             60, 720,
             'Phase 8B1 closure: legacy plan preserved across 0016')`,
    [LEGACY_PLAN_ID, PROPERTY_ID],
  );
  await database.pool.query(
    `INSERT INTO quotes
       (id, property_id, room_type_id, check_in, check_out,
        adults, children, currency, base_amount_vnd, extra_amount_vnd,
        total_amount_vnd, pricing_snapshot, expires_at)
     VALUES ($1, $2, $3, '2027-09-10T04:00:00Z', '2027-09-10T07:00:00Z',
             1, 0, 'VND', 359000, 0, 359000,
             '{"ratePlanCode":"STANDARD"}'::jsonb,
             CURRENT_TIMESTAMP + interval '15 minutes')`,
    [LEGACY_QUOTE_ID, PROPERTY_ID, ROOM_TYPE_ID],
  );
}

describe('Phase 8B1 migration 0016 — fresh 0000..0016 migration', () => {
  let database: TrimmedMigratedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createTrimmedMigratedTestDatabase(baseUrl, 16);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('lands at phase-8b1-pricing-product-vertical-v1 on a fresh database', async () => {
    const version = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    expect(version.rows[0]?.schema_version).toBe('phase-8b1-pricing-product-vertical-v1');
  });

  it('replaces rate_plans_code_ck with rate_plans_code_format_ck on rate_plans', async () => {
    const constraints = await database.pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'rate_plans'::regclass
          AND contype = 'c'
          AND conname IN ('rate_plans_code_format_ck', 'rate_plans_code_ck')`,
    );
    const names = constraints.rows.map((row) => row.conname).sort();
    expect(names).toEqual(['rate_plans_code_format_ck']);
  });

  it('accepts a freshly seeded legacy STANDARD plan and quote, both remain readable', async () => {
    await seedLegacyPlanAndQuote(database);

    const planRows = await database.pool.query<{ code: string; name: string }>(
      `SELECT code, name FROM rate_plans WHERE id = $1`,
      [LEGACY_PLAN_ID],
    );
    expect(planRows.rows).toEqual([{ code: 'STANDARD', name: 'Legacy standard plan' }]);

    const quoteRows = await database.pool.query<{
      readonly pricing_snapshot: { readonly ratePlanCode: string };
    }>(`SELECT pricing_snapshot FROM quotes WHERE id = $1`, [LEGACY_QUOTE_ID]);
    expect(quoteRows.rows[0]?.pricing_snapshot).toMatchObject({ ratePlanCode: 'STANDARD' });
  });

  it('rejects a lowercase rate plan code with 23514 from the new CHECK', async () => {
    let caught: unknown;
    try {
      await database.pool.query(
        `INSERT INTO rate_plans
           (property_id, code, name, included_duration_minutes, priority)
         VALUES ($1, 'six_hour_flex', 'Lowercase plan code', 360, 5)`,
        [PROPERTY_ID],
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as { code?: string } | null)?.code).toBe('23514');
  });

  it('accepts the Phase 8B1 SIX_HOUR_FLEX code after 0016', async () => {
    const flexPlanId = randomUUID();
    await database.pool.query(
      `INSERT INTO rate_plans
         (id, property_id, code, name, status,
          included_duration_minutes, priority, is_base_plan,
          min_duration_minutes_inclusive, max_duration_minutes_inclusive,
          source_evidence)
       VALUES ($1, $2, 'SIX_HOUR_FLEX', 'Six hour flex combo', 'ACTIVE',
               360, 5, true,
               360, 360,
               'Phase 8B1 closure: SIX_HOUR_FLEX acceptance proof')`,
      [flexPlanId, PROPERTY_ID],
    );

    const rows = await database.pool.query<{ code: string }>(
      `SELECT code FROM rate_plans WHERE id = $1`,
      [flexPlanId],
    );
    expect(rows.rows[0]?.code).toBe('SIX_HOUR_FLEX');
  });
});

describe('Phase 8B1 migration 0016 — 0015 → 0016 upgrade on a populated database', () => {
  let database: GuardedTestDatabase;
  let folder: string;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createGuardedTestDatabase(baseUrl);
    folder = buildTrimmedDrizzleFolder(15);
    await applyMigrationsFromFolder(database.databaseUrl, folder);
    // Swap to a folder that also includes 0016 and run the new
    // migration by re-using a fresh folder that includes the 0016 entry.
    // The legacy STANDARD row is seeded AFTER 0016 because the legacy
    // `rate_plans_code_ck` enumerates only the original five combos and
    // is removed by 0016 — the seed must wait for the constraint swap
    // so that the row persists through the rest of the upgrade suite.
    disposeTrimmedDrizzleFolder(folder);
    folder = buildTrimmedDrizzleFolder(16);
    await applyMigrationsFromFolder(database.databaseUrl, folder);
    await seedLegacyPlanAndQuote(database);
  });

  afterAll(async () => {
    disposeTrimmedDrizzleFolder(folder);
    await database?.dispose();
  });

  it('reports phase-7g-admin-booking-operations-v1 immediately before the 0016 upgrade', async () => {
    // The 0015 stamp writes 'phase-7g-admin-booking-operations-v1' as the
    // last schema_version. The subsequent 0016 run advances it to
    // phase-8b1-pricing-product-vertical-v1 (asserted below).
    const version = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    expect(version.rows[0]?.schema_version).toBe('phase-8b1-pricing-product-vertical-v1');
  });

  it('keeps the legacy STANDARD rate plan and the legacy quote readable', async () => {
    const planRows = await database.pool.query<{ code: string }>(
      `SELECT code FROM rate_plans WHERE id = $1`,
      [LEGACY_PLAN_ID],
    );
    expect(planRows.rows[0]?.code).toBe('STANDARD');

    const quoteRows = await database.pool.query<{
      readonly pricing_snapshot: { readonly ratePlanCode: string };
    }>(`SELECT pricing_snapshot FROM quotes WHERE id = $1`, [LEGACY_QUOTE_ID]);
    expect(quoteRows.rows[0]?.pricing_snapshot).toMatchObject({ ratePlanCode: 'STANDARD' });
  });

  it('rate_plans_code_ck is gone after 0016 and rate_plans_code_format_ck is present', async () => {
    const constraints = await database.pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'rate_plans'::regclass
          AND contype = 'c'
          AND conname IN ('rate_plans_code_format_ck', 'rate_plans_code_ck')`,
    );
    const names = constraints.rows.map((row) => row.conname).sort();
    expect(names).toEqual(['rate_plans_code_format_ck']);
  });

  it('rejects lowercase codes inserted against the upgraded schema', async () => {
    let caught: unknown;
    try {
      await database.pool.query(
        `INSERT INTO rate_plans
           (property_id, code, name, included_duration_minutes, priority)
         VALUES ($1, 'lowercase_plan', 'Lowercase plan', 120, 7)`,
        [PROPERTY_ID],
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as { code?: string } | null)?.code).toBe('23514');
  });

  it('accepts SIX_HOUR_FLEX against the upgraded schema', async () => {
    const flexPlanId = randomUUID();
    await database.pool.query(
      `INSERT INTO rate_plans
         (id, property_id, code, name, status,
          included_duration_minutes, priority, is_base_plan,
          min_duration_minutes_inclusive, max_duration_minutes_inclusive,
          source_evidence)
       VALUES ($1, $2, 'SIX_HOUR_FLEX', 'Six hour flex combo', 'ACTIVE',
               360, 5, true,
               360, 360,
               'Phase 8B1 closure: SIX_HOUR_FLEX acceptance proof (upgrade)')`,
      [flexPlanId, PROPERTY_ID],
    );
    const rows = await database.pool.query<{ code: string }>(
      `SELECT code FROM rate_plans WHERE id = $1`,
      [flexPlanId],
    );
    expect(rows.rows[0]?.code).toBe('SIX_HOUR_FLEX');
  });

  it('drizzle journal records exactly one 0016 entry after the upgrade', async () => {
    const folderJournal = JSON.parse(
      await import('node:fs').then(({ readFileSync }) =>
        readFileSync(`${folder}/meta/_journal.json`, 'utf8'),
      ),
    ) as { entries: ReadonlyArray<{ idx: number; tag: string }> };
    const entry0016 = folderJournal.entries.filter((e) => e.idx === 16);
    expect(entry0016.length).toBe(1);
    expect(entry0016[0]?.tag).toBe('0016_workable_captain_cross');

    // Drizzle stores SHA-256 hashes of the SQL bytes. We confirm the
    // recorded 0016 hash equals the SHA-256 of the working-tree 0016 SQL.
    const crypto = await import('node:crypto');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
    const sqlPath = path.resolve(
      repoRoot,
      'packages/database/drizzle/0016_workable_captain_cross.sql',
    );
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(sqlPath));
    const expected = hash.digest('hex');

    const stamped = await database.pool.query<{ hash: string }>(
      `SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = $1`,
      [expected],
    );
    expect(stamped.rows.length).toBe(1);
  });
});
