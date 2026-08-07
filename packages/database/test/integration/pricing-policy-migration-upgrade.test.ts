import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyMigrationsFromFolder,
  buildTrimmedDrizzleFolder,
  disposeTrimmedDrizzleFolder,
} from './migration-folder.js';
import { createGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';

describe('Operations V3 pricing policy migration upgrade', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }

    database = await createGuardedTestDatabase(baseUrl);
    const preCatalogFolder = buildTrimmedDrizzleFolder(28);
    try {
      await applyMigrationsFromFolder(database.databaseUrl, preCatalogFolder);
    } finally {
      disposeTrimmedDrizzleFolder(preCatalogFolder);
    }

    const before = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pricing_policy_versions'`,
    );
    expect(before.rows).toEqual([{ count: '0' }]);

    const catalogFolder = buildTrimmedDrizzleFolder(29);
    try {
      await applyMigrationsFromFolder(database.databaseUrl, catalogFolder);
    } finally {
      disposeTrimmedDrizzleFolder(catalogFolder);
    }
  }, 120_000);

  afterAll(async () => {
    await database?.dispose();
  });

  it('upgrades the real 0028 journal tail with empty catalog tables', async () => {
    const result = await database.pool.query<{
      policyTable: string;
      componentTable: string;
      v1Table: string;
      rowCount: string;
      extensionCount: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'pricing_policy_versions') AS "policyTable",
         (SELECT count(*)::text FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'pricing_policy_components') AS "componentTable",
         (SELECT count(*)::text FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'rate_plans') AS "v1Table",
         (SELECT count(*)::text FROM pricing_policy_versions) AS "rowCount",
         (SELECT count(*)::text FROM pg_extension WHERE extname = 'btree_gist') AS "extensionCount"`,
    );
    expect(result.rows).toEqual([
      {
        policyTable: '1',
        componentTable: '1',
        v1Table: '1',
        rowCount: '0',
        extensionCount: '1',
      },
    ]);
  });
});
