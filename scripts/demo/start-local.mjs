#!/usr/bin/env node
// scripts/demo/start-local.mjs
//
// Local emergency demo runner. Assumes the infrastructure (Postgres,
// Redis, Mailpit) is already running. Starts the payment simulator on
// 3090 and verifies Web (3000) + API (3001) are reachable. If they are
// not, it offers to start them via the existing `pnpm dev:*` scripts.

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

const SIMULATOR_PATH = 'tests/e2e/_fixtures/payment-provider-simulator.mjs';

async function ping(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function readEnv(key) {
  const envFile = resolve(process.cwd(), '.env');
  if (!existsSync(envFile)) return undefined;
  const text = readFileSync(envFile, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    if (line.slice(0, eq).trim() === key) return line.slice(eq + 1).trim();
  }
  return undefined;
}

async function isPortBound(port) {
  try {
    const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'TCP'], {
      windowsHide: true,
    });
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.trim().startsWith('TCP')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      const local = parts[1];
      const state = parts[3];
      if (state !== 'LISTENING') continue;
      if (local.endsWith(`:${port}`)) return true;
    }
  } catch {}
  return false;
}

function spawnSimulator() {
  const momoIpn =
    process.env.PAYMENT_SIMULATOR_MOMO_IPN_URL ??
    `http://localhost:${process.env.API_PORT ?? '3001'}/api/v1/webhooks/momo`;
  const vnpayIpn =
    process.env.PAYMENT_SIMULATOR_VNPAY_IPN_URL ??
    `http://localhost:${process.env.API_PORT ?? '3001'}/api/v1/webhooks/vnpay`;
  const webPort = process.env.WEB_PORT ?? '3000';
  // Wrap with with-local-env.mjs so the simulator inherits the repo's
  // .env values (PAYMENT_SIMULATOR_* secrets, MOMO/VNPAY partner codes).
  // Provider default back-redirect uses the canonical browser origin
  // (`http://localhost`) so the simulator's browser-side redirect lands
  // on the persistent booking page without exposing a session token in
  // the URL.
  const child = spawn(
    process.execPath,
    ['scripts/with-local-env.mjs', process.execPath, SIMULATOR_PATH],
    {
      env: {
        ...process.env,
        PAYMENT_SIMULATOR_MOMO_IPN_URL: momoIpn,
        PAYMENT_SIMULATOR_VNPAY_IPN_URL: vnpayIpn,
        PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE: `http://localhost:${webPort}/booking/manage`,
      },
      stdio: 'inherit',
      windowsHide: true,
      detached: false,
    },
  );
  child.on('exit', (code) => {
    process.stderr.write(`[simulator] exited code=${String(code)}\n`);
  });
  return child;
}

async function main() {
  console.log('--- Local demo start ---');
  // Canonical browser origins for the demo. Browser-visible flows use
  // `localhost` exclusively; the API origin is `localhost`, with the
  // loopback IP used only for server-to-server simulator/IPN traffic
  // that never reaches the browser.
  const WEB_PORT = process.env.WEB_PORT ?? '3000';
  const API_PORT = process.env.API_PORT ?? '3001';
  const SIM_PORT = process.env.PAYMENT_SIMULATOR_PORT ?? '3090';
  const WEB = `http://localhost:${WEB_PORT}`;
  const API = `http://localhost:${API_PORT}`;
  const SIM_BASE = `http://localhost:${SIM_PORT}`;

  // 1. Simulator
  if (await isPortBound(Number.parseInt(SIM_PORT, 10))) {
    console.log(`simulator (${SIM_PORT}): already running`);
  } else {
    console.log(`simulator (${SIM_PORT}): starting`);
    const child = spawnSimulator();
    // Wait for simulator to be ready
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (await ping(`${SIM_BASE}/__health`)) {
        console.log('simulator: ready');
        break;
      }
      await delay(500);
    }
  }

  // 2. Web
  const webOk = await ping(WEB + '/');
  if (webOk) {
    console.log(`web (${WEB_PORT}): already running`);
  } else {
    console.log(
      `web (${WEB_PORT}): not running, please start it with \`pnpm dev:web\` in another terminal`,
    );
  }

  // 3. API
  const apiOk = await ping(API + '/api/v1/health/live');
  if (apiOk) {
    console.log(`api (${API_PORT}): already running`);
  } else {
    console.log(
      `api (${API_PORT}): not running, please start it with \`pnpm dev:api\` in another terminal`,
    );
  }

  console.log('\nDemo environment status:');
  console.log('  Web:        ' + (webOk ? 'READY' : 'NOT READY'));
  console.log('  API:        ' + (apiOk ? 'READY' : 'NOT READY'));
  console.log(
    '  Simulator:  ' + ((await isPortBound(Number.parseInt(SIM_PORT, 10))) ? 'READY' : 'NOT READY'),
  );

  if (!webOk || !apiOk) {
    console.log(
      '\nSome services are not running. Run `pnpm dev:web` and `pnpm dev:api` in separate terminals, then `pnpm demo:verify`.',
    );
    process.exit(1);
  }
  console.log('\nRun `pnpm demo:verify` to validate the demo end-to-end.');
}

main().catch((e) => {
  console.error('start error:', e);
  process.exit(1);
});
