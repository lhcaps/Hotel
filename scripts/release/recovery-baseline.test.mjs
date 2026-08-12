import assert from 'node:assert/strict';
import test from 'node:test';

import { createRecoveryBaseline } from './capture-recovery-baseline.mjs';

function snapshot(overrides = {}) {
  return {
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
        restartCount: 1,
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

test('recovery baseline is deterministically non-canonical and records no environment values', () => {
  const baseline = createRecoveryBaseline(snapshot());

  assert.equal(baseline.schemaVersion, 1);
  assert.equal(baseline.canonical, false);
  assert.equal(baseline.mixed, true);
  assert.match(baseline.baselineId, /^recovery-[a-f0-9]{64}$/u);
  assert.deepEqual(baseline.environmentFileHashes, snapshot().environmentFileHashes);
  assert.equal(baseline.composeFile, snapshot().composeFile);
  assert.equal(baseline.recovery.overrideFile, snapshot().recovery.overrideFile);
  assert.equal(JSON.stringify(baseline).includes('postgresql://'), false);
});

test('recovery baseline rejects incomplete live metadata rather than guessing a rollback target', () => {
  assert.throws(() => createRecoveryBaseline(snapshot({ services: {} })), /service/i);
  assert.throws(() => createRecoveryBaseline(snapshot({ caddyIdentity: 'not-a-hash' })), /Caddy/i);
});
