import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createBackupEvidence } from './create-backup-evidence.mjs';

test('backup evidence records verified non-secret metadata for a non-empty dump', async () => {
  const root = mkdtempSync(join(tmpdir(), 'room-backup-evidence-'));
  const dump = join(root, 'backup.dump');
  try {
    writeFileSync(dump, 'synthetic-postgres-dump', 'utf8');
    const result = await createBackupEvidence({
      backupPath: dump,
      backupId: 'backup-20260812',
      databaseIdentity: 'postgres:room-management-postgres-1',
      restoreRehearsalId: 'restore-20260812',
      createdAt: '2026-08-12T00:00:00.000Z',
    });
    assert.equal(result.verified, true);
    assert.equal(result.bytes, 23);
    assert.equal(
      result.sha256,
      createHash('sha256').update('synthetic-postgres-dump').digest('hex'),
    );
    assert.equal(JSON.stringify(result).includes('synthetic-postgres-dump'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('backup evidence rejects a missing or zero-byte dump', async () => {
  const root = mkdtempSync(join(tmpdir(), 'room-backup-evidence-empty-'));
  const dump = join(root, 'empty.dump');
  try {
    writeFileSync(dump, '', 'utf8');
    await assert.rejects(
      () =>
        createBackupEvidence({
          backupPath: dump,
          backupId: 'backup-20260812',
          databaseIdentity: 'postgres:room-management-postgres-1',
          restoreRehearsalId: 'restore-20260812',
        }),
      /non-zero/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
