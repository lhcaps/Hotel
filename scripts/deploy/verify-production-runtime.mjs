import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const image = argument('--image') ?? 'room-management-migrate:latest';
const releaseSha = argument('--release-sha') ?? process.env.RELEASE_SHA;
const composeProject = `roomruntime${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const temporaryRoot = mkdtempSync(join(tmpdir(), 'room-production-runtime-'));
const composeFile = join(temporaryRoot, 'compose.yml');

if (!/^[a-f0-9]{40,64}$/i.test(releaseSha ?? '')) {
  throw new Error('A full --release-sha is required for runtime image verification.');
}

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    ...options,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${String(result.status)}.\n${output}`);
  }
  process.stdout.write(`PASS ${label}\n`);
  return output.trim();
}

function runNode(label, workspace, program) {
  return run(label, 'docker', [
    'run',
    '--rm',
    '--entrypoint',
    'node',
    '--workdir',
    `/srv/room-management/${workspace}`,
    image,
    '--input-type=module',
    '-e',
    program,
  ]);
}

function assertRuntimeDependencies(workspace) {
  return runNode(
    `runtime dependencies resolve from ${workspace}`,
    workspace,
    "import { readFile } from 'node:fs/promises'; const manifest = JSON.parse(await readFile('package.json', 'utf8')); for (const dependency of Object.keys(manifest.dependencies ?? {})) { const dependencyManifest = JSON.parse(await readFile(`node_modules/${dependency}/package.json`, 'utf8')); const exportsEntry = dependencyManifest.exports; const candidates = [dependencyManifest.main, dependencyManifest.module, typeof exportsEntry === 'string' ? exportsEntry : undefined, exportsEntry?.['.']?.import, exportsEntry?.['.']?.default, exportsEntry?.['.']?.require].filter((entry) => typeof entry === 'string'); const hasJavaScriptEntry = candidates.some((entry) => !entry.endsWith('.css')); if (hasJavaScriptEntry) console.log(`${dependency}=${import.meta.resolve(dependency)}`); else console.log(`${dependency}=STYLE_ONLY_SKIPPED`); }",
  );
}

function composeSmoke() {
  writeFileSync(
    composeFile,
    `services:\n  postgres:\n    image: postgres:18.1-alpine\n    environment:\n      POSTGRES_USER: runtime_regression\n      POSTGRES_PASSWORD: runtime_regression_only\n      POSTGRES_DB: runtime_regression\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -U runtime_regression -d runtime_regression\"]\n      interval: 2s\n      timeout: 2s\n      retries: 20\n  migrate:\n    image: ${image}\n    command: [\"node\", \"packages/database/dist/database/scripts/migrate.js\"]\n    environment:\n      DATABASE_URL: postgresql://runtime_regression:runtime_regression_only@postgres:5432/runtime_regression\n    depends_on:\n      postgres:\n        condition: service_healthy\n`,
    'utf8',
  );
  try {
    run('Compose migrate service completes', 'docker', [
      'compose',
      '--project-name',
      composeProject,
      '--file',
      composeFile,
      'up',
      '--abort-on-container-exit',
      '--exit-code-from',
      'migrate',
    ]);
  } finally {
    const result = spawnSync(
      'docker',
      [
        'compose',
        '--project-name',
        composeProject,
        '--file',
        composeFile,
        'down',
        '--volumes',
        '--remove-orphans',
      ],
      { encoding: 'utf8', shell: false, windowsHide: true },
    );
    if (result.status !== 0) {
      throw new Error('Disposable Compose runtime regression cleanup failed.');
    }
  }
}

try {
  const inspection = JSON.parse(
    run('image metadata reads', 'docker', ['image', 'inspect', image]),
  )[0];
  if (inspection.Config.User !== 'node') {
    throw new Error(
      `Runtime image user must be node, received ${inspection.Config.User ?? '<empty>'}.`,
    );
  }
  if (inspection.Config.Labels?.['org.opencontainers.image.revision'] !== releaseSha) {
    throw new Error('Runtime image revision does not match the requested release SHA.');
  }
  process.stdout.write('PASS runtime image user and revision\n');

  run('runtime executes as node', 'docker', ['run', '--rm', '--entrypoint', 'id', image, '-un']);
  runNode(
    'database migration module imports',
    'packages/database',
    "await import('./dist/database/src/migrations.js'); console.log('MIGRATION_IMPORT_OK');",
  );
  run('compiled migration journal exists', 'docker', [
    'run',
    '--rm',
    '--entrypoint',
    'test',
    image,
    '-f',
    'packages/database/dist/database/drizzle/meta/_journal.json',
  ]);
  runNode(
    'drizzle-orm resolves from database workspace',
    'packages/database',
    "console.log(import.meta.resolve('drizzle-orm')); ",
  );
  runNode(
    'pg resolves from database workspace',
    'packages/database',
    "console.log(import.meta.resolve('pg')); ",
  );

  for (const workspace of [
    'packages/database',
    'apps/api',
    'apps/worker',
    'apps/web',
    'apps/payment-demo',
  ]) {
    assertRuntimeDependencies(workspace);
  }
  for (const entrypoint of [
    'packages/database/dist/database/scripts/migrate.js',
    'apps/api/dist/apps/api/src/main.js',
    'apps/worker/dist/src/main.js',
    'apps/web/.next/standalone/apps/web/server.js',
    'apps/payment-demo/main.mjs',
  ]) {
    run(`runtime entrypoint parses: ${entrypoint}`, 'docker', [
      'run',
      '--rm',
      '--entrypoint',
      'node',
      image,
      '--check',
      entrypoint,
    ]);
  }
  composeSmoke();
  process.stdout.write('Production runtime image verification passed.\n');
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
