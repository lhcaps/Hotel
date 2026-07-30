// packages/database/scripts/demo-lifecycle.ts
//
// Phase 6F demo database lifecycle. Runs via `pnpm --filter
// @room/database demo:db:create` or `demo:db:drop` so the `pg`
// dependency resolves from this workspace.
//
// Refuses to operate on any database name that does not match the
// disposable demo prefix.

import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

const DEMO_DATABASE_PREFIX = 'room_management_demo_';
const DEMO_DATABASE_NAME_PATTERN = /^room_management_demo_[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ADMIN_DATABASE_URL =
  process.env.DEMO_ADMIN_DATABASE_URL ?? 'postgresql://room:room@127.0.0.1:5432/postgres';

function generateName(): string {
  const suffix = randomBytes(16).toString('base64url');
  return `${DEMO_DATABASE_PREFIX}${suffix}`;
}

function assertSafeName(name: string): void {
  if (!DEMO_DATABASE_NAME_PATTERN.test(name)) {
    throw new Error(
      `Refusing to operate on database name "${name}": must match ${DEMO_DATABASE_NAME_PATTERN}.`,
    );
  }
}

function buildDemoUrl(databaseName: string): string {
  const u = new URL(ADMIN_DATABASE_URL);
  u.pathname = `/${databaseName}`;
  u.search = '';
  u.hash = '';
  return u.toString();
}

async function withAdminClient<T>(operation: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: ADMIN_DATABASE_URL,
    application_name: 'room-management-demo-lifecycle',
  });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

async function create(): Promise<void> {
  const name = generateName();
  assertSafeName(name);
  await withAdminClient(async (client) => {
    await client.query(`CREATE DATABASE "${name}"`);
  });
  const url = buildDemoUrl(name);
  process.stdout.write(`DEMO_DATABASE_NAME=${name}\n`);
  process.stdout.write(`DEMO_DATABASE_URL=${url}\n`);
}

async function drop(name: string): Promise<void> {
  assertSafeName(name);
  await withAdminClient(async (client) => {
    const exists = await client.query<{ exists: boolean }>(
      `SELECT 1 AS exists FROM pg_database WHERE datname = $1`,
      [name],
    );
    if (exists.rowCount === 0) {
      process.stdout.write(`Demo database "${name}" already absent.\n`);
      return;
    }
    await client.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name],
    );
    await client.query(`DROP DATABASE "${name}"`);
    process.stdout.write(`Demo database "${name}" dropped.\n`);
  });
}

const [, , command, ...rest] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case 'create':
      await create();
      break;
    case 'drop':
      await drop(rest[0] ?? '');
      break;
    default:
      process.stderr.write('Usage: demo-lifecycle.ts create | drop <demo_database_name>\n');
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`demo-lifecycle error: ${message}\n`);
  process.exitCode = 1;
});
