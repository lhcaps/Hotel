import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { attestRelease } from './lib/attestation.mjs';
import { hashFile } from './lib/canonical.mjs';
import { dockerSnapshot } from './lib/docker-snapshot.mjs';
import {
  loadEnvironmentSchema,
  readEnvironmentFile,
  validateEnvironment,
} from './lib/environment.mjs';
import { verifyManifest } from './lib/manifest.mjs';
import {
  validateBackupEvidence,
  validateProductionApproval,
  validateRecoveryBaseline,
  validateRestoreRehearsal,
  validateRollbackStrategy,
} from './lib/production-policy.mjs';
import {
  readProductionCurrentPointer,
  switchProductionCurrentPointer,
} from './lib/production-runtime.mjs';
import {
  executeProductionRollback,
  preflightRelease,
  releaseDirectoryName,
} from './lib/release-state.mjs';

const APPROVAL_ID = 'APPROVE_OPERATIONS_V3_PRODUCTION_RELEASE_RECONCILIATION_AND_CANARY';

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--'))) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readEvidence(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${label} is invalid.`);
  }
}

function composeUp(
  { composeFile, composeProject, composeEnvironment, composeOverrides = [] },
  { noBuild = false } = {},
) {
  const files = [composeFile, ...composeOverrides].flatMap((file) => ['--file', file]);
  execFileSync(
    'docker',
    [
      'compose',
      '--project-name',
      composeProject,
      ...files,
      '--env-file',
      composeEnvironment,
      'up',
      '--detach',
      '--force-recreate',
      ...(noBuild ? ['--no-build'] : []),
    ],
    { stdio: 'pipe', windowsHide: true },
  );
}

function composeTopologyValid({
  composeFile,
  composeProject,
  composeEnvironment,
  composeOverrides = [],
}) {
  try {
    const files = [composeFile, ...composeOverrides].flatMap((file) => ['--file', file]);
    execFileSync(
      'docker',
      [
        'compose',
        '--project-name',
        composeProject,
        ...files,
        '--env-file',
        composeEnvironment,
        'config',
        '--quiet',
      ],
      { stdio: 'pipe', windowsHide: true },
    );
    return true;
  } catch {
    return false;
  }
}

function projectHealth(project) {
  try {
    const identifiers = execFileSync(
      'docker',
      ['ps', '--quiet', '--filter', `label=com.docker.compose.project=${project}`],
      { encoding: 'utf8', windowsHide: true },
    )
      .split(/\r?\n/u)
      .filter(Boolean);
    if (identifiers.length === 0) return { dockerHealth: false, databaseHealth: false };
    const containers = JSON.parse(
      execFileSync('docker', ['inspect', ...identifiers], { encoding: 'utf8', windowsHide: true }),
    );
    const byService = Object.fromEntries(
      containers
        .map((container) => [container.Config?.Labels?.['com.docker.compose.service'], container])
        .filter(([service]) => typeof service === 'string'),
    );
    const required = ['caddy', 'web', 'payment-demo', 'api', 'worker', 'postgres', 'redis'];
    const dockerHealth = required.every((service) => byService[service]?.State?.Running === true);
    const postgres = byService.postgres;
    const databaseHealth =
      postgres?.State?.Running === true &&
      (postgres.State?.Health === undefined || postgres.State.Health.Status === 'healthy');
    return { dockerHealth, databaseHealth };
  } catch {
    return { dockerHealth: false, databaseHealth: false };
  }
}

function waitForHealth(inputs) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const health = projectHealth(inputs.composeProject);
    if (health.dockerHealth && health.databaseHealth) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }
  return false;
}

function diskAvailable(targetRoot) {
  try {
    return statfsSync(targetRoot).bavail > 0;
  } catch {
    return false;
  }
}

