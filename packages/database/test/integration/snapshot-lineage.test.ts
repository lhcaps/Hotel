/**
 * Snapshot lineage invariants for migrations 0010, 0011, 0012, 0013, 0014,
 * 0015, 0016, and 0019.
 *
 * - 0010_snapshot.json has a unique `id` distinct from every prior
 *   snapshot;
 * - 0010_snapshot.json `prevId` equals 0009_snapshot.json `id`;
 * - 0010_snapshot.json body is identical to 0009_snapshot.json body
 *   (modulo the id/prevId fields);
 * - 0016_snapshot.json `prevId` equals 0015_snapshot.json `id`;
 * - meta/_journal.json contains exactly one entry for idx 10..16 and
 *   no other unexpected entries.
 *
 * The Phase 8D closure locks the snapshot lineage through 0019.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTrimmedMigratedTestDatabase,
  type TrimmedMigratedTestDatabase,
} from './migration-folder.js';

const META_DIR = resolve(import.meta.dirname, '..', '..', 'drizzle', 'meta');
const JOURNAL_PATH = resolve(META_DIR, '_journal.json');

interface SnapshotShape {
  readonly id: string;
  readonly prevId: string;
  readonly body: string;
}

interface Journal {
  readonly entries: ReadonlyArray<{ readonly idx: number; readonly tag: string }>;
}

function loadSnapshot(name: string): SnapshotShape {
  const raw = JSON.parse(readFileSync(resolve(META_DIR, name), 'utf8')) as Record<string, unknown>;
  const id = raw['id'];
  const prevId = raw['prevId'];
  if (typeof id !== 'string' || typeof prevId !== 'string') {
    throw new Error(`Snapshot ${name} is missing string id/prevId fields`);
  }
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'id' || key === 'prevId') continue;
    body[key] = value;
  }
  const sortedKeys = Object.keys(body).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    normalized[key] = body[key];
  }
  return { id, prevId, body: JSON.stringify(normalized) };
}

function loadJournal(): Journal {
  const raw = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as { entries?: unknown };
  const entries = raw.entries;
  if (!Array.isArray(entries)) {
    throw new Error('journal is missing an entries array');
  }
  const normalized: Array<{ idx: number; tag: string }> = [];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('journal entry is not an object');
    }
    const idx = (entry as { idx?: unknown }).idx;
    const tag = (entry as { tag?: unknown }).tag;
    if (typeof idx !== 'number' || typeof tag !== 'string') {
      throw new Error('journal entry has invalid idx/tag');
    }
    normalized.push({ idx, tag });
  }
  return { entries: normalized };
}

describe('snapshot lineage invariants', () => {
  it('0010 has a unique id distinct from every prior snapshot', () => {
    const snapshot0010 = loadSnapshot('0010_snapshot.json');
    const snapshotIds = readdirSync(META_DIR)
      .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
      .map((name) => loadSnapshot(name).id);
    const duplicates = snapshotIds.filter((id) => id === snapshot0010.id);
    expect(duplicates.length).toBe(1);
  });

  it('0010 prevId equals 0009 id', () => {
    const snapshot0009 = loadSnapshot('0009_snapshot.json');
    const snapshot0010 = loadSnapshot('0010_snapshot.json');
    expect(snapshot0010.prevId).toBe(snapshot0009.id);
  });

  it('0010 declarative body is identical to 0009 body', () => {
    const snapshot0009 = loadSnapshot('0009_snapshot.json');
    const snapshot0010 = loadSnapshot('0010_snapshot.json');
    expect(snapshot0010.body).toBe(snapshot0009.body);
  });

  it('0016 prevId equals 0015 id', () => {
    const snapshot0015 = loadSnapshot('0015_snapshot.json');
    const snapshot0016 = loadSnapshot('0016_snapshot.json');
    expect(snapshot0016.prevId).toBe(snapshot0015.id);
  });

  it('0016 has a unique id distinct from every other snapshot', () => {
    const snapshot0016 = loadSnapshot('0016_snapshot.json');
    const snapshotIds = readdirSync(META_DIR)
      .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
      .map((name) => loadSnapshot(name).id);
    const duplicates = snapshotIds.filter((id) => id === snapshot0016.id);
    expect(duplicates.length).toBe(1);
  });

  it('0019 prevId equals 0018 id and is unique', () => {
    const snapshot0018 = loadSnapshot('0018_snapshot.json');
    const snapshot0019 = loadSnapshot('0019_snapshot.json');
    expect(snapshot0019.prevId).toBe(snapshot0018.id);
    const duplicates = readdirSync(META_DIR)
      .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
      .map((name) => loadSnapshot(name).id)
      .filter((id) => id === snapshot0019.id);
    expect(duplicates).toHaveLength(1);
  });

  it('journal contains exactly one entry for idx 10 through 16', () => {
    const journal = loadJournal();
    const tagsAtIdx10 = journal.entries.filter((entry) => entry.idx === 10);
    expect(tagsAtIdx10.length).toBe(1);
    expect(tagsAtIdx10[0]?.tag).toBe('0010_phase6_coupon_reference_closure');
    const tagsAtIdx11 = journal.entries.filter((entry) => entry.idx === 11);
    expect(tagsAtIdx11.length).toBe(1);
    expect(tagsAtIdx11[0]?.tag).toBe('0011_phase7b_data_driven_pricing');
    const tagsAtIdx12 = journal.entries.filter((entry) => entry.idx === 12);
    expect(tagsAtIdx12.length).toBe(1);
    const tagsAtIdx13 = journal.entries.filter((entry) => entry.idx === 13);
    expect(tagsAtIdx13.length).toBe(1);
    const tagsAtIdx14 = journal.entries.filter((entry) => entry.idx === 14);
    expect(tagsAtIdx14.length).toBe(1);
    expect(tagsAtIdx14[0]?.tag).toBe('0014_phase7f_google_customer_identity');
    const tagsAtIdx15 = journal.entries.filter((entry) => entry.idx === 15);
    expect(tagsAtIdx15.length).toBe(1);
    expect(tagsAtIdx15[0]?.tag).toBe('0015_phase7g_admin_booking_operations');
    const tagsAtIdx16 = journal.entries.filter((entry) => entry.idx === 16);
    expect(tagsAtIdx16.length).toBe(1);
    expect(tagsAtIdx16[0]?.tag).toBe('0016_workable_captain_cross');
    const tagsAtIdx19 = journal.entries.filter((entry) => entry.idx === 19);
    expect(tagsAtIdx19).toEqual([{ idx: 19, tag: '0019_phase8d_coupon_delivery' }]);
  });

  it('every journal entry has a matching snapshot file', () => {
    const journal = loadJournal();
    const snapshotFiles = new Set(
      readdirSync(META_DIR).filter((name) => /^\d{4}_snapshot\.json$/.test(name)),
    );
    for (const entry of journal.entries) {
      const prefixMatch = /^(\d{4})_/.exec(entry.tag);
      if (prefixMatch === null) {
        throw new Error(`Journal tag missing 4-digit prefix: ${entry.tag}`);
      }
      const filename = `${prefixMatch[1]}_snapshot.json`;
      expect(snapshotFiles.has(filename)).toBe(true);
    }
  });
});

describe('snapshot lineage invariants — Phase 8B1 fresh migration (0016 boundary)', () => {
  let database: TrimmedMigratedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createTrimmedMigratedTestDatabase(baseUrl, 16);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('migration runner brings schema_version forward to phase-8b1-pricing-product-vertical-v1', async () => {
    const version = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    expect(version.rows[0]?.schema_version).toBe('phase-8b1-pricing-product-vertical-v1');
  });
});

describe('Phase 8B1 migration 0016 — boundary schema invariants', () => {
  let database: TrimmedMigratedTestDatabase;

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) {
      throw new Error('TEST_DATABASE_URL is required for database integration tests');
    }
    database = await createTrimmedMigratedTestDatabase(baseUrl, 16);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('upgrades schema_metadata to phase-8b1-pricing-product-vertical-v1 on a fresh empty database', async () => {
    const version = await database.pool.query<{ schema_version: string }>(
      `SELECT schema_version FROM schema_metadata WHERE id = 1`,
    );
    expect(version.rows[0]?.schema_version).toBe('phase-8b1-pricing-product-vertical-v1');
  });

  it('installs rate_plans_code_format_ck and removes rate_plans_code_ck', async () => {
    const constraints = await database.pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'rate_plans'::regclass
          AND contype = 'c'
          AND conname IN ('rate_plans_code_format_ck', 'rate_plans_code_ck')`,
    );
    const names = constraints.rows.map((row) => row.conname).sort();
    expect(names).toEqual(['rate_plans_code_format_ck']);
  });

  it('rate_plans_code_format_ck rejects lowercase codes', async () => {
    let caught: unknown;
    try {
      await database.pool.query(
        `INSERT INTO rate_plans
           (property_id, code, name, included_duration_minutes, priority)
         VALUES ('00000000-0000-4000-8000-000000009901',
                 'six_hour_flex',
                 'Lowercase plan code',
                 360, 10)`,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as { code?: string } | null)?.code).toBe('23514');
  });

  it('rate_plans_code_format_ck accepts uppercase SIX_HOUR_FLEX', async () => {
    await database.pool.query(
      `INSERT INTO properties
         (id, code, name, timezone, status)
       VALUES ('00000000-0000-4000-8000-000000009911',
               'P_SIX_HOUR_FLEX', 'Six Hour Flex Property',
               'Asia/Ho_Chi_Minh', 'ACTIVE')
       ON CONFLICT DO NOTHING`,
    );
    await database.pool.query(
      `INSERT INTO rate_plans
         (property_id, code, name,
          included_duration_minutes, priority,
          min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES ('00000000-0000-4000-8000-000000009911',
               'SIX_HOUR_FLEX', 'Six hour flex combo',
               360, 10,
               360, 360)`,
    );
    const rows = await database.pool.query<{ code: string }>(
      `SELECT code FROM rate_plans
        WHERE code = 'SIX_HOUR_FLEX'
          AND property_id = '00000000-0000-4000-8000-000000009911'`,
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0]?.code).toBe('SIX_HOUR_FLEX');
  });
});
