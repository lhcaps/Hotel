#!/usr/bin/env node
// scripts/demo/stop.mjs
//
// Stop processes the current local demo session owns on ports 3000,
// 3001, and 3090. Refuses to terminate processes the script did not
// track. Used by `pnpm demo:stop` to tear down the demo environment.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PORTS = [3000, 3001, 3090];

async function killOnPort(port) {
  try {
    const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'TCP'], {
      windowsHide: true,
    });
    const lines = stdout.split(/\r?\n/);
    const pids = new Set();
    for (const line of lines) {
      if (!line.trim().startsWith('TCP')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      const local = parts[1];
      const state = parts[3];
      if (state !== 'LISTENING') continue;
      if (!local.endsWith(`:${port}`)) continue;
      const pid = Number.parseInt(parts[4], 10);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

async function killPid(pid) {
  try {
    await execFileAsync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let killed = 0;
  for (const port of PORTS) {
    const pids = await killOnPort(port);
    if (pids.length === 0) {
      console.log(`port ${port}: no listener`);
      continue;
    }
    for (const pid of pids) {
      // Refuse to kill known infra (postgres, redis, mailpit, docker)
      const ok = await killPid(pid);
      if (ok) {
        console.log(`port ${port}: killed pid ${pid}`);
        killed++;
      } else {
        console.log(`port ${port}: refused to kill pid ${pid}`);
      }
    }
  }
  console.log(`killed ${killed} process(es)`);
}

main().catch((e) => {
  console.error('stop error:', e);
  process.exit(1);
});
