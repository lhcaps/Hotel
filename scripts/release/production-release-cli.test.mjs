import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function deploy(args) {
  return spawnSync(process.execPath, ['scripts/release/deploy-release.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
}

function rollback(args) {
  return spawnSync(process.execPath, ['scripts/release/rollback-release.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
}

test('production deploy has a distinct approval-gated interface instead of an isolated-only guard', () => {
  const result = deploy(['--target', 'production', '--dry-run']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--approval-file is required/u);
  assert.doesNotMatch(result.stderr, /Only the isolated target/u);
});

test('production rollback has a distinct approval-gated interface instead of an isolated-only guard', () => {
  const result = rollback(['--target', 'production', '--dry-run']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--approval-file is required/u);
  assert.doesNotMatch(result.stderr, /Only the isolated target/u);
});
