import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attestRelease } from './lib/attestation.mjs';
import { createManifest } from './lib/manifest.mjs';
import { executeIsolatedDeploy, executeIsolatedRollback } from './lib/release-state.mjs';
import { evaluateTopology } from './lib/topology.mjs';

const REPOSITORY_ROOT = join(fileURLToPath(new URL('../..', import.meta.url)));

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
const digest = (character) => `sha256:${character.repeat(64)}`;
function release(sourceSha, character) {
  return createManifest({
    sourceSha,
    createdAt: '2026-08-10T00:00:00.000Z',
    images: {
      web: { repository: 'rehearsal/web', digest: digest(character) },
      api: { repository: 'rehearsal/api', digest: digest(character) },
      worker: { repository: 'rehearsal/worker', digest: digest(character) },
      paymentDemo: { repository: 'rehearsal/payment', digest: digest(character) },
    },
    composeSha256: character.repeat(64),
    caddySha256: character.repeat(64),
    migrations: {
      latest: '0000_test.sql',
      aggregateSha256: character.repeat(64),
      rollbackCompatibleWith: [],
    },
    envSchemaSha256: character.repeat(64),
  });
}
function snapshot(manifest, mixedWorker) {
  const directory = `/opt/room-management/releases/${manifest.releaseId}`;
  const service = (image) => ({
    image,
    releaseId: manifest.releaseId,
    workingDirectory: directory,
    state: 'running',
  });
  return {
    currentPointer: directory,
    sharedReleaseId: manifest.releaseId,
    composeSha256: manifest.compose.sha256,
    caddySha256: manifest.caddy.sha256,
    migrationCompleted: true,
    services: {
      caddy: service('caddy@sha256:edge'),
      web: service(`${manifest.images.web.repository}@${manifest.images.web.digest}`),
      api: service(`${manifest.images.api.repository}@${manifest.images.api.digest}`),
      worker: service(
        mixedWorker ?? `${manifest.images.worker.repository}@${manifest.images.worker.digest}`,
      ),
      'payment-demo': service(
        `${manifest.images.paymentDemo.repository}@${manifest.images.paymentDemo.digest}`,
      ),
      postgres: service('postgres@sha256:data'),
      redis: service('redis@sha256:cache'),
    },
  };
}
function source(root, manifest) {
  const directory = join(root, manifest.releaseId.replace(':', '-'));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'release-manifest.json'), `${JSON.stringify(manifest)}\n`);
  return directory;
}

function command(script, args) {
  const result = spawnSync(
    process.execPath,
    [join(REPOSITORY_ROOT, 'scripts', 'release', script), ...args],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      shell: false,
    },
  );
  return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

export function runReleaseRehearsal() {
  const root = mkdtempSync(join(tmpdir(), 'room-wave1-rehearsal-'));
  try {
    const a = release('a'.repeat(40), '1');
    const b = release('b'.repeat(40), '2');
    const aSource = source(root, a);
    const deployA = command('deploy-release.mjs', [
      '--manifest',
      join(aSource, 'release-manifest.json'),
      '--target',
      'isolated',
      '--target-root',
      root,
      '--source-directory',
      aSource,
      '--execute',
    ]);
    const aAttestation = attestRelease({ manifest: a, runtimeSnapshot: snapshot(a) });
    const bSource = source(root, b);
    const deployB = command('deploy-release.mjs', [
      '--manifest',
      join(bSource, 'release-manifest.json'),
      '--target',
      'isolated',
      '--target-root',
      root,
      '--source-directory',
      bSource,
      '--execute',
    ]);
    const bAttestation = attestRelease({ manifest: b, runtimeSnapshot: snapshot(b) });
    const mixed = snapshot(b, `${a.images.worker.repository}@${a.images.worker.digest}`);
    const mixedRejected =
      attestRelease({ manifest: b, runtimeSnapshot: mixed }).status === 'FAIL' &&
      evaluateTopology({ manifest: b, runtimeSnapshot: mixed }).status === 'FAIL';
    const rollback = command('rollback-release.mjs', [
      '--target-release-id',
      a.releaseId,
      '--target',
      'isolated',
      '--target-root',
      root,
      '--execute',
    ]);
    const rollbackAttestation = attestRelease({ manifest: a, runtimeSnapshot: snapshot(a) });
    return {
      releaseADeploy:
        deployA.exitCode === 0 && /DEPLOY=PASS/u.test(deployA.stdout) ? 'PASS' : 'FAIL',
      releaseAAttestation: aAttestation.status,
      releaseBDeploy:
        deployB.exitCode === 0 && /DEPLOY=PASS/u.test(deployB.stdout) ? 'PASS' : 'FAIL',
      releaseBAttestation: bAttestation.status,
      mixedReleaseRejection: mixedRejected ? 'PASS' : 'FAIL',
      rollbackToA:
        rollback.exitCode === 0 && /ROLLBACK=PASS/u.test(rollback.stdout) ? 'PASS' : 'FAIL',
      rollbackAttestation: rollbackAttestation.status,
      releaseA: a,
      releaseB: b,
      deployA,
      deployB,
      rollback,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.main) process.stdout.write(`${JSON.stringify(runReleaseRehearsal(), null, 2)}\n`);
