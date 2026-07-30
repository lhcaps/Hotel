import type { DatabaseClient, createDatabasePool } from '@room/database';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseProvider } from '../src/database/database.provider.js';

type DatabasePool = ReturnType<typeof createDatabasePool>;

describe('DatabaseProvider', () => {
  it('closes its application-scoped pool exactly once during shutdown', async () => {
    const pool = {
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
    } as unknown as Pick<DatabasePool, 'end' | 'query'>;
    const provider = new DatabaseProvider(pool, {} as DatabaseClient);

    await Promise.all([provider.onApplicationShutdown(), provider.onApplicationShutdown()]);

    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
