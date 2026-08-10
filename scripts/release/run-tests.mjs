import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const testFiles = readdirSync(import.meta.dirname, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.mjs'))
  .map((entry) => join(import.meta.dirname, entry.name))
  .sort();

if (testFiles.length === 0) {
  throw new Error('No release-integrity test files were found.');
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: false,
});

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
