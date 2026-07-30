import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_SCHEMA_VERSION, getSchemaStatus } from '../../src/schema-status.js';
import { createGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';
import { migrateDatabase } from '../../src/migrations.js';

const PHASE5_TABLES = ['booking_contacts', 'guest_otp_challenges', 'guest_sessions'] as const;

const PHASE5_INDICES = [
  'bookings_quote_id_uq',
  'guest_otp_challenges_one_active_booking_uq',
  'guest_otp_challenges_booking_email_created_idx',
  'guest_otp_challenges_ip_created_idx',
] as const;

describe('phase 5 migration from an empty database', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createGuardedTestDatabase(baseUrl);
    await migrateDatabase(database.databaseUrl);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('reports the phase 5 schema version as ready', async () => {
    await expect(getSchemaStatus(database.pool)).resolves.toEqual({
      ready: true,
      actualVersion: EXPECTED_SCHEMA_VERSION,
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    });
  });

  it('creates every phase 5 table', async () => {
    const tables = await database.pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name`,
    );
    const tableNames = tables.rows.map((row) => row.table_name);
    for (const table of PHASE5_TABLES) {
      expect(tableNames).toContain(table);
    }
  });

  it('creates every phase 5 index', async () => {
    const indices = await database.pool.query<{ indexname: string }>(
      `SELECT indexname
         FROM pg_indexes
        WHERE schemaname = 'public'`,
    );
    const indexNames = indices.rows.map((row) => row.indexname);
    for (const index of PHASE5_INDICES) {
      expect(indexNames).toContain(index);
    }
  });
});

describe('phase 5 migration over a phase 4 database', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createGuardedTestDatabase(baseUrl);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('migrates successfully and reports the phase 5 version', async () => {
    await migrateDatabase(database.databaseUrl);

    await expect(getSchemaStatus(database.pool)).resolves.toMatchObject({
      ready: true,
      actualVersion: EXPECTED_SCHEMA_VERSION,
    });
  });

  it('is a no-op on a second invocation', async () => {
    const migrationHistoryBefore = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`,
    );
    const appliedCount = Number(migrationHistoryBefore.rows[0]?.count);

    await migrateDatabase(database.databaseUrl);

    const migrationHistoryAfter = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`,
    );
    expect(Number(migrationHistoryAfter.rows[0]?.count)).toBe(appliedCount);
  });
});