function recoveryArtifactsValid(baseline) {
  try {
    validateRecoveryBaseline(baseline);
    return (
      existsSync(baseline.composeFile) &&
      existsSync(baseline.caddyFile) &&
      existsSync(baseline.composeEnvironmentFile) &&
      hashFile(baseline.composeFile) === baseline.composeIdentity &&
      hashFile(baseline.caddyFile) === baseline.caddyIdentity &&
      hashFile(baseline.composeEnvironmentFile) === baseline.environmentFileHashes.compose &&
      existsSync(baseline.recovery.composeFile) &&
      existsSync(baseline.recovery.caddyFile) &&
      existsSync(baseline.recovery.composeEnvironmentFile) &&
      existsSync(baseline.recovery.overrideFile) &&
      hashFile(baseline.recovery.composeFile) === baseline.recovery.composeIdentity &&
      hashFile(baseline.recovery.caddyFile) === baseline.recovery.caddyIdentity &&
      hashFile(baseline.recovery.composeEnvironmentFile) ===
        baseline.recovery.composeEnvironmentIdentity &&
      hashFile(baseline.recovery.overrideFile) === baseline.recovery.overrideIdentity
    );
  } catch {
    return false;
  }
}

function imageAvailable(reference, digest) {
  try {
    return (
      execFileSync('docker', ['image', 'inspect', reference, '--format', '{{.Id}}'], {
        encoding: 'utf8',
        windowsHide: true,
      }).trim() === digest
    );
  } catch {
    return false;
  }
}

function environmentValue(path, name) {
  const line = readFileSync(path, 'utf8')
    .split(/\r?\n/u)
    .find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1);
}

function canonicalTargetValid({
  releaseDirectory,
  composeEnvironment,
  serviceEnvironmentDirectory,
}) {
  try {
    const manifest = JSON.parse(
      readFileSync(join(releaseDirectory, 'release-manifest.json'), 'utf8'),
    );
    verifyManifest({ manifest, releaseDirectory, repositoryRoot: releaseDirectory });
    const variables = {
      web: 'WEB_IMAGE',
      api: 'API_IMAGE',
      worker: 'WORKER_IMAGE',
      paymentDemo: 'PAYMENT_DEMO_IMAGE',
    };
    const images = Object.entries(variables).every(([name, variable]) => {
      const reference = environmentValue(composeEnvironment, variable);
      return reference !== undefined && imageAvailable(reference, manifest.images[name].digest);
    });
    const schema = loadEnvironmentSchema(
      join(releaseDirectory, 'deploy', 'environment-schema.json'),
    );
    const combined = {};
    for (const [service, definition] of Object.entries(schema.services)) {
      const values = readEnvironmentFile(join(serviceEnvironmentDirectory, `${service}.env`));
      if (
        !Object.keys(values).every((key) => definition.allowedKeys.includes(key)) ||
        (definition.allowedKeys.includes('RELEASE_ID') &&
          values.RELEASE_ID !== manifest.releaseId) ||
        (definition.allowedKeys.includes('RELEASE_SHA') &&
          values.RELEASE_SHA !== manifest.sourceSha)
      ) {
        return undefined;
      }
      for (const [key, value] of Object.entries(values)) {
        if (combined[key] !== undefined && combined[key] !== value) return undefined;
        combined[key] = value;
      }
    }
    for (const key of [
      'RELEASE_WORKING_DIRECTORY',
      'RELEASE_CURRENT_POINTER',
      'RELEASE_COMPOSE_SHA256',
      'RELEASE_CADDY_SHA256',
      'RELEASE_MIGRATION_COMPLETED',
    ]) {
      combined[key] = environmentValue(composeEnvironment, key);
    }
    validateEnvironment({ values: combined, schema, deploymentClass: 'real-production' });
    return { manifest, images, environment: true };
  } catch {
    return undefined;
  }
}

function currentManifest(targetRoot) {
  try {
    const directory = readProductionCurrentPointer(targetRoot);
    if (directory === undefined) return undefined;
    const manifest = JSON.parse(readFileSync(join(directory, 'release-manifest.json'), 'utf8'));
    verifyManifest({ manifest, releaseDirectory: directory, repositoryRoot: directory });
    return { directory, manifest };
  } catch {
    return undefined;
  }
}

