import assert from 'node:assert/strict';
import test from 'node:test';

import { createManifest } from './lib/manifest.mjs';
import { attestRelease } from './lib/attestation.mjs';

const sourceSha = 'a'.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;
const manifest = createManifest({
  sourceSha,
  createdAt: '2026-08-10T00:00:00.000Z',
  images: {
    web: { repository: 'registry.example/web', digest: digest('1') },
    api: { repository: 'registry.example/api', digest: digest('2') },
    worker: { repository: 'registry.example/worker', digest: digest('3') },
    paymentDemo: { repository: 'registry.example/payment-demo', digest: digest('4') },
  },
  composeSha256: '5'.repeat(64),
  caddySha256: '6'.repeat(64),
  migrations: { latest: '0000_test.sql', aggregateSha256: '7'.repeat(64), rollbackCompatibleWith: [] },
  envSchemaSha256: '8'.repeat(64),
});

function snapshot() {
  const releaseDirectory = `/opt/room-management/releases/${manifest.releaseId}`;
  return {
    currentPointer: releaseDirectory,
    sharedReleaseId: manifest.releaseId,
    composeSha256: manifest.compose.sha256,
    caddySha256: manifest.caddy.sha256,
    migrationCompleted: true,
    services: {
      caddy: { image: 'caddy@sha256:edge', releaseId: manifest.releaseId, workingDirectory: releaseDirectory, state: 'running' },
      web: { image: `registry.example/web@${digest('1')}`, releaseId: manifest.releaseId, workingDirectory: releaseDirectory, state: 'running' },
      api: { image: `registry.example/api@${digest('2')}`, releaseId: manifest.releaseId, workingDirectory: releaseDirectory, state: 'running' },
      worker: { image: `registry.example/worker@${digest('3')}`, releaseId: manifest.releaseId, workingDirectory: releaseDirectory, state: 'running' },
      'payment-demo': { image: `registry.example/payment-demo@${digest('4')}`, releaseId: manifest.releaseId, workingDirectory: releaseDirectory, state: 'running' },
      postgres: { image: 'postgres@sha256:data', releaseId: manifest.releaseId, workingDirectory: releaseDirectory, state: 'running' },
      redis: { image: 'redis@sha256:cache', releaseId: manifest.releaseId, workingDirectory: releaseDirectory, state: 'running' },
    },
  };
}

test('attestation passes only when every canonical service matches the release', () => {
  assert.equal(attestRelease({ manifest, runtimeSnapshot: snapshot() }).status, 'PASS');
});

test('attestation rejects a mixed worker image and staging ownership', () => {
  const mixed = snapshot();
  mixed.services.worker.image = `registry.example/worker@${digest('9')}`;
  assert.equal(attestRelease({ manifest, runtimeSnapshot: mixed }).status, 'FAIL');

  const staging = snapshot();
  staging.services.api.workingDirectory = '/opt/room-management/staging/a';
  assert.equal(attestRelease({ manifest, runtimeSnapshot: staging }).status, 'FAIL');
});
