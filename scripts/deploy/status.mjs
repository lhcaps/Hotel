import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const composeFile = resolve(root, 'docker-compose.production.yml');
const publicOrigin = process.env.WEB_ORIGIN;

if (typeof publicOrigin !== 'string' || !publicOrigin.startsWith('https://')) {
  process.stderr.write('WEB_ORIGIN must be an HTTPS origin.\n');
  process.exit(1);
}

const paths = ['/health', '/api/v1/health/live', '/api/v1/health/ready'];
let failed = false;
for (const path of paths) {
  try {
    const response = await fetch(new URL(path, publicOrigin), { redirect: 'error' });
    process.stdout.write(`${path} ${response.status}\n`);
    if (response.status !== 200) failed = true;
  } catch {
    process.stdout.write(`${path} unreachable\n`);
    failed = true;
  }
}
const result = spawnSync('docker', ['compose', '-f', composeFile, 'ps'], {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
});
process.stdout.write(result.stdout);
if (result.status !== 0 || failed) process.exitCode = 1;
