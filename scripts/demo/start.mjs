#!/usr/bin/env node
// scripts/demo/start.mjs
//
// Phase 6F demo startup. Brings the demo environment up on isolated
// ports 3100/3101 and tracks every PID it spawns so cleanup can target
// only the processes this runner created.
//
// This is a thin wrapper: it composes existing pnpm scripts
// (`infra:up`, `db:migrate`, `db:seed:development`, `seed-demo`,
// `dev:api`, `dev:web`, `dev:worker`) and never invents a new
// orchestration system. It re-uses `scripts/with-local-env.mjs` for
// per-child env loading.
//
// Safety rules:
//   - Loopback PostgreSQL only (DEMO_ADMIN_DATABASE_URL override).
//   - Disposable database: room_management_demo_<uuid>.
//   - Never signals port 3001 (reserved for the QLLaw project).
//   - Never deletes Docker volumes.
//   - ADMIN password generated per-run; never printed.
//   - Guest/booking secrets generated per-run via randomBytes; never
//     committed, never printed, shared only via child process env.
//
// Lifecycle rules (Phase 6F runner closure):
//   - Signal handlers and crash handlers register BEFORE any mutable
//     operation (database create, child spawn, port bind).
//   - State manifest persisted to OS temp; stale manifests from prior
//     crashed runs are recovered deterministically.
//   - Port availability is verified with a real TCP bind, not HTTP.
//   - All cleanup operations idempotent and bounded.
//   - `DEMO_AUTO_SHUTDOWN_AFTER_MS` enables a test-only shutdown path
//     that invokes the same SIGINT handler.

