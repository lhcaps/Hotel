#!/usr/bin/env node
/**
 * scripts/package-demo.mjs
 *
 * Build the customer-delivery ZIP from the current HEAD.
 *
 * Rules:
 *   - Archive root contains README-DEMO.md, verification/, and the
 *     source tree necessary to run the demo.
 *   - Excluded from the archive:
 *       * node_modules/, .git/, .next/, .turbo/, coverage/, storybook-static/
 *       * .env, .env.* (except .env.example)
 *       * output/, test-results/, playwright-report/, .demo/
 *       * docs/handoffs/** (internal agent / policy handoffs)
 *       * AGENT_RULES.md, API_CONTRACT.md, AUTH_RBAC_POLICY.md,
 *         DB_MIGRATION_POLICY.md, DESIGN.md, FRONTEND_RULES.md,
 *         MCP_SECURITY_POLICY.md, OBSERVABILITY_POLICY.md,
 *         RELEASE_CHECKLIST.md, TESTING_STRATEGY.md
 *       * .toolcache/, .superpowers/, .cursor/, .vscode/
 *       * Generated artefacts under apps/api/dist, apps/web/.next,
 *         apps/worker/dist, packages-star/dist (where packages-star is
 *         each package directory under packages/)
 *   - The SHA-256 of the resulting ZIP is written NEXT TO the archive
 *     (at output/room-management-demo.zip.sha256). It is NOT embedded
 *     inside the archive itself - the external .sha256 file is the
 *     authoritative integrity record.
 *   - The repository working tree MUST be clean. A release archive is
 *     identified by its committed HEAD, so shipping an overlay would make
 *     its prefix and release SHA untruthful.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile, stat, readFile, readdir } from 'node:fs/promises';
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
  process.stdout.write('[package-demo] ' + message + '\n');
}

function run(cmd, args, opts) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...(opts ?? {}),
  });
  if (result.status !== 0) {
    throw new Error(
      'Command failed (' + String(result.status) + '): ' + cmd + ' ' + args.join(' '),
    );
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
    throw new Error(
      'Command failed (' + String(result.status) + '): ' + cmd + ' ' + args.join(' '),
    );
  }
  return (result.stdout ?? '').trim();
}

async function* walk(dir, baseDir) {
  const root = baseDir ?? dir;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      yield* walk(full, root);
    } else if (entry.isFile()) {
      yield rel;
    }
  }
}

async function main() {
  log('Reading HEAD commit SHA');
  const headSha = capture('git', ['rev-parse', 'HEAD']);
  const headShort = headSha.slice(0, 7);
  log('HEAD = ' + headShort);

  const dirty = capture('git', ['status', '--porcelain=v1', '--untracked-files=all']);
  if (dirty.length > 0) {
    throw new Error(
      'Refusing to package: release archives require a clean committed HEAD. Commit or remove every working-tree change first.',
    );
  }

  log('Source of truth: clean committed HEAD via git archive');

  log('Preparing staging directory without removing unrelated local output');
  await mkdir(outputDir, { recursive: true });
  await rm(zipPath, { force: true });
  await rm(sumsPath, { force: true });
  await rm(stageDir, { recursive: true, force: true });
  await rm(path.join(outputDir, 'stage.tar'), { force: true });
  await mkdir(stageDir, { recursive: true });

  log('Exporting tree from HEAD (no worktree noise)');
  run('git', [
    'archive',
    '--format=tar',
    '--prefix=room-management-demo-' + headShort + '/',
    'HEAD',
    '-o',
    path.join(outputDir, 'stage.tar'),
  ]);

  log('Extracting tree into staging directory');
  run('tar', ['-xf', path.join(outputDir, 'stage.tar'), '-C', stageDir]);
  await rm(path.join(outputDir, 'stage.tar'), { force: true });

  const extractedRoot = path.join(stageDir, 'room-management-demo-' + headShort);
  if (!existsSync(extractedRoot)) {
    throw new Error('Expected ' + extractedRoot + ' to exist after extraction');
  }

  if (!existsSync(path.join(extractedRoot, 'README-DEMO.md'))) {
    throw new Error('README-DEMO.md not found at repo root');
  }

  log('Writing verification/INDEX.md (external SHA-256 is authoritative)');
  const verificationDir = path.join(extractedRoot, 'verification');
  await mkdir(verificationDir, { recursive: true });
  const indexLines = [
    '# Verification index',
    '',
    'Captured against commit ' + headShort + ' (' + headSha + ').',
    '',
    '## How to verify the archive integrity',
    '',
    'The SHA-256 of room-management-demo.zip lives in the file',
    'output/room-management-demo.zip.sha256 next to the archive, NOT',
    'inside it. Use that external file as the authoritative integrity',
    'record:',
    '',
    '    Get-FileHash output/room-management-demo.zip -Algorithm SHA256',
    '',
    'On POSIX systems:',
    '',
    '    sha256sum output/room-management-demo.zip',
    '',
    'The in-archive SHA256-EXPECTED.txt is only an advisory. It cannot',
    'contain the archive hash without becoming stale or self-referential.',
    'Always compare against the detached .sha256 file shipped next to',
    'the archive.',
    '',
    '## Artifacts in this directory',
    '',
    '- INDEX.md - this file',
    '- SHA256-EXPECTED.txt - advisory that points to the detached hash file',
    '',
    '## Reproduction',
    '',
    '    pnpm install --frozen-lockfile',
    '    pnpm demo:db:create',
    '    pnpm demo:seed',
    '    .\\RUN-DEMO.ps1',
    '    .\\VERIFY-DEMO.ps1',
    '    npx playwright test tests/e2e/final-local-demo-acceptance.spec.ts --config=playwright.verify.config.ts --workers=1 --retries=0',
    '    .\\STOP-DEMO.ps1',
    '',
  ];
  await writeFile(path.join(verificationDir, 'INDEX.md'), indexLines.join('\n'), 'utf8');

  log('Stripping artefacts that must not ship to the customer');
  const strippingRoots = [
    path.join(extractedRoot, 'node_modules'),
    path.join(extractedRoot, '.git'),
    path.join(extractedRoot, '.next'),
    path.join(extractedRoot, '.toolcache'),
    path.join(extractedRoot, '.superpowers'),
    path.join(extractedRoot, '.cursor'),
    path.join(extractedRoot, '.vscode'),
    path.join(extractedRoot, '.idea'),
    path.join(extractedRoot, '.demo'),
    path.join(extractedRoot, 'output'),
    path.join(extractedRoot, 'test-results'),
    path.join(extractedRoot, 'playwright-report'),
    path.join(extractedRoot, 'docs', 'handoffs'),
  ];
  for (const target of strippingRoots) {
    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true });
    }
  }

  log('Pruning generated build artefacts and policy markdown');
  const filePrune = [
    path.join(extractedRoot, 'AGENT_RULES.md'),
    path.join(extractedRoot, 'API_CONTRACT.md'),
    path.join(extractedRoot, 'AUTH_RBAC_POLICY.md'),
    path.join(extractedRoot, 'DB_MIGRATION_POLICY.md'),
    path.join(extractedRoot, 'DESIGN.md'),
    path.join(extractedRoot, 'FRONTEND_RULES.md'),
    path.join(extractedRoot, 'MCP_SECURITY_POLICY.md'),
    path.join(extractedRoot, 'OBSERVABILITY_POLICY.md'),
    path.join(extractedRoot, 'RELEASE_CHECKLIST.md'),
    path.join(extractedRoot, 'TESTING_STRATEGY.md'),
    path.join(extractedRoot, '.env'),
    path.join(extractedRoot, 'docs', 'docs.zip'),
  ];
  for (const target of filePrune) {
    if (existsSync(target)) {
      await rm(target, { force: true });
    }
  }

  log('Pruning .env.* variants (keeping only .env.example)');
  for await (const rel of walk(extractedRoot)) {
    if (rel === '.env.example') continue;
    if (rel === '.env' || rel.startsWith('.env.')) {
      await rm(path.join(extractedRoot, rel), { force: true });
    }
  }

  log('Pruning dist/, .next/, coverage/, storybook-static/, *.tsbuildinfo');
  for await (const rel of walk(extractedRoot)) {
    if (
      rel.includes('/dist/') ||
      rel.endsWith('/dist') ||
      rel.endsWith('.tsbuildinfo') ||
      rel.includes('/coverage/') ||
      rel.endsWith('/coverage') ||
      rel.includes('/.next/') ||
      rel.endsWith('/.next') ||
      rel.includes('/storybook-static/') ||
      rel.endsWith('/storybook-static')
    ) {
      await rm(path.join(extractedRoot, rel), { force: true });
    }
  }

  log('Writing in-archive advisory (verification/SHA256-EXPECTED.txt)');
  // The ZIP's final hash CANNOT be embedded inside the ZIP itself
  // because zipping changes the hash. The advisory file therefore
  // instructs the operator to consult the external
  // `output/room-management-demo.zip.sha256` next to the archive.
  // The two reference documents are README-DEMO.md and
  // verification/INDEX.md.
  await writeFile(
    path.join(verificationDir, 'SHA256-EXPECTED.txt'),
    [
      '# SHA-256 advisory',
      '',
      'The authoritative SHA-256 of room-management-demo.zip lives in',
      '`output/room-management-demo.zip.sha256` next to the archive,',
      'NOT inside this archive. This file is intentionally NOT an',
      'embedded hash because doing so would either be stale (computed',
      'before zipping) or self-referential (computed after zipping).',
      '',
      'Verification:',
      '',
      '    Get-FileHash output/room-management-demo.zip -Algorithm SHA256',
      '',
      'Compare the output to the single line in',
      '`output/room-management-demo.zip.sha256`.',
      '',
    ].join('\n'),
    'utf8',
  );

  log('Re-zipping staging directory');
  await rm(zipPath, { force: true });
  if (process.platform === 'win32') {
    run('tar', ['-a', '-cf', zipPath, 'room-management-demo-' + headShort], {
      cwd: stageDir,
    });
  } else {
    run('zip', ['-rq', zipPath, 'room-management-demo-' + headShort], {
      cwd: stageDir,
    });
  }

  log('Computing final SHA-256 over the archive and writing the external .sha256');
  const zipStat = await stat(zipPath);
  const zipBuffer = await readFile(zipPath);
  const sha = createHash('sha256').update(zipBuffer).digest('hex');
  const finalSumLine = sha + '  room-management-demo.zip\n';
  await writeFile(sumsPath, finalSumLine, 'utf8');

  log('Cleaning up staging directory');
  await rm(stageDir, { recursive: true, force: true });

  log('Done.');
  log('Archive  : ' + zipPath);
  log('Size     : ' + (zipStat.size / 1024 / 1024).toFixed(2) + ' MiB');
  log('Prefix   : room-management-demo-' + headShort + '/');
  log('SHA-256  : ' + sha);
  log('SHA file : ' + sumsPath + ' (authoritative)');
}

main().catch((err) => {
  process.stderr.write('[package-demo] ' + err.message + '\n');
  process.exitCode = 1;
});
