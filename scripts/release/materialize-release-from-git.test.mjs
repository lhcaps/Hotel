import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { materializeReleaseFromGit } from './materialize-release-from-git.mjs';

function git(repositoryRoot, args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

test('materialization contains only the approved committed tree, never local overlays', () => {
  const root = mkdtempSync(join(tmpdir(), 'room-release-archive-'));
  const repositoryRoot = join(root, 'repository');
  const destination = join(root, 'release');
  try {
    execFileSync('git', ['init', '--quiet', repositoryRoot]);
    git(repositoryRoot, ['config', 'user.email', 'release-test@example.test']);
    git(repositoryRoot, ['config', 'user.name', 'Release Test']);
    writeFileSync(join(repositoryRoot, 'tracked.txt'), 'committed\n', 'utf8');
    git(repositoryRoot, ['add', 'tracked.txt']);
    git(repositoryRoot, ['commit', '--quiet', '--message', 'fixture']);
    const sourceSha = git(repositoryRoot, ['rev-parse', 'HEAD']);
    const treeSha = git(repositoryRoot, ['rev-parse', 'HEAD^{tree}']);
    const committedTrackedContent = execFileSync('git', ['show', `${sourceSha}:tracked.txt`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    writeFileSync(join(repositoryRoot, 'tracked.txt'), 'working-tree-overlay\n', 'utf8');
    writeFileSync(join(repositoryRoot, 'untracked.txt'), 'must-not-release\n', 'utf8');

    const result = materializeReleaseFromGit({ repositoryRoot, sourceSha, destination });

    assert.equal(result.sourceSha, sourceSha);
    assert.equal(result.treeSha, treeSha);
    assert.equal(readFileSync(join(destination, 'tracked.txt'), 'utf8'), committedTrackedContent);
    assert.equal(existsSync(join(destination, 'untracked.txt')), false);
    assert.deepEqual(JSON.parse(readFileSync(join(destination, 'release-source.json'), 'utf8')), {
      sourceSha,
      treeSha,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('materialization rejects an abbreviated or unknown source revision before creating output', () => {
  const root = mkdtempSync(join(tmpdir(), 'room-release-archive-invalid-'));
  const repositoryRoot = join(root, 'repository');
  const destination = join(root, 'release');
  try {
    execFileSync('git', ['init', '--quiet', repositoryRoot]);
    assert.throws(
      () => materializeReleaseFromGit({ repositoryRoot, sourceSha: 'deadbeef', destination }),
      /full source SHA/i,
    );
    assert.equal(existsSync(destination), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
