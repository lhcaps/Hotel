import { requireApiEnvironment } from '@room/config';
import { createDatabaseClient, createDatabasePool } from '@room/database';

import { bootstrapAdmin } from '../src/bootstrap.js';
import { createDatabaseBootstrapDependencies } from '../src/database-bootstrap.js';

const environment = requireApiEnvironment();
const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (email === undefined || password === undefined) {
  throw new Error('ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required.');
}

const pool = createDatabasePool(environment.DATABASE_URL, {
  max: 1,
  applicationName: 'room-management-admin-bootstrap',
});
try {
  const result = await bootstrapAdmin(
    {
      email,
      password,
      environment: environment.NODE_ENV,
      productionAcknowledged: process.env.ADMIN_BOOTSTRAP_PRODUCTION_ACK === 'I_UNDERSTAND',
    },
    createDatabaseBootstrapDependencies(createDatabaseClient(pool)),
  );
  process.stdout.write(
    `ADMIN bootstrap ${result.created ? 'created' : 'already exists'} for ${result.email}\n`,
  );
} finally {
  await pool.end();
}
