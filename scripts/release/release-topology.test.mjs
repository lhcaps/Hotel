import assert from 'node:assert/strict';
import test from 'node:test';

import { createManifest } from './lib/manifest.mjs';
import { evaluateTopology } from './lib/topology.mjs';

const digest = (character) => `sha256:${character.repeat(64)}`;
const manifest = createManifest({
  sourceSha: 'a'.repeat(40),
  createdAt: '2026-08-10T00:00:00.000Z',
  images: {
    web: { repository: 'r/web', digest: digest('1') },
    api: { repository: 'r/api', digest: digest('2') },
    worker: { repository: 'r/worker', digest: digest('3') },
    paymentDemo: { repository: 'r/payment', digest: digest('4') },
  },
  composeSha256: '5'.repeat(64),
  caddySha256: '6'.repeat(64),
  migrations: {
    latest: '0000_test.sql',
    aggregateSha256: '7'.repeat(64),
    rollbackCompatibleWith: [],
  },
  envSchemaSha256: '8'.repeat(64),
});

function snapshot() {
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
      web: service(`r/web@${digest('1')}`),
      api: service(`r/api@${digest('2')}`),
      worker: service(`r/worker@${digest('3')}`),
      'payment-demo': service(`r/payment@${digest('4')}`),
      postgres: service('postgres@sha256:data'),
      redis: service('redis@sha256:cache'),
    },
  };
}

test('topology guard accepts canonical topology and rejects each production drift class', () => {
  assert.equal(evaluateTopology({ manifest, runtimeSnapshot: snapshot() }).status, 'PASS');
  const mixed = snapshot();
  mixed.services.worker.image = `r/worker@${digest('9')}`;
  assert.equal(evaluateTopology({ manifest, runtimeSnapshot: mixed }).status, 'FAIL');
  const staging = snapshot();
  staging.services.api.workingDirectory = '/opt/room-management/staging/old';
  assert.equal(evaluateTopology({ manifest, runtimeSnapshot: staging }).status, 'FAIL');
  const pointer = snapshot();
  pointer.currentPointer = '/opt/room-management/releases/other';
  assert.equal(evaluateTopology({ manifest, runtimeSnapshot: pointer }).status, 'FAIL');
  const missing = snapshot();
  delete missing.services['payment-demo'];
  assert.equal(evaluateTopology({ manifest, runtimeSnapshot: missing }).status, 'FAIL');
  assert.equal(
    evaluateTopology({ manifest, runtimeSnapshot: snapshot(), migrationProvenanceMatch: false })
      .status,
    'FAIL',
  );
});
