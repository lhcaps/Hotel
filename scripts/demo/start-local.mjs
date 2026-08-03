#!/usr/bin/env node
// scripts/demo/start-local.mjs
//
// Local demo runner for the customer-delivery package. Starts Web
// (port 3000), API (port 3001), worker, and the payment simulator
// (port 3090), waits for readiness, and writes an ownership manifest
// listing every PID this runner spawned so `scripts/demo/stop.mjs`
// can tear down only those processes.
//
// Operating-system support: this script is Windows-only. It uses
// `tasklist /FI "IMAGENAME eq node.exe"` to detect ownership of an
// existing listener (so it can refuse to take over a process the
// runner did not spawn) and writes a manifest with PIDs that
// `scripts/demo/stop.mjs` is the only consumer of.
//
// Prerequisites (handled by the customer runbook, not by this script):
//   - `docker compose up -d` running Postgres, Redis, Mailpit.
//   - `pnpm demo:db:create` and `pnpm demo:seed` already executed.
//   - `pnpm install --frozen-lockfile` already executed.
//
// Exit codes:
//   0 = all services ready
//   1 = a service failed to come up within the readiness deadline
//   2 = an unsafe state was detected (e.g. port held by an unknown
//       process that this script will not terminate).

import { spawn, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { closeSync, mkdirSync, openSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import process from 'node:process';
import { resolveCommandInvocation } from '../command-executable.mjs';
import { DEMO_SECRET_KEYS } from './demo-constants.mjs';
import { inspectWindowsProcessIdentity, isExactReadyStatus } from './runner-safety.mjs';

const REPO_ROOT = process.cwd();
const MANIFEST_DIR = resolve(REPO_ROOT, '.demo');
const MANIFEST_PATH = resolve(MANIFEST_DIR, 'start-manifest.json');
const LOG_DIR = resolve(MANIFEST_DIR, 'logs');

const WEB_PORT = process.env.WEB_PORT ?? '3000';
const API_PORT = process.env.API_PORT ?? '3001';
const SIM_PORT = process.env.PAYMENT_SIMULATOR_PORT ?? '3090';
const SIMULATOR_PATH = 'tests/e2e/_fixtures/payment-provider-simulator.mjs';
const READINESS_TIMEOUT_MS = 60_000;
const READINESS_POLL_MS = 750;
const execFileAsync = promisify(execFile);

const SERVICES = [
  {
    key: 'web',
    label: 'Web (Next.js)',
    spawn: () =>
      spawnNodeScript(['pnpm', 'dev:web'], {
        WEB_PORT,
        NODE_ENV: 'development',
      }),
    // Probe the IPv4 listener directly. Browser-facing URLs stay on canonical
    // localhost, but Node may resolve localhost to ::1 while the API binds
    // 127.0.0.1 only, which would make a healthy stack time out here.
    health: { url: `http://127.0.0.1:${WEB_PORT}/`, kind: 'http' },
  },
  {
    key: 'api',
    label: 'API (NestJS)',
    spawn: () =>
      spawnNodeScript(['pnpm', 'dev:api'], {
        API_PORT,
        NODE_ENV: 'development',
      }),
    health: { url: `http://127.0.0.1:${API_PORT}/api/v1/health/ready`, kind: 'http' },
  },
  {
    key: 'worker',
    label: 'Worker',
    spawn: () =>
      spawnNodeScript(['pnpm', 'dev:worker'], {
        NODE_ENV: 'development',
      }),
    health: { kind: 'process' },
  },
  {
    key: 'simulator',
    label: 'Payment simulator',
    spawn: () =>
      spawnNodeScript(['node', SIMULATOR_PATH], {
        PAYMENT_SIMULATOR_PORT: SIM_PORT,
        PAYMENT_SIMULATOR_MOMO_IPN_URL: `http://localhost:${API_PORT}/api/v1/webhooks/momo`,
        PAYMENT_SIMULATOR_VNPAY_IPN_URL: `http://localhost:${API_PORT}/api/v1/webhooks/vnpay`,
        PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE: `http://localhost:${WEB_PORT}/booking/manage`,
      }),
    health: { url: `http://127.0.0.1:${SIM_PORT}/__health`, kind: 'http' },
  },
];

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const text = readFileSync(filePath, 'utf8');
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

function createMissingDemoSecrets(fileEnv) {
  const generated = {};
  for (const key of DEMO_SECRET_KEYS) {
    if (typeof fileEnv[key] === 'string' && fileEnv[key].length >= 32) continue;
    generated[key] = randomBytes(32).toString('base64url');
  }
  return generated;
}

function spawnNodeScript(args, extraEnv) {
  // Load the repository's .env file at the runner process so the
  // spawned children inherit DATABASE_URL, BETTER_AUTH_SECRET,
  // MOMO/VNPAY credentials, etc. We do not rely on with-local-env.mjs
  // because the wrapper's `../../.env` resolution is relative to the
  // child's cwd, which varies between workspaces. Inlining the env
  // at the runner is the only reliable way to load it once and
  // propagate it down to every child.
  const fileEnv = loadEnvFile(join(REPO_ROOT, '.env'));
  const generatedDemoSecrets = createMissingDemoSecrets(fileEnv);
  const env = {
    ...process.env,
    ...fileEnv,
    ...generatedDemoSecrets,
    ...extraEnv,
  };
  // Resolve the high-level command (pnpm, node, tsx, etc.) into a
  // real executable + args. command-executable.mjs handles the
  // Windows-specific `node <corepack-pnpm.js>` invocation.
  const [command, ...rest] = args;
  const invocation = resolveCommandInvocation(command, rest);
  mkdirSync(LOG_DIR, { recursive: true });
  const safeName = command.replaceAll(/[^a-z0-9]+/gi, '-').replaceAll(/^-|-$/g, '');
  const logPath = join(LOG_DIR, `${safeName || 'service'}.log`);
  const logHandle = openSync(logPath, 'a');
  const child = spawn(invocation.executable, invocation.args, {
    cwd: REPO_ROOT,
    env,
    // A detached process with inherited stdout/stderr is torn down when the
    // runner command exits on Windows. File-backed logs keep the process
    // group alive while preserving diagnostics for the runbook.
    stdio: ['ignore', logHandle, logHandle],
    windowsHide: true,
    detached: true,
  });
  closeSync(logHandle);
  child.unref();
  console.log(`  logs: ${logPath}`);
  return child;
}

async function pingHttp(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return isExactReadyStatus(r.status);
  } catch {
    return false;
  }
}

async function waitForHealth(services, children) {
  const pending = services.filter((s) => s.health);
  if (pending.length === 0) return;
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  const ready = new Set();
  while (Date.now() < deadline && ready.size < pending.length) {
    for (const s of pending) {
      if (ready.has(s.key)) continue;
      if (s.health.kind === 'process') {
        const child = children[s.key];
        if (child?.exitCode !== null || child?.signalCode !== null || child?.killed === true) {
          throw new Error(`${s.label} exited before readiness`);
        }
        ready.add(s.key);
        console.log(`  ${s.label}: RUNNING (process liveness)`);
        continue;
      }
      const ok = await pingHttp(s.health.url);
      if (ok) {
        ready.add(s.key);
        console.log(`  ${s.label}: READY (${s.health.url})`);
      }
    }
    if (ready.size < pending.length) {
      await delay(READINESS_POLL_MS);
    }
  }
  if (ready.size < pending.length) {
    const missing = pending.filter((s) => !ready.has(s.key)).map((s) => s.label);
    throw new Error(`Readiness deadline reached. Still not ready: ${missing.join(', ')}`);
  }
}

async function detectListenerPid(port) {
  // Uses Get-NetTCPConnection (PowerShell) to read LISTENING sockets and
  // return the owning process ID. This is read-only and never kills anything.
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
      ],
      { windowsHide: true },
    );
    const pid = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function recordOwnedPids(children) {
  // The runner's child handle gives us the PID of the immediate
  // child (pnpm or node). That's the root of the process tree we
  // spawned. This is the PID we want to terminate on shutdown - the
  // grandchildren (next dev, tsx watch, etc.) are part of the same
  // taskkill /T tree.
  const owned = [];
  for (const [key, child] of Object.entries(children)) {
    if (!child || !Number.isFinite(child.pid)) continue;
    const identity = await inspectWindowsProcessIdentity(child.pid);
    if (identity === undefined) {
      throw new Error(`Unable to capture process identity for ${key} PID ${child.pid}`);
    }
    owned.push({
      pid: child.pid,
      service: key,
      startedAt: new Date().toISOString(),
      identity,
    });
  }
  return owned;
}

