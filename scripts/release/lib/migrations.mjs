import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertPlainObject, canonicalJson, readJsonFile, sha256 } from './canonical.mjs';

function migrationDirectory(repositoryRoot) {
  return join(repositoryRoot, 'packages', 'database', 'drizzle');
}

export function deriveMigrationSet(repositoryRoot) {
  const directory = migrationDirectory(repositoryRoot);
  const provenance = readJsonFile(
    join(directory, 'migration-provenance.json'),
    'migration provenance manifest',
  );
  const journal = readJsonFile(join(directory, 'meta', '_journal.json'), 'migration journal');
  assertPlainObject(provenance, 'Migration provenance manifest');
  assertPlainObject(journal, 'Migration journal');

  if (!Array.isArray(provenance.entries) || provenance.entries.length === 0) {
    throw new Error('Migration provenance manifest must contain at least one entry.');
  }
  if (!Array.isArray(journal.entries)) {
    throw new Error('Migration journal must contain entries.');
  }
  if (journal.entries.length !== provenance.entries.length) {
    throw new Error('Migration journal and provenance manifest have different entry counts.');
  }

  const entries = provenance.entries.map((entry, index) => {
    assertPlainObject(entry, `Migration provenance entry ${index}`);
    if (
      entry.index !== index ||
      typeof entry.fileName !== 'string' ||
      typeof entry.sha256 !== 'string'
    ) {
      throw new Error(`Migration provenance entry ${index} is malformed.`);
    }
    if (!/^\d{4}_[a-z0-9_]+\.sql$/iu.test(entry.fileName)) {
      throw new Error(`Migration provenance entry ${index} has an invalid file name.`);
    }
    const actualHash = sha256(readFileSync(join(directory, entry.fileName)));
    if (actualHash !== entry.sha256) {
      throw new Error(`Migration provenance mismatch for ${entry.fileName}.`);
    }
    const journalEntry = journal.entries[index];
    const expectedTag = entry.fileName.slice(0, -'.sql'.length);
    if (journalEntry?.idx !== index || journalEntry?.tag !== expectedTag) {
      throw new Error(`Migration journal mismatch for ${entry.fileName}.`);
    }
    return { index, fileName: entry.fileName, sha256: actualHash };
  });

  return {
    latest: entries.at(-1).fileName,
    aggregateSha256: sha256(canonicalJson(entries)),
    rollbackCompatibleWith: [],
  };
}
