import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRollbackStrategy } from './lib/production-recovery.mjs';

test('application-compatible rollback can retain the migrated schema', () => {
  assert.deepEqual(evaluateRollbackStrategy({ legacyCompatibility: true }), {
    ok: true,
    strategy: 'application-compatible',
    restoreRequired: false,
  });
});

test('migration-incompatible rollback fails closed without validated restore evidence', () => {
  assert.deepEqual(evaluateRollbackStrategy({ legacyCompatibility: false }), {
    ok: false,
    strategy: 'database-restore-required',
    restoreRequired: true,
  });
});

test('migration-incompatible rollback becomes eligible only after validated restore evidence', () => {
  assert.deepEqual(
    evaluateRollbackStrategy({ legacyCompatibility: false, restoreEvidenceValid: true }),
    { ok: true, strategy: 'database-restore-required', restoreRequired: true },
  );
});
