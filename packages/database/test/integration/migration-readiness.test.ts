import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_SCHEMA_VERSION, getSchemaStatus } from '../../src/schema-status.js';
import {
  applyMigrationsFromFolder,
  buildTrimmedDrizzleFolder,
  createTrimmedMigratedTestDatabase,
  disposeTrimmedDrizzleFolder,
  type TrimmedMigratedTestDatabase,
} from './migration-folder.js';
import { createGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';
import { migrateDatabase } from '../../src/migrations.js';

describe('migration readiness from an empty PostgreSQL database', () => {
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

  it('is not ready before migrations and is current after the immutable history runs', async () => {
    await expect(getSchemaStatus(database.pool)).resolves.toMatchObject({
      ready: false,
      actualVersion: null,
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    });

    await migrateDatabase(database.databaseUrl);

    await expect(getSchemaStatus(database.pool)).resolves.toEqual({
      ready: true,
      actualVersion: EXPECTED_SCHEMA_VERSION,
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    });
  });

  it('creates every Phase 2 table, required auth tables, and installs the required extension', async () => {
    const tables = await database.pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        'amenities',
        'accounts',
        'audit_events',
        'bookings',
        'maintenance_blocks',
        'outbox_events',
        'price_tiers',
        'properties',
        'quotes',
        'rate_plan_prices',
        'rate_plans',
        'room_inventory_blocks',
        'room_type_amenities',
        'room_types',
        'rooms',
        'schema_metadata',
        'sessions',
        'users',
        'verification_records',
      ]),
    );
    await expect(database.pool.query('SELECT id FROM users')).resolves.toMatchObject({
      rowCount: 0,
    });
    await expect(
      database.pool.query(
        `INSERT INTO users (name, email, role)
         VALUES ('Invalid role', 'invalid-role@example.test', 'SYSTEM_WORKER')`,
      ),
    ).rejects.toMatchObject({ code: '22P02' });
    await expect(
      database.pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'`),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('accepts Better Auth opaque session identifiers', async () => {
    const user = await database.pool.query<{ id: string }>(
      `INSERT INTO users (name, email, role) VALUES ('Session user', 'session-user@example.test', 'ADMIN') RETURNING id`,
    );
    await expect(
      database.pool.query(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES ('opaque-better-auth-session-id', $1, 'opaque-token', now() + interval '1 day')`,
        [user.rows[0]?.id],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });
});

describe('Phase 8B1 migration readiness through migration 0016', () => {
  let database: TrimmedMigratedTestDatabase;

  beforeAll(async () => {
    database = await createTrimmedMigratedTestDatabase(
      process.env.TEST_DATABASE_URL ?? (() => {
        throw new Error('TEST_DATABASE_URL is required for database integration tests');
      })(),
      16,
    );
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('brings schema_metadata to phase-8b1-pricing-product-vertical-v1 after the 0016 boundary', async () => {
    const version = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    expect(version.rows[0]?.schema_version).toBe('phase-8b1-pricing-product-vertical-v1');
  });

  it('reports ready=false at the 0016 boundary against the post-Gate-B EXPECTED_SCHEMA_VERSION', async () => {
    // EXPECTED_SCHEMA_VERSION currently targets phase-8c-payment-reconciliation-v1
    // (uncommitted Gate B). With migrations trimmed at 0016 we land at the
    // 8B1 version; readiness against the post-Gate-B target must be false.
    await expect(getSchemaStatus(database.pool)).resolves.toMatchObject({
      ready: false,
      actualVersion: 'phase-8b1-pricing-product-vertical-v1',
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    });
  });
});

describe('Phase 8B1 migration 0016 — idempotent re-run on a trimmed folder', () => {
  let database: GuardedTestDatabase;
  let folder: string;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createGuardedTestDatabase(baseUrl);
    folder = buildTrimmedDrizzleFolder(16);
    await applyMigrationsFromFolder(database.databaseUrl, folder);
  });

  afterAll(async () => {
    disposeTrimmedDrizzleFolder(folder);
    await database?.dispose();
  });

  it('does not apply any new migration on a second run', async () => {
    const before = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`,
    );
    await applyMigrationsFromFolder(database.databaseUrl, folder);
    const after = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });
});

describe('Phase 8C migration 0018 metadata repair', () => {
  let database: GuardedTestDatabase;
  let folder: string;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createGuardedTestDatabase(baseUrl);
    folder = buildTrimmedDrizzleFolder(17);
    await applyMigrationsFromFolder(database.databaseUrl, folder);

    // Reproduce a database that journaled an earlier 0017 before its Phase 8C
    // metadata stamp was appended: the reconciliation DDL is present, but the
    // readiness marker remains at the 8B1 version.
    await database.pool.query(
      `UPDATE schema_metadata
          SET schema_version = 'phase-8b1-pricing-product-vertical-v1'
        WHERE id = 1`,
    );

    disposeTrimmedDrizzleFolder(folder);
    folder = buildTrimmedDrizzleFolder(18);
    await applyMigrationsFromFolder(database.databaseUrl, folder);
  });

  afterAll(async () => {
    disposeTrimmedDrizzleFolder(folder);
    await database?.dispose();
  });

  it('keeps the pre-Phase-8D marker not-ready without losing reconciliation columns', async () => {
    await expect(getSchemaStatus(database.pool)).resolves.toEqual({
      ready: false,
      actualVersion: 'phase-8c-payment-reconciliation-v1',
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    });

    const columns = await database.pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payment_attempts'
          AND column_name = 'reconciliation_attempt_count'`,
    );
    expect(columns.rows).toEqual([{ column_name: 'reconciliation_attempt_count' }]);
  });
});
