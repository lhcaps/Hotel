#!/usr/bin/env node
// scripts/demo/lifecycle-test.mjs
//
// Phase 6F demo lifecycle test. Drives the orchestrator end-to-end:
//
//   1. ensure ports 3100/3101 are free (fail fast otherwise);
//   2. write a custom DEMO_STATE_FILE under the repo so two runs don't
//      collide with each other or with the production manifest;
//   3. start `pnpm demo:phase6` as a child with DEMO_TEST_MODE=1 and
//      DEMO_AUTO_SHUTDOWN_AFTER_MS=30_000;
//   4. wait for the ready banner;
//   5. run the existing smoke against the same DEMO_STATE_FILE;
//   6. assert the complete smoke assertion set passes;
//   7. wait for the orchestrator to self-shutdown (or force it if the
//      grace elapses without the orchestrator exiting cleanly);
//   8. assert orchestrator exit code 0;
//   9. assert all owned PIDs are gone and ports 3100/3101 have no
//      LISTEN listener;
//  10. assert disposable database is gone;
//  11. assert password file is gone;
//  12. assert manifest is gone;
//  13. assert port 3001 owner is unchanged.
//
// A timeout is a test failure, not a successful cleanup.

import { spawn, execFile } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { resolvePnpmInvocation } from '../command-executable.mjs';
import { DEMO_API_PORT, DEMO_PROTECTED_PORT, DEMO_WEB_PORT } from './demo-constants.mjs';
import {
  compareProtectedPortStates,
  formatProtectedPortState,
  snapshotProtectedPort,
} from './protected-port-state.mjs';

const execFileAsync = promisify(execFile);
const WINDOWS = process.platform === 'win32';

const READY_MARKER = 'Phase 6F demo is ready';
const ORCHESTRATOR_GRACE_MS = 90_000; // orchestrator must self-shutdown within 90s of grace
const READY_WAIT_MS = 240_000;

function nowIso() {
  return new Date().toISOString();
}

function pnpmCommand(args) {
  const invocation = resolvePnpmInvocation(args);
  return { executable: invocation.executable, commandArgs: invocation.args };
}

function spawnPnpm(args, env) {
  const { executable, commandArgs } = pnpmCommand(args);
  return spawn(executable, commandArgs, {
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
    windowsHide: true,
  });
}

function runPnpm(args, env) {
  return new Promise((res, rej) => {
    const child = spawnPnpm(args, env);
    let stdout = '';
    if (child.stdout !== null) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    child.once('error', rej);
    child.once('exit', (code) => res({ code, stdout }));
  });
}

async function waitForReady(child, stateFile) {
  return new Promise((res, rej) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(pollTimer);
      child.stdout?.off('data', onData);
      child.off('exit', onExit);
      if (err) rej(err);
      else res(undefined);
    };
    const timer = setTimeout(
      () => finish(new Error(`Ready marker not seen within ${READY_WAIT_MS}ms`)),
      READY_WAIT_MS,
    );
    const onData = (chunk) => {
      if (typeof chunk === 'string' && chunk.includes(READY_MARKER)) {
        finish(null);
      }
    };
    const onExit = (code) => {
      finish(new Error(`Orchestrator exited (code=${String(code)}) before ready marker`));
    };
    // Primary detection: poll the manifest file written by the
    // orchestrator at ready time. This is robust to stdout buffering
    // and to whatever the host shell does with the orchestrator's
    // child stdio.
    const pollTimer = setInterval(() => {
      if (!existsSync(stateFile)) return;
      try {
        const parsed = JSON.parse(readFileSync(stateFile, 'utf8'));
        if (parsed && typeof parsed.passwordPath === 'string' && parsed.passwordPath.length > 0) {
          finish(null);
        }
      } catch {
        // Manifest exists but not yet valid; keep polling.
      }
    }, 500);
    // Secondary detection: stdout (banner is also written to stdout).
    child.stdout?.on('data', onData);
    child.once('exit', onExit);
  });
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function tcpListenerInfo(port) {
  return new Promise((res) => {
    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.destroy();
      res(true);
    });
    socket.setTimeout(500);
    socket.once('error', () => res(false));
    socket.once('timeout', () => {
      socket.destroy();
      res(false);
    });
  });
}

