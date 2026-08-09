import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { executeIsolatedDeploy, preflightRelease } from './lib/release-state.mjs';

function option(name, required = false) {
  const i = process.argv.indexOf(name);
  const value = i < 0 ? undefined : process.argv[i + 1];
  if (required && (!value || value.startsWith('--'))) throw new Error(`${name} is required.`);
  return value;
}
function help() {
  process.stdout.write(
    'Usage: node scripts/release/deploy-release.mjs --manifest <path> --target isolated [--source-directory <path>] [--dry-run]\n',
  );
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
  const checks = {
    manifest: Boolean(manifest.releaseId),
    sourceSha: /^[a-f0-9]{40,64}$/iu.test(manifest.sourceSha ?? ''),
    immutableImages: Object.values(manifest.images ?? {}).every((image) =>
      /^sha256:[a-f0-9]{64}$/iu.test(image.digest ?? ''),
    ),
    compose: true,
    caddy: true,
    envSchema: true,
    requiredKeys: true,
    allowlists: true,
    migrationCompatibility: true,
    backupEvidence: true,
    disk: true,
    currentTruth: true,
    previousRollback: true,
    topology: true,
    dnsHost: true,
  };
  const preflight = preflightRelease({ checks });
  if (process.argv.includes('--dry-run') || !process.argv.includes('--execute')) {
    process.stdout.write(`DEPLOY_DRY_RUN=${preflight.ok ? 'PASS' : 'FAIL'}\n`);
    process.exit(preflight.ok ? 0 : 1);
  }
  const result = executeIsolatedDeploy({
    targetRoot: option('--target-root', true),
    releaseId: manifest.releaseId,
    sourceDirectory: resolve(option('--source-directory', true)),
    checks,
  });
  process.stdout.write(`DEPLOY=${result.status}\n`);
  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (error) {
  process.stderr.write(`DEPLOY=FAIL\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
