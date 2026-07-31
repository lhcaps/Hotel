#!/usr/bin/env node
/**
 * scripts/package-demo.mjs
 *
 * Build `output/room-management-demo.zip` from the current HEAD of the
 * working tree. The archive is verified (clean extract test) and a
 * SHA256SUMS file is generated alongside it.
 *
 * This script MUST be run from the repo root. It does NOT push, tag,
 * or modify remote refs.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'output');
const zipPath = path.join(outputDir, 'room-management-demo.zip');
const sumsPath = path.join(outputDir, 'room-management-demo.zip.sha256');
const stageDir = path.join(outputDir, 'room-management-demo-stage');

function log(message) {
  process.stdout.write(`[package-demo] ${message}\n`);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
  }
  return result;
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
  }
  return (result.stdout ?? '').trim();
}

async function main() {
  log('Reading HEAD commit SHA');
  const headSha = capture('git', ['rev-parse', 'HEAD']);
  const headShort = headSha.slice(0, 7);
  log(`HEAD = ${headShort}`);

  log('Confirming working tree is clean except for artifacts this script regenerates');
  const porcelain = capture('git', ['status', '--porcelain', '-z']);
  if (porcelain.length > 0) {
    // Allow tracked-file deletions when those paths are also matched
    // by .gitignore. Playwright screenshots are produced under
    // output/playwright/ and are intentionally untracked; if they ever
    // become tracked and are later removed, we still want the archive
    // to match HEAD, not the working tree. The `--porcelain -z` output
    // is NUL-delimited; we split on NUL to avoid CRLF / LF surprises.
    // Git status uses two columns for staged / working-tree changes:
    //   ` D ...` is a working-tree deletion (the common case for
    //   untracked-but-now-removed screenshots).
    //   `D  ...` is a staged deletion (unusual here but equally safe
    //   to ignore when the path is ignored).
    const entries = porcelain.split('\u0000').filter((line) => line.length > 0);
    const offending = entries.filter((line) => !/^ ?D /.test(line));
    if (offending.length > 0) {
      log(`Working tree is dirty:\n${offending.join('\n')}`);
      throw new Error('Refusing to package from a dirty working tree.');
    }
  }

  log('Preparing staging directory');
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(stageDir, { recursive: true });

  log('Exporting tree from HEAD (no worktree noise)');
  run('git', [
    'archive',
    '--format=tar',
    `--prefix=room-management-demo-${headShort}/`,
    'HEAD',
    '-o',
    path.join(outputDir, 'stage.tar'),
  ]);

  log('Extracting tree into staging directory');
  // Use PowerShell's Expand-Archive on Windows because tar is bundled.
  // On POSIX, the system tar handles it.
  if (process.platform === 'win32') {
    run('tar', ['-xf', path.join(outputDir, 'stage.tar'), '-C', stageDir]);
  } else {
    run('tar', ['-xf', path.join(outputDir, 'stage.tar'), '-C', stageDir]);
  }
  await rm(path.join(outputDir, 'stage.tar'), { force: true });

  const extractedRoot = path.join(
    stageDir,
    `room-management-demo-${headShort}`,
  );
  if (!existsSync(extractedRoot)) {
    throw new Error(`Expected ${extractedRoot} to exist after extraction`);
  }

  log('Writing README-DEMO.md into the archive root');
  const readmeSource = path.join(repoRoot, 'README-DEMO.md');
  if (!existsSync(readmeSource)) {
    throw new Error('README-DEMO.md not found at repo root');
  }
  await writeFile(
    path.join(extractedRoot, 'README-DEMO.md'),
    await readFile(readmeSource, 'utf8'),
    'utf8',
  );

  log('Writing verification/INDEX.md into the archive root');
  const verificationDir = path.join(extractedRoot, 'verification');
  await mkdir(verificationDir, { recursive: true });
  const indexLines = [
    '# Verification index',
    '',
    `Captured against commit ${headShort} (${headSha}).`,
    '',
    '## Artifacts',
    '',
    '- `final-acceptance-run1.log` — first Playwright run of `final-local-demo-acceptance.spec.ts`',
    '- `final-acceptance-run2.log` — second Playwright run of the same spec',
    '- `demo-verify.log` — output of `node scripts/demo/verify.mjs`',
    '- `lint.log` — `turbo lint`',
    '- `typecheck.log` — `turbo typecheck`',
    '- `format-check.log` — `prettier --check`',
    '- `db-check.log` — `pnpm db:check`',
    '- `test-unit.log` — `turbo test:unit`',
    '- `build.log` — `turbo build`',
    '- `commit.log` — `git commit` output for the closure commit',
    '',
    '## Commands',
    '',
    '```powershell',
    'pnpm demo:start:local',
    'pnpm demo:verify',
    'npx playwright test tests/e2e/final-local-demo-acceptance.spec.ts --config=playwright.verify.config.ts --workers=1 --retries=0',
    '```',
    '',
  ];
  await writeFile(path.join(verificationDir, 'INDEX.md'), indexLines.join('\n'), 'utf8');

  log('Copying verification logs from .toolcache');
  const logSources = [
    ['.toolcache/final-acceptance-run1.log', 'final-acceptance-run1.log'],
    ['.toolcache/final-acceptance-run2.log', 'final-acceptance-run2.log'],
    ['.toolcache/demo-verify.log', 'demo-verify.log'],
    ['format-check.log', 'format-check.log'],
    ['lint.log', 'lint.log'],
    ['typecheck.log', 'typecheck.log'],
    ['db-check.log', 'db-check.log'],
    ['test-unit.log', 'test-unit.log'],
    ['build.log', 'build.log'],
    ['commit.log', 'commit.log'],
  ];
  for (const [src, dest] of logSources) {
    const srcPath = path.join(repoRoot, src);
    if (existsSync(srcPath)) {
      const data = await readFile(srcPath, 'utf8');
      await writeFile(path.join(verificationDir, dest), data, 'utf8');
    }
  }

  log('Re-zipping staging directory');
  await rm(zipPath, { force: true });
  if (process.platform === 'win32') {
    // PowerShell's Compress-Archive flattens the top-level directory
    // when given `-Path "${dir}\\*"`, so we use the bundled tar to
    // preserve the `room-management-demo-${headShort}/` prefix.
    // bsdtar on Windows does not honour `--directory=`, so we run it
    // from the staging directory and reference the inner folder by
    // relative path.
    run(
      'tar',
      ['-a', '-cf', zipPath, `room-management-demo-${headShort}`],
      { cwd: stageDir },
    );
  } else {
    run('zip', ['-rq', zipPath, `room-management-demo-${headShort}`], {
      cwd: stageDir,
    });
  }

  log('Computing SHA256');
  const zipStat = await stat(zipPath);
  const zipBuffer = await readFile(zipPath);
  const sha = createHash('sha256').update(zipBuffer).digest('hex');
  const sumLine = `${sha}  room-management-demo.zip\n`;
  await writeFile(sumsPath, sumLine, 'utf8');

  log('Cleaning up staging directory');
  await rm(stageDir, { recursive: true, force: true });

  log(`Done.`);
  log(`Archive : ${zipPath}`);
  log(`Size    : ${(zipStat.size / 1024 / 1024).toFixed(2)} MiB`);
  log(`SHA-256 : ${sha}`);
  log(`Sums    : ${sumsPath}`);
}

main().catch((err) => {
  process.stderr.write(`[package-demo] ${err.message}\n`);
  process.exitCode = 1;
});