import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('release manifest CLI help does not require a target or environment input', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/release/generate-release-manifest.mjs', '--help'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: false,
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
});
