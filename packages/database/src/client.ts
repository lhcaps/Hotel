import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

import { databaseSchema } from './schema.js';

export type DatabaseClient = NodePgDatabase<typeof databaseSchema>;
export type DatabasePool = Pool;
export type DatabasePoolClient = PoolClient;

export interface DatabasePoolOptions {
  readonly max?: number;
  readonly applicationName?: string;
  readonly connectionTimeoutMillis?: number;
  readonly idleTimeoutMillis?: number;
}

export type DatabaseConnectionTarget = string | URL;

function explicitUrlPoolConfig(url: URL): PoolConfig {
  const database = decodeURIComponent(url.pathname.slice(1));
  return {
    host: url.hostname,
    port: url.port === '' ? 5432 : Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

export function createDatabasePool(
  connection: DatabaseConnectionTarget,
  options: DatabasePoolOptions = {},
): Pool {
  const config: PoolConfig = {
    ...(typeof connection === 'string'
      ? { connectionString: connection }
      : explicitUrlPoolConfig(connection)),
    max: options.max ?? 10,
    application_name: options.applicationName ?? 'room-management',
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
  };
  return new Pool(config);
}

export function createDatabaseClient(pool: Pool): DatabaseClient {
  return drizzle(pool, { schema: databaseSchema });
}

export async function withDatabasePool<T>(
  connection: DatabaseConnectionTarget,
  operation: (pool: Pool) => Promise<T>,
  options: DatabasePoolOptions = {},
): Promise<T> {
  const pool = createDatabasePool(connection, options);
  try {
    return await operation(pool);
  } finally {
    await pool.end();
  }
}
