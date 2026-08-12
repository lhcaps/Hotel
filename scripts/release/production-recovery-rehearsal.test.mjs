import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRollbackStrategyEvidence } from './rehearse-production-recovery.mjs';

const inputs = {
  baselineId: 'recovery-baseline-20260812',
  candidateSourceSha: 'a'.repeat(40),
  legacySourceSha: 'b'.repeat(40),
  rehearsalId: 'restore-20260812',
  rehearsedAt: '2026-08-12T00:00:00.000Z',
};

test('an incompatible legacy runtime requires a verified isolated restore rehearsal', () => {
  const evidence = buildRollbackStrategyEvidence({
    ...inputs,
    legacyCompatibility: false,
    restoreRehearsal: undefined,
  });

  assert.deepEqual(evidence, {
    ...inputs,
    schemaVersion: 1,
    legacyCompatibility: false,
    strategy: 'database-restore-required',
    restoreRequired: true,
    status: 'BLOCKED_RESTORE_EVIDENCE',
  });
});

test('a verified restore rehearsal makes an incompatible rollback strategy executable', () => {
  const restoreRehearsal = {
    schemaVersion: 1,
    rehearsalId: inputs.rehearsalId,
    backupId: 'backup-20260812',
    databaseIdentity: 'isolated:rehearsal',
    isolated: true,
    restoredBytes: 1024,
    checksumVerified: true,
    migrationState: '0029',
    status: 'PASS',
    completedAt: inputs.rehearsedAt,
  };
  const evidence = buildRollbackStrategyEvidence({
    ...inputs,
    legacyCompatibility: false,
    restoreRehearsal,
  });

  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.strategy, 'database-restore-required');
  assert.equal(evidence.restoreRequired, true);
});

test('a compatible legacy runtime can retain the candidate-migrated schema', () => {
  const evidence = buildRollbackStrategyEvidence({
    ...inputs,
    legacyCompatibility: true,
  });

  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.strategy, 'application-compatible');
  assert.equal(evidence.restoreRequired, false);
});
