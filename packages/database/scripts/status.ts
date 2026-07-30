import { withDatabasePool } from '../src/client.js';
import { getSchemaStatus } from '../src/schema-status.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required');
}

const status = await withDatabasePool(databaseUrl, getSchemaStatus, {
  max: 1,
  applicationName: 'room-management-schema-status',
});
process.stdout.write(`${JSON.stringify(status)}\n`);
if (!status.ready) {
  process.exitCode = 1;
}