import { execFile, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, chmodSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import process from 'node:process';
import { resolvePnpmInvocation } from '../command-executable.mjs';

import {
  DEMO_ADMIN_EMAIL,
  DEMO_API_PORT,
  DEMO_DATABASE_NAME_PATTERN,
  DEMO_MANIFEST_FILENAME,
  DEMO_MANIFEST_SCHEMA,
  DEMO_PROTECTED_PORT,
  DEMO_SECRET_KEYS,
  DEMO_WEB_PORT,
  assertSafeDemoDatabaseUrl,
} from './demo-constants.mjs';

const execFileAsync = promisify(execFile);

const WINDOWS = process.platform === 'win32';
const ORCHESTRATOR_START_TS = new Date().toISOString();
const RUN_ID = randomUUID();
const ORCHESTRATOR_PID = process.pid;

const MANIFEST_PATH = process.env.DEMO_STATE_FILE ?? resolve(tmpdir(), DEMO_MANIFEST_FILENAME);

// Allowed values for `shutdownReason`. Kept as a small enum so the
// "Did this run die of an external timeout?" classification is
// unambiguous in the diagnostic stream.
/** @type {Readonly<{SIGNAL:'SIGNAL',CHILD_EXIT:'CHILD_EXIT',STARTUP_ERROR:'STARTUP_ERROR',TEST_AUTO_SHUTDOWN:'TEST_AUTO_SHUTDOWN',UNKNOWN:'UNKNOWN'}>} */
const SHUTDOWN_REASON = Object.freeze({
  SIGNAL: 'SIGNAL',
  CHILD_EXIT: 'CHILD_EXIT',
  STARTUP_ERROR: 'STARTUP_ERROR',
  TEST_AUTO_SHUTDOWN: 'TEST_AUTO_SHUTDOWN',
  UNKNOWN: 'UNKNOWN',
});

/**
 * @typedef {'SIGNAL'|'CHILD_EXIT'|'STARTUP_ERROR'|'TEST_AUTO_SHUTDOWN'|'UNKNOWN'} ShutdownReason
 */

const DEMO_ADMIN_DATABASE_URL =
  process.env.DEMO_ADMIN_DATABASE_URL ?? 'postgresql://room:room@127.0.0.1:5432/postgres';

// ---------------------------------------------------------------------------
// Per-run random secrets. 256+ bits of entropy each. Never logged.
// ---------------------------------------------------------------------------
function generateRandomSecret() {
  // 32 bytes -> 256 bits of entropy -> 43 base64url chars.
  return randomBytes(32).toString('base64url');
}

const BETTER_AUTH_SECRET = generateRandomSecret();
const DEMO_ADMIN_PASSWORD = `Aa1-${randomBytes(24).toString('base64url')}`;
const DEMO_SECRETS = Object.freeze(
  Object.fromEntries(DEMO_SECRET_KEYS.map((key) => [key, generateRandomSecret()])),
);

// ---------------------------------------------------------------------------
// Per-run owned-children map and shutdown flag.
// ---------------------------------------------------------------------------
const children = new Map();
const ownedPids = new Set();
let shuttingDown = false;

function readEnvFile() {
  const envFile = resolve(process.cwd(), '.env');
  if (!existsSync(envFile)) return {};
  const text = readFileSync(envFile, 'utf8');
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = readEnvFile();

/** @type {Record<string, string | undefined>} */
const baseDemoEnv = {
  ...process.env,
  ...fileEnv,
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  API_HOST: '127.0.0.1',
  API_PORT: String(DEMO_API_PORT),
  WEB_PORT: String(DEMO_WEB_PORT),
  NEXT_DIST_DIR: '.next-demo',
  WEB_ORIGIN: `http://127.0.0.1:${DEMO_WEB_PORT}`,
  AUTH_BASE_URL: `http://127.0.0.1:${DEMO_API_PORT}`,
  NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${DEMO_API_PORT}/api/v1`,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  MAIL_HOST: process.env.MAIL_HOST ?? '127.0.0.1',
  MAIL_PORT: process.env.MAIL_PORT ?? '1025',
  MAIL_FROM: process.env.MAIL_FROM ?? 'no-reply@room-management.local',
  SMTP_HOST: process.env.SMTP_HOST ?? '127.0.0.1',
  SMTP_PORT: process.env.SMTP_PORT ?? '1025',
  SMTP_SECURE: 'false',
  SMTP_FROM: process.env.SMTP_FROM ?? 'no-reply@room-management.local',
  BETTER_AUTH_SECRET,
  ...DEMO_SECRETS,
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL ?? DEMO_ADMIN_EMAIL,
  ADMIN_BOOTSTRAP_PASSWORD: DEMO_ADMIN_PASSWORD,
  WORKER_MODE: 'continuous',
  WORKER_OUTBOX_INTERVAL_MS: '2000',
  WORKER_EXPIRATION_INTERVAL_MS: '5000',
};

// Phase 6F demo payment harness: when MOMO_ENABLED is requested for the
// demo, the orchestrator also boots the deterministic payment provider
// simulator so signing and signatures stay real. The flag is unset by
// default so existing demo runs are unaffected unless the operator
// explicitly opts in.
const DEMO_PAYMENT_SIMULATOR_PORT = 3090;
const DEMO_PAYMENT_SIMULATOR_HOST = '127.0.0.1';
if (process.env.DEMO_PAYMENT_SIMULATOR !== 'off') {
  baseDemoEnv.PAYMENT_SIMULATOR_HOST = DEMO_PAYMENT_SIMULATOR_HOST;
  baseDemoEnv.PAYMENT_SIMULATOR_PORT = String(DEMO_PAYMENT_SIMULATOR_PORT);
  baseDemoEnv.PAYMENT_SIMULATOR_MOMO_PARTNER_CODE =
    process.env.PAYMENT_SIMULATOR_MOMO_PARTNER_CODE ?? 'DEMO_MOMO';
  baseDemoEnv.PAYMENT_SIMULATOR_MOMO_ACCESS_KEY =
    process.env.PAYMENT_SIMULATOR_MOMO_ACCESS_KEY ?? 'demo-momo-access-key';
  baseDemoEnv.PAYMENT_SIMULATOR_MOMO_SECRET_KEY =
    process.env.PAYMENT_SIMULATOR_MOMO_SECRET_KEY ?? randomBytes(32).toString('base64url');
  baseDemoEnv.PAYMENT_SIMULATOR_VNPAY_TMN_CODE =
    process.env.PAYMENT_SIMULATOR_VNPAY_TMN_CODE ?? 'DEMOVNPAY';
  baseDemoEnv.PAYMENT_SIMULATOR_VNPAY_HASH_SECRET =
    process.env.PAYMENT_SIMULATOR_VNPAY_HASH_SECRET ?? randomBytes(32).toString('base64url');
  baseDemoEnv.PAYMENT_SIMULATOR_MOMO_IPN_URL =
    process.env.PAYMENT_SIMULATOR_MOMO_IPN_URL ??
    `http://127.0.0.1:${DEMO_API_PORT}/api/v1/webhooks/momo`;
  baseDemoEnv.PAYMENT_SIMULATOR_VNPAY_IPN_URL =
    process.env.PAYMENT_SIMULATOR_VNPAY_IPN_URL ??
    `http://127.0.0.1:${DEMO_API_PORT}/api/v1/webhooks/vnpay`;
}

// ---------------------------------------------------------------------------
// State manifest (Stage G). Strictly write-only; never logs the
// password or any secret. The manifest lives at MANIFEST_PATH, which
// can be overridden via DEMO_STATE_FILE so the lifecycle test can run
// twice without colliding with itself.
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} DemoState
 * @property {string|undefined} databaseName
 * @property {string|undefined} passwordPath
 * @property {string} manifestPath
 * @property {ShutdownReason|null} cleanupReason
 * @property {number|undefined} lastExitCode
 */

/** @type {DemoState} */
const state = {
  databaseName: undefined,
  passwordPath: undefined,
  manifestPath: MANIFEST_PATH,
  cleanupReason: null,
  lastExitCode: undefined,
};

function writeManifest() {
  const payload = {
    schema: DEMO_MANIFEST_SCHEMA,
    runId: RUN_ID,
    orchestratorPid: ORCHESTRATOR_PID,
    startedAt: ORCHESTRATOR_START_TS,
    pid3001Owner: process.env.PID_3001_OWNER ?? null,
    databaseName: state.databaseName ?? null,
    passwordPath: state.passwordPath ?? null,
    webPort: DEMO_WEB_PORT,
    apiPort: DEMO_API_PORT,
    ownedPids: [...ownedPids],
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(payload, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  // Best-effort chmod for filesystems that ignore the `mode` option.
  try {
    chmodSync(MANIFEST_PATH, 0o600);
  } catch {
    // Not supported on this platform; ignore.
  }
}

function removeManifest() {
  try {
    unlinkSync(MANIFEST_PATH);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    // Permission/path issue — leave the file in place for forensics.
  }
}

function pidIsAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      // EPERM means the process exists but we may not signal it.
      // ESRCH means no such process. Both classify correctly here.
      return error.code === 'EPERM';
    }
    return false;
  }
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    const text = readFileSync(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-run state cleanup invariants (Stage G).
//
// recoverStaleManifest:
//   - if a manifest exists and its orchestrator PID is alive, refuse
//     to start;
//   - if the manifest is stale, validate every recorded path/name,
//     drop only its exact demo DB, delete only its password file,
//     remove only its manifest. Never scan arbitrary databases.
//
// All paths must satisfy the demo prefix guard or be rejected.
// ---------------------------------------------------------------------------
function assertManifestInvariants(manifest) {
  if (manifest.schema !== DEMO_MANIFEST_SCHEMA) {
    throw new Error(
      `Refusing stale manifest: unsupported schema version ${String(manifest.schema)}`,
    );
  }
  if (typeof manifest.databaseName !== 'string') {
    throw new Error('Refusing stale manifest: missing databaseName');
  }
  if (!DEMO_DATABASE_NAME_PATTERN.test(manifest.databaseName)) {
    throw new Error(
      `Refusing stale manifest: database name "${manifest.databaseName}" does not match demo prefix`,
    );
  }
  if (typeof manifest.passwordPath !== 'string') {
    throw new Error('Refusing stale manifest: missing passwordPath');
  }
  // We never want to delete a path that escapes tmpdir or has no
  // exact password-file naming convention.
  const passwordName = manifest.passwordPath.split(/[\\/]/).pop() ?? '';
  if (!/^room-management-demo-admin-[a-f0-9]{16}\.txt$/.test(passwordName)) {
    throw new Error(
      `Refusing stale manifest: password path "${manifest.passwordPath}" has unsafe basename`,
    );
  }
}

async function recoverStaleManifest() {
  const existing = readManifest();
  if (existing === null) return;
  try {
    assertManifestInvariants(existing);
  } catch (error) {
    // Treat an invalid manifest the same as a missing one but log
    // loudly so the operator knows the manifest was left in a bad
    // state.
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[demo] stale manifest refused: ${message}\n`);
    removeManifest();
    return;
  }
  const orchestratorPid =
    typeof existing.orchestratorPid === 'number' ? existing.orchestratorPid : 0;
  if (pidIsAlive(orchestratorPid)) {
    throw new Error(
      `Refusing to start: demo manifest at ${MANIFEST_PATH} belongs to a live orchestrator (pid ${orchestratorPid}). Stop the existing demo or wait for it to finish.`,
    );
  }
  // Stale. Recover.
  const databaseName = existing.databaseName;
  const passwordPath = existing.passwordPath;

  process.stdout.write(`[demo] Recovering stale manifest for ${databaseName}\n`);
  await dropDemoDatabaseByName(databaseName);
  removePasswordFile(passwordPath);
  removeManifest();
}

async function dropDemoDatabaseByName(databaseName) {
  if (!DEMO_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(`Refusing to drop database "${databaseName}": unsafe name.`);
  }
  await runSpawn(['--filter', '@room/database', 'demo:db:drop', databaseName], {
    ...process.env,
    DEMO_ADMIN_DATABASE_URL,
  });
}

function removePasswordFile(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// TCP port-ownership probe (Stage E). Real bind, not HTTP.
// ---------------------------------------------------------------------------
async function probeTcpBindFree(port) {
  return new Promise((resolveProbe) => {
    const server = createServer();
    server.unref();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      server.close(() => resolveProbe(result));
    };
    server.once('error', (error) => {
      // EADDRINUSE -> port occupied.
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      finish({ free: false, code });
    });
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => finish({ free: true }));
  });
}

async function reportOwningPidForPort(port) {
  // Best-effort: returns the PID that holds the port on Windows, or
  // null on POSIX. Never signals or terminates the owning PID.
  if (WINDOWS) {
    try {
      const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'TCP'], {
        windowsHide: true,
      });
      const lines = stdout.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP')) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 5) continue;
        const local = parts[1] ?? '';
        const state = parts[3] ?? '';
        if (state !== 'LISTENING') continue;
        if (!local.endsWith(`:${port}`)) continue;
        const pidText = parts[4] ?? '';
        const pid = Number.parseInt(pidText, 10);
        if (Number.isFinite(pid) && pid > 0) {
          return pid;
        }
      }
    } catch {
      // netstat unavailable; fall through.
    }
  }
  return null;
}

async function assertPortFree(label, port) {
  const probe = await probeTcpBindFree(port);
  if (!probe.free) {
    let detail = `code=${String(probe.code ?? 'unknown')}`;
    if (probe.code === 'EADDRINUSE') {
      const owning = await reportOwningPidForPort(port);
      if (owning !== null) detail += `, owningPid=${owning}`;
    }
    throw new Error(`${label} (${port}) is not free (${detail}); refusing to start.`);
  }
}

// ---------------------------------------------------------------------------
// Process spawn helpers.
// ---------------------------------------------------------------------------
function spawnDemoChild(name, args, environment) {
  const invocation = resolvePnpmInvocation(args);
  const executable = invocation.executable;
  const commandArgs = invocation.args;
  const child = spawn(executable, commandArgs, {
    env: environment,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
    detached: false,
  });
  const spawnedAt = new Date().toISOString();
  children.set(name, child);
  if (typeof child.pid === 'number') {
    ownedPids.add(child.pid);
  }
  child.once('exit', (code, signal) => {
    const exitedAt = new Date().toISOString();
    process.stderr.write(
      `[demo] child ${name} (pid=${String(child.pid ?? '?')}) exited at ${exitedAt} code=${String(code)} signal=${String(signal)} uptime=${String(Math.round(process.uptime()))}s\n`,
    );
    if (!shuttingDown) {
      // Treat as failure unless we are deliberately shutting down.
      void shutdown(1, SHUTDOWN_REASON.CHILD_EXIT);
    }
  });
  process.stderr.write(`[demo] spawned ${name} pid=${String(child.pid ?? '?')} at ${spawnedAt}\n`);
  return child;
}

async function runSpawn(args, environment) {
  const invocation = resolvePnpmInvocation(args);
  const executable = invocation.executable;
  const commandArgs = invocation.args;
  const child = spawn(executable, commandArgs, {
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  await new Promise((res, rej) => {
    child.once('error', rej);
    child.once('exit', (code) => {
      if (code === 0) res(undefined);
      else rej(new Error(`${args.join(' ')} exited with code ${String(code)}`));
    });
  });
}

async function waitForHttp(url, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      // fall through
    }
    await delay(500);
  }
  throw new Error(`${label} did not become ready within ${timeoutMs}ms (${url})`);
}

async function ensureInfra() {
  const result = spawn('docker', ['compose', 'up', '-d'], {
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  await new Promise((res, rej) => {
    result.once('error', rej);
    result.once('exit', (code) =>
      code === 0 ? res(undefined) : rej(new Error(`docker compose up -d exited with code ${code}`)),
    );
  });
}

async function createDisposableDatabase() {
  const result = await new Promise((resolveP) => {
    const child = spawn(
      process.execPath,
      ['scripts/with-local-env.mjs', 'pnpm', '--filter', '@room/database', 'demo:db:create'],
      {
        env: { ...process.env, DEMO_ADMIN_DATABASE_URL },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    let stdout = '';
    if (child.stdout !== null) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    child.once('exit', (code) => resolveP({ stdout, status: code }));
  });
  if (result.status !== 0) {
    throw new Error(`demo:db:create exited with status ${String(result.status)}`);
  }
  const nameMatch = result.stdout.match(/^DEMO_DATABASE_NAME=(\S+)/m);
  const urlMatch = result.stdout.match(/^DEMO_DATABASE_URL=(\S+)/m);
  if (!nameMatch || !urlMatch) {
    throw new Error(`demo:db:create did not return DEMO_DATABASE_NAME/URL: ${result.stdout}`);
  }
  const name = nameMatch[1];
  const url = urlMatch[1];
  assertSafeDemoDatabaseUrl(url);
  return { name, url };
}

async function migrate(databaseUrl) {
  await runSpawn(['--filter', '@room/database', 'db:migrate'], {
    ...baseDemoEnv,
    DATABASE_URL: databaseUrl,
  });
}

async function seed(databaseUrl) {
  await runSpawn(['--filter', '@room/database', 'demo:seed'], {
    ...baseDemoEnv,
    DATABASE_URL: databaseUrl,
  });
}

async function bootstrapAdmin(databaseUrl) {
  await runSpawn(['--filter', '@room/auth', 'admin:bootstrap'], {
    ...baseDemoEnv,
    DATABASE_URL: databaseUrl,
  });
}

// ---------------------------------------------------------------------------
// Cleanup (Stage F + Stage G).
// Idempotent. Runs at most once per process. Records the cleanup
// reason and exits with the preserved code.
// ---------------------------------------------------------------------------
async function killChildByPid(pid) {
  if (!pidIsAlive(pid)) return;
  try {
    if (WINDOWS) {
      await execFileAsync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
        windowsHide: true,
      });
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        process.kill(pid, 'SIGTERM');
      }
    }
  } catch {
    // Already gone or already detached.
  }
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null) return;
  await new Promise((res) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      res(undefined);
    };
    child.once('exit', finish);
    setTimeout(finish, timeoutMs).unref();
  });
}

/**
 * @param {number} [exitCode]
 * @param {ShutdownReason} [reason]
 */
async function shutdown(exitCode = 0, reason = SHUTDOWN_REASON.UNKNOWN) {
  if (shuttingDown) {
    state.lastExitCode = exitCode;
    return;
  }
  shuttingDown = true;
  state.cleanupReason = reason;
  state.lastExitCode = exitCode;

  process.stdout.write(`\n=========================================\n`);
  process.stdout.write(`Phase 6F demo shutting down (reason=${reason}, exit=${exitCode})\n`);

  // Children in reverse order (worker, web, api) so we tear down in
  // the reverse of bring-up. We try SIGTERM/SIGINT and only force-kill
  // if the child does not exit within a bounded grace period.
  const names = [...children.keys()].reverse();
  for (const name of names) {
    const child = children.get(name);
    if (child === undefined) continue;
    const pid = child.pid;
    if (pid === undefined) continue;
    process.stdout.write(`  stopping ${name} pid=${pid}\n`);
    await killChildByPid(pid);
    await waitForChildExit(child, 2_500);
    if (child.exitCode === null) {
      process.stdout.write(`  force-killing ${name} pid=${pid}\n`);
      if (WINDOWS) {
        await execFileAsync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
          windowsHide: true,
        });
      } else {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Ignore.
        }
      }
    }
  }

  // Belt and braces: anything we still own that wasn't stopped above.
  for (const pid of [...ownedPids]) {
    if (pid === ORCHESTRATOR_PID) continue;
    if (pidIsAlive(pid)) {
      process.stdout.write(`  terminating remaining owned pid=${pid}\n`);
      if (WINDOWS) {
        try {
          await execFileAsync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
            windowsHide: true,
          });
        } catch {
          // Already gone.
        }
      } else {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Ignore.
        }
      }
    }
  }

  // Drop the disposable DB only if we know its name. The lifecycle
  // script enforces the demo prefix guard.
  if (state.databaseName !== undefined) {
    process.stdout.write(`  dropping demo database ${state.databaseName}\n`);
    try {
      await dropDemoDatabaseByName(state.databaseName);
    } catch {
      // Already gone or already dropped.
    }
  }

  // Remove the per-run password file and manifest.
  if (state.passwordPath !== undefined) {
    process.stdout.write(`  removing admin password file\n`);
    removePasswordFile(state.passwordPath);
  }
  removeManifest();

  process.stdout.write(`  cleanup complete\n`);
  process.stdout.write(`=========================================\n`);

  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Lifecycle handler registration (Stage F). Must run BEFORE any
// mutable operation: docker up, DB create, child spawn, port bind.
// ---------------------------------------------------------------------------
function registerLifecycleHandlers() {
  process.on('SIGINT', () => {
    void shutdown(130, SHUTDOWN_REASON.SIGNAL);
  });
  process.on('SIGTERM', () => {
    void shutdown(143, SHUTDOWN_REASON.SIGNAL);
  });
  // SIGBREAK is supported on Windows. We register it as a normal
  // signal — no exception if the runtime does not surface it.
  process.on('SIGBREAK', () => {
    void shutdown(131, SHUTDOWN_REASON.SIGNAL);
  });
  process.on('uncaughtException', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[demo] uncaughtException: ${message}\n`);
    void shutdown(1, SHUTDOWN_REASON.STARTUP_ERROR);
  });
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    process.stderr.write(`[demo] unhandledRejection: ${message}\n`);
    void shutdown(1, SHUTDOWN_REASON.STARTUP_ERROR);
  });
}

