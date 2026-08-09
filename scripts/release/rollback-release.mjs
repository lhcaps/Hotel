import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { executeIsolatedRollback, preflightRelease } from './lib/release-state.mjs';

function option(name, required = false) {
  const i = process.argv.indexOf(name);
  const value = i < 0 ? undefined : process.argv[i + 1];
  if (required && (!value || value.startsWith('--'))) throw new Error(`${name} is required.`);
  return value;
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
  const manifestExists = existsSync(
    resolve(targetRoot, 'releases', releaseId, 'release-manifest.json'),
  );
  const preflight = preflightRelease({
    checks: {
      rollbackManifest: manifestExists,
      immutableImages: manifestExists,
      compose: manifestExists,
      caddy: manifestExists,
      migrationCompatibility: manifestExists,
      envSchema: manifestExists,
      currentTruth: existsSync(resolve(targetRoot, 'current')),
    },
  });
  if (process.argv.includes('--dry-run') || !process.argv.includes('--execute')) {
    process.stdout.write(`ROLLBACK_DRY_RUN=${preflight.ok ? 'PASS' : 'FAIL'}\n`);
    process.exit(preflight.ok ? 0 : 1);
  }
  const result = executeIsolatedRollback({
    targetRoot,
    targetReleaseId: releaseId,
    checks: preflight.checks,
  });
  process.stdout.write(`ROLLBACK=${result.status}\n`);
  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (error) {
  process.stderr.write(
    `ROLLBACK=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