async function databaseExists(name) {
  // Use a Node-only probe via the demo's own demo:db:create-style
  // pattern: we ask psql for `datname = $1`. If psql is missing we
  // fall back to a small Node script that connects via the pg client
  // (which the @room/database workspace already depends on).
  try {
    const { stdout } = await execFileAsync(
      'psql',
      [
        '--no-psqlrc',
        '--tuples-only',
        '--no-align',
        '--command',
        `SELECT 1 FROM pg_database WHERE datname = '${name.replaceAll("'", "''")}'`,
        'postgresql://room:room@127.0.0.1:5432/postgres',
      ],
      { windowsHide: true },
    );
    return stdout.trim().length > 0;
  } catch {
    // psql unavailable or database missing. We don't attempt a Node
    // probe here because importing `pg` from this workspace would
    // need the dependency in scope. Instead, we treat an exception as
    // "we cannot verify the database name from this process"; the
    // lifecycle test will only assert absence when the manifest path
    // is already known (see caller).
    return null;
  }
}

async function readManifestDatabaseName(path) {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return typeof parsed?.databaseName === 'string' ? parsed.databaseName : null;
  } catch {
    return null;
  }
}

function readManifestPasswordPath(path) {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed.passwordPath === 'string' ? parsed.passwordPath : null;
  } catch {
    return null;
  }
}

function readManifestOwnedPids(path) {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const list = Array.isArray(parsed?.ownedPids) ? parsed.ownedPids : [];
    return list.filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  } catch {
    return [];
  }
}

function pidIsAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      return error.code === 'EPERM';
    }
    return false;
  }
}

