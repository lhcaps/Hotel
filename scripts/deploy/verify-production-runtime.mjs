import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '../..');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const image = argument('--image') ?? 'room-management-migrate:latest';
const releaseSha = argument('--release-sha') ?? process.env.RELEASE_SHA;
const composeProject = `roomruntime${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const temporaryRoot = mkdtempSync(join(tmpdir(), 'room-production-runtime-'));
const composeFile = join(temporaryRoot, 'compose.yml');
const environmentFile = join(temporaryRoot, 'runtime.env');

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

function parseTemplate() {
  const templatePath = resolve(repositoryRoot, 'deploy/.env.production.example');
  return Object.fromEntries(
    readFileSync(templatePath, 'utf8')
      .split(/\r?\n/u)
      .flatMap((line) => {
        const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
        return match === null ? [] : [[match[1], match[2]]];
      }),
  );
}

function writeRuntimeEnvironment() {
  const replacements = {
    REPLACE_WITH_FULL_40_CHAR_COMMIT_SHA: releaseSha,
    REPLACE_WITH_PUBLIC_DOMAIN: 'room.runtime.test',
    REPLACE_WITH_PAYMENT_DEMO_DOMAIN: 'payments.room.runtime.test',
    REPLACE_WITH_CADDY_NETWORK_CIDR: '172.16.0.0/12',
    REPLACE_WITH_POSTGRES_USER: 'runtime_regression',
    REPLACE_WITH_POSTGRES_PASSWORD: 'runtime_regression_only',
    REPLACE_WITH_POSTGRES_DATABASE: 'runtime_regression',
    REPLACE_WITH_SMTP_HOST: 'smtp.runtime.test',
    REPLACE_WITH_VERIFIED_SENDER: 'no-reply',
    REPLACE_WITH_SMTP_USER: 'runtime-smtp-user',
    REPLACE_WITH_SMTP_PASSWORD: 'runtime-smtp-password',
    REPLACE_WITH_32_PLUS_CHAR_AUTH_SECRET: 'a'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_OTP_SECRET: 'b'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_CHALLENGE_SECRET: 'c'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_SESSION_SECRET: 'd'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_IP_DIGEST_SECRET: 'e'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_PAYMENT_DEMO_CONTROL_TOKEN: 'f'.repeat(40),
    REPLACE_WITH_MOMO_PARTNER_CODE: 'runtime-momo-partner',
    REPLACE_WITH_MOMO_ACCESS_KEY: 'runtime-momo-access',
    REPLACE_WITH_32_PLUS_CHAR_MOMO_SECRET: 'g'.repeat(40),
    REPLACE_WITH_VNPAY_TMN_CODE: 'runtime-vnpay-tmn',
    REPLACE_WITH_32_PLUS_CHAR_VNPAY_SECRET: 'h'.repeat(40),
  };
  const environment = Object.fromEntries(
    Object.entries(parseTemplate()).map(([key, value]) => [
      key,
      Object.entries(replacements).reduce(
        (resolved, [placeholder, replacement]) => resolved.replaceAll(placeholder, replacement),
        value,
      ),
    ]),
  );
  writeFileSync(
    environmentFile,
    `${Object.entries(environment)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`,
    'utf8',
  );
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function waitForService(service, program) {
  let lastOutput = '';
  for (let attempt = 1; attempt <= 90; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'compose',
        '--project-name',
        composeProject,
        '--file',
        composeFile,
        'exec',
        '-T',
        service,
        'node',
        '-e',
        program,
      ],
      { encoding: 'utf8', shell: false, windowsHide: true },
    );
    lastOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status === 0) {
      process.stdout.write(`PASS Compose ${service} is ready\n`);
      return;
    }
    sleep(1_000);
  }
  throw new Error(`Compose ${service} did not become ready.\n${lastOutput}`);
}

function waitForSuccessfulExit(service) {
  let lastOutput = '';
  for (let attempt = 1; attempt <= 90; attempt += 1) {
    const containerId = spawnSync(
      'docker',
      [
        'compose',
        '--project-name',
        composeProject,
        '--file',
        composeFile,
        'ps',
        '--all',
        '-q',
        service,
      ],
      { encoding: 'utf8', shell: false, windowsHide: true },
    );
    const identifier = (containerId.stdout ?? '').trim();
    if (containerId.status === 0 && identifier.length > 0) {
      const inspection = spawnSync('docker', ['inspect', identifier], {
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      });
      lastOutput = `${inspection.stdout ?? ''}${inspection.stderr ?? ''}`;
      if (inspection.status === 0) {
        const state = JSON.parse(inspection.stdout)[0]?.State;
        if (state?.Status === 'exited') {
          if (state.ExitCode !== 0) {
            throw new Error(`Compose ${service} exited ${String(state.ExitCode)}.`);
          }
          process.stdout.write(`PASS Compose ${service} completes\n`);
          return;
        }
      }
    } else {
      lastOutput = `${containerId.stdout ?? ''}${containerId.stderr ?? ''}`;
    }
    sleep(1_000);
  }
  throw new Error(`Compose ${service} did not complete.\n${lastOutput}`);
}

function inspectComposeService(service, expectedState) {
  const containerId = run(`Compose ${service} container is present`, 'docker', [
    'compose',
    '--project-name',
    composeProject,
    '--file',
    composeFile,
    'ps',
    '--all',
    '-q',
    service,
  ]);
  const inspection = JSON.parse(
    run(`Compose ${service} state reads`, 'docker', ['inspect', containerId]),
  )[0];
  if (inspection.State.Status !== expectedState) {
    throw new Error(
      `Compose ${service} must be ${expectedState}, received ${inspection.State.Status}.`,
    );
  }
  if (expectedState === 'exited' && inspection.State.ExitCode !== 0) {
    throw new Error(`Compose ${service} exited ${String(inspection.State.ExitCode)}.`);
  }
  process.stdout.write(`PASS Compose ${service} state ${expectedState}\n`);
}

function composeSmoke() {
  writeRuntimeEnvironment();
  writeFileSync(
    composeFile,
    `services:
  postgres:
    image: postgres:18.1-alpine
    env_file: runtime.env
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 2s
      timeout: 2s
      retries: 30
  redis:
    image: redis:8.4.0-alpine
    command: ["redis-server", "--appendonly", "no"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 2s
      retries: 30
  migrate:
    image: ${image}
    command: ["node", "packages/database/dist/database/scripts/migrate.js"]
    env_file: runtime.env
    depends_on:
      postgres:
        condition: service_healthy
  api:
    image: ${image}
    command: ["node", "apps/api/dist/apps/api/src/main.js"]
    env_file: runtime.env
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
  worker:
    image: ${image}
    command: ["node", "apps/worker/dist/src/main.js"]
    env_file: runtime.env
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
  web:
    image: ${image}
    command: ["node", "apps/web/.next/standalone/apps/web/server.js"]
    environment:
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
    env_file: runtime.env
  payment-demo:
    image: ${image}
    command: ["node", "apps/payment-demo/main.mjs"]
    env_file: runtime.env
`,
    'utf8',
  );
  try {
    run('Compose full application topology starts', 'docker', [
      'compose',
      '--project-name',
      composeProject,
      '--file',
      composeFile,
      'up',
      '--detach',
    ]);
    waitForSuccessfulExit('migrate');
    waitForService(
      'api',
      "fetch('http://127.0.0.1:3001/api/v1/health/ready').then((response) => process.exit(response.status === 200 ? 0 : 1)).catch(() => process.exit(1));",
    );
    waitForService(
      'web',
      "fetch('http://127.0.0.1:3000').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));",
    );
    waitForService(
      'payment-demo',
      "fetch('http://127.0.0.1:3090/__health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));",
    );
    for (const service of ['postgres', 'redis', 'api', 'worker', 'web', 'payment-demo']) {
      inspectComposeService(service, 'running');
    }
    inspectComposeService('migrate', 'exited');
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
    process.stdout.write('PASS disposable Compose runtime cleanup\n');
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
  run('Next standalone static assets exist', 'docker', [
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    image,
    '-ec',
    'test -n "$(find apps/web/.next/standalone/apps/web/.next/static -type f -print -quit)"',
  ]);
  runNode(
    'drizzle-orm resolves from database workspace',
    'packages/database',
    "console.log(import.meta.resolve('drizzle-orm'));",
  );
  runNode(
    'pg resolves from database workspace',
    'packages/database',
    "console.log(import.meta.resolve('pg'));",
  );
  for (const [workspace, specifier] of [
    ['apps/api', '@room/database'],
    ['apps/api', '@room/database/schema'],
    ['apps/api', '@room/booking'],
    ['apps/api', '@room/booking/coupon'],
    ['apps/api', '@room/auth'],
    ['apps/api', '@room/config'],
    ['apps/api', '@room/contracts'],
    ['apps/api', '@room/contracts/pricing'],
    ['apps/api', '@room/contracts/public-room-catalog'],
    ['apps/api', '@room/contracts/admin'],
    ['apps/api', '@room/observability'],
    ['apps/worker', '@room/database'],
    ['apps/worker', '@room/booking'],
    ['apps/worker', '@room/config'],
    ['apps/worker', '@room/observability'],
    ['apps/web', '@room/config'],
    ['apps/web', '@room/contracts'],
  ]) {
    runNode(
      `${workspace} imports ${specifier}`,
      workspace,
      `await import('${specifier}'); console.log('WORKSPACE_PACKAGE_IMPORT_OK');`,
    );
  }

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
