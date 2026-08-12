import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { hashFile } from './lib/canonical.mjs';
import { createManifest } from './lib/manifest.mjs';
import { deriveMigrationSet } from './lib/migrations.mjs';
import { validatePublicBuildConfig } from '../deploy/validate-public-build-config.mjs';

function printHelp() {
  process.stdout.write(
    `Usage: node scripts/release/generate-release-manifest.mjs --release-directory <path> --source-sha <sha> --source-tree-sha <sha> --web-image <repository@digest> --api-image <repository@digest> --worker-image <repository@digest> --payment-demo-image <repository@digest> [options]\n\n`,
  );
  process.stdout.write(`Options:\n`);
  process.stdout.write(
    `  --repository-root <path>  Repository containing immutable migration provenance (default: current directory)\n`,
  );
  process.stdout.write(`  --created-at <timestamp>  Manifest timestamp (default: current time)\n`);
  process.stdout.write(
    `  --public-api-base-url <url>  Validated public API URL baked into web assets\n`,
  );
  process.stdout.write(`  --public-domain <hostname>  Public web hostname used by the build\n`);
  process.stdout.write(`  --web-origin <url>  Public web origin used by the build\n`);
}

function readOption(name, required = true) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--'))) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseImage(value, name) {
  const separator = value.lastIndexOf('@');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(`${name} must use repository@sha256:digest form.`);
  }
  return { repository: value.slice(0, separator), digest: value.slice(separator + 1) };
}

try {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const releaseDirectory = resolve(readOption('--release-directory'));
  const repositoryRoot = resolve(readOption('--repository-root', false) ?? process.cwd());
  const publicBuild = validatePublicBuildConfig({
    apiBaseUrl: readOption('--public-api-base-url'),
    publicDomain: readOption('--public-domain'),
    webOrigin: readOption('--web-origin'),
  });
  const manifest = createManifest({
    sourceSha: readOption('--source-sha'),
    sourceTreeSha: readOption('--source-tree-sha'),
    createdAt: readOption('--created-at', false) ?? new Date().toISOString(),
    images: {
      web: parseImage(readOption('--web-image'), 'web image'),
      api: parseImage(readOption('--api-image'), 'api image'),
      worker: parseImage(readOption('--worker-image'), 'worker image'),
      paymentDemo: parseImage(readOption('--payment-demo-image'), 'payment-demo image'),
    },
    composeSha256: hashFile(join(releaseDirectory, 'docker-compose.production.yml')),
    caddySha256: hashFile(join(releaseDirectory, 'deploy', 'Caddyfile')),
    migrations: deriveMigrationSet(repositoryRoot),
    envSchemaSha256: hashFile(join(releaseDirectory, 'deploy', 'environment-schema.json')),
    publicBuild,
  });
  const outputPath = join(releaseDirectory, 'release-manifest.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`RELEASE_MANIFEST_GENERATED=PASS\nRELEASE_ID=${manifest.releaseId}\n`);
} catch (error) {
  process.stderr.write(
    `RELEASE_MANIFEST_GENERATED=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
