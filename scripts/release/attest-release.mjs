import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { attestRelease } from './lib/attestation.mjs';
import { dockerSnapshot } from './lib/docker-snapshot.mjs';

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--')))
    throw new Error(`${name} is required.`);
  return value;
}

function printHelp() {
  process.stdout.write(
    'Usage: node scripts/release/attest-release.mjs --manifest <path> --target <local|docker> [--snapshot <path> | --project <compose-project>] [--json] [--strict]\n',
  );
}

try {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const manifest = JSON.parse(readFileSync(resolve(option('--manifest', true)), 'utf8'));
  const target = option('--target', true);
  if (!['local', 'docker'].includes(target)) throw new Error('--target must be local or docker.');
  const runtimeSnapshot =
    target === 'local'
      ? JSON.parse(readFileSync(resolve(option('--snapshot', true)), 'utf8'))
      : dockerSnapshot({ manifest, project: option('--project', true) });
  const report = attestRelease({ manifest, runtimeSnapshot });
  const output = process.argv.includes('--json')
    ? JSON.stringify(report, null, 2)
    : `RELEASE_ATTESTATION=${report.status}\n${report.failures.map((failure) => `MISMATCH=${failure}`).join('\n')}\n`;
  process.stdout.write(output);
  if (process.argv.includes('--strict') && report.status !== 'PASS') process.exit(1);
} catch (error) {
  process.stderr.write(
    `RELEASE_ATTESTATION=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
