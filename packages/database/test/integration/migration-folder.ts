import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  copyFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';

import { withDatabasePool } from '../../src/client.js';
import {
  createGuardedTestDatabase,
  type GuardedTestDatabase,
} from '../../src/testing.js';

export const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
  .toString('utf8')
  .trim();

export const DRIZZLE_DIR = resolve(REPO_ROOT, 'packages/database/drizzle');
export const META_DIR = resolve(DRIZZLE_DIR, 'meta');
export const JOURNAL_PATH = resolve(META_DIR, '_journal.json');

interface JournalFile {
  readonly version: string;
  readonly dialect: string;
  readonly entries: ReadonlyArray<{
    readonly idx: number;
    readonly version: string;
    readonly when: number;
    readonly tag: string;
    readonly breakpoints: boolean;
  }>;
}

export interface TrimmedMigratedTestDatabase extends GuardedTestDatabase {
  readonly migrationsFolder: string;
}

/**
 * Copy the `packages/database/drizzle` folder into a fresh temp directory
 * while keeping only files whose migration index is `<= maxIndex`. The
 * journal is rewritten so the migrator only considers the entries within
 * the trimmed range.
 *
 * This is the test-only mechanism that lets Gate A2 cover migration 0016
 * without accidentally applying the uncommitted Gate B migration 0017
 * that may live in the working tree.
 */
export function buildTrimmedDrizzleFolder(maxIndex: number): string {
  const tmpRoot = mkdtempSync(join(tmpdir(), `room-mgmt-drizzle-${maxIndex}-`));
  const metaDir = join(tmpRoot, 'meta');
  mkdirSync(metaDir, { recursive: true });

  for (const fileName of readdirSync(DRIZZLE_DIR)) {
    if (!/^\d{4}_.+\.sql$/.test(fileName)) continue;
    const index = Number(fileName.slice(0, 4));
    if (index > maxIndex) continue;
    copyFileSync(join(DRIZZLE_DIR, fileName), join(tmpRoot, fileName));
  }

  for (const fileName of readdirSync(META_DIR)) {
    if (!/^\d{4}_snapshot\.json$/.test(fileName)) continue;
    const index = Number(fileName.slice(0, 4));
    if (index > maxIndex) continue;
    copyFileSync(join(META_DIR, fileName), join(metaDir, fileName));
  }

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as JournalFile;
  const trimmed: JournalFile = {
    version: journal.version,
    dialect: journal.dialect,
    entries: journal.entries.filter((entry) => entry.idx <= maxIndex),
  };
  writeFileSync(
    join(metaDir, '_journal.json'),
    `${JSON.stringify(trimmed, null, 2)}\n`,
    'utf8',
  );

  return tmpRoot;
}

export function disposeTrimmedDrizzleFolder(folder: string): void {
  rmSync(folder, { recursive: true, force: true });
}

/**
 * Apply migrations from a pre-trimmed folder using the Drizzle migrator
 * directly. Bypasses the package's own `migrateDatabase` so test code can
 * pin the exact migration set applied.
 */
export async function applyMigrationsFromFolder(
  connectionString: string,
  folder: string,
): Promise<void> {
  await withDatabasePool(
    connectionString,
    async (pool) => {
      await migrate(drizzle(pool), { migrationsFolder: folder });
    },
    { max: 1, applicationName: 'room-management-test-trimmed-migrator' },
  );
}

/**
 * Convenience wrapper that combines `createGuardedTestDatabase`,
 * a trimmed Drizzle folder, and an applied migration run.
 *
 * The temp folder is registered for cleanup with the returned
 * `GuardedTestDatabase` wrapper.
 */
export async function createTrimmedMigratedTestDatabase(
  baseUrl: string,
  maxIndex: number,
): Promise<TrimmedMigratedTestDatabase> {
  const database = await createGuardedTestDatabase(baseUrl);
  const folder = buildTrimmedDrizzleFolder(maxIndex);
  try {
    await applyMigrationsFromFolder(database.databaseUrl, folder);
  } catch (error) {
    disposeTrimmedDrizzleFolder(folder);
    await database.dispose();
    throw error;
  }
  const originalDispose = database.dispose.bind(database);
  return Object.assign(database, {
    migrationsFolder: folder,
    dispose: async (): Promise<void> => {
      try {
        await originalDispose();
      } finally {
        disposeTrimmedDrizzleFolder(folder);
      }
    },
  });
}

export type TestPoolClient = PoolClient;