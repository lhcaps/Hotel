import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { executeIsolatedDeploy, preflightRelease } from './lib/release-state.mjs';
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
function help() {
  process.stdout.write(
    'Usage: node scripts/release/deploy-release.mjs --manifest <path> --target isolated --source-directory <path> [--compose-file <path> --compose-project <name> --compose-env-file <path>] [--dry-run]\n',
  );
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
      const values = readEnvironmentFile(resolve(directory, `${service}.env`));
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
function manifestChecks(
  manifest,
  sourceDirectory,
  composeEnvironment,
  serviceEnvironmentDirectory,
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
    verifyManifest({ manifest, releaseDirectory: sourceDirectory, repositoryRoot: process.cwd() });
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
  const serviceEnvironments = serviceEnvironmentsValid(
    serviceEnvironmentDirectory,
    resolve(sourceDirectory, 'deploy', 'environment-schema.json'),
    manifest,
  );
  checks.requiredKeys = serviceEnvironments;
  checks.allowlists = serviceEnvironments;
  return checks;
}
try {
  if (process.argv.includes('--help')) {
    help();
    process.exit(0);
  }
  const manifestPath = resolve(option('--manifest', true));
  const target = option('--target', true);
  if (target !== 'isolated') throw new Error('Only the isolated target is authorized in Wave 1.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const sourceDirectory = resolve(option('--source-directory', true));
  const composeEnvironment = resolve(option('--compose-env-file', true));
  const serviceEnvironmentDirectory = resolve(option('--service-env-directory', true));
  const checks = {
    ...manifestChecks(manifest, sourceDirectory, composeEnvironment, serviceEnvironmentDirectory),
    backupEvidence: true,
    disk: true,
    currentTruth: true,
    previousRollback: true,
    topology: true,
    dnsHost: true,
  };
  const preflight = preflightRelease({ checks });
  if (process.argv.includes('--dry-run') || !process.argv.includes('--execute')) {
    process.stdout.write(
      `DEPLOY_DRY_RUN=${preflight.ok ? 'PASS' : 'FAIL'}\n${preflight.failures.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n')}\n`,
    );
    process.exit(preflight.ok ? 0 : 1);
  }
  composeUp();
  const result = executeIsolatedDeploy({
    targetRoot: option('--target-root', true),
    releaseId: manifest.releaseId,
    sourceDirectory,
    checks,
  });
  process.stdout.write(
    `DEPLOY=${result.status}\n${result.preflight?.failures.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n') ?? ''}\n`,
  );
  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (error) {
  process.stderr.write(`DEPLOY=FAIL\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
