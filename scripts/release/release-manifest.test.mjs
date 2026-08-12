import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createManifest, verifyManifest } from './lib/manifest.mjs';
import { deriveMigrationSet } from './lib/migrations.mjs';

const SOURCE_SHA = 'a'.repeat(40);
const SOURCE_TREE_SHA = 'b'.repeat(40);
const DIGEST_A = `sha256:${'1'.repeat(64)}`;
const DIGEST_B = `sha256:${'2'.repeat(64)}`;
const DIGEST_C = `sha256:${'3'.repeat(64)}`;
const DIGEST_D = `sha256:${'4'.repeat(64)}`;

test('canonical production Compose requires explicit immutable application image inputs', () => {
  const compose = readFileSync('docker-compose.production.yml', 'utf8');
  assert.doesNotMatch(compose, /^x-app:\s*&app\r?\n\s+build:/mu);
  for (const imageVariable of ['WEB_IMAGE', 'API_IMAGE', 'WORKER_IMAGE', 'PAYMENT_DEMO_IMAGE']) {
    assert.match(compose, new RegExp(`\\$\\{${imageVariable}:\\?`, 'u'));
  }
});

test('canonical production Compose binds every governed service to release attestation labels', () => {
  const compose = readFileSync('docker-compose.production.yml', 'utf8');
  for (const label of [
    'RELEASE_ID',
    'com.room.release.working_directory',
    'com.room.release.current_pointer',
    'com.room.release.shared_release_id',
    'com.room.release.compose_sha256',
    'com.room.release.caddy_sha256',
    'com.room.release.migration_completed',
  ]) {
    assert.match(compose, new RegExp(`${label.replaceAll('.', '\\.')}:`, 'u'));
  }
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeFile(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

function makeReleaseFixture() {
  const root = mkdtempSync(join(tmpdir(), 'room-release-manifest-'));
  const migrationSql = 'CREATE TABLE release_manifest_test ();\n';
  const migrationHash = sha256(migrationSql);

  writeFile(
    join(root, 'docker-compose.production.yml'),
    `services:\n  caddy:\n    image: caddy@sha256:${'c'.repeat(64)}\n  web:\n    image: web@sha256:${'d'.repeat(64)}\n  payment-demo:\n    image: payment-demo@sha256:${'e'.repeat(64)}\n  api:\n    image: api@sha256:${'f'.repeat(64)}\n  worker:\n    image: worker@sha256:${'0'.repeat(64)}\n  postgres:\n    image: postgres@sha256:${'9'.repeat(64)}\n  redis:\n    image: redis@sha256:${'8'.repeat(64)}\n  migrate:\n    image: migrate@sha256:${'7'.repeat(64)}\n`,
  );
  writeFile(join(root, 'deploy', 'Caddyfile'), ':443 { respond "ok" }\n');
  writeFile(join(root, 'deploy', 'environment-schema.json'), '{"schemaVersion":1,"keys":{}}\n');
  writeFile(join(root, 'packages', 'database', 'drizzle', '0000_test.sql'), migrationSql);
  writeFile(
    join(root, 'packages', 'database', 'drizzle', 'migration-provenance.json'),
    `${JSON.stringify({ version: 1, entries: [{ index: 0, fileName: '0000_test.sql', sha256: migrationHash }] })}\n`,
  );
  writeFile(
    join(root, 'packages', 'database', 'drizzle', 'meta', '_journal.json'),
    `${JSON.stringify({ entries: [{ idx: 0, tag: '0000_test' }] })}\n`,
  );
  writeFile(
    join(root, 'release-source.json'),
    `${JSON.stringify({ sourceSha: SOURCE_SHA, treeSha: SOURCE_TREE_SHA })}\n`,
  );

  const migrations = deriveMigrationSet(root);
  const manifest = createManifest({
    sourceSha: SOURCE_SHA,
    sourceTreeSha: SOURCE_TREE_SHA,
    createdAt: '2026-08-10T00:00:00.000Z',
    images: {
      web: { repository: 'registry.example/room-web', digest: DIGEST_A },
      api: { repository: 'registry.example/room-api', digest: DIGEST_B },
      worker: { repository: 'registry.example/room-worker', digest: DIGEST_C },
      paymentDemo: { repository: 'registry.example/room-payment-demo', digest: DIGEST_D },
    },
    composeSha256: sha256(readFileSync(join(root, 'docker-compose.production.yml'))),
    caddySha256: sha256(readFileSync(join(root, 'deploy', 'Caddyfile'))),
    migrations,
    envSchemaSha256: sha256(readFileSync(join(root, 'deploy', 'environment-schema.json'))),
  });

  return { root, manifest };
}

function withFixture(callback) {
  const fixture = makeReleaseFixture();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

test('manifest identity is stable across createdAt changes and verifies exact release artifacts', () => {
  withFixture(({ root, manifest }) => {
    const later = createManifest({
      sourceSha: SOURCE_SHA,
      sourceTreeSha: SOURCE_TREE_SHA,
      createdAt: '2026-08-10T01:00:00.000Z',
      images: manifest.images,
      composeSha256: manifest.compose.sha256,
      caddySha256: manifest.caddy.sha256,
      migrations: manifest.migrations,
      envSchemaSha256: manifest.envSchema.sha256,
    });

    assert.equal(later.releaseId, manifest.releaseId);
    assert.deepEqual(verifyManifest({ manifest, releaseDirectory: root, repositoryRoot: root }), {
      ok: true,
      manifest,
    });
  });
});

test('manifest creation rejects malformed source SHA', () => {
  withFixture(({ manifest }) => {
    assert.throws(
      () =>
        createManifest({
          sourceSha: 'not-a-source-sha',
          sourceTreeSha: SOURCE_TREE_SHA,
          createdAt: manifest.createdAt,
          images: manifest.images,
          composeSha256: manifest.compose.sha256,
          caddySha256: manifest.caddy.sha256,
          migrations: manifest.migrations,
          envSchemaSha256: manifest.envSchema.sha256,
        }),
      /source SHA/i,
    );
  });
});

test('verification rejects changed Compose and Caddy artifacts', () => {
  withFixture(({ root, manifest }) => {
    const composePath = join(root, 'docker-compose.production.yml');
    const originalCompose = readFileSync(composePath, 'utf8');
    writeFile(composePath, 'services: {}\n');
    assert.throws(
      () => verifyManifest({ manifest, releaseDirectory: root, repositoryRoot: root }),
      /Compose digest/i,
    );

    writeFile(composePath, originalCompose);
    writeFile(join(root, 'deploy', 'Caddyfile'), ':443 { respond "changed" }\n');
    assert.throws(
      () => verifyManifest({ manifest, releaseDirectory: root, repositoryRoot: root }),
      /Caddy digest/i,
    );
  });
});

test('verification rejects a release whose exact Compose topology omits worker', () => {
  withFixture(({ root, manifest }) => {
    const composePath = join(root, 'docker-compose.production.yml');
    const withoutWorker = readFileSync(composePath, 'utf8').replace(
      /  worker:[\s\S]*?\n  postgres:/u,
      '  postgres:',
    );
    writeFile(composePath, withoutWorker);
    const topologyManifest = createManifest({
      sourceSha: manifest.sourceSha,
      sourceTreeSha: manifest.sourceTreeSha,
      createdAt: manifest.createdAt,
      images: manifest.images,
      composeSha256: sha256(readFileSync(composePath)),
      caddySha256: manifest.caddy.sha256,
      migrations: manifest.migrations,
      envSchemaSha256: manifest.envSchema.sha256,
    });

    assert.throws(
      () =>
        verifyManifest({
          manifest: topologyManifest,
          releaseDirectory: root,
          repositoryRoot: root,
        }),
      /worker/i,
    );
  });
});

test('manifest creation rejects mutable image references without immutable digests', () => {
  withFixture(({ manifest }) => {
    assert.throws(
      () =>
        createManifest({
          sourceSha: manifest.sourceSha,
          sourceTreeSha: manifest.sourceTreeSha,
          createdAt: manifest.createdAt,
          images: {
            ...manifest.images,
            web: { repository: 'registry.example/room-web:latest' },
          },
          composeSha256: manifest.compose.sha256,
          caddySha256: manifest.caddy.sha256,
          migrations: manifest.migrations,
          envSchemaSha256: manifest.envSchema.sha256,
        }),
      /immutable digest|latest/i,
    );
  });
});

test('manifest identity binds the exact committed source tree', () => {
  withFixture(({ manifest }) => {
    assert.equal(manifest.sourceTreeSha, SOURCE_TREE_SHA);
    const alternateTree = createManifest({
      sourceSha: manifest.sourceSha,
      sourceTreeSha: 'c'.repeat(40),
      createdAt: manifest.createdAt,
      images: manifest.images,
      composeSha256: manifest.compose.sha256,
      caddySha256: manifest.caddy.sha256,
      migrations: manifest.migrations,
      envSchemaSha256: manifest.envSchema.sha256,
    });
    assert.notEqual(alternateTree.releaseId, manifest.releaseId);
    assert.throws(
      () =>
        createManifest({
          sourceSha: manifest.sourceSha,
          createdAt: manifest.createdAt,
          images: manifest.images,
          composeSha256: manifest.compose.sha256,
          caddySha256: manifest.caddy.sha256,
          migrations: manifest.migrations,
          envSchemaSha256: manifest.envSchema.sha256,
        }),
      /source tree SHA/i,
    );
  });
});

test('verification rejects migration and environment schema changes', () => {
  withFixture(({ root, manifest }) => {
    writeFile(
      join(root, 'packages', 'database', 'drizzle', '0000_test.sql'),
      'CREATE TABLE changed ();\n',
    );
    assert.throws(
      () => verifyManifest({ manifest, releaseDirectory: root, repositoryRoot: root }),
      /migration provenance/i,
    );

    writeFile(
      join(root, 'packages', 'database', 'drizzle', '0000_test.sql'),
      'CREATE TABLE release_manifest_test ();\n',
    );
    writeFile(join(root, 'deploy', 'environment-schema.json'), '{"schemaVersion":2,"keys":{}}\n');
    assert.throws(
      () => verifyManifest({ manifest, releaseDirectory: root, repositoryRoot: root }),
      /environment schema digest/i,
    );
  });
});

test('verification rejects a tampered manifest', () => {
  withFixture(({ root, manifest }) => {
    const tampered = { ...manifest, sourceSha: 'b'.repeat(40) };
    assert.throws(
      () => verifyManifest({ manifest: tampered, releaseDirectory: root, repositoryRoot: root }),
      /releaseId/i,
    );
  });
});

test('generator and verifier commands create and verify a manifest from explicit immutable inputs', () => {
  withFixture(({ root, manifest }) => {
    const imageArguments = [
      ['--web-image', manifest.images.web],
      ['--api-image', manifest.images.api],
      ['--worker-image', manifest.images.worker],
      ['--payment-demo-image', manifest.images.paymentDemo],
    ].flatMap(([flag, image]) => [flag, `${image.repository}@${image.digest}`]);
    const generated = spawnSync(
      process.execPath,
      [
        'scripts/release/generate-release-manifest.mjs',
        '--release-directory',
        root,
        '--repository-root',
        root,
        '--source-sha',
        SOURCE_SHA,
        '--source-tree-sha',
        SOURCE_TREE_SHA,
        '--created-at',
        manifest.createdAt,
        ...imageArguments,
      ],
      { cwd: process.cwd(), encoding: 'utf8', shell: false },
    );

    assert.equal(generated.status, 0, generated.stderr);
    assert.equal(
      JSON.parse(readFileSync(join(root, 'release-manifest.json'), 'utf8')).releaseId,
      manifest.releaseId,
    );

    const verified = spawnSync(
      process.execPath,
      [
        'scripts/release/verify-release-manifest.mjs',
        '--release-directory',
        root,
        '--repository-root',
        root,
      ],
      { cwd: process.cwd(), encoding: 'utf8', shell: false },
    );

    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /RELEASE_MANIFEST=PASS/);
  });
});
