import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  executeIsolatedRollback,
  preflightRelease,
  releaseDirectoryName,
} from './lib/release-state.mjs';
import { verifyManifest } from './lib/manifest.mjs';

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
try {
  if (process.argv.includes('--help')) {
    process.stdout.write(
      'Usage: node scripts/release/rollback-release.mjs --target-release-id <id> --target isolated [--dry-run]\n',
    );
    process.exit(0);
  }
  const target = option('--target', true);
  if (target !== 'isolated') throw new Error('Only the isolated target is authorized in Wave 1.');
  const targetRoot = resolve(
    option('--target-root', !process.argv.includes('--dry-run')) ?? process.cwd(),
  );
  const releaseId = option('--target-release-id', true);
  const releaseDirectory = resolve(targetRoot, 'releases', releaseDirectoryName(releaseId));
  const manifestPath = resolve(releaseDirectory, 'release-manifest.json');
  const manifestExists = existsSync(manifestPath);
  const composeEnvironment = option('--compose-env-file');
  let artifactValid = false;
  let imagesAvailable = false;
  if (manifestExists && composeEnvironment !== undefined) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      verifyManifest({ manifest, releaseDirectory, repositoryRoot: process.cwd() });
      const variables = {
        web: 'WEB_IMAGE',
        api: 'API_IMAGE',
        worker: 'WORKER_IMAGE',
        paymentDemo: 'PAYMENT_DEMO_IMAGE',
      };
      imagesAvailable = Object.entries(variables).every(([name, variable]) => {
        const reference = environmentValue(resolve(composeEnvironment), variable);
        return reference !== undefined && imageAvailable(reference, manifest.images[name].digest);
      });
      artifactValid = true;
    } catch {
      artifactValid = false;
    }
  }
  const preflight = preflightRelease({
    checks: {
      rollbackManifest: manifestExists,
      immutableImages: imagesAvailable,
      compose: artifactValid,
      caddy: artifactValid,
      migrationCompatibility: artifactValid,
      envSchema: artifactValid,
      currentTruth: existsSync(resolve(targetRoot, 'current')),
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
