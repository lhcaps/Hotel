import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  executeIsolatedDeploy,
  executeProductionDeploy,
  preflightRelease,
  releaseDirectoryName,
} from './lib/release-state.mjs';
import { verifyManifest } from './lib/manifest.mjs';
import {
  loadEnvironmentSchema,
  readEnvironmentFile,
  validateEnvironment,
} from './lib/environment.mjs';
import { attestRelease } from './lib/attestation.mjs';
import { dockerSnapshot } from './lib/docker-snapshot.mjs';
import { productionPreflightChecks, validateRollbackStrategy } from './lib/production-policy.mjs';
import {
  readProductionCurrentPointer,
  switchProductionCurrentPointer,
} from './lib/production-runtime.mjs';
import { hashFile } from './lib/canonical.mjs';

const APPROVAL_ID = 'APPROVE_OPERATIONS_V3_PRODUCTION_RELEASE_RECONCILIATION_AND_CANARY';

function option(name, required = false) {
  const i = process.argv.indexOf(name);
  const value = i < 0 ? undefined : process.argv[i + 1];
  if (required && (!value || value.startsWith('--'))) throw new Error(`${name} is required.`);
  return value;
}
function help() {
  process.stdout.write(
    'Usage: node scripts/release/deploy-release.mjs --manifest <path> --target <isolated|production> --target-root <path> --source-directory <path> --compose-file <path> --compose-project <name> --compose-env-file <path> --service-env-directory <path> --backup-evidence-file <path> [production evidence options] [--dry-run|--execute]\n',
  );
}
function composeArguments({ composeFile, composeProject, composeEnvironment }) {
  const args = ['compose', '--project-name', composeProject, '--file', composeFile];
  args.push('--env-file', composeEnvironment);
  return args;
}
function composeUp(inputs) {
  const args = composeArguments(inputs);
  args.push('up', '--detach', '--force-recreate');
  execFileSync('docker', args, { stdio: 'pipe', windowsHide: true });
}
function composeTopologyValid(inputs) {
  try {
    const args = composeArguments(inputs);
    args.push('config', '--quiet');
    execFileSync('docker', args, { stdio: 'pipe', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
function backupEvidenceValid(path, manifest) {
  try {
    const evidence = JSON.parse(readFileSync(path, 'utf8'));
    return evidence.releaseId === manifest.releaseId && evidence.verified === true;
  } catch {
    return false;
  }
}
function currentReleaseValid(targetRoot) {
  const pointer = join(targetRoot, 'current');
  if (!existsSync(pointer)) return { exists: false, valid: true };
  try {
    const releaseId = readFileSync(pointer, 'utf8').trim();
    const manifestPath = join(
      targetRoot,
      'releases',
      releaseDirectoryName(releaseId),
      'release-manifest.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    verifyManifest({
      manifest,
      releaseDirectory: join(targetRoot, 'releases', releaseDirectoryName(releaseId)),
      repositoryRoot: process.cwd(),
    });
    return { exists: true, valid: manifest.releaseId === releaseId };
  } catch {
    return { exists: true, valid: false };
  }
}
function diskAvailable(targetRoot) {
  try {
    return statfsSync(targetRoot).bavail > 0;
  } catch {
    return false;
  }
}
function candidateAvailable(targetRoot, manifest) {
  return !existsSync(join(targetRoot, 'releases', releaseDirectoryName(manifest.releaseId)));
}
function isolatedHostPrerequisites(inputs) {
  return /^[a-z0-9][a-z0-9_-]*$/iu.test(inputs.composeProject) && composeTopologyValid(inputs);
}
function environmentValue(path, name) {
  const line = readFileSync(path, 'utf8')
    .split(/\r?\n/u)
    .find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1);
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
function serviceEnvironmentsValid({
  directory,
  schemaPath,
  manifest,
  deploymentClass,
  composeEnvironment,
}) {
  try {
    const schema = loadEnvironmentSchema(schemaPath);
    const combined = {};
    for (const [service, definition] of Object.entries(schema.services)) {
      const values = readEnvironmentFile(resolve(directory, `${service}.env`));
      if (
        !Object.keys(values).every((key) => definition.allowedKeys.includes(key)) ||
        (definition.allowedKeys.includes('RELEASE_ID') &&
          values.RELEASE_ID !== manifest.releaseId) ||
        (definition.allowedKeys.includes('RELEASE_SHA') &&
          values.RELEASE_SHA !== manifest.sourceSha)
      ) {
        return false;
      }
      for (const [key, value] of Object.entries(values)) {
        if (combined[key] !== undefined && combined[key] !== value) return false;
        combined[key] = value;
      }
    }
    if (deploymentClass === 'real-production') {
      for (const key of [
        'RELEASE_WORKING_DIRECTORY',
        'RELEASE_CURRENT_POINTER',
        'RELEASE_COMPOSE_SHA256',
        'RELEASE_CADDY_SHA256',
        'RELEASE_MIGRATION_COMPLETED',
      ]) {
        const value = environmentValue(composeEnvironment, key);
        if (value === undefined || (combined[key] !== undefined && combined[key] !== value))
          return false;
        combined[key] = value;
      }
    }
    validateEnvironment({ values: combined, schema, deploymentClass });
    return true;
  } catch {
    return false;
  }
}
function manifestChecks(
  manifest,
  sourceDirectory,
  composeEnvironment,
  serviceEnvironmentDirectory,
  target,
) {
  const checks = {
    manifest: false,
    sourceSha: false,
    immutableImages: false,
    compose: false,
    caddy: false,
    envSchema: false,
    requiredKeys: false,
    allowlists: false,
    migrationCompatibility: false,
  };
  try {
    verifyManifest({
      manifest,
      releaseDirectory: sourceDirectory,
      repositoryRoot: target === 'production' ? sourceDirectory : process.cwd(),
    });
    Object.assign(checks, {
      manifest: true,
      sourceSha: true,
      compose: true,
      caddy: true,
      envSchema: true,
      migrationCompatibility: true,
    });
  } catch {
    return checks;
  }
  const imageVariables = {
    web: 'WEB_IMAGE',
    api: 'API_IMAGE',
    worker: 'WORKER_IMAGE',
    paymentDemo: 'PAYMENT_DEMO_IMAGE',
  };
  checks.immutableImages = Object.entries(imageVariables).every(([name, variable]) => {
    const reference = environmentValue(composeEnvironment, variable);
    return reference !== undefined && imageAvailable(reference, manifest.images[name].digest);
  });
  const serviceEnvironments = serviceEnvironmentsValid({
    directory: serviceEnvironmentDirectory,
    schemaPath: resolve(sourceDirectory, 'deploy', 'environment-schema.json'),
    manifest,
    deploymentClass: target === 'production' ? 'real-production' : 'isolated',
    composeEnvironment,
  });
  checks.requiredKeys = serviceEnvironments;
  checks.allowlists = serviceEnvironments;
  return checks;
}

function readEvidence(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${label} is invalid.`);
  }
}

function caddyContractValid(sourceDirectory) {
  try {
    const caddy = readFileSync(resolve(sourceDirectory, 'deploy', 'Caddyfile'), 'utf8');
    return (
      caddy.includes('{$PUBLIC_DOMAIN} {') &&
      caddy.includes('www.{$PUBLIC_DOMAIN} {') &&
      caddy.includes('{$PAYMENT_DEMO_DOMAIN} {')
    );
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

function candidateHealthy({ composeFile, composeProject, composeEnvironment }) {
  const health = projectHealth(composeProject);
  if (!health.dockerHealth || !health.databaseHealth) return false;
  try {
    const migrate = execFileSync(
      'docker',
      [
        'compose',
        '--project-name',
        composeProject,
        '--file',
        composeFile,
        '--env-file',
        composeEnvironment,
        'ps',
        '--all',
        '--format',
        'json',
        'migrate',
      ],
      { encoding: 'utf8', windowsHide: true },
    ).trim();
    const state = JSON.parse(migrate);
    return state.State === 'exited' && state.ExitCode === 0;
  } catch {
    return false;
  }
}

function waitForCandidateHealth(inputs) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (candidateHealthy(inputs)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }
  return false;
}

function recoveryBaselineMatchesRuntime({ baseline, targetRoot }) {
  try {
    if (readProductionCurrentPointer(targetRoot) !== baseline.currentPointer) return false;
    if (!existsSync(baseline.composeFile) || !existsSync(baseline.caddyFile)) return false;
    if (!existsSync(baseline.composeEnvironmentFile)) return false;
    if (hashFile(baseline.composeFile) !== baseline.composeIdentity) return false;
    if (hashFile(baseline.caddyFile) !== baseline.caddyIdentity) return false;
    const composeEnvironmentHash = baseline.environmentFileHashes.compose;
    if (
      typeof composeEnvironmentHash !== 'string' ||
      hashFile(baseline.composeEnvironmentFile) !== composeEnvironmentHash
    ) {
      return false;
    }
    const identifiers = execFileSync(
      'docker',
      ['ps', '--quiet', '--filter', `label=com.docker.compose.project=${baseline.project}`],
      { encoding: 'utf8', windowsHide: true },
    )
      .split(/\r?\n/u)
      .filter(Boolean);
    if (identifiers.length === 0) return false;
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
try {
  if (process.argv.includes('--help')) {
    help();
    process.exit(0);
  }
  const target = option('--target', true);
  if (!['isolated', 'production'].includes(target)) {
    throw new Error('--target must be isolated or production.');
  }
  const approvalFile =
    target === 'production' ? resolve(option('--approval-file', true)) : undefined;
  const recoveryBaselineFile =
    target === 'production' ? resolve(option('--recovery-baseline-file', true)) : undefined;
  const restoreRehearsalFile =
    target === 'production' ? resolve(option('--restore-rehearsal-file', true)) : undefined;
  const rollbackStrategyFile =
    target === 'production' ? resolve(option('--rollback-strategy-file', true)) : undefined;
  const manifestPath = resolve(option('--manifest', true));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const sourceDirectory = resolve(option('--source-directory', true));
  const targetRoot = resolve(option('--target-root', true));
  const composeFile = resolve(option('--compose-file', true));
  const composeProject = option('--compose-project', true);
  const composeEnvironment = resolve(option('--compose-env-file', true));
  const serviceEnvironmentDirectory = resolve(option('--service-env-directory', true));
  const backupEvidenceFile = resolve(option('--backup-evidence-file', true));
  const composeInputs = { composeFile, composeProject, composeEnvironment };
  const artifactChecks = manifestChecks(
    manifest,
    sourceDirectory,
    composeEnvironment,
    serviceEnvironmentDirectory,
    target,
  );
  const checks =
    target === 'production'
      ? {
          ...artifactChecks,
          ...productionPreflightChecks({
            approval: readEvidence(approvalFile, 'Production approval evidence'),
            manifest,
            expectedApprovalId: APPROVAL_ID,
            recoveryBaseline: readEvidence(recoveryBaselineFile, 'Recovery baseline evidence'),
            backup: readEvidence(backupEvidenceFile, 'Production backup evidence'),
            restoreRehearsal: readEvidence(restoreRehearsalFile, 'Restore rehearsal evidence'),
            ...projectHealth(composeProject),
            currentTruth: recoveryBaselineMatchesRuntime({
              baseline: readEvidence(recoveryBaselineFile, 'Recovery baseline evidence'),
              targetRoot,
            }),
            rollbackTarget: recoveryBaselineMatchesRuntime({
              baseline: readEvidence(recoveryBaselineFile, 'Recovery baseline evidence'),
              targetRoot,
            }),
            migrationProvenance: artifactChecks.migrationCompatibility,
            rollbackStrategy: (() => {
              try {
                validateRollbackStrategy({
                  strategy: readEvidence(rollbackStrategyFile, 'Rollback strategy evidence'),
                  baseline: readEvidence(recoveryBaselineFile, 'Recovery baseline evidence'),
                  manifest,
                  restoreRehearsal: readEvidence(
                    restoreRehearsalFile,
                    'Restore rehearsal evidence',
                  ),
                });
                return true;
              } catch {
                return false;
              }
            })(),
          }),
          disk: diskAvailable(targetRoot),
          caddyContract: caddyContractValid(sourceDirectory),
          topology: composeTopologyValid(composeInputs),
          releaseIdUnique: candidateAvailable(targetRoot, manifest),
        }
      : (() => {
          const current = currentReleaseValid(targetRoot);
          return {
            ...artifactChecks,
            backupEvidence: backupEvidenceValid(backupEvidenceFile, manifest),
            disk: diskAvailable(targetRoot),
            currentTruth: current.valid,
            previousRollback: !current.exists || current.valid,
            topology:
              composeTopologyValid(composeInputs) && candidateAvailable(targetRoot, manifest),
            dnsHost: isolatedHostPrerequisites(composeInputs),
          };
        })();
  const preflight = preflightRelease({ checks });
  if (process.argv.includes('--dry-run') || !process.argv.includes('--execute')) {
    process.stdout.write(
      `DEPLOY_DRY_RUN=${preflight.ok ? 'PASS' : 'FAIL'}\n${preflight.failures.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n')}\n`,
    );
    process.exit(preflight.ok ? 0 : 1);
  }
  const recoveryBaseline =
    target === 'production'
      ? readEvidence(recoveryBaselineFile, 'Recovery baseline evidence')
      : undefined;
  const result =
    target === 'production'
      ? executeProductionDeploy({
          targetRoot,
          releaseId: manifest.releaseId,
          sourceDirectory,
          checks,
          readCurrentPointer: () => readProductionCurrentPointer(targetRoot),
          switchCurrentPointer: ({ releaseDirectory }) =>
            switchProductionCurrentPointer({ targetRoot, releaseDirectory }),
          restoreCurrentPointer: ({ previousPointer }) => {
            if (previousPointer !== undefined) {
              switchProductionCurrentPointer({ targetRoot, releaseDirectory: previousPointer });
            }
          },
          onStartCandidate: ({ releaseDirectory }) =>
            composeUp({
              ...composeInputs,
              composeFile: join(releaseDirectory, 'docker-compose.production.yml'),
            }),
          onVerifyCandidate: ({ releaseDirectory }) =>
            waitForCandidateHealth({
              composeFile: join(releaseDirectory, 'docker-compose.production.yml'),
              composeProject,
              composeEnvironment,
            }),
          onAttest: () =>
            attestRelease({
              manifest,
              runtimeSnapshot: dockerSnapshot({ manifest, project: composeProject }),
            }).status === 'PASS',
          onRecoverFailure: () =>
            composeUp({
              composeFile: recoveryBaseline.composeFile,
              composeProject,
              composeEnvironment: recoveryBaseline.composeEnvironmentFile,
            }),
        })
      : (() => {
          composeUp(composeInputs);
          return executeIsolatedDeploy({
            targetRoot,
            releaseId: manifest.releaseId,
            sourceDirectory,
            checks,
          });
        })();
  process.stdout.write(
    `DEPLOY=${result.status}\n${result.preflight?.failures.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n') ?? ''}\n`,
  );
  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (error) {
  process.stderr.write(`DEPLOY=FAIL\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
