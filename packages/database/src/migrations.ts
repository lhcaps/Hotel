import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { withDatabasePool } from './client.js';
import { DatabaseMigrationError } from './errors.js';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

export async function migrateDatabase(connectionString: string): Promise<void> {
  try {
    await withDatabasePool(
      connectionString,
      async (pool) => {
        await migrate(drizzle(pool), { migrationsFolder });
      },
      { max: 1, applicationName: 'room-management-migrator' },
    );
  } catch (cause) {
    throw new DatabaseMigrationError('Database migration failed', { cause });
  }
}
