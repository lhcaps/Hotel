import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  executeIsolatedDeploy,
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
function help() {
  process.stdout.write(
    'Usage: node scripts/release/deploy-release.mjs --manifest <path> --target isolated --target-root <path> --source-directory <path> --compose-file <path> --compose-project <name> --compose-env-file <path> --service-env-directory <path> --backup-evidence-file <path> [--dry-run|--execute]\n',
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
  const targetRoot = resolve(option('--target-root', true));
  const composeFile = resolve(option('--compose-file', true));
  const composeProject = option('--compose-project', true);
  const composeEnvironment = resolve(option('--compose-env-file', true));
  const serviceEnvironmentDirectory = resolve(option('--service-env-directory', true));
  const backupEvidenceFile = resolve(option('--backup-evidence-file', true));
  const composeInputs = { composeFile, composeProject, composeEnvironment };
  const current = currentReleaseValid(targetRoot);
  const checks = {
    ...manifestChecks(manifest, sourceDirectory, composeEnvironment, serviceEnvironmentDirectory),
    backupEvidence: backupEvidenceValid(backupEvidenceFile, manifest),
    disk: diskAvailable(targetRoot),
    currentTruth: current.valid,
    previousRollback: !current.exists || current.valid,
    topology: composeTopologyValid(composeInputs) && candidateAvailable(targetRoot, manifest),
    dnsHost: isolatedHostPrerequisites(composeInputs),
  };
  const preflight = preflightRelease({ checks });
  if (process.argv.includes('--dry-run') || !process.argv.includes('--execute')) {
    process.stdout.write(
      `DEPLOY_DRY_RUN=${preflight.ok ? 'PASS' : 'FAIL'}\n${preflight.failures.map((name) => `PREFLIGHT_FAILURE=${name}`).join('\n')}\n`,
    );
    process.exit(preflight.ok ? 0 : 1);
  }
  composeUp(composeInputs);
  const result = executeIsolatedDeploy({
    targetRoot,
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
