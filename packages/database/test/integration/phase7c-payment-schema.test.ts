import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_SCHEMA_VERSION, getSchemaStatus } from '../../src/schema-status.js';
import { createMigratedTestDatabase } from './helpers.js';
import type { GuardedTestDatabase } from '../../src/testing.js';

describe('Phase 8C payment reconciliation schema', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('installs the payment aggregate, attempt, and verified-event tables', async () => {
    const result = await database.pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name`,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['payments', 'payment_attempts', 'payment_provider_events']),
    );
  });

  it('reports the latest schema version as ready after preserving Phase 8C payment tables', async () => {
    await expect(getSchemaStatus(database.pool)).resolves.toEqual({
      ready: true,
      actualVersion: EXPECTED_SCHEMA_VERSION,
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    });
  });
});