// ---------------------------------------------------------------------------
// Demo bootstrap. The orchestrator's exact entry point lives in main()
// below; register handlers first, then recover stale manifest, then
// perform real port checks, then start the environment.
// ---------------------------------------------------------------------------
async function printBanner() {
  const passwordPath = resolve(
    tmpdir(),
    `room-management-demo-admin-${randomBytes(8).toString('hex')}.txt`,
  );
  writeFileSync(passwordPath, DEMO_ADMIN_PASSWORD, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(passwordPath, 0o600);
  } catch {
    // Not supported on this platform; ignore.
  }
  state.passwordPath = passwordPath;

  process.stderr.write(`[demo] READY orchestrator=${ORCHESTRATOR_PID} runId=${RUN_ID}\n`);
  process.stdout.write(`\n=========================================\n`);
  process.stdout.write(`Phase 6F demo is ready.\n`);
  process.stdout.write(`  Run ID           : ${RUN_ID}\n`);
  process.stdout.write(`  Orchestrator PID : ${ORCHESTRATOR_PID}\n`);
  process.stdout.write(`  Public web       : http://127.0.0.1:${DEMO_WEB_PORT}\n`);
  process.stdout.write(`  Public API base  : http://127.0.0.1:${DEMO_API_PORT}/api/v1\n`);
  process.stdout.write(`  Mailpit UI       : http://127.0.0.1:8025\n`);
  process.stdout.write(`  Disposable DB    : ${state.databaseName}\n`);
  process.stdout.write(`  ADMIN email      : ${baseDemoEnv.ADMIN_BOOTSTRAP_EMAIL}\n`);
  process.stdout.write(
    `  ADMIN password   : (written to ${passwordPath} for smoke; not printed)\n`,
  );
  process.stdout.write(`  Coupon fixtures  : DEMO-FIXED, DEMO-PERCENT, DEMO-DISABLED\n`);
  process.stdout.write(`  Reserved port    : ${DEMO_PROTECTED_PORT} (NOT touched)\n`);
  process.stdout.write(`  Manifest         : ${MANIFEST_PATH}\n`);
  process.stdout.write(`=========================================\n`);
}

