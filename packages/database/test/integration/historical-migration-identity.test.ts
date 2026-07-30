/**
 * Phase 1 durable migration provenance proof.
 *
 * The published repository is squashed into a single clean root commit, so the
 * historical ancestry used by the legacy test cannot be relied upon any more.
 * Migration provenance is now encoded in
 * `packages/database/drizzle/migration-provenance.json`. This test asserts
 * durable invariants without consulting git ancestry:
 *
 *   1. The released migration .sql files match the journal one-to-one and in
 *      monotonic order.
 *   2. Migration ordering is monotonic; duplicate indices are forbidden.
 *   3. Every released migration has a provenance entry.
 *   4. The SHA-256 of each released migration SQL equals the manifest hash.
 *      Released SQL may not be modified.
 *   5. Older phase-commit references recorded on the manifest are
 *      informational only and need not exist in the current Git ancestry.
 *
 * Refresh policy: the authoritative refresh script
 * (`scripts/database/refresh-migration-provenance.ts`) MUST refuse to rewrite
 * existing entries unless the `--allow-rewrite-released` flag is supplied.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DRIZZLE_DIR = resolve(import.meta.dirname, '..', '..', 'drizzle');
const PROVENANCE_PATH = resolve(DRIZZLE_DIR, 'migration-provenance.json');

interface ProvenanceEntry {
  readonly index: number;
  readonly fileName: string;
  readonly sha256: string;
  readonly phase: string;
  readonly previousIntroductionReference: string | null;
}

interface ProvenanceManifest {
  readonly version: number;
  readonly entries: readonly ProvenanceEntry[];
}

function loadManifest(): ProvenanceManifest {
  const raw = readFileSync(PROVENANCE_PATH, 'utf8');
  return JSON.parse(raw) as ProvenanceManifest;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function loadJournal(): readonly { idx: number; tag: string }[] {
  const raw = readFileSync(resolve(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8');
  const parsed = JSON.parse(raw) as { entries: readonly { idx: number; tag: string }[] };
  return parsed.entries.map((entry) => ({ idx: entry.idx, tag: entry.tag }));
}

function listMigrationFiles(): readonly string[] {
  return readdirSync(DRIZZLE_DIR)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

describe('migration provenance (durable manifest)', () => {
  const manifest = loadManifest();
  const journal = loadJournal();
  const releasedFiles = listMigrationFiles();

  it('contains a manifest entry for every released migration .sql file', () => {
    const manifestFiles = new Set(manifest.entries.map((entry) => entry.fileName));
    for (const fileName of releasedFiles) {
      expect(manifestFiles.has(fileName)).toBe(true);
    }
  });

  it('contains a journal entry for every released migration .sql file', () => {
    const journalTags = new Set(journal.map((entry) => entry.tag));
    for (const fileName of releasedFiles) {
      const prefix = fileName.slice(0, 4);
      const tag = `${prefix}_${fileName.slice(5).replace(/\.sql$/u, '')}`;
      expect(journalTags.has(tag)).toBe(true);
    }
  });

  it('has monotonic indices and no duplicate indices in the manifest', () => {
    const seen = new Set<number>();
    let previous = -1;
    for (const entry of manifest.entries) {
      expect(entry.index).toBeGreaterThan(previous);
      expect(seen.has(entry.index)).toBe(false);
      seen.add(entry.index);
      previous = entry.index;
    }
  });

  it('releases every journal entry as a manifest entry (1:1)', () => {
    const manifestIndices = new Set(manifest.entries.map((entry) => entry.index));
    for (const journalEntry of journal) {
      expect(manifestIndices.has(journalEntry.idx)).toBe(true);
    }
  });

  it('matches the journal tag with the fileName basename', () => {
    for (const journalEntry of journal) {
      const expectedSuffix = `${journalEntry.idx.toString().padStart(4, '0')}_${journalEntry.tag
        .split('_')
        .slice(1)
        .join('_')}.sql`;
      const entry = manifest.entries.find((row) => row.index === journalEntry.idx);
      expect(entry).toBeDefined();
      expect(entry?.fileName).toBe(expectedSuffix);
    }
  });

  it.each(
    manifest.entries.map((entry) => ({
      index: entry.index,
      fileName: entry.fileName,
      sha256: entry.sha256,
    })),
  )('migration $fileName (index $index) SHA-256 matches manifest', ({ fileName, sha256 }) => {
    const fullPath = resolve(DRIZZLE_DIR, fileName);
    const content = readFileSync(fullPath, 'utf8');
    expect(sha256(content)).toBe(sha256);
  });

  it('each informational previousIntroductionReference is recorded as metadata only', () => {
    for (const entry of manifest.entries) {
      // Reference is informational and may be missing in squashed ancestry.
      // The test enforces only the structural field.
      expect(['string', 'object']).toContain(typeof entry.previousIntroductionReference);
    }
  });
});
