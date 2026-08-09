import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { verifyManifest } from './lib/manifest.mjs';

function printHelp() {
  process.stdout.write(
    `Usage: node scripts/release/verify-release-manifest.mjs --release-directory <path> [--repository-root <path>]\n`,
  );
}

function readOption(name, required = true) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--'))) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

try {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const releaseDirectory = resolve(readOption('--release-directory'));
  const repositoryRoot = resolve(readOption('--repository-root', false) ?? process.cwd());
  const manifest = JSON.parse(
    readFileSync(resolve(releaseDirectory, 'release-manifest.json'), 'utf8'),
  );
  verifyManifest({ manifest, releaseDirectory, repositoryRoot });
  process.stdout.write(`RELEASE_MANIFEST=PASS\nRELEASE_ID=${manifest.releaseId}\n`);
} catch (error) {
  process.stderr.write(
    `RELEASE_MANIFEST=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