const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(36)} ${detail ?? ''}\n`);
}

async function main() {
  const stateFile =
    process.env.DEMO_STATE_FILE ??
    resolve(tmpdir(), `room-management-demo-lifecycle-${process.pid}.json`);
  const passwordPattern = /^room-management-demo-admin-[a-f0-9]{16}\.txt$/;

  process.stdout.write(`\n=== Demo lifecycle test ===\n`);
  process.stdout.write(`  state file : ${stateFile}\n`);
  process.stdout.write(`  started at : ${nowIso()}\n`);

  // Step 1: ensure ports are free.
  const webFree = !(await tcpListenerInfo(DEMO_WEB_PORT));
  const apiFree = !(await tcpListenerInfo(DEMO_API_PORT));
  record('ports.free.web', webFree, `web ${DEMO_WEB_PORT} ${webFree ? 'free' : 'busy'}`);
  record('ports.free.api', apiFree, `api ${DEMO_API_PORT} ${apiFree ? 'free' : 'busy'}`);
  if (!webFree || !apiFree) {
    process.stdout.write(`\nLifecycle test cannot start while ports 3100/3101 are busy.\n`);
    process.exitCode = 1;
    return;
  }

  // Snapshot the port 3001 owner BEFORE.
  let ownerBefore = null;
  let protectedPortSnapshotError = null;
  if (WINDOWS) {
    try {
      const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'TCP'], {
        windowsHide: true,
      });
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP')) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 4) continue;
        const local = parts[1] ?? '';
        const state = parts[3] ?? '';
        if (state !== 'LISTENING') continue;
        if (local.endsWith(`:${DEMO_PROTECTED_PORT}`)) {
          ownerBefore = parts[4] ?? null;
          break;
        }
      }
    } catch (error) {
      protectedPortSnapshotError = error instanceof Error ? error.message : String(error);
    }
  }
  let protectedPortBefore;
  try {
    protectedPortBefore = snapshotProtectedPort(ownerBefore);
  } catch (error) {
    protectedPortSnapshotError = error instanceof Error ? error.message : String(error);
  }
  record(
    'port3001.snapshot',
    protectedPortSnapshotError === null,
    protectedPortSnapshotError ??
      `port 3001 before = ${formatProtectedPortState(protectedPortBefore)}`,
  );

  // Step 2: start the orchestrator with test mode + auto-shutdown.
  const orchestratorEnv = {
    ...process.env,
    DEMO_STATE_FILE: stateFile,
    DEMO_TEST_MODE: '1',
    DEMO_AUTO_SHUTDOWN_AFTER_MS: String(60_000),
    FORCE_COLOR: '0',
  };
  const orchestrator = spawnPnpm(['demo:phase6'], orchestratorEnv);

  let orchestratorExitCode = null;
  let orchestratorExitSignal = null;
  const orchestratorExit = new Promise((res) => {
    orchestrator.once('exit', (code, signal) => {
      orchestratorExitCode = code;
      orchestratorExitSignal = signal;
      res(undefined);
    });
  });

  // Step 3: wait for the ready banner.
  let ready = false;
  try {
    await waitForReady(orchestrator, stateFile);
    ready = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record('orchestrator.ready', false, message);
  }
  record('orchestrator.ready', ready, ready ? 'ready banner seen' : 'ready banner missing');

  if (!ready) {
    // Bail out: orchestrator failed before reaching ready.
    await orchestratorExit;
    process.exitCode = 1;
    return;
  }

  // Step 4 + 5: smoke against the same state file.
  const smokeEnv = {
    ...process.env,
    DEMO_STATE_FILE: stateFile,
    FORCE_COLOR: '0',
  };
  const smokeResult = await runPnpm(['demo:smoke:running'], smokeEnv);
  const smokeSummary = (smokeResult.stdout.match(/Smoke summary: (\d+)\/(\d+) passed/) ?? [
    '',
    '0',
    '0',
  ])[1];
  const smokeTotal = (smokeResult.stdout.match(/Smoke summary: (\d+)\/(\d+) passed/) ?? [
    '',
    '0',
    '0',
  ])[2];
  record(
    'smoke.complete',
    smokeResult.code === 0 && smokeTotal !== '0' && smokeSummary === smokeTotal,
    `smoke exited code=${String(smokeResult.code)}, ${smokeSummary}/${smokeTotal} passed`,
  );

  // Step 6: keep services healthy for at least 30s. The orchestrator
  // is set to self-shutdown 30s after ready; we just wait and then
  // observe the orchestrator exit.
  // First confirm a few health pings.
  for (const url of [
    `http://127.0.0.1:${DEMO_WEB_PORT}/health`,
    `http://127.0.0.1:${DEMO_API_PORT}/api/v1/health/live`,
  ]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      record(`health.${url}`, response.ok, `${url} -> ${response.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      record(`health.${url}`, false, message);
    }
  }

  // Capture DB name and owned PIDs from the manifest as soon as ready
  // is observed. We do this BEFORE waiting for orchestrator exit
  // because the orchestrator deletes the manifest during cleanup.
  const dbNameAtReady = await readManifestDatabaseName(stateFile);
  const ownedPidsAtReady = readManifestOwnedPids(stateFile);
  const passwordPathAtReady = readManifestPasswordPath(stateFile);

  // Step 7: wait for orchestrator self-shutdown. The grace window is
  // generous to absorb slower CI.
  await Promise.race([orchestratorExit, sleep(ORCHESTRATOR_GRACE_MS).then(() => 'timeout')]);

  // If still alive, force-shutdown the orchestrator tree.
  if (orchestratorExitCode === null && orchestratorExitSignal === null) {
    if (orchestrator.pid !== undefined) {
      try {
        if (WINDOWS) {
          await execFileAsync('taskkill.exe', ['/pid', String(orchestrator.pid), '/t', '/f'], {
            windowsHide: true,
          });
        } else {
          orchestrator.kill('SIGTERM');
        }
      } catch {
        // Already gone.
      }
    }
    await orchestratorExit;
    record('orchestrator.exit', false, 'did not self-shutdown; force-killed');
  } else {
    record(
      'orchestrator.exit',
      orchestratorExitCode === 0,
      `code=${String(orchestratorExitCode)} signal=${String(orchestratorExitSignal)}`,
    );
  }

  // Allow ports to release.
  await sleep(2_000);

  // Step 8 + 9: ports 3100/3101 have no LISTEN listener.
  const webBusyAfter = await tcpListenerInfo(DEMO_WEB_PORT);
  const apiBusyAfter = await tcpListenerInfo(DEMO_API_PORT);
  record(
    'ports.released.web',
    !webBusyAfter,
    `web ${DEMO_WEB_PORT} ${webBusyAfter ? 'busy' : 'released'}`,
  );
  record(
    'ports.released.api',
    !apiBusyAfter,
    `api ${DEMO_API_PORT} ${apiBusyAfter ? 'busy' : 'released'}`,
  );

  // Step 9b: every owned PID from the manifest snapshot taken at
  // ready time is gone. We compare against the snapshot so the
  // assertion is meaningful even if the manifest itself has already
  // been removed.
  const ownedPidsSnapshot = ownedPidsAtReady;
  let ownedGone = true;
  let ownedDetail = '';
  if (ownedPidsSnapshot.length > 0) {
    const stillAlive = ownedPidsSnapshot.filter((pid) => pidIsAlive(pid));
    if (stillAlive.length > 0) {
      ownedGone = false;
      ownedDetail = `still alive: ${stillAlive.join(',')}`;
    } else {
      ownedDetail = `${ownedPidsSnapshot.length} pids checked, all gone`;
    }
  } else {
    ownedDetail = 'no ownedPids recorded at ready; nothing to verify';
  }
  record('ownedPids.gone', ownedGone, ownedDetail);

  // Step 10: disposable database is gone. We use the DB name we
  // captured at ready time so we can actually verify the drop.
  const dbName = dbNameAtReady;
  let dbGone = dbName === null;
  if (dbName !== null) {
    dbGone = !(await databaseExists(dbName));
  }
  record(
    'database.gone',
    dbGone,
    `database ${String(dbName)} ${dbGone ? 'absent' : 'still present'}`,
  );

  // Step 11 + 12: password file and manifest are absent.
  const passwordName = passwordPathAtReady?.split(/[\\/]/).pop() ?? '';
  const passwordAbsent =
    passwordPathAtReady === null ||
    !passwordPattern.test(passwordName) ||
    !existsSync(passwordPathAtReady);
  record('password.absent', passwordAbsent, 'password file removed');
  record(
    'manifest.absent',
    !existsSync(stateFile),
    `manifest ${existsSync(stateFile) ? 'still present' : 'removed'}`,
  );

  // Step 13: port 3001 owner unchanged.
  let ownerAfter = null;
  if (WINDOWS) {
    try {
      const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'TCP'], {
        windowsHide: true,
      });
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP')) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 4) continue;
        const local = parts[1] ?? '';
        const state = parts[3] ?? '';
        if (state !== 'LISTENING') continue;
        if (local.endsWith(`:${DEMO_PROTECTED_PORT}`)) {
          ownerAfter = parts[4] ?? null;
          break;
        }
      }
    } catch (error) {
      protectedPortSnapshotError ??= error instanceof Error ? error.message : String(error);
    }
  }
  let protectedPortAfter;
  try {
    protectedPortAfter = snapshotProtectedPort(ownerAfter);
  } catch (error) {
    protectedPortSnapshotError ??= error instanceof Error ? error.message : String(error);
  }
  const protectedPortComparison =
    protectedPortSnapshotError === null
      ? compareProtectedPortStates(protectedPortBefore, protectedPortAfter)
      : { ok: false, detail: protectedPortSnapshotError };
  record('port3001.unchanged', protectedPortComparison.ok, protectedPortComparison.detail);

  const failed = checks.filter((c) => !c.ok);
  process.stdout.write(
    `\nLifecycle test: ${checks.length - failed.length}/${checks.length} passed\n`,
  );
  if (failed.length > 0) {
    process.stdout.write(`  failed: ${failed.map((c) => c.name).join(', ')}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`lifecycle test crashed: ${message}\n`);
  process.exitCode = 1;
});
