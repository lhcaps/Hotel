import assert from 'node:assert/strict';
import test from 'node:test';

import {
  productionPreflightChecks,
  validateBackupEvidence,
  validateProductionApproval,
  validateRecoveryBaseline,
  validateRollbackStrategy,
  validateRestoreRehearsal,
} from './lib/production-policy.mjs';

const sourceSha = 'a'.repeat(40);
const approvalId = 'APPROVE_OPERATIONS_V3_PRODUCTION_RELEASE_RECONCILIATION_AND_CANARY';
const manifest = { sourceSha };

function approval(overrides = {}) {
  return {
    approvalId,
    target: 'production',
    approvedSourceSha: sourceSha,
    scope: 'OPERATIONS_V3_PRODUCTION_RELEASE_RECONCILIATION_AND_CANARY',
    approvedAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}

function recoveryBaseline(overrides = {}) {
  return {
    schemaVersion: 1,
    baselineId: 'legacy-production-20260812',
    canonical: false,
    mixed: true,
    project: 'room-management',
    capturedAt: '2026-08-12T00:00:00.000Z',
    currentPointer: '/opt/room-management/releases/4fb79a023209c349cff5c74caec626556459ae67',
    services: {
      api: {
        containerName: 'room-management-api-1',
        imageId: `sha256:${'1'.repeat(64)}`,
        revision: '4'.repeat(40),
        restartCount: 0,
      },
      worker: {
        containerName: 'room-management-worker-1',
        imageId: `sha256:${'2'.repeat(64)}`,
        revision: '8'.repeat(40),
        restartCount: 0,
      },
    },
    composeIdentity: 'c'.repeat(64),
    caddyIdentity: 'd'.repeat(64),
    composeFile: '/opt/room-management/staging/docker-compose.production.yml',
    caddyFile: '/opt/room-management/staging/deploy/Caddyfile',
    composeEnvironmentFile: '/opt/room-management/staging/deploy/.env.production',
    migrationState: '0029_operations_v3_pricing_policy_release.sql',
    environmentFileHashes: {
      compose: 'e'.repeat(64),
      api: 'e'.repeat(64),
      worker: 'f'.repeat(64),
    },
    databaseIdentity: 'postgres:room-management-postgres-1',
    recovery: {
      composeFile: '/opt/room-management/evidence/runtime-snapshot/docker-compose.production.yml',
      caddyFile: '/opt/room-management/evidence/runtime-snapshot/deploy/Caddyfile',
      composeEnvironmentFile: '/opt/room-management/evidence/runtime-snapshot/compose.env',
      overrideFile: '/opt/room-management/evidence/runtime-snapshot/baseline-images.override.yml',
      composeIdentity: 'c'.repeat(64),
      caddyIdentity: 'd'.repeat(64),
      composeEnvironmentIdentity: 'e'.repeat(64),
      overrideIdentity: 'f'.repeat(64),
    },
    ...overrides,
  };
}

function backupEvidence(overrides = {}) {
  return {
    schemaVersion: 1,
    backupId: 'room-management-20260812',
    path: '/var/backups/room-management-20260812.dump',
    createdAt: '2026-08-12T00:00:00.000Z',
    databaseIdentity: 'postgres:room-management-postgres-1',
    bytes: 1024,
    sha256: 'b'.repeat(64),
    verified: true,
    restoreRehearsalId: 'restore-20260812',
    ...overrides,
  };
}

function restoreRehearsal(overrides = {}) {
  return {
    schemaVersion: 1,
    rehearsalId: 'restore-20260812',
    backupId: 'room-management-20260812',
    databaseIdentity: 'postgres:room-management-postgres-1',
    isolated: true,
    restoredBytes: 1024,
    checksumVerified: true,
    migrationState: '0029_operations_v3_pricing_policy_release.sql',
    status: 'PASS',
    completedAt: '2026-08-12T00:10:00.000Z',
    ...overrides,
  };
}

test('production approval binds target, scope, fixed approval ID, and exact source SHA', () => {
  assert.equal(
    validateProductionApproval({ approval: approval(), manifest, expectedApprovalId: approvalId }),
    true,
  );
  assert.throws(
    () =>
      validateProductionApproval({
        approval: approval({ approvedSourceSha: 'b'.repeat(40) }),
        manifest,
        expectedApprovalId: approvalId,
      }),
    /source SHA/i,
  );
  assert.throws(
    () =>
      validateProductionApproval({
        approval: approval({ target: 'isolated' }),
        manifest,
        expectedApprovalId: approvalId,
      }),
    /target/i,
  );
});

test('recovery baseline is explicitly mixed, non-canonical, and complete enough for deterministic recovery', () => {
  assert.equal(validateRecoveryBaseline(recoveryBaseline()), true);
  assert.throws(
    () => validateRecoveryBaseline(recoveryBaseline({ canonical: true })),
    /canonical=false/i,
  );
  assert.throws(
    () => validateRecoveryBaseline(recoveryBaseline({ environmentFileHashes: {} })),
    /environment.*hash/i,
  );
  assert.throws(
    () => validateRecoveryBaseline(recoveryBaseline({ composeFile: '' })),
    /Compose file/i,
  );
  assert.throws(
    () =>
      validateRecoveryBaseline(
        recoveryBaseline({ environmentFileHashes: { api: 'e'.repeat(64) } }),
      ),
    /Compose environment hash/i,
  );
  assert.throws(() => validateRecoveryBaseline(recoveryBaseline({ services: {} })), /service/i);
});

test('backup and restore evidence reject missing verification, empty data, and production restore targets', () => {
  assert.equal(validateBackupEvidence(backupEvidence()), true);
  assert.equal(validateRestoreRehearsal(restoreRehearsal(), backupEvidence()), true);
  assert.throws(() => validateBackupEvidence(backupEvidence({ bytes: 0 })), /non-zero/i);
  assert.throws(() => validateBackupEvidence(backupEvidence({ verified: false })), /verified/i);
  assert.throws(
    () => validateRestoreRehearsal(restoreRehearsal({ isolated: false }), backupEvidence()),
    /isolated/i,
  );
});

test('production preflight has no implicit pass for missing safety evidence', () => {
  const checks = productionPreflightChecks({
    approval: approval(),
    manifest,
    expectedApprovalId: approvalId,
    recoveryBaseline: recoveryBaseline(),
    backup: backupEvidence(),
    restoreRehearsal: undefined,
    databaseHealth: true,
    dockerHealth: true,
    currentTruth: true,
    rollbackTarget: true,
    migrationProvenance: true,
  });

  assert.equal(checks.approval, true);
  assert.equal(checks.recoveryBaseline, true);
  assert.equal(checks.backupEvidence, true);
  assert.equal(checks.restoreEvidence, false);
  assert.equal(checks.databaseHealth, true);
  assert.equal(checks.dockerHealth, true);
  assert.equal(checks.rollbackTarget, true);
  assert.equal(checks.rollbackStrategy, false);
});

test('rollback strategy binds the legacy baseline and candidate source before permitting deployment', () => {
  const baseline = recoveryBaseline();
  const strategy = {
    schemaVersion: 1,
    baselineId: baseline.baselineId,
    candidateSourceSha: sourceSha,
    legacyCompatibility: true,
    strategy: 'application-compatible',
    restoreRequired: false,
    status: 'PASS',
    rehearsedAt: '2026-08-12T00:20:00.000Z',
  };
  assert.equal(
    validateRollbackStrategy({ strategy, baseline, manifest, restoreRehearsal: undefined }),
    true,
  );
  assert.throws(
    () =>
      validateRollbackStrategy({
        strategy: { ...strategy, candidateSourceSha: 'b'.repeat(40) },
        baseline,
        manifest,
      }),
    /candidate source SHA/i,
  );
  assert.throws(
    () =>
      validateRollbackStrategy({
        strategy: { ...strategy, legacyCompatibility: false, strategy: 'application-compatible' },
        baseline,
        manifest,
      }),
    /database-restore-required/i,
  );
});
