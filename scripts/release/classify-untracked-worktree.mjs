import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const SEMANTIC_CANDIDATES = new Set([
  '0030_b0_bootstrap_template.sql',
  '0030_b0_production_bootstrap.sql',
  'docs/customer-v2/CUSTOMER_ROUTE_MATRIX.md',
  'tests/e2e/operations-v3-admin-responsive-a11y.spec.ts',
  'tests/e2e/stage3-auth-integration.spec.ts',
]);

function git(repositoryRoot, args) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//u, '');
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function classify(pathName) {
  const normalized = normalizePath(pathName);
  const lower = normalized.toLowerCase();

  if (
    lower === '.agents' ||
    lower.startsWith('.agents/') ||
    lower === '_bmad' ||
    lower.startsWith('_bmad/') ||
    lower === '_bmad-output' ||
    lower.startsWith('_bmad-output/')
  ) {
    return {
      bucket: 'BMAD_GENERATED',
      decision: 'PRESERVE; do not stage or package without an explicit project decision.',
    };
  }

  if (lower === '.release-candidate-b42ab08a' || lower.startsWith('.release-candidate-b42ab08a/')) {
    return {
      bucket: 'HISTORICAL_RELEASE_CANDIDATE',
      decision: 'PRESERVE for forensics; never execute or stage as current release source.',
    };
  }

  if (SEMANTIC_CANDIDATES.has(normalized)) {
    return {
      bucket: 'SEMANTIC_CANDIDATE_OWNER_REVIEW',
      decision: 'PRESERVE pending owner review; do not stage, delete, or execute.',
    };
  }

  if (
    /(?:^|\/)\.(?:tar|tar\.gz|tgz|zip)$/iu.test(lower) ||
    lower.endsWith('.tar') ||
    lower.endsWith('.tar.gz') ||
    lower.endsWith('.tgz') ||
    lower.endsWith('.zip')
  ) {
    return {
      bucket: 'ARCHIVE_OR_EXPORT_OWNER_REVIEW',
      decision: 'PRESERVE pending retention decision; never use as release source.',
    };
  }

  if (lower === 'release_attestation_2026-08-15.md') {
    return {
      bucket: 'INVALID_HISTORICAL_EVIDENCE',
      decision: 'PRESERVE as untrusted historical material; it cannot establish current attestation.',
    };
  }

  if (
    !normalized.includes('/') &&
    /\.(?:md|txt)$/iu.test(lower)
  ) {
    return {
      bucket: 'HISTORICAL_REPORT_OWNER_REVIEW',
      decision: 'PRESERVE pending owner review; do not promote to current evidence.',
    };
  }

  if (
    !normalized.includes('/') ||
    lower.startsWith('scripts/deploy/') ||
    lower.startsWith('deploy/')
  ) {
    return {
      bucket: 'ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW',
      decision: 'PRESERVE pending exact-path owner classification; never execute as governed tooling.',
    };
  }

  return {
    bucket: 'UNREVIEWED_PRESERVE_OWNER_REVIEW',
    decision: 'PRESERVE pending owner classification; no staging, deletion, or execution.',
  };
}

function listUntracked(repositoryRoot) {
  const output = git(repositoryRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  return output
    .split('\0')
    .filter(Boolean)
    .map(normalizePath)
    .sort(compareStrings);
}

function render({ repositoryRoot, outputPath, snapshotDate }) {
  const paths = listUntracked(repositoryRoot);
  const branch = git(repositoryRoot, ['branch', '--show-current']).trim() || '(detached)';
  const head = git(repositoryRoot, ['rev-parse', 'HEAD']).trim();
  const records = paths.map((path) => ({ path, ...classify(path) }));
  const counts = new Map();
  for (const record of records) counts.set(record.bucket, (counts.get(record.bucket) ?? 0) + 1);

  const lines = [
    '# Untracked worktree inventory',
    '',
    `Snapshot date: ${snapshotDate}`,
    `Branch: \`${branch}\``,
    `HEAD at capture: \`${head}\``,
    `Untracked path count: **${records.length}**`,
    '',
    'This report is generated from `git ls-files --others --exclude-standard` and classifies every path individually. It is a preservation and owner-review record, not authorization to delete, archive, stage, execute, or deploy anything. Release material must be derived from an exact committed SHA and excludes every untracked path.',
    '',
    '## Classification counts',
    '',
    '| Bucket | Count | Default decision |',
    '| --- | ---: | --- |',
  ];

  for (const [bucket, count] of [...counts.entries()].sort(([a], [b]) => compareStrings(a, b))) {
    const decision = classify(records.find((record) => record.bucket === bucket).path).decision;
    lines.push(`| \`${bucket}\` | ${count} | ${decision} |`);
  }

  lines.push(
    '',
    '## Individual path classification',
    '',
    '| Path | Bucket | Decision |',
    '| --- | --- | --- |',
  );

  for (const record of records) {
    const pathForTable = record.path.replaceAll('|', '\\|');
    lines.push(`| \`${pathForTable}\` | \`${record.bucket}\` | ${record.decision} |`);
  }

  lines.push(
    '',
    '## Safety boundary',
    '',
    '- Unknown and semantic paths remain preserved until an owner makes an exact-path decision.',
    '- Do not run root `b0-*`, `check-*`, `deploy-*.sh`, `verify-*`, stage/repro/bootstrap helpers, historical archives, or any path listed above as production tooling.',
    '- A candidate approved for source must be reviewed, tested, and committed before release materialization. A disposable path may be removed only after its absolute target and owner approval are recorded separately.',
  );

  const report = `${lines.join('\n')}\n`;
  if (outputPath !== undefined) {
    const destination = resolve(repositoryRoot, outputPath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, report, 'utf8');
  }
  return report;
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

if (import.meta.main) {
  try {
    const repositoryRoot = resolve(option('--repository-root') ?? process.cwd());
    if (!existsSync(repositoryRoot)) throw new Error('Repository root does not exist.');
    const snapshotDate = option('--snapshot-date') ?? new Date().toISOString().slice(0, 10);
    const report = render({
      repositoryRoot,
      outputPath: option('--output'),
      snapshotDate,
    });
    if (process.argv.includes('--output')) {
      process.stdout.write(`UNTRACKED_INVENTORY=PASS\nPATH_COUNT=${report.match(/^Untracked path count: \*\*(\d+)\*\*$/mu)?.[1] ?? 'unknown'}\n`);
    } else {
      process.stdout.write(report);
    }
  } catch (error) {
    process.stderr.write(`UNTRACKED_INVENTORY=FAIL\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

export { classify, listUntracked, render };
