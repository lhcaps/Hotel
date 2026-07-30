import { Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@room/config';
import { createLogger } from '@room/observability';
import { Redis } from 'ioredis';

import type { DatabaseProvider } from '../database/database.provider.js';

export type ReadinessCheckStatus = 'up' | 'down';

export interface ReadinessChecks {
  readonly configuration: ReadinessCheckStatus;
  readonly postgres: ReadinessCheckStatus;
  readonly schema: ReadinessCheckStatus;
  readonly redis: ReadinessCheckStatus;
}

export type RedisProbe = () => Promise<void>;

export interface ReadinessContext {
  requestId?: string;
  correlationId?: string;
}

export class ReadinessError extends Error {
  public constructor(public readonly checks: ReadinessChecks) {
    super('API is not ready');
  }
}

@Injectable()
export class HealthService {
  private readonly logger;

  public constructor(
    private readonly environment: ApiEnvironment,
    private readonly database: Pick<DatabaseProvider, 'ping' | 'schemaStatus'>,
    private readonly redisProbe: RedisProbe,
  ) {
    this.logger = createLogger({
      service: 'api',
      environment: environment.NODE_ENV,
      level: environment.LOG_LEVEL,
    });
  }

  public async live() {
    return { service: 'api', status: 'ok', checks: { process: 'up' } } as const;
  }

  public async ready(context: ReadinessContext = {}) {
    let postgres: ReadinessCheckStatus = 'up';
    let schema: ReadinessCheckStatus = 'down';
    let redis: ReadinessCheckStatus = 'up';

    try {
      await this.database.ping();
    } catch {
      postgres = 'down';
      this.logger.error({ check: 'postgres', ...context }, 'Readiness check failed');
    }

    if (postgres === 'up') {
      try {
        schema = (await this.database.schemaStatus()).ready ? 'up' : 'down';
        if (schema === 'down') {
          this.logger.error({ check: 'schema', ...context }, 'Readiness check failed');
        }
      } catch {
        this.logger.error({ check: 'schema', ...context }, 'Readiness check failed');
      }
    }

    try {
      await this.redisProbe();
    } catch {
      redis = 'down';
      this.logger.error({ check: 'redis', ...context }, 'Readiness check failed');
    }

    const checks: ReadinessChecks = { configuration: 'up', postgres, schema, redis };
    if (Object.values(checks).includes('down')) {
      throw new ReadinessError(checks);
    }
    return {
      service: 'api',
      status: 'ready',
      checks,
    } as const;
  }
}

export function createRedisProbe(environment: ApiEnvironment): RedisProbe {
  return async () => {
    const client = new Redis(environment.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    client.on('error', () => undefined);
    try {
      await client.connect();
      await client.ping();
    } finally {
      client.disconnect();
    }
  };
}