function writeManifest(owned, warnings) {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  const manifest = {
    schema: 2,
    runner: 'scripts/demo/start-local.mjs',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    ports: {
      web: Number.parseInt(WEB_PORT, 10),
      api: Number.parseInt(API_PORT, 10),
      simulator: Number.parseInt(SIM_PORT, 10),
    },
    owned,
    warnings: warnings ?? [],
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

async function main() {
  console.log('--- Local demo start (Windows-only) ---');
  if (process.platform !== 'win32') {
    console.error(
      'This runner is Windows-only. On macOS / Linux, run the equivalent dev commands manually.',
    );
    process.exit(2);
  }

  // Safety: refuse to take over listeners whose owning PID is not in
  // the owned set we are about to record.
  for (const port of [WEB_PORT, API_PORT, SIM_PORT]) {
    const owner = await detectListenerPid(Number.parseInt(port, 10));
    if (owner !== null) {
      console.error(`Port ${port} is already bound by PID ${owner}. Refusing to start.`);
      console.error('Run scripts/demo/stop.mjs first, or stop the existing process manually.');
      process.exit(2);
    }
  }

  const children = {};
  for (const svc of SERVICES) {
    try {
      const child = svc.spawn();
      children[svc.key] = child;
      console.log(`  ${svc.label}: spawned pid=${child.pid}`);
    } catch (err) {
      console.error(`  ${svc.label}: spawn failed: ${formatError(err)}`);
      for (const [k, c] of Object.entries(children)) {
        if (c && !c.killed) {
          try {
            c.kill();
          } catch (killErr) {
            process.stderr.write(`rollback kill failed for ${k}: ${formatError(killErr)}\n`);
          }
          console.log(`  rolled back: killed ${k} pid=${c.pid}`);
        }
      }
      process.exit(1);
    }
  }

  // Persist ownership manifest immediately so that an unexpected crash
  // (e.g. Ctrl-C during npm install) still leaves stop.mjs with a list
  // of PIDs it is allowed to terminate.
  let ownedInitial;
  try {
    ownedInitial = await recordOwnedPids(children);
  } catch (error) {
    console.error(`start-local: ${formatError(error)}`);
    for (const child of Object.values(children)) {
      if (child?.killed !== true) child?.kill();
    }
    process.exit(1);
  }
  writeManifest(ownedInitial, ['manifest recorded before readiness wait']);

  try {
    await waitForHealth(SERVICES, children);
  } catch (err) {
    console.error(`start-local: ${formatError(err)}`);
    console.error('Manifest retained so stop.mjs can clean up.');
    process.exit(1);
  }

  // Refresh manifest after readiness so the final owned PID set is
  // recorded exactly once, with the same children.
  const ownedFinal = await recordOwnedPids(children);
  writeManifest(ownedFinal, ['manifest recorded after readiness wait']);

  console.log(`\nAll services ready. Manifest: ${MANIFEST_PATH}`);
  console.log('Run VERIFY-DEMO.ps1 next.');
}

if (!existsSync(REPO_ROOT)) {
  throw new Error(`Repository root not found: ${REPO_ROOT}`);
}

main().catch((err) => {
  console.error(`start-local: ${err.message}`);
  process.exit(1);
});
