import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { hashFile } from './lib/canonical.mjs';
import { createManifest } from './lib/manifest.mjs';
import { deriveMigrationSet } from './lib/migrations.mjs';
import {
  loadEnvironmentSchema,
  readEnvironmentFile,
  renderServiceEnvironments,
} from './lib/environment.mjs';

const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url));
function run(executable, args, options = {}) {
  return execFileSync(executable, args, { encoding: 'utf8', windowsHide: true, ...options });
}

function baseImage() {
  const configured = process.env.WAVE1_REHEARSAL_BASE_IMAGE;
  if (configured !== undefined) return configured;
  const image = run('docker', ['image', 'ls', '--format', '{{.Repository}}:{{.Tag}}'])
    .split(/\r?\n/u)
    .find((value) => value.startsWith('room-management-api:'));
  if (image === undefined) throw new Error('A local room-management-api image is required.');
  return image;
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

function compose(project, file, environment, args, allowFailure = false) {
  try {
    return run('docker', [
      'compose',
      '--project-name',
      project,
      '--file',
      file,
      '--env-file',
      environment,
      ...args,
    ]);
  } catch (error) {
    if (allowFailure) return error;
    throw error;
  }
}

function makeImage(root, name, sourceSha) {
  const buildDirectory = join(root, `build-${name}`);
  mkdirSync(buildDirectory, { recursive: true });
  writeFileSync(
    join(buildDirectory, 'Dockerfile'),
    `FROM ${baseImage()}\nLABEL com.room.rehearsal.source=${sourceSha}\n`,
  );
  const tag = `room-wave1-${name}-app:rehearsal`;
  run('docker', ['build', '--quiet', '--tag', tag, buildDirectory]);
  return { tag, digest: run('docker', ['image', 'inspect', tag, '--format', '{{.Id}}']).trim() };
}

function composeTemplate() {
  return `name: rehearsal

x-service: &service
  image: \${REHEARSAL_IMAGE:?rehearsal image is required}
  entrypoint: ['/bin/sh', '-c', 'while true; do sleep 3600; done']
  labels: &release_labels
    RELEASE_ID: \${RELEASE_ID:?release id is required}
    org.opencontainers.image.revision: \${RELEASE_SHA:?release SHA is required}
    com.room.release.working_directory: \${RELEASE_DIRECTORY:?release directory is required}
    com.room.release.current_pointer: \${RELEASE_DIRECTORY:?release directory is required}
    com.room.release.shared_release_id: \${RELEASE_ID:?release id is required}
    com.room.release.compose_sha256: \${COMPOSE_SHA256:?compose hash is required}
    com.room.release.caddy_sha256: \${CADDY_SHA256:?caddy hash is required}
    com.room.release.migration_completed: 'true'

services:
  caddy:
    <<: *service
  web:
    <<: *service
  api:
    <<: *service
  worker:
    <<: *service
  payment-demo:
    <<: *service
  postgres:
    <<: *service
  redis:
    <<: *service
  migrate:
    <<: *service
`;
}

function makeRelease(root, name, sourceSha) {
  const image = makeImage(root, name, sourceSha);
  const directory = join(root, `source-${name}`);
  mkdirSync(join(directory, 'deploy'), { recursive: true });
  writeFileSync(join(directory, 'docker-compose.production.yml'), composeTemplate());
  cpSync(join(REPOSITORY_ROOT, 'deploy', 'Caddyfile'), join(directory, 'deploy', 'Caddyfile'));
  cpSync(
    join(REPOSITORY_ROOT, 'deploy', 'environment-schema.json'),
    join(directory, 'deploy', 'environment-schema.json'),
  );
  const migrations = deriveMigrationSet(REPOSITORY_ROOT);
  const manifest = createManifest({
    sourceSha,
    sourceTreeSha: sourceSha,
    createdAt: '2026-08-10T00:00:00.000Z',
    images: {
      web: { repository: `rehearsal/${name}/app`, digest: image.digest },
      api: { repository: `rehearsal/${name}/app`, digest: image.digest },
      worker: { repository: `rehearsal/${name}/app`, digest: image.digest },
      paymentDemo: { repository: `rehearsal/${name}/app`, digest: image.digest },
    },
    composeSha256: hashFile(join(directory, 'docker-compose.production.yml')),
    caddySha256: hashFile(join(directory, 'deploy', 'Caddyfile')),
    migrations,
    envSchemaSha256: hashFile(join(directory, 'deploy', 'environment-schema.json')),
  });
  writeFileSync(join(directory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    join(directory, 'release-source.json'),
    `${JSON.stringify({ sourceSha: manifest.sourceSha, treeSha: manifest.sourceTreeSha }, null, 2)}\n`,
  );
  const backupEvidenceFile = join(directory, 'backup-evidence.json');
  writeFileSync(
    backupEvidenceFile,
    `${JSON.stringify({ releaseId: manifest.releaseId, verified: true })}\n`,
  );
  const environmentValues = {
    ...readEnvironmentFile(join(REPOSITORY_ROOT, '.env.example')),
    RELEASE_ID: manifest.releaseId,
    RELEASE_SHA: manifest.sourceSha,
  };
  const serviceEnvironmentDirectory = join(directory, 'service-environments');
  renderServiceEnvironments({
    values: environmentValues,
    schema: loadEnvironmentSchema(join(directory, 'deploy', 'environment-schema.json')),
    destinationDirectory: serviceEnvironmentDirectory,
  });
  const releaseDirectory = `/opt/room-management/releases/${manifest.releaseId}`;
  writeFileSync(
    join(directory, 'rehearsal.env'),
    [
      `REHEARSAL_IMAGE=${image.tag}`,
      `WEB_IMAGE=${image.tag}`,
      `API_IMAGE=${image.tag}`,
      `WORKER_IMAGE=${image.tag}`,
      `PAYMENT_DEMO_IMAGE=${image.tag}`,
      `RELEASE_ID=${manifest.releaseId}`,
      `RELEASE_SHA=${manifest.sourceSha}`,
      `RELEASE_DIRECTORY=${releaseDirectory}`,
      `COMPOSE_SHA256=${manifest.compose.sha256}`,
      `CADDY_SHA256=${manifest.caddy.sha256}`,
      '',
    ].join('\n'),
  );
  return {
    directory,
    environment: join(directory, 'rehearsal.env'),
    backupEvidenceFile,
    serviceEnvironmentDirectory,
    image,
    manifest,
  };
}

function pass(result, expression) {
  return result.exitCode === 0 && expression.test(result.stdout) ? 'PASS' : 'FAIL';
}

export function runComposeWorkloadRehearsal() {
  const root = mkdtempSync(join(tmpdir(), 'room-wave1-compose-'));
  const project = `roomwave1${Date.now().toString(36)}`;
  const createdImages = [];
  let cleanupFile;
  let cleanupEnvironment;
  try {
    const a = makeRelease(root, 'a', 'a'.repeat(40));
    const b = makeRelease(root, 'b', 'b'.repeat(40));
    cleanupFile = join(b.directory, 'docker-compose.production.yml');
    cleanupEnvironment = b.environment;
    createdImages.push(a.image.tag, b.image.tag);
    const deploy = (release) =>
      command('deploy-release.mjs', [
        '--manifest',
        join(release.directory, 'release-manifest.json'),
        '--target',
        'isolated',
        '--target-root',
        root,
        '--source-directory',
        release.directory,
        '--compose-file',
        join(release.directory, 'docker-compose.production.yml'),
        '--compose-project',
        project,
        '--compose-env-file',
        release.environment,
        '--service-env-directory',
        release.serviceEnvironmentDirectory,
        '--backup-evidence-file',
        release.backupEvidenceFile,
        '--execute',
      ]);
    const attest = (release) =>
      command('attest-release.mjs', [
        '--manifest',
        join(release.directory, 'release-manifest.json'),
        '--target',
        'docker',
        '--project',
        project,
        '--strict',
      ]);
    const topology = (release) =>
      command('check-release-topology.mjs', [
        '--manifest',
        join(release.directory, 'release-manifest.json'),
        '--target',
        'docker',
        '--project',
        project,
        '--strict',
      ]);

    const deployA = deploy(a);
    const attestA = attest(a);
    const deployB = deploy(b);
    const attestB = attest(b);
    compose(project, join(a.directory, 'docker-compose.production.yml'), a.environment, [
      'up',
      '--detach',
      '--force-recreate',
      'api',
    ]);
    const mixedAttestation = attest(b);
    const mixedTopology = topology(b);
    compose(project, join(b.directory, 'docker-compose.production.yml'), b.environment, [
      'up',
      '--detach',
      '--force-recreate',
    ]);
    const restoredB = attest(b);
    const rollback = command('rollback-release.mjs', [
      '--target-release-id',
      a.manifest.releaseId,
      '--target',
      'isolated',
      '--target-root',
      root,
      '--compose-file',
      join(
        root,
        'releases',
        a.manifest.releaseId.replace(':', '-'),
        'docker-compose.production.yml',
      ),
      '--compose-project',
      project,
      '--compose-env-file',
      join(root, 'releases', a.manifest.releaseId.replace(':', '-'), 'rehearsal.env'),
      '--service-env-directory',
      join(root, 'releases', a.manifest.releaseId.replace(':', '-'), 'service-environments'),
      '--execute',
    ]);
    const rollbackAttestation = attest(a);
    return {
      project,
      releaseA: a.manifest,
      releaseB: b.manifest,
      releaseAManifestSha256: hashFile(join(a.directory, 'release-manifest.json')),
      releaseBManifestSha256: hashFile(join(b.directory, 'release-manifest.json')),
      deployA,
      attestA,
      deployB,
      attestB,
      mixedAttestation,
      mixedTopology,
      restoredB,
      rollback,
      rollbackAttestation,
      releaseADeploy: pass(deployA, /DEPLOY=PASS/u),
      releaseAAttestation: pass(attestA, /RELEASE_ATTESTATION=PASS/u),
      releaseBDeploy: pass(deployB, /DEPLOY=PASS/u),
      releaseBAttestation: pass(attestB, /RELEASE_ATTESTATION=PASS/u),
      mixedReleaseRejection:
        mixedAttestation.exitCode !== 0 &&
        mixedTopology.exitCode !== 0 &&
        /RELEASE_ATTESTATION=FAIL/u.test(mixedAttestation.stdout) &&
        /TOPOLOGY_GUARD=FAIL/u.test(mixedTopology.stdout)
          ? 'PASS'
          : 'FAIL',
      restoredBAttestation: pass(restoredB, /RELEASE_ATTESTATION=PASS/u),
      rollbackToA: pass(rollback, /ROLLBACK=PASS/u),
      rollbackAttestation: pass(rollbackAttestation, /RELEASE_ATTESTATION=PASS/u),
    };
  } finally {
    if (cleanupFile !== undefined && cleanupEnvironment !== undefined) {
      compose(
        project,
        cleanupFile,
        cleanupEnvironment,
        ['down', '--volumes', '--remove-orphans'],
        true,
      );
    }
    for (const image of createdImages) {
      try {
        run('docker', ['image', 'rm', '--force', image]);
      } catch {
        // Rehearsal cleanup must not hide the result of the prior verification steps.
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.main)
  process.stdout.write(`${JSON.stringify(runComposeWorkloadRehearsal(), null, 2)}\n`);
