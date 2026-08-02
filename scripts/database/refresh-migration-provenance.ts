/**
 * Refresh the migration-provenance manifest with the SHA-256 of every
 * released migration SQL file.
 *
 * Defaults: refuse to rewrite hashes that have already been recorded for a
 * released migration. Without `--allow-rewrite-released`, the script only
 * adds new entries; existing entries are left untouched.
 *
 * Use this script when intentionally releasing a new forward migration.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const drizzleDir = resolve(repoRoot, 'packages', 'database', 'drizzle');
const manifestPath = resolve(drizzleDir, 'migration-provenance.json');

interface ProvenanceEntry {
  index: number;
  fileName: string;
  sha256: string;
  phase: string;
  previousIntroductionReference: string | null;
}

interface ProvenanceManifest {
  version: number;
  entries: ProvenanceEntry[];
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function listMigrationFiles(): readonly string[] {
  return readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function loadManifest(): ProvenanceManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ProvenanceManifest;
}

function saveManifest(manifest: ProvenanceManifest): void {
  const serialised = JSON.stringify(manifest, null, 2) + '\n';
  writeFileSync(manifestPath, serialised, 'utf8');
}

function refresh(): void {
  const allowRewriteReleased = process.argv.includes('--allow-rewrite-released');
  const manifest = loadManifest();
  const existingByFile = new Map(manifest.entries.map((entry) => [entry.fileName, entry]));
  const released = listMigrationFiles();

  for (const fileName of released) {
    const content = readFileSync(resolve(drizzleDir, fileName), 'utf8');
    const hash = sha256(content);
    const existing = existingByFile.get(fileName);
    if (existing !== undefined) {
      if (existing.sha256 !== hash && !allowRewriteReleased) {
        console.error(
          `[refresh-migration-provenance] ${fileName} hash mismatch (recorded=${existing.sha256}, current=${hash}). Refusing to rewrite; pass --allow-rewrite-released to acknowledge.`,
        );
        process.exit(2);
      }
      existing.sha256 = hash;
    } else {
      const prefix = fileName.slice(0, 4);
      manifest.entries.push({
        index: Number(prefix),
        fileName,
        sha256: hash,
        phase: 'uncategorized',
        previousIntroductionReference: null,
      });
    }
  }
  manifest.entries.sort((a, b) => a.index - b.index);
  saveManifest(manifest);
  console.log(
    `[refresh-migration-provenance] Wrote ${manifest.entries.length} entries to ${manifestPath}.`,
  );
}

refresh();
