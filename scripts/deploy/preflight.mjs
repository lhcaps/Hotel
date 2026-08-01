import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const composeFile = resolve(root, 'docker-compose.production.yml');
const required = [
  'RELEASE_SHA',
  'PUBLIC_DOMAIN',
  'PAYMENT_DEMO_DOMAIN',
  'NEXT_PUBLIC_API_BASE_URL',
  'INTERNAL_API_BASE_URL',
  'WEB_ORIGIN',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
  'PAYMENT_DEMO_CONTROL_TOKEN',
];

function invalid(value) {
  return (
    value === undefined || value === '' || /REPLACE_ME|REPLACE_WITH|example\.invalid/i.test(value)
  );
}

const failures = required.filter((key) => invalid(process.env[key]));
if (!/^[a-f0-9]{40,64}$/i.test(process.env.RELEASE_SHA ?? '')) {
  failures.push('RELEASE_SHA must be a full 40-64 hexadecimal commit SHA');
}
if (!existsSync(composeFile)) failures.push('docker-compose.production.yml is missing');

if (failures.length > 0) {
  process.stderr.write(`Production preflight failed: ${failures.join(', ')}\n`);
  process.exitCode = 1;
} else {
  const result = spawnSync('docker', ['compose', '-f', composeFile, 'config', '--quiet'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    process.stderr.write('Production preflight failed: Docker Compose configuration is invalid.\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Production preflight passed for RELEASE_SHA=${process.env.RELEASE_SHA}\n`,
    );
  }
}
