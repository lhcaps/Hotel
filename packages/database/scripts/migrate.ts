import { migrateDatabase } from '../src/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required');
}

await migrateDatabase(databaseUrl);
process.stdout.write('Database migrations applied\n');