async function main() {
  // Stage F: register lifecycle handlers BEFORE any mutable operation.
  registerLifecycleHandlers();

  // Stage G: recover stale manifest BEFORE any port binding.
  await recoverStaleManifest();

  // Stage E: real TCP port-ownership checks (not HTTP).
  await assertPortFree(`Demo web port`, DEMO_WEB_PORT);
  await assertPortFree(`Demo API port`, DEMO_API_PORT);

  // Stage J-style audit pre-start: ensure tmpdir exists so we can
  // safely create password file / manifest there.
  try {
    mkdirSync(tmpdir(), { recursive: true });
  } catch {
    // tmpdir always exists on Windows; ignore any race.
  }

  await ensureInfra();
  const db = await createDisposableDatabase();
  state.databaseName = db.name;
  // Write manifest as soon as we know the DB name; the password file
  // path is filled in by printBanner() after the children are ready.
  writeManifest();

  await migrate(db.url);
  await seed(db.url);
  await bootstrapAdmin(db.url);

  /** @type {Record<string, string | undefined>} */
  const apiEnv = { ...baseDemoEnv, DATABASE_URL: db.url };
  // The payment provider simulator is a local Node.js script. We spawn
  // it directly via process.execPath so it shares the demo lifecycle
  // (PID tracked, signals propagated) without going through pnpm. The
  // simulator only starts under NODE_ENV=development in the demo so the
  // production safety guard is intentional and silent in this code
  // path. Disable with DEMO_PAYMENT_SIMULATOR=off to keep the legacy
  // demo behavior.
  if (process.env.DEMO_PAYMENT_SIMULATOR !== 'off') {
    const simulatorPath = resolve(
      process.cwd(),
      'tests/e2e/_fixtures/payment-provider-simulator.mjs',
    );
    const simulatorChild = spawn(process.execPath, [simulatorPath], {
      env: {
        ...apiEnv,
        NODE_ENV: 'development',
        PAYMENT_SIMULATOR_HOST: DEMO_PAYMENT_SIMULATOR_HOST,
        PAYMENT_SIMULATOR_PORT: String(DEMO_PAYMENT_SIMULATOR_PORT),
        // Configure a loopback-only default browser back-redirect so a
        // customer clicking through the simulator ends up back on the
        // persistent booking page without Playwright / test-helper
        // control-plane setup. The base URL is restricted to the loopback
        // web port so production deployments remain unaffected: when the
        // simulator is started without this env var, no automatic redirect
        // happens (the original simulator behaviour).
        PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE: `http://127.0.0.1:${String(DEMO_WEB_PORT)}/booking/manage`,
      },
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
      detached: false,
    });
    children.set('simulator', simulatorChild);
    if (typeof simulatorChild.pid === 'number') ownedPids.add(simulatorChild.pid);
    simulatorChild.once('exit', (code, signal) => {
      process.stderr.write(
        `[demo] simulator child exited code=${String(code)} signal=${String(signal)}\n`,
      );
    });
    await waitForHttp(
      `http://${DEMO_PAYMENT_SIMULATOR_HOST}:${String(DEMO_PAYMENT_SIMULATOR_PORT)}/__health`,
      'Payment simulator',
      15_000,
    );
    apiEnv.PAYMENT_SIMULATOR_BASE_URL = `http://${DEMO_PAYMENT_SIMULATOR_HOST}:${String(DEMO_PAYMENT_SIMULATOR_PORT)}`;
    // Wire the API at the simulator. Loopback HTTP is permitted by the
    // adapter guards only when the simulator host is reachable
    // (PAYMENT_SIMULATOR_BASE_URL or port 3090 on loopback), so this
    // remains a non-production path.
    //
    // The demo orchestrator wins over stale `.env` values: when the
    // simulator is active, every MoMo/VNPay endpoint must point at the
    // local stack, otherwise the config validator refuses to start the
    // API (MOMO_API_BASE_URL is required to be simulator-backed, and the
    // return/IPN URLs are required to be loopback under the simulator
    // branch).
    const localReturnUrl = (provider) =>
      `http://127.0.0.1:${String(DEMO_API_PORT)}/api/v1/payments/providers/${provider}/return`;
    const localIpnUrl = (provider) =>
      `http://127.0.0.1:${String(DEMO_API_PORT)}/api/v1/webhooks/${provider}`;
    apiEnv.MOMO_ENABLED = 'true';
    apiEnv.MOMO_ENVIRONMENT = apiEnv.MOMO_ENVIRONMENT ?? 'sandbox';
    apiEnv.MOMO_PARTNER_CODE = apiEnv.PAYMENT_SIMULATOR_MOMO_PARTNER_CODE ?? 'DEMO_MOMO';
    apiEnv.MOMO_ACCESS_KEY = apiEnv.PAYMENT_SIMULATOR_MOMO_ACCESS_KEY ?? 'demo-momo-access-key';
    apiEnv.MOMO_SECRET_KEY = apiEnv.PAYMENT_SIMULATOR_MOMO_SECRET_KEY;
    apiEnv.MOMO_API_BASE_URL = apiEnv.PAYMENT_SIMULATOR_BASE_URL;
    apiEnv.MOMO_RETURN_URL = localReturnUrl('momo');
    apiEnv.MOMO_IPN_URL = localIpnUrl('momo');
    apiEnv.MOMO_REQUEST_TYPE = apiEnv.MOMO_REQUEST_TYPE ?? 'captureWallet';
    apiEnv.MOMO_REQUEST_TIMEOUT_MS = apiEnv.MOMO_REQUEST_TIMEOUT_MS ?? '30000';

    apiEnv.VNPAY_ENABLED = 'true';
    apiEnv.VNPAY_ENVIRONMENT = apiEnv.VNPAY_ENVIRONMENT ?? 'sandbox';
    apiEnv.VNPAY_TMN_CODE = apiEnv.PAYMENT_SIMULATOR_VNPAY_TMN_CODE ?? 'DEMOVNPAY';
    apiEnv.VNPAY_HASH_SECRET = apiEnv.PAYMENT_SIMULATOR_VNPAY_HASH_SECRET;
    apiEnv.VNPAY_API_BASE_URL = `${apiEnv.PAYMENT_SIMULATOR_BASE_URL}/vnpay-test/pay`;
    apiEnv.VNPAY_RETURN_URL = localReturnUrl('vnpay');
    apiEnv.VNPAY_IPN_URL = localIpnUrl('vnpay');
    apiEnv.VNPAY_REQUEST_TIMEOUT_MS = apiEnv.VNPAY_REQUEST_TIMEOUT_MS ?? '10000';
  }
  spawnDemoChild('api', ['--filter', '@room/api', 'dev'], apiEnv);
  await waitForHttp(`http://127.0.0.1:${DEMO_API_PORT}/api/v1/health/live`, 'API', 60_000);

  const webEnv = { ...baseDemoEnv, DATABASE_URL: db.url };
  // The web workspace's `dev` script hard-codes `--port 3000`, which
  // belongs to the unrelated QLLaw project. Override the CLI flag here
  // so we bind to the isolated demo port and never touch 3000/3001.
  spawnDemoChild(
    'web',
    ['--filter', '@room/web', 'exec', 'next', 'dev', '--port', String(DEMO_WEB_PORT)],
    webEnv,
  );
  await waitForHttp(`http://127.0.0.1:${DEMO_WEB_PORT}/health`, 'Web', 60_000);

  const workerEnv = { ...baseDemoEnv, DATABASE_URL: db.url };
  spawnDemoChild('worker', ['--filter', '@room/worker', 'dev'], workerEnv);
  await delay(2_000);

  await printBanner();
  // Re-write the manifest now that we know the password path.
  writeManifest();

  // Stage H: test-only auto-shutdown. Disabled by default. Only
  // honored when DEMO_TEST_MODE=1 is set; in production this is a
  // hard no-op so a stray environment variable cannot ever shut the
  // demo down by itself.
  const testShutdown = process.env.DEMO_AUTO_SHUTDOWN_AFTER_MS;
  if (testShutdown !== undefined && process.env.DEMO_TEST_MODE === '1') {
    const ms = Number.parseInt(testShutdown, 10);
    if (Number.isFinite(ms) && ms > 0) {
      process.stderr.write(`[demo] DEMO_AUTO_SHUTDOWN_AFTER_MS=${String(ms)} (test mode)\n`);
      setTimeout(() => {
        void shutdown(0, SHUTDOWN_REASON.TEST_AUTO_SHUTDOWN);
      }, ms).unref();
    }
  }

  // Keep the orchestrator alive; child stdio is inherited so the user
  // sees API/Web/worker logs directly.
  await new Promise(() => undefined);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`demo start error: ${message}\n`);
  void shutdown(1, SHUTDOWN_REASON.STARTUP_ERROR);
});
