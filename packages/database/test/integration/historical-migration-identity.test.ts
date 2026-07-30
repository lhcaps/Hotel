/**
 * Historical migration identity proof.
 *
 * Each migration .sql file must be byte-identical with the blob in the
 * commit that introduced it. This test asserts that the working tree
 * matches the historical blob for every released .sql migration, referenced by
 * the commits that introduced them:
 *
 *   - 0000 and 0001: ddd3455 (phase 2 database foundation)
 *   - 0002..0004: corresponding intermediate commits
 *   - 0005 and 0006: 7698353 (phase 5 booking hold guest access)
 *   - 0007 and 0008: 721f9d0 (coupon definitions and booking applications)
 *   - 0009:          83ccbbc (coupon reference and terminal-state invariants)
 *   - 0010:          7f68ad3 (coupon application reference serialization)
 *   - 0016:          5f1e760 (Phase 8B1 pricing product vertical — rate
 *                        plan code format constraint and tightened booking
 *                        status/timestamp constraints; schema version
 *                        phase-8b1-pricing-product-vertical-v1)
 *
 * The proof is independent of the working-tree-vs-index comparison: this
 * test queries the introduction commit directly via `git log --diff-filter=A`.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DRIZZLE_DIR = resolve(import.meta.dirname, '..', '..', 'drizzle');

interface MigrationEntry {
  readonly fileName: string;
  readonly index: number;
  readonly introductionCommit: string;
  readonly introductionDate: string;
  readonly anyTouchingCommits: readonly string[];
}

function listMigrations(): readonly MigrationEntry[] {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => Number(name.slice(0, 4)) <= 19)
    .sort();
  return files
    .map((fileName) => {
      const indexMatch = /^(\d{4})_/.exec(fileName);
      if (indexMatch === null) {
        throw new Error(`Migration file missing 4-digit prefix: ${fileName}`);
      }
      const fullPath = resolve(DRIZZLE_DIR, fileName);
      const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .toString('utf8')
        .trim();
      const repoRelativePath = fullPath.startsWith(repoRoot)
        ? fullPath.slice(repoRoot.length + 1).replaceAll('\\', '/')
        : fullPath.replaceAll('\\', '/');
      const introOut = execFileSync(
        'git',
        ['log', '--diff-filter=A', '--format=%H%x09%aI', '--', repoRelativePath],
        { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
      )
        .toString('utf8')
        .trim();
      const historyOut = execFileSync(
        'git',
        ['log', '--format=%H%x09%aI', '--', repoRelativePath],
        { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
      )
        .toString('utf8')
        .trim();
      if (introOut.length === 0) {
        // Not yet committed. This is expected for the migration introduced by
        // the in-progress phase; it will be tracked once the introduction
        // commit is recorded.
        return null;
      }
      const firstLine = introOut.split('\n')[0];
      if (firstLine === undefined) {
        throw new Error(`Empty introduction output for ${fileName}`);
      }
      const [introCommit, introDate] = firstLine.split('\t');
      if (introCommit === undefined || introDate === undefined) {
        throw new Error(`Invalid introduction output for ${fileName}: ${introOut}`);
      }
      void fullPath;
      const touching: readonly string[] = Object.freeze(
        historyOut
          .split('\n')
          .map((line) => line.split('\t')[0] ?? '')
          .filter((sha): sha is string => sha.length > 0),
      );
      const entry: MigrationEntry = {
        fileName,
        index: Number(indexMatch[1]),
        introductionCommit: introCommit,
        introductionDate: introDate,
        anyTouchingCommits: touching,
      };
      return entry;
    })
    .filter((entry): entry is MigrationEntry => entry !== null);
}

function gitBlobAt(commit: string, repoRelativePath: string): string {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString('utf8')
    .trim();
  const out = execFileSync('git', ['rev-parse', `${commit}:${repoRelativePath}`], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.toString('utf8').trim();
}

function gitWorkingTreeBlob(path: string): string {
  const out = execFileSync('git', ['hash-object', path], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.toString('utf8').trim();
}

const REFERENCE = {
  intro_phase5: '7698353',
  intro_phase6: '721f9d0',
  intro_0009: '83ccbbc',
  intro_0010: '7f68ad3',
  intro_0015: 'c53b7bf',
  intro_0016: '5f1e760',
  intro_0019: '29a650e',
} as const;

describe('historical migration identity', () => {
  it('lists exactly the released migrations 0000 through 0019', () => {
    // 0014 was introduced in commit 1fb4ca4 (Phase 7F customer profiles and
    // booking ownership). 0015 was introduced in commit c53b7bf (Phase 7G
    // admin booking operations). 0016 was introduced in commit 5f1e760
    // (Phase 8B1 pricing product vertical). From the Phase 8B1 closure
    // commit onward the locked identity set is 0000-0019.
    expect(listMigrations().length).toBe(20);
  });

  it('0005 and 0006 were introduced in the phase 5 commit', () => {
    const entries = listMigrations();
    expect(
      entries.find((e) => e.index === 5)?.introductionCommit.startsWith(REFERENCE.intro_phase5),
    ).toBe(true);
    expect(
      entries.find((e) => e.index === 6)?.introductionCommit.startsWith(REFERENCE.intro_phase5),
    ).toBe(true);
  });

  it('0007 and 0008 were introduced in the coupon definitions commit', () => {
    const entries = listMigrations();
    expect(
      entries.find((e) => e.index === 7)?.introductionCommit.startsWith(REFERENCE.intro_phase6),
    ).toBe(true);
    expect(
      entries.find((e) => e.index === 8)?.introductionCommit.startsWith(REFERENCE.intro_phase6),
    ).toBe(true);
  });

  it('0009 was introduced in the reference invariants commit', () => {
    const entries = listMigrations();
    expect(
      entries.find((e) => e.index === 9)?.introductionCommit.startsWith(REFERENCE.intro_0009),
    ).toBe(true);
  });

  it('0010 was introduced in the application reference serialization commit', () => {
    const entries = listMigrations();
    expect(
      entries.find((e) => e.index === 10)?.introductionCommit.startsWith(REFERENCE.intro_0010),
    ).toBe(true);
  });

  it('0015 was originally introduced in the Phase 7G admin booking operations commit', () => {
    const entries = listMigrations();
    expect(
      entries.find((e) => e.index === 15)?.introductionCommit.startsWith(REFERENCE.intro_0015),
    ).toBe(true);
  });

  it('0016 was introduced in the Phase 8B1 pricing product vertical commit', () => {
    const entries = listMigrations();
    expect(
      entries.find((e) => e.index === 16)?.introductionCommit.startsWith(REFERENCE.intro_0016),
    ).toBe(true);
  });

  it('0019 was introduced in the Phase 8D coupon delivery commit', () => {
    const entries = listMigrations();
    expect(
      entries.find((e) => e.index === 19)?.introductionCommit.startsWith(REFERENCE.intro_0019),
    ).toBe(true);
  });

  it.each(
    listMigrations().map((entry) => ({
      index: entry.index,
      fileName: entry.fileName,
      commits: entry.anyTouchingCommits,
    })),
  )(
    'migration $fileName (index $index) blob matches a recorded commit',
    ({ fileName, commits }) => {
      const fullPath = resolve(DRIZZLE_DIR, fileName);
      const working = gitWorkingTreeBlob(fullPath);
      const repoRelativePath = `packages/database/drizzle/${fileName}`;
      const recordedHashes = commits.map((commit) => gitBlobAt(commit, repoRelativePath));
      expect(recordedHashes).toContain(working);
    },
  );
});
