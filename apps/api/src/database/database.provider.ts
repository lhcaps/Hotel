import type { OnApplicationShutdown } from '@nestjs/common';
import type { ApiEnvironment } from '@room/config';
import {
  createDatabaseClient,
  createDatabasePool,
  getSchemaStatus,
  type DatabaseClient,
  type SchemaStatus,
} from '@room/database';

type DatabasePool = ReturnType<typeof createDatabasePool>;
type ApplicationDatabasePool = Pick<DatabasePool, 'end' | 'query'>;

export class DatabaseProvider implements OnApplicationShutdown {
  private shutdownPromise: Promise<void> | undefined;

  public constructor(
    public readonly pool: ApplicationDatabasePool,
    public readonly client: DatabaseClient,
  ) {}

  public async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  public schemaStatus(): Promise<SchemaStatus> {
    return getSchemaStatus(this.pool);
  }

  public onApplicationShutdown(): Promise<void> {
    this.shutdownPromise ??= this.pool.end();
    return this.shutdownPromise;
  }
}

export function createApplicationDatabaseProvider(
  environment: Pick<ApiEnvironment, 'DATABASE_URL'>,
): DatabaseProvider {
  const pool = createDatabasePool(environment.DATABASE_URL, {
    applicationName: 'room-management-api',
  });
  return new DatabaseProvider(pool, createDatabaseClient(pool));
}
