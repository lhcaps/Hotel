import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabasePool } from '../../src/client.js';
import { createPreparedGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';

describe('guarded test database failure cleanup', () => {
  let baseUrl: string;
  let adminPool: ReturnType<typeof createDatabasePool>;

  beforeAll(() => {
    const configured = process.env.TEST_DATABASE_URL;
    if (configured === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    baseUrl = configured;
    const adminUrl = new URL(baseUrl);
    adminUrl.pathname = '/postgres';
    adminUrl.search = '';
    adminUrl.hash = '';
    adminPool = createDatabasePool(adminUrl, {
      max: 1,
      applicationName: 'room-management-cleanup-verification',
    });
  });

  afterAll(async () => {
    await adminPool.end();
  });

  it('drops a created database when preparation fails', async () => {
    let attemptedName: string | undefined;
    await expect(
      createPreparedGuardedTestDatabase(baseUrl, async (database: GuardedTestDatabase) => {
        attemptedName = database.databaseName;
        throw new Error('forced preparation failure');
      }),
    ).rejects.toThrow('forced preparation failure');

    const remaining = await adminPool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM pg_database WHERE datname = $1',
      [attemptedName],
    );
    expect(remaining.rows).toEqual([{ count: 0 }]);
  });
});
