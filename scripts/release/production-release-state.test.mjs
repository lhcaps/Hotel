import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { executeProductionDeploy, executeProductionRollback } from './lib/release-state.mjs';

const checks = {
  manifest: true,
  sourceSha: true,
  immutableImages: true,
  compose: true,
  caddy: true,
  envSchema: true,
  requiredKeys: true,
  allowlists: true,
  migrationCompatibility: true,
  approval: true,
  recoveryBaseline: true,
  backupEvidence: true,
  restoreEvidence: true,
  databaseHealth: true,
  dockerHealth: true,
  currentTruth: true,
  rollbackTarget: true,
  recoverySnapshot: true,
  migrationProvenance: true,
  disk: true,
  topology: true,
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'room-production-release-state-'));
  const source = join(root, 'source');
  mkdirSync(source);
  writeFileSync(join(source, 'release-manifest.json'), '{}\n');
  writeFileSync(join(root, 'current'), 'legacy-release\n');
  return { root, source };
}

test('production deploy rejects missing recovery evidence before it copies a candidate or switches current', () => {
  const { root, source } = fixture();
  try {
    const result = executeProductionDeploy({
      targetRoot: root,
      releaseId: 'candidate-release',
      sourceDirectory: source,
      checks: { ...checks, recoveryBaseline: false },
    });

    assert.equal(result.status, 'FAIL');
    assert.deepEqual(result.preflight.failures, ['recoveryBaseline']);
    assert.equal(existsSync(join(root, 'releases', 'candidate-release')), false);
    assert.equal(readFileSync(join(root, 'current'), 'utf8').trim(), 'legacy-release');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production deploy performs candidate verification before one controlled current switch and attestation', () => {
  const { root, source } = fixture();
  const phases = [];
  try {
    const result = executeProductionDeploy({
      targetRoot: root,
      releaseId: 'candidate-release',
      sourceDirectory: source,
      checks,
      onStartCandidate: ({ releaseDirectory }) => {
        phases.push(`start:${releaseDirectory.endsWith('candidate-release')}`);
      },
      onVerifyCandidate: () => phases.push('verify'),
      onAttest: () => phases.push('attest'),
    });

    assert.equal(result.status, 'PASS');
    assert.deepEqual(phases, ['start:true', 'verify', 'attest']);
    assert.equal(readFileSync(join(root, 'current'), 'utf8').trim(), 'candidate-release');
    assert.equal(
      existsSync(join(root, 'releases', 'candidate-release', 'release-manifest.json')),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production rollback rejects an unproven restore path and keeps the known current release', () => {
  const { root, source } = fixture();
  try {
    executeProductionDeploy({
      targetRoot: root,
      releaseId: 'rollback-release',
      sourceDirectory: source,
      checks,
    });
    writeFileSync(join(root, 'current'), 'candidate-release\n');

    const result = executeProductionRollback({
      targetRoot: root,
      targetReleaseId: 'rollback-release',
      checks: { ...checks, restoreEvidence: false },
    });

    assert.equal(result.status, 'FAIL');
    assert.equal(readFileSync(join(root, 'current'), 'utf8').trim(), 'candidate-release');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production deploy delegates the current pointer to the host adapter and restores it on attestation failure', () => {
  const { root, source } = fixture();
  let currentPointer = '/opt/room-management/releases/legacy-release';
  const switchedTo = [];
  try {
    const result = executeProductionDeploy({
      targetRoot: root,
      releaseId: 'candidate-release',
      sourceDirectory: source,
      checks,
      readCurrentPointer: () => currentPointer,
      switchCurrentPointer: ({ releaseDirectory }) => {
        switchedTo.push(releaseDirectory);
        currentPointer = releaseDirectory;
      },
      restoreCurrentPointer: ({ previousPointer }) => {
        currentPointer = previousPointer;
      },
      onAttest: () => false,
    });

    assert.equal(result.status, 'FAIL');
    assert.equal(switchedTo.length, 1);
    assert.equal(currentPointer, '/opt/room-management/releases/legacy-release');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production deploy invokes full-topology recovery after a candidate failure', () => {
  const { root, source } = fixture();
  let recovery = false;
  try {
    const result = executeProductionDeploy({
      targetRoot: root,
      releaseId: 'candidate-release',
      sourceDirectory: source,
      checks,
      onVerifyCandidate: () => false,
      onRecoverFailure: ({ previousPointer }) => {
        recovery = previousPointer === 'legacy-release';
      },
    });

    assert.equal(result.status, 'FAIL');
    assert.equal(recovery, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production rollback accepts an explicit recovery-baseline directory without guessing release order', () => {
  const { root, source } = fixture();
  const recoveryDirectory = join(root, 'legacy-baseline');
  let switched;
  try {
    mkdirSync(recoveryDirectory);
    writeFileSync(join(root, 'current'), 'candidate-release\n');
    const result = executeProductionRollback({
      targetRoot: root,
      targetReleaseId: 'recovery-baseline',
      targetDirectory: recoveryDirectory,
      checks,
      switchCurrentPointer: ({ releaseDirectory }) => {
        switched = releaseDirectory;
      },
    });

    assert.equal(result.status, 'PASS');
    assert.equal(switched, recoveryDirectory);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production rollback invokes recovery after its target topology fails verification', () => {
  const { root, source } = fixture();
  let recovered = false;
  try {
    executeProductionDeploy({
      targetRoot: root,
      releaseId: 'rollback-release',
      sourceDirectory: source,
      checks,
    });
    writeFileSync(join(root, 'current'), 'candidate-release\n');

    const result = executeProductionRollback({
      targetRoot: root,
      targetReleaseId: 'rollback-release',
      checks,
      onVerifyCandidate: () => false,
      onRecoverFailure: ({ previousPointer }) => {
        recovered = previousPointer === 'candidate-release';
      },
    });

    assert.equal(result.status, 'FAIL');
    assert.equal(recovered, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
