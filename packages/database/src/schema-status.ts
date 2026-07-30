import type { Pool, PoolClient } from 'pg';

export const EXPECTED_SCHEMA_VERSION = 'phase-8d-client-acceptance-v1';

export interface SchemaStatus {
  readonly ready: boolean;
  readonly actualVersion: string | null;
  readonly expectedVersion: typeof EXPECTED_SCHEMA_VERSION;
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

function postgresCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}

export async function getSchemaStatus(connection: Queryable): Promise<SchemaStatus> {
  try {
    const result = await connection.query<{ schema_version: string }>(
      'SELECT schema_version FROM schema_metadata WHERE id = 1',
    );
    const actualVersion = result.rows[0]?.schema_version ?? null;
    return {
      ready: actualVersion === EXPECTED_SCHEMA_VERSION,
      actualVersion,
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    };
  } catch (error) {
    if (postgresCode(error) !== '42P01') {
      throw error;
    }
    return {
      ready: false,
      actualVersion: null,
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    };
  }
}
