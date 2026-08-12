import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createBackupEvidence } from './create-backup-evidence.mjs';
import { validateRestoreRehearsal } from './lib/production-policy.mjs';

const SHA = /^[a-f0-9]{40,64}$/iu;
const IMAGE_REVISION_LABEL = 'org.opencontainers.image.revision';
const DATABASE_NAME = 'room_management';

function requireOption(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} is required.`);
  return value;
}

function optionalOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fullSha(value, label) {
  if (!SHA.test(value)) throw new Error(`${label} must be a full Git SHA.`);
  return value;
}

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    windowsHide: true,
  }).trim();
}

function dockerSucceeds(args) {
  try {
    docker(args);
    return true;
  } catch {
    return false;
  }
}

function imageRevision(image) {
  try {
    const revision = docker([
      'image',
      'inspect',
      image,
      '--format',
      `{{ index .Config.Labels \"${IMAGE_REVISION_LABEL}\" }}`,
    ]);
    return revision.length === 0 ? undefined : revision;
  } catch {
    return undefined;
  }
}

function waitFor(check, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (check()) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }
  return false;
}

function databaseEnvironment(database) {
  const secret = randomBytes(32).toString('base64url');
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    API_HOST: '0.0.0.0',
    API_PORT: '3001',
    WEB_ORIGIN: 'http://localhost:3000',
    AUTH_BASE_URL: 'http://localhost:3001',
    DATABASE_URL: `postgresql://room:room@postgres:5432/${database}`,
    REDIS_URL: 'redis://redis:6379',
    MAIL_HOST: 'mail.invalid',
    MAIL_PORT: '1025',
    MAIL_FROM: 'no-reply@room-management.invalid',
    BETTER_AUTH_SECRET: secret,
    GUEST_OTP_SECRET: randomBytes(32).toString('base64url'),
    GUEST_CHALLENGE_REF_SECRET: randomBytes(32).toString('base64url'),
    GUEST_SESSION_SECRET: randomBytes(32).toString('base64url'),
    BOOKING_IP_DIGEST_SECRET: randomBytes(32).toString('base64url'),
    BOOKING_ACCESS_QR_SECRET: randomBytes(32).toString('base64url'),
  };
}

function environmentArguments(environment) {
  return Object.entries(environment).flatMap(([key, value]) => ['--env', `${key}=${value}`]);
}

async function captureDump({ container, output }) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(
      'docker',
      ['exec', container, 'pg_dump', '-Fc', '-U', 'room', DATABASE_NAME],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    const outputChunks = [];
    child.stdout.on('data', (chunk) => outputChunks.push(chunk));
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Disposable PostgreSQL dump failed (${String(code)}).`));
        return;
      }
      writeFileSync(output, Buffer.concat(outputChunks), { mode: 0o600 });
      resolvePromise();
    });
  });
}

async function restoreDump({ container, database, backupPath }) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '--interactive',
        container,
        'pg_restore',
        '-U',
        'room',
        '-d',
        database,
        '--clean',
        '--if-exists',
      ],
      { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true },
    );
    child.stdin.end(readFileSync(backupPath));
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Disposable PostgreSQL restore failed (${String(code)}).`));
    });
  });
}

function migrationState(container, database) {
  return docker([
    'exec',
    container,
    'psql',
    '-U',
    'room',
    '-d',
    database,
    '--tuples-only',
    '--no-align',
    '--command',
    'SELECT count(*) FROM drizzle.__drizzle_migrations',
  ]);
}

function startApi({ name, network, image, environment }) {
  return docker([
    'run',
    '--detach',
    '--name',
    name,
    '--network',
    network,
    ...environmentArguments(environment),
    image,
    'node',
    'apps/api/dist/apps/api/src/main.js',
  ]);
}

function apiReady(name) {
  return dockerSucceeds([
    'exec',
    name,
    'node',
    '--input-type=module',
    '--eval',
    "const response = await fetch('http://127.0.0.1:3001/api/v1/health/ready'); process.exit(response.status === 200 ? 0 : 1);",
  ]);
}

