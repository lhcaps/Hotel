import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SOURCE_SHA = /^[a-f0-9]{40,64}$/iu;

function git(repositoryRoot, args, options = {}) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd: repositoryRoot,
    encoding: options.encoding ?? 'utf8',
    windowsHide: true,
  });
}

function resolveCommit(repositoryRoot, sourceSha) {
  if (typeof sourceSha !== 'string' || !SOURCE_SHA.test(sourceSha)) {
    throw new Error('A full source SHA is required for release materialization.');
  }
  const commit = git(repositoryRoot, ['rev-parse', '--verify', `${sourceSha}^{commit}`]).trim();
  if (commit !== sourceSha.toLowerCase()) {
    throw new Error('Release materialization source SHA must resolve without abbreviation.');
  }
  const treeSha = git(repositoryRoot, ['rev-parse', '--verify', `${commit}^{tree}`]).trim();
  return { sourceSha: commit, treeSha };
}

export function materializeReleaseFromGit({ repositoryRoot, sourceSha, destination }) {
  const root = resolve(repositoryRoot);
  const output = resolve(destination);
  if (existsSync(output)) throw new Error('Release materialization destination already exists.');
  const identity = resolveCommit(root, sourceSha);
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output);
  try {
    const archive = git(root, ['archive', '--format=tar', identity.sourceSha], {
      encoding: 'buffer',
    });
    execFileSync('tar', ['-xf', '-', '-C', output], {
      input: archive,
      windowsHide: true,
    });
    writeFileSync(
      resolve(output, 'release-source.json'),
      `${JSON.stringify(identity, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    return identity;
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--'))) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

if (import.meta.main) {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      process.stdout.write(
        'Usage: node scripts/release/materialize-release-from-git.mjs --repository-root <path> --source-sha <sha> --destination <path>\n',
      );
      process.exit(0);
    }
    const result = materializeReleaseFromGit({
      repositoryRoot: option('--repository-root', true),
      sourceSha: option('--source-sha', true),
      destination: option('--destination', true),
    });
    process.stdout.write(
      `RELEASE_MATERIALIZATION=PASS\nSOURCE_SHA=${result.sourceSha}\nSOURCE_TREE_SHA=${result.treeSha}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `RELEASE_MATERIALIZATION=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
