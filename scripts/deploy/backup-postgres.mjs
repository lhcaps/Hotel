import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const outputDir = resolve(process.env.BACKUP_DIR ?? resolve(root, 'backups'));
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true, mode: 0o700 });
const releaseSha = process.env.RELEASE_SHA;
if (!/^[a-f0-9]{40,64}$/i.test(releaseSha ?? ''))
  throw new Error('RELEASE_SHA must be a full commit SHA');
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const output = resolve(outputDir, `room-management-${releaseSha.slice(0, 12)}-${stamp}.dump`);
const compose = [
  'compose',
  '-f',
  'docker-compose.production.yml',
  'exec',
  '-T',
  'postgres',
  'pg_dump',
  '-Fc',
  '-U',
  process.env.POSTGRES_USER ?? 'room',
  process.env.POSTGRES_DB ?? 'room_management',
];
const child = spawn('docker', compose, {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
  env: process.env,
});
const hash = createHash('sha256');
const stream = createWriteStream(output, { mode: 0o600 });
child.stdout.on('data', (chunk) => hash.update(chunk));
child.stdout.pipe(stream);
await new Promise((resolvePromise, reject) => {
  child.once('error', reject);
  child.once('exit', (code) =>
    code === 0 ? resolvePromise(undefined) : reject(new Error(`pg_dump exited ${code}`)),
  );
});
writeFileSync(`${output}.sha256`, `${hash.digest('hex')}  ${output.split(/[\\/]/).at(-1)}\n`, {
  mode: 0o600,
});
process.stdout.write(`Backup created: ${output}\n`);
