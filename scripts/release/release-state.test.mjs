import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  executeIsolatedDeploy,
  executeIsolatedRollback,
  preflightRelease,
} from './lib/release-state.mjs';

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
  backupEvidence: true,
  disk: true,
  currentTruth: true,
  previousRollback: true,
  topology: true,
  dnsHost: true,
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'room-release-state-'));
  const source = join(root, 'source');
  mkdirSync(source);
  writeFileSync(join(source, 'release-manifest.json'), '{}\n');
  return { root, source };
}
test('preflight rejects every failed governed prerequisite before mutation', () => {
  const result = preflightRelease({
    checks: { ...checks, immutableImages: false, topology: false },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ['immutableImages', 'topology']);
});
test('isolated deploy restores the previous pointer after candidate or switch failure', () => {
  const { root, source } = fixture();
  try {
    const first = executeIsolatedDeploy({
      targetRoot: root,
      releaseId: 'release-a',
      sourceDirectory: source,
      checks,
    });
    assert.equal(first.status, 'PASS');
    const second = executeIsolatedDeploy({
      targetRoot: root,
      releaseId: 'release-b',
      sourceDirectory: source,
      checks,
      fault: 'SWITCH_CURRENT',
    });
    assert.equal(second.status, 'FAIL');
    assert.equal(readFileSync(join(root, 'current'), 'utf8').trim(), 'release-a');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('rollback rejects a missing target and restores the complete known release', () => {
  const { root, source } = fixture();
  try {
    executeIsolatedDeploy({
      targetRoot: root,
      releaseId: 'release-a',
      sourceDirectory: source,
      checks,
    });
    executeIsolatedDeploy({
      targetRoot: root,
      releaseId: 'release-b',
      sourceDirectory: source,
      checks,
    });
    assert.equal(
      executeIsolatedRollback({ targetRoot: root, targetReleaseId: 'missing', checks }).status,
      'FAIL',
    );
    assert.equal(
      executeIsolatedRollback({ targetRoot: root, targetReleaseId: 'release-a', checks }).status,
      'PASS',
    );
    assert.equal(readFileSync(join(root, 'current'), 'utf8').trim(), 'release-a');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
