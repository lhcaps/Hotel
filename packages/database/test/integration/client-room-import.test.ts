import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMigratedTestDatabase } from './helpers.js';

const script = resolve(import.meta.dirname, '..', '..', 'scripts', 'import-client-rooms.ts');
const databases: Array<Awaited<ReturnType<typeof createMigratedTestDatabase>>> = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.dispose()));
});

function runImport(databaseUrl: string): Promise<{
  readonly counts: { readonly created: number; readonly updated: number; readonly skipped: number };
}> {
  const child = spawn(process.execPath, ['--import', 'tsx', script, '--apply'], {
    cwd: resolve(import.meta.dirname, '..', '..'),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      CLIENT_ROOM_IMPORT_CONFIRM: 'APPLY_9_ROOMS',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const output: Buffer[] = [];
  const errors: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
  return once(child, 'exit').then(([code]) => {
    if (code !== 0) throw new Error(Buffer.concat(errors).toString('utf8'));
    return JSON.parse(Buffer.concat(output).toString('utf8')) as {
      readonly counts: {
        readonly created: number;
        readonly updated: number;
        readonly skipped: number;
      };
    };
  });
}

describe('client room import', () => {
  it('creates the approved nine rooms and skips every unchanged row on a second apply', async () => {
    const database = await createMigratedTestDatabase();
    databases.push(database);

    const first = await runImport(database.databaseUrl);
    expect(first.counts).toEqual({ created: 40, updated: 0, skipped: 0 });

    const second = await runImport(database.databaseUrl);
    expect(second.counts).toEqual({ created: 0, updated: 0, skipped: 40 });

    const [rooms, prices] = await Promise.all([
      database.pool.query(
        "SELECT room_number FROM rooms WHERE room_number IN ('Rose', 'Nami', 'Phù Vân', 'Sunset', 'Yuki', 'Sabi', 'Sudal', 'Wabi', 'Haven') ORDER BY room_number",
      ),
      database.pool.query<{ count: number }>('SELECT count(*)::int AS count FROM rate_plan_prices'),
    ]);
    expect(rooms.rowCount).toBe(9);
    expect(prices.rows[0]?.count).toBe(18);
  });
});
