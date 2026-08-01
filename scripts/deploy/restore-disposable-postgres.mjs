import { createReadStream, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const backup = process.argv[2];
const target = process.env.RESTORE_DATABASE_NAME;
if (backup === undefined || !existsSync(resolve(backup))) {
  throw new Error('Pass an existing backup file path.');
}
if (target === undefined || !/^room_management_restore_[a-z0-9_]+$/i.test(target)) {
  throw new Error('RESTORE_DATABASE_NAME must be a disposable room_management_restore_* database.');
}
if (process.env.RESTORE_CONFIRM !== 'RESTORE_DISPOSABLE_ONLY') {
  throw new Error(
    'Set RESTORE_CONFIRM=RESTORE_DISPOSABLE_ONLY after verifying the disposable target.',
  );
}

async function run(args, input) {
  const child = spawn('docker', args, {
    cwd: root,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'inherit', 'inherit'],
    env: process.env,
  });
  if (input !== undefined) createReadStream(input).pipe(child.stdin);
  await new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolvePromise(undefined) : reject(new Error(`restore command exited ${code}`)),
    );
  });
}

const user = process.env.POSTGRES_USER ?? 'room';
await run([
  'compose',
  '-f',
  'docker-compose.production.yml',
  'exec',
  '-T',
  'postgres',
  'dropdb',
  '--if-exists',
  '-U',
  user,
  target,
]);
await run([
  'compose',
  '-f',
  'docker-compose.production.yml',
  'exec',
  '-T',
  'postgres',
  'createdb',
  '-U',
  user,
  target,
]);
await run(
  [
    'compose',
    '-f',
    'docker-compose.production.yml',
    'exec',
    '-T',
    'postgres',
    'pg_restore',
    '-U',
    user,
    '-d',
    target,
    '--clean',
    '--if-exists',
  ],
  resolve(backup),
);
process.stdout.write(`Disposable restore completed: ${target}\n`);