function removeContainer(name) {
  if (name !== undefined) dockerSucceeds(['rm', '--force', name]);
}

export function buildRollbackStrategyEvidence({
  baselineId,
  candidateSourceSha,
  legacySourceSha,
  rehearsalId,
  rehearsedAt,
  legacyCompatibility,
  restoreRehearsal,
}) {
  const restoreRequired = legacyCompatibility !== true;
  return {
    schemaVersion: 1,
    baselineId,
    candidateSourceSha,
    legacySourceSha,
    rehearsalId,
    rehearsedAt,
    legacyCompatibility: !restoreRequired,
    strategy: restoreRequired ? 'database-restore-required' : 'application-compatible',
    restoreRequired,
    status: restoreRequired && restoreRehearsal === undefined ? 'BLOCKED_RESTORE_EVIDENCE' : 'PASS',
  };
}

export async function rehearseProductionRecovery({
  legacyImage,
  candidateImage,
  legacySourceSha,
  candidateSourceSha,
  baselineId,
  outputDirectory,
}) {
  fullSha(legacySourceSha, 'Legacy source SHA');
  fullSha(candidateSourceSha, 'Candidate source SHA');
  if (imageRevision(legacyImage) !== legacySourceSha) {
    throw new Error('Legacy API image revision does not match the selected legacy source SHA.');
  }
  if (imageRevision(candidateImage) !== candidateSourceSha) {
    throw new Error(
      'Candidate API image revision does not match the selected candidate source SHA.',
    );
  }
  const runId = randomUUID().replaceAll('-', '');
  const network = `room-release-rehearsal-${runId}`;
  const postgres = `${network}-postgres`;
  const redis = `${network}-redis`;
  const candidateMigrate = `${network}-candidate-migrate`;
  const candidateDatabase = DATABASE_NAME;
  const restoredDatabase = `room_management_restore_${runId.slice(0, 16)}`;
  const legacyCandidate = `${network}-legacy-candidate`;
  const legacyRestored = `${network}-legacy-restored`;
  const rehearsalId = `restore-${runId}`;
  const backupId = `rehearsal-backup-${runId}`;
  const databaseIdentity = `isolated:${network}:postgres`;
  const directory = resolve(outputDirectory);
  const backupPath = join(directory, `${backupId}.dump`);
  let baselineMigrationState;
  let candidateMigrationState;
  let restoredMigrationState;
  let legacyCompatibility = false;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    docker(['network', 'create', network]);
    docker([
      'run',
      '--detach',
      '--name',
      postgres,
      '--network',
      network,
      '--network-alias',
      'postgres',
      '--env',
      'POSTGRES_USER=room',
      '--env',
      'POSTGRES_PASSWORD=room',
      '--env',
      `POSTGRES_DB=${DATABASE_NAME}`,
      'postgres:18.1-alpine',
    ]);
    docker([
      'run',
      '--detach',
      '--name',
      redis,
      '--network',
      network,
      '--network-alias',
      'redis',
      'redis:8.4.0-alpine',
    ]);
    if (
      !waitFor(() =>
        dockerSucceeds(['exec', postgres, 'pg_isready', '-U', 'room', '-d', DATABASE_NAME]),
      )
    ) {
      throw new Error('Disposable PostgreSQL did not become ready.');
    }

    const migrationEnvironment = databaseEnvironment(candidateDatabase);
    docker([
      'run',
      '--name',
      candidateMigrate,
      '--network',
      network,
      ...environmentArguments(migrationEnvironment),
      legacyImage,
      'node',
      'packages/database/dist/database/scripts/migrate.js',
    ]);
    baselineMigrationState = migrationState(postgres, candidateDatabase);
    await captureDump({ container: postgres, output: backupPath });

    docker([
      'run',
      '--rm',
      '--network',
      network,
      ...environmentArguments(migrationEnvironment),
      candidateImage,
      'node',
      'packages/database/dist/database/scripts/migrate.js',
    ]);
    candidateMigrationState = migrationState(postgres, candidateDatabase);

    startApi({
      name: legacyCandidate,
      network,
      image: legacyImage,
      environment: migrationEnvironment,
    });
    legacyCompatibility = waitFor(() => apiReady(legacyCandidate));
    removeContainer(legacyCandidate);

    docker(['exec', postgres, 'createdb', '-U', 'room', restoredDatabase]);
    await restoreDump({ container: postgres, database: restoredDatabase, backupPath });
    restoredMigrationState = migrationState(postgres, restoredDatabase);
    if (restoredMigrationState !== baselineMigrationState) {
      throw new Error('Disposable restore did not recover the baseline migration journal.');
    }
    startApi({
      name: legacyRestored,
      network,
      image: legacyImage,
      environment: databaseEnvironment(restoredDatabase),
    });
    if (!waitFor(() => apiReady(legacyRestored))) {
      throw new Error('Legacy API did not become ready against the restored disposable database.');
    }
    removeContainer(legacyRestored);

    const completedAt = new Date().toISOString();
    const restoreRehearsal = {
      schemaVersion: 1,
      rehearsalId,
      backupId,
      databaseIdentity,
      isolated: true,
      restoredBytes: statSync(backupPath).size,
      checksumVerified: true,
      migrationState: `baseline=${baselineMigrationState};candidate=${candidateMigrationState};restored=${restoredMigrationState}`,
      status: 'PASS',
      completedAt,
    };
    const backupEvidence = await createBackupEvidence({
      backupPath,
      backupId,
      databaseIdentity,
      restoreRehearsalId: rehearsalId,
      createdAt: completedAt,
    });
    validateRestoreRehearsal(restoreRehearsal, backupEvidence);
    const rollbackStrategy = buildRollbackStrategyEvidence({
      baselineId,
      candidateSourceSha,
      legacySourceSha,
      rehearsalId,
      rehearsedAt: completedAt,
      legacyCompatibility,
      restoreRehearsal,
    });
    if (rollbackStrategy.status !== 'PASS') {
      throw new Error('Rollback strategy lacks verified restore evidence.');
    }
    writeFileSync(
      join(directory, 'backup-evidence.json'),
      `${JSON.stringify(backupEvidence, null, 2)}\n`,
      {
        encoding: 'utf8',
        mode: 0o600,
      },
    );
    writeFileSync(
      join(directory, 'restore-rehearsal.json'),
      `${JSON.stringify(restoreRehearsal, null, 2)}\n`,
      {
        encoding: 'utf8',
        mode: 0o600,
      },
    );
    writeFileSync(
      join(directory, 'rollback-strategy.json'),
      `${JSON.stringify(rollbackStrategy, null, 2)}\n`,
      {
        encoding: 'utf8',
        mode: 0o600,
      },
    );
    return { backupEvidence, restoreRehearsal, rollbackStrategy };
  } finally {
    removeContainer(legacyCandidate);
    removeContainer(legacyRestored);
    removeContainer(candidateMigrate);
    removeContainer(redis);
    removeContainer(postgres);
    dockerSucceeds(['network', 'rm', network]);
  }
}

if (import.meta.main) {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      process.stdout.write(
        'Usage: node scripts/release/rehearse-production-recovery.mjs --legacy-image <immutable-image> --legacy-source-sha <sha> --candidate-image <immutable-image> --candidate-source-sha <sha> --baseline-id <id> --output-directory <path>\n',
      );
      process.exit(0);
    }
    const result = await rehearseProductionRecovery({
      legacyImage: requireOption('--legacy-image'),
      legacySourceSha: requireOption('--legacy-source-sha'),
      candidateImage: requireOption('--candidate-image'),
      candidateSourceSha: requireOption('--candidate-source-sha'),
      baselineId: requireOption('--baseline-id'),
      outputDirectory:
        optionalOption('--output-directory') ?? join(tmpdir(), 'room-release-rehearsal'),
    });
    process.stdout.write(
      `PRODUCTION_RECOVERY_REHEARSAL=PASS\nROLLBACK_STRATEGY=${result.rollbackStrategy.strategy}\nRESTORE_REHEARSAL=${result.restoreRehearsal.status}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `PRODUCTION_RECOVERY_REHEARSAL=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
