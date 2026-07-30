import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';

import { createDatabasePool } from './client.js';
import { DatabaseSafetyError } from './errors.js';

const TEST_DATABASE_PREFIX = 'room_management_test_';
const TEST_DATABASE_NAME = /^room_management_test_[a-zA-Z0-9][a-zA-Z0-9_]*$/;

export interface TestDatabaseGuardOptions {
  readonly allowedCiHost?: string;
}

function refuse(): never {
  throw new DatabaseSafetyError('Refusing destructive database operation on an unsafe target');
}

export function assertSafeTestDatabaseUrl(
  value: string,
  options: TestDatabaseGuardOptions = {},
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return refuse();
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    return refuse();
  }

  const allowedHosts = new Set(['localhost', '127.0.0.1']);
  if (options.allowedCiHost !== undefined && options.allowedCiHost.length > 0) {
    allowedHosts.add(options.allowedCiHost);
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    !allowedHosts.has(url.hostname) ||
    !TEST_DATABASE_NAME.test(databaseName) ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    return refuse();
  }

  return url;
}

export function createUniqueTestDatabaseName(): string {
  return `${TEST_DATABASE_PREFIX}${randomUUID().replaceAll('-', '')}`;
}

export interface GuardedTestDatabase {
  readonly databaseName: string;
  readonly databaseUrl: string;
  readonly pool: Pool;
  openClient(): Promise<PoolClient>;
  dispose(): Promise<void>;
}

function databaseUrlWithName(url: URL, databaseName: string): URL {
  const result = new URL(url);
  result.pathname = `/${databaseName}`;
  result.search = '';
  result.hash = '';
  return result;
}

async function dropGuardedDatabase(adminPool: Pool, databaseName: string): Promise<void> {
  if (!TEST_DATABASE_NAME.test(databaseName)) {
    return refuse();
  }
  await adminPool.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  await adminPool.query(`DROP DATABASE "${databaseName}"`);
}

export async function createGuardedTestDatabase(
  baseUrl: string,
  options: TestDatabaseGuardOptions = {},
): Promise<GuardedTestDatabase> {
  const guardedBase = assertSafeTestDatabaseUrl(baseUrl, options);
  const databaseName = createUniqueTestDatabaseName();
  const adminUrl = databaseUrlWithName(guardedBase, 'postgres');
  const databaseUrl = databaseUrlWithName(guardedBase, databaseName);
  const adminPool = createDatabasePool(adminUrl, {
    max: 1,
    applicationName: 'room-management-test-admin',
  });

  let databaseCreated = false;
  let pool: Pool;
  try {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    pool = createDatabasePool(databaseUrl, {
      max: 6,
      applicationName: 'room-management-test',
    });
  } catch (error) {
    if (databaseCreated) {
      try {
        await dropGuardedDatabase(adminPool, databaseName);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Test database creation failed and cleanup also failed',
        );
      }
    }
    throw error;
  } finally {
    await adminPool.end();
  }

  let disposed = false;
  let applicationPoolClosed = false;
  let cleanupInProgress: Promise<void> | undefined;

  async function dispose(): Promise<void> {
    if (disposed) {
      return;
    }
    if (cleanupInProgress !== undefined) {
      return cleanupInProgress;
    }

    cleanupInProgress = (async () => {
      if (!applicationPoolClosed) {
        await pool.end();
        applicationPoolClosed = true;
      }

      assertSafeTestDatabaseUrl(databaseUrl.toString(), options);
      const cleanupPool = createDatabasePool(adminUrl, {
        max: 1,
        applicationName: 'room-management-test-cleanup',
      });
      try {
        await dropGuardedDatabase(cleanupPool, databaseName);
        disposed = true;
      } finally {
        await cleanupPool.end();
      }
    })();

    try {
      await cleanupInProgress;
    } finally {
      cleanupInProgress = undefined;
    }
  }

  return {
    databaseName,
    databaseUrl: databaseUrl.toString(),
    pool,
    openClient: async () => pool.connect(),
    dispose,
  };
}

export async function createPreparedGuardedTestDatabase(
  baseUrl: string,
  prepare: (database: GuardedTestDatabase) => Promise<void>,
  options: TestDatabaseGuardOptions = {},
): Promise<GuardedTestDatabase> {
  const database = await createGuardedTestDatabase(baseUrl, options);
  try {
    await prepare(database);
    return database;
  } catch (error) {
    try {
      await database.dispose();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Test database preparation failed and cleanup also failed',
      );
    }
    throw error;
  }
}
