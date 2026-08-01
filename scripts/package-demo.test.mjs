#!/usr/bin/env node
/**
 * Regression test for release provenance.
 *
 * A package named after a commit must contain only that clean committed tree.
 * The test runs the real packager against a disposable dirty Git repository
 * and asserts it fails before an output directory is created.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const repo = mkdtempSync(join(tmpdir(), 'room-package-demo-dirty-'));
const packager = resolve(import.meta.dirname, 'package-demo.mjs');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repo,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr}`);
  }
}

run('git', ['init', '--quiet']);
run('git', ['config', 'user.email', 'test@example.invalid']);
run('git', ['config', 'user.name', 'Package test']);
writeFileSync(join(repo, 'README-DEMO.md'), '# Demo\n', 'utf8');
run('git', ['add', 'README-DEMO.md']);
run('git', ['commit', '--quiet', '-m', 'fixture']);

writeFileSync(join(repo, 'README-DEMO.md'), '# Dirty demo\n', 'utf8');
const result = spawnSync(process.execPath, [packager], {
  cwd: repo,
  encoding: 'utf8',
  shell: false,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const passed =
  result.status !== 0 &&
  /clean committed HEAD/i.test(output) &&
  existsSync(join(repo, 'output')) === false;

process.stdout.write(
  `${passed ? 'PASS' : 'FAIL'} package-demo rejects a dirty repository before output creation\n`,
);
if (!passed) {
  process.stderr.write(`status=${String(result.status)} output=${output}\n`);
  process.exitCode = 1;
}

const cleanRepo = mkdtempSync(join(tmpdir(), 'room-package-demo-clean-'));
function runClean(command, args) {
  const result = spawnSync(command, args, {
    cwd: cleanRepo,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result;
}

runClean('git', ['init', '--quiet']);
runClean('git', ['config', 'user.email', 'test@example.invalid']);
runClean('git', ['config', 'user.name', 'Package test']);
writeFileSync(join(cleanRepo, 'README-DEMO.md'), '# Demo\n', 'utf8');
runClean('git', ['add', 'README-DEMO.md']);
runClean('git', ['commit', '--quiet', '-m', 'fixture']);

const cleanResult = spawnSync(process.execPath, [packager], {
  cwd: cleanRepo,
  encoding: 'utf8',
  shell: false,
});
const head = runClean('git', ['rev-parse', '--short', 'HEAD']).stdout.trim();
const index = spawnSync(
  'tar',
  [
    '-xOf',
    join(cleanRepo, 'output', 'room-management-demo.zip'),
    `room-management-demo-${head}/verification/INDEX.md`,
  ],
  { cwd: cleanRepo, encoding: 'utf8', shell: false },
);
const cleanPassed =
  cleanResult.status === 0 &&
  index.status === 0 &&
  /external file as the authoritative integrity/i.test(index.stdout ?? '') &&
  /final-acceptance-run1\.log/i.test(index.stdout ?? '') === false &&
  /single-line authoritative hash/i.test(index.stdout ?? '') === false;

process.stdout.write(
  `${cleanPassed ? 'PASS' : 'FAIL'} package-demo writes truthful in-archive integrity guidance\n`,
);
if (!cleanPassed) {
  process.stderr.write(
    `status=${String(cleanResult.status)} index=${index.stdout ?? index.stderr ?? ''}\n`,
  );
  process.exitCode = 1;
}