function baselineRuntimeMatches({ baseline, project, targetRoot }) {
  try {
    if (
      baseline.project !== project ||
      readProductionCurrentPointer(targetRoot) !== baseline.currentPointer
    ) {
      return false;
    }
    const identifiers = execFileSync(
      'docker',
      ['ps', '--quiet', '--filter', `label=com.docker.compose.project=${project}`],
      { encoding: 'utf8', windowsHide: true },
    )
      .split(/\r?\n/u)
      .filter(Boolean);
    const containers = JSON.parse(
      execFileSync('docker', ['inspect', ...identifiers], { encoding: 'utf8', windowsHide: true }),
    );
    const services = Object.fromEntries(
      containers.map((container) => [
        container.Config?.Labels?.['com.docker.compose.service'],
        container,
      ]),
    );
    return Object.entries(baseline.services).every(([service, expected]) => {
      const actual = services[service];
      return (
        actual?.State?.Running === true &&
        actual.Image === expected.imageId &&
        (expected.revision === null ||
          actual.Config?.Labels?.['org.opencontainers.image.revision'] === expected.revision) &&
        Number(actual.RestartCount ?? -1) === expected.restartCount
      );
    });
  } catch {
    return false;
  }
}

export function runProductionRollback() {
  const approvalFile = resolve(option('--approval-file', true));
  const recoveryBaselineFile = resolve(option('--recovery-baseline-file', true));
  const backupEvidenceFile = resolve(option('--backup-evidence-file', true));
  const restoreRehearsalFile = resolve(option('--restore-rehearsal-file', true));
  const rollbackStrategyFile = resolve(option('--rollback-strategy-file', true));
  const targetRoot = resolve(option('--target-root', true));
  const composeProject = option('--compose-project', true);
  const currentComposeEnvironment = resolve(option('--current-compose-env-file', true));
  const requestedReleaseId = option('--target-release-id');
  const baseline = readEvidence(recoveryBaselineFile, 'Recovery baseline evidence');
  const rollbackToBaseline = requestedReleaseId === undefined;
  const targetReleaseId = requestedReleaseId ?? baseline.baselineId;
  const targetDirectory = rollbackToBaseline
    ? resolve(baseline.currentPointer)
    : resolve(targetRoot, 'releases', releaseDirectoryName(targetReleaseId));
  const composeFile = rollbackToBaseline
    ? resolve(baseline.recovery.composeFile)
    : resolve(option('--compose-file', true));
  const composeEnvironment = rollbackToBaseline
    ? resolve(baseline.recovery.composeEnvironmentFile)
    : resolve(option('--compose-env-file', true));
  const serviceEnvironmentDirectory = rollbackToBaseline
    ? undefined
    : resolve(option('--service-env-directory', true));
  const composeOverrides = rollbackToBaseline ? [resolve(baseline.recovery.overrideFile)] : [];
  const current = currentManifest(targetRoot);
  const target = rollbackToBaseline
    ? undefined
    : canonicalTargetValid({
        releaseDirectory: targetDirectory,
        composeEnvironment,
        serviceEnvironmentDirectory,
      });
  const strategy = readEvidence(rollbackStrategyFile, 'Rollback strategy evidence');
  const backup = readEvidence(backupEvidenceFile, 'Production backup evidence');
  const restoreRehearsal = readEvidence(restoreRehearsalFile, 'Restore rehearsal evidence');
  let approval = false;
  let strategyValid = false;
  let backupValid = false;
  let restoreValid = false;
  let currentRuntimeValid = false;
  try {
    if (current === undefined)
      throw new Error('Current canonical release manifest is unavailable.');
    validateProductionApproval({
      approval: readEvidence(approvalFile, 'Production approval evidence'),
      manifest: current.manifest,
      expectedApprovalId: APPROVAL_ID,
    });
    approval = true;
    validateBackupEvidence(backup);
    backupValid = true;
    validateRestoreRehearsal(restoreRehearsal, backup);
    restoreValid = true;
    validateRollbackStrategy({
      strategy,
      baseline,
      manifest: current.manifest,
      restoreRehearsal,
    });
    strategyValid = true;
    currentRuntimeValid =
      attestRelease({
        manifest: current.manifest,
        runtimeSnapshot: dockerSnapshot({ manifest: current.manifest, project: composeProject }),
      }).status === 'PASS';
  } catch {
    // Individual false checks are emitted below; no raw evidence values are exposed.
  }
  const health = projectHealth(composeProject);
  const targetValid = rollbackToBaseline ? recoveryArtifactsValid(baseline) : target !== undefined;
  const checks = {
    approval,
    recoveryBaseline: recoveryArtifactsValid(baseline),
    backupEvidence: backupValid,
    restoreEvidence: restoreValid,
    rollbackStrategy: strategyValid,
    currentTruth:
      current !== undefined &&
      readProductionCurrentPointer(targetRoot) === current.directory &&
      currentRuntimeValid,
    rollbackTarget: targetValid && existsSync(targetDirectory),
    immutableImages: rollbackToBaseline ? true : target.images,
    compose: targetValid,
    caddy: rollbackToBaseline ? targetValid : target !== undefined,
    envSchema: rollbackToBaseline ? targetValid : target?.environment === true,
    migrationCompatibility: strategy.legacyCompatibility === true,
    databaseRestoreAutomation: strategy.legacyCompatibility === true,
    databaseHealth: health.databaseHealth,
    dockerHealth: health.dockerHealth,
    disk: diskAvailable(targetRoot),
    topology: composeTopologyValid({
      composeFile,
      composeProject,
      composeEnvironment,
      composeOverrides,
    }),
  };
  const preflight = preflightRelease({ checks });
  if (process.argv.includes('--dry-run') || !process.argv.includes('--execute')) {
    process.stdout.write(
      `ROLLBACK_DRY_RUN=${preflight.ok ? 'PASS' : 'FAIL'}\n${preflight.failures.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n')}\n`,
    );
    return preflight.ok ? 0 : 1;
  }
  const result = executeProductionRollback({
    targetRoot,
    targetReleaseId,
    targetDirectory,
    checks,
    readCurrentPointer: () => readProductionCurrentPointer(targetRoot),
    switchCurrentPointer: ({ releaseDirectory }) =>
      switchProductionCurrentPointer({ targetRoot, releaseDirectory }),
    restoreCurrentPointer: ({ previousPointer }) => {
      if (previousPointer !== undefined) {
        switchProductionCurrentPointer({ targetRoot, releaseDirectory: previousPointer });
      }
    },
    onStartCandidate: () =>
      composeUp(
        { composeFile, composeProject, composeEnvironment, composeOverrides },
        { noBuild: rollbackToBaseline },
      ),
    onVerifyCandidate: () => waitForHealth({ composeProject }),
    onAttest: () =>
      rollbackToBaseline
        ? baselineRuntimeMatches({ baseline, project: composeProject, targetRoot })
        : attestRelease({
            manifest: target.manifest,
            runtimeSnapshot: dockerSnapshot({ manifest: target.manifest, project: composeProject }),
          }).status === 'PASS',
    onRecoverFailure: ({ previousPointer }) => {
      if (previousPointer !== undefined) {
        composeUp({
          composeFile: join(previousPointer, 'docker-compose.production.yml'),
          composeProject,
          composeEnvironment: currentComposeEnvironment,
        });
      }
    },
  });
  process.stdout.write(
    `ROLLBACK=${result.status}\n${result.evidence?.[0]?.failures?.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n') ?? ''}\n`,
  );
  return result.status === 'PASS' ? 0 : 1;
}
