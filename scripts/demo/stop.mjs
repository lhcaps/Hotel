#!/usr/bin/env node
// scripts/demo/stop.mjs
//
// Tear down the local demo stack started by `scripts/demo/start-local.mjs`.
//
// Safety rules:
//   - Reads `.demo/start-manifest.json` to learn which PIDs this
//     runner is allowed to terminate.
//   - Kills ONLY those PIDs (plus any tree children we recorded).
//   - Never scans ports and never uses `taskkill /F` against unknown
//     listeners. If a listener is not in the manifest, it is left
//     alone.
//   - Refuses to run if the manifest is missing or corrupt (this is
//     what stops the operator from accidentally killing unrelated
//     processes on shared hosts).
//
// Exit codes:
//   0 = every owned PID terminated cleanly (or was already gone).
//   1 = some owned PIDs could not be terminated.
//   2 = manifest missing / unreadable / corrupt — operator must
//       intervene manually.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import {
  inspectWindowsProcessIdentity,
  matchesProcessIdentity,
  validateOwnedProcessEntry,
} from './runner-safety.mjs';

const execFileAsync = promisify(execFile);
const MANIFEST_PATH = resolve(process.cwd(), '.demo', 'start-manifest.json');

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function taskkillPid(pid) {
  // /T walks the process tree; /F forces termination. We pass /PID so
  // we are explicit, and never use /IM (image name) which would sweep
  // unrelated node.exe processes.
  try {
    await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function processAlive(pid) {
  try {
    const { stdout } = await execFileAsync(
      'tasklist.exe',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true },
    );
    return stdout.trim().startsWith('"');
  } catch {
    return false;
  }
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return {
      ok: false,
      reason: `Manifest not found at ${MANIFEST_PATH}. Did start-local.mjs run?`,
    };
  }
  let raw;
  try {
    raw = readFileSync(MANIFEST_PATH, 'utf8');
  } catch (err) {
    return { ok: false, reason: `Manifest unreadable: ${formatError(err)}` };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `Manifest corrupt: ${formatError(err)}` };
  }
  if (parsed.schema !== 2) {
    return { ok: false, reason: `Manifest schema mismatch (got ${parsed.schema})` };
  }
  if (!Array.isArray(parsed.owned)) {
    return { ok: false, reason: 'Manifest missing "owned" array' };
  }
  const invalid = parsed.owned.find((entry) => validateOwnedProcessEntry(entry).ok === false);
  if (invalid !== undefined) {
    return { ok: false, reason: 'Manifest contains an incomplete process identity' };
  }
  const owned = parsed.owned;
  return { ok: true, manifest: parsed, owned };
}

async function main() {
  console.log('--- Local demo stop ---');
  if (process.platform !== 'win32') {
    console.error('This runner is Windows-only.');
    process.exit(2);
  }

  const result = readManifest();
  if (!result.ok) {
    console.error(`Refusing to terminate anything: ${result.reason}`);
    console.error('No owned PIDs in scope. Investigate manually if needed.');
    process.exit(2);
  }

  const { manifest, owned } = result;
  if (owned.length === 0) {
    console.log(`Manifest has zero owned PIDs (${MANIFEST_PATH}). Nothing to do.`);
    return;
  }

  console.log(`Manifest recorded ${manifest.startedAt} with ${owned.length} PID(s).`);
  let killed = 0;
  let failed = 0;
  for (const entry of owned) {
    const alive = await processAlive(entry.pid);
    if (!alive) {
      console.log(`  pid ${entry.pid} (${entry.service}): already gone`);
      continue;
    }
    const identity = await inspectWindowsProcessIdentity(entry.pid);
    if (!matchesProcessIdentity(entry.identity, identity)) {
      console.error(`  pid ${entry.pid} (${entry.service}): identity mismatch; refusing to kill`);
      failed++;
      continue;
    }
    const ok = await taskkillPid(entry.pid);
    if (ok) {
      console.log(`  pid ${entry.pid} (${entry.service}): killed`);
      killed++;
    } else {
      console.error(`  pid ${entry.pid} (${entry.service}): failed to kill`);
      failed++;
    }
  }

  console.log(`Summary: killed=${killed} failed=${failed} total_owned=${owned.length}`);
  if (failed > 0) process.exit(1);
  try {
    unlinkSync(MANIFEST_PATH);
    console.log(`Retired manifest: ${MANIFEST_PATH}`);
  } catch (error) {
    console.error(`Stopped processes but could not retire manifest: ${formatError(error)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`stop: ${err.message}`);
  process.exit(1);
});
