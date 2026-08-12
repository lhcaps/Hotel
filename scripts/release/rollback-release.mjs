import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  executeIsolatedRollback,
  preflightRelease,
  releaseDirectoryName,
} from './lib/release-state.mjs';
import { verifyManifest } from './lib/manifest.mjs';
import {
  loadEnvironmentSchema,
  readEnvironmentFile,
  validateEnvironment,
} from './lib/environment.mjs';

function option(name, required = false) {
  const i = process.argv.indexOf(name);
  const value = i < 0 ? undefined : process.argv[i + 1];
  if (required && (!value || value.startsWith('--'))) throw new Error(`${name} is required.`);
  return value;
}
function composeUp() {
  const composeFile = option('--compose-file');
  if (composeFile === undefined) return;
  const project = option('--compose-project', true);
  const args = ['compose', '--project-name', project, '--file', resolve(composeFile)];
  const environmentFile = option('--compose-env-file');
  if (environmentFile !== undefined) args.push('--env-file', resolve(environmentFile));
  args.push('up', '--detach', '--force-recreate');
  execFileSync('docker', args, { stdio: 'pipe', windowsHide: true });
}
function composeTopologyValid(composeFile, composeProject, composeEnvironment) {
  try {
    execFileSync(
      'docker',
      [
        'compose',
        '--project-name',
        composeProject,
        '--file',
        composeFile,
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
function serviceEnvironmentsValid(directory, schemaPath, manifest) {
  try {
    const schema = loadEnvironmentSchema(schemaPath);
    return Object.entries(schema.services).every(([service, definition]) => {
      const values = readEnvironmentFile(join(directory, `${service}.env`));
      validateEnvironment({ values, schema, deploymentClass: 'isolated' });
      return (
        Object.keys(values).every((key) => definition.allowedKeys.includes(key)) &&
        (!definition.allowedKeys.includes('RELEASE_ID') ||
          values.RELEASE_ID === manifest.releaseId) &&
        (!definition.allowedKeys.includes('RELEASE_SHA') ||
          values.RELEASE_SHA === manifest.sourceSha)
      );
    });
  } catch {
    return false;
  }
}
function currentReleaseManifest(targetRoot) {
  try {
    const releaseId = readFileSync(join(targetRoot, 'current'), 'utf8').trim();
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
    return manifest.releaseId === releaseId ? manifest : undefined;
  } catch {
    return undefined;
  }
}
function rollbackMigrationCompatible(targetManifest, currentManifest) {
  return (
    targetManifest.migrations.aggregateSha256 === currentManifest.migrations.aggregateSha256 ||
    targetManifest.migrations.rollbackCompatibleWith.includes(
      currentManifest.migrations.aggregateSha256,
    )
  );
}
try {
  if (process.argv.includes('--help')) {
    process.stdout.write(
      'Usage: node scripts/release/rollback-release.mjs --target-release-id <id> --target <isolated|production> --target-root <path> --compose-file <path> --compose-project <name> --compose-env-file <path> --service-env-directory <path> [production evidence options] [--dry-run|--execute]\n',
    );
    process.exit(0);
  }
  const target = option('--target', true);
  if (!['isolated', 'production'].includes(target)) {
    throw new Error('--target must be isolated or production.');
  }
  if (target === 'production') {
    const { runProductionRollback } = await import('./production-rollback.mjs');
    process.exit(runProductionRollback());
  }
  const targetRoot = resolve(option('--target-root', true));
  const releaseId = option('--target-release-id', true);
  const releaseDirectory = resolve(targetRoot, 'releases', releaseDirectoryName(releaseId));
  const manifestPath = resolve(releaseDirectory, 'release-manifest.json');
  const manifestExists = existsSync(manifestPath);
  const composeFile = resolve(option('--compose-file', true));
  const composeProject = option('--compose-project', true);
  const composeEnvironment = resolve(option('--compose-env-file', true));
  const serviceEnvironmentDirectory = resolve(option('--service-env-directory', true));
  let artifactValid = false;
  let imagesAvailable = false;
  let environmentValid = false;
  let targetManifest;
  if (manifestExists) {
    try {
      targetManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      verifyManifest({ manifest: targetManifest, releaseDirectory, repositoryRoot: process.cwd() });
      const variables = {
        web: 'WEB_IMAGE',
        api: 'API_IMAGE',
        worker: 'WORKER_IMAGE',
        paymentDemo: 'PAYMENT_DEMO_IMAGE',
      };
      imagesAvailable = Object.entries(variables).every(([name, variable]) => {
        const reference = environmentValue(composeEnvironment, variable);
        return (
          reference !== undefined && imageAvailable(reference, targetManifest.images[name].digest)
        );
      });
      environmentValid = serviceEnvironmentsValid(
        serviceEnvironmentDirectory,
        join(releaseDirectory, 'deploy', 'environment-schema.json'),
        targetManifest,
      );
      artifactValid = true;
    } catch {
      artifactValid = false;
    }
  }
  const currentManifest = currentReleaseManifest(targetRoot);
  const preflight = preflightRelease({
    checks: {
      rollbackManifest: manifestExists,
      immutableImages: imagesAvailable,
      compose: artifactValid,
      caddy: artifactValid,
      migrationCompatibility:
        artifactValid &&
        currentManifest !== undefined &&
        rollbackMigrationCompatible(targetManifest, currentManifest),
      envSchema: artifactValid && environmentValid,
      currentTruth: currentManifest !== undefined,
      topology: composeTopologyValid(composeFile, composeProject, composeEnvironment),
    },
  });
  if (process.argv.includes('--dry-run') || !process.argv.includes('--execute')) {
    process.stdout.write(
      `ROLLBACK_DRY_RUN=${preflight.ok ? 'PASS' : 'FAIL'}\n${preflight.failures.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n')}\n`,
    );
    process.exit(preflight.ok ? 0 : 1);
  }
  composeUp();
  const result = executeIsolatedRollback({
    targetRoot,
    targetReleaseId: releaseId,
    checks: preflight.checks,
  });
  process.stdout.write(
    `ROLLBACK=${result.status}\n${result.evidence?.[0]?.failures?.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n') ?? ''}\n`,
  );
  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (error) {
  process.stderr.write(
    `ROLLBACK=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
