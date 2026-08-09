import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { attestRelease } from './lib/attestation.mjs';

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--')))
    throw new Error(`${name} is required.`);
  return value;
}

function printHelp() {
  process.stdout.write(
    'Usage: node scripts/release/attest-release.mjs --manifest <path> --target <local|docker> [--snapshot <path>] [--json] [--strict]\n',
  );
}

function dockerSnapshot() {
  const identifiers = execFileSync('docker', ['ps', '--quiet'], { encoding: 'utf8' })
    .split(/\r?\n/u)
    .filter(Boolean);
  const inspected =
    identifiers.length === 0
      ? []
      : JSON.parse(execFileSync('docker', ['inspect', ...identifiers], { encoding: 'utf8' }));
  const services = Object.fromEntries(
    inspected
      .map((container) => [container.Config?.Labels?.['com.docker.compose.service'], container])
      .filter(([service]) => typeof service === 'string')
      .map(([service, container]) => [
        service,
        {
          image: container.RepoDigests?.[0] ?? container.Image,
          releaseId:
            container.Config?.Labels?.RELEASE_ID ??
            container.Config?.Env?.find((entry) => entry.startsWith('RELEASE_ID='))?.slice(
              'RELEASE_ID='.length,
            ),
          workingDirectory: container.Config?.Labels?.['com.docker.compose.project.working_dir'],
          state: container.State?.Running ? 'running' : container.State?.Status,
        },
      ]),
  );
  return { services, migrationCompleted: false };
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
      : dockerSnapshot();
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
