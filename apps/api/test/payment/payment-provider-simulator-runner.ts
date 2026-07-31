#!/usr/bin/env node
// apps/api/test/payment/payment-provider-simulator-runner.mjs
//
// Runner for the deterministic MoMo + VNPAY payment provider simulator.
// Starts the simulator as a child process and exposes the host/port so
// the global setup can point the API at deterministic URLs.
//
// This file is part of test-only infrastructure. It is only invoked when
// NODE_ENV is 'test' (the simulator itself refuses to start under
// NODE_ENV=production). No production code path is affected.
//
// Schema is intentionally narrow: {host, port, baseUrl, stop()}.

import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface PaymentProviderSimulator {
  readonly host: string;
  readonly port: number;
  readonly baseUrl: string;
  readonly stop: () => Promise<void>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SIMULATOR_ENTRY = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
  'tests',
  'e2e',
  '_fixtures',
  'payment-provider-simulator.mjs',
);

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3090;
const STARTUP_TIMEOUT_MS = 15_000;

function ts(): string {
  return new Date().toISOString();
}

function log(message: string, fields?: Record<string, unknown>): void {
  const suffix = fields === undefined ? '' : ` ${JSON.stringify(fields)}`;
  process.stdout.write(`[payment-simulator-runner ${ts()}] ${message}${suffix}\n`);
}

export async function startPaymentProviderSimulator(): Promise<PaymentProviderSimulator> {
  const host = process.env['PAYMENT_SIMULATOR_HOST'] ?? DEFAULT_HOST;
  const port = Number.parseInt(process.env['PAYMENT_SIMULATOR_PORT'] ?? String(DEFAULT_PORT), 10);
  const child: ChildProcess = spawn(process.execPath, [SIMULATOR_ENTRY], {
    env: {
      ...process.env,
      NODE_ENV: process.env['NODE_ENV'] ?? 'test',
      PAYMENT_SIMULATOR_HOST: host,
      PAYMENT_SIMULATOR_PORT: String(port),
      PAYMENT_SIMULATOR_MOMO_IPN_URL:
        process.env['PAYMENT_SIMULATOR_MOMO_IPN_URL'] ??
        'http://127.0.0.1:3101/api/v1/webhooks/momo',
      PAYMENT_SIMULATOR_VNPAY_IPN_URL:
        process.env['PAYMENT_SIMULATOR_VNPAY_IPN_URL'] ??
        'http://127.0.0.1:3101/api/v1/webhooks/vnpay',
      // Loopback-only default back-redirect so tests that skip the control-plane
      // setup still return to /booking/manage/{bookingCode} after a simulator
      // success click, matching the pnpm demo:phase6 behaviour.
      PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE: 'http://127.0.0.1:3100/booking/manage',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const stderrChunks: string[] = [];
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => stderrChunks.push(chunk));
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => log('child', { chunk: chunk.trim() }));

  await new Promise<void>((resolve, reject) => {
    const started = (chunk: string) =>
      chunk.includes('[payment-simulator') && chunk.includes('started');
    let resolved = false;
    const finish = (err?: Error) => {
      if (resolved) return;
      resolved = true;
      if (err !== undefined) reject(err);
      else resolve();
    };
    const onData = (chunk: string) => {
      if (started(chunk)) finish();
    };
    child.stdout?.on('data', onData);
    const timer = setTimeout(() => {
      finish(
        new Error(
          `simulator did not start within ${STARTUP_TIMEOUT_MS}ms; stderr=${stderrChunks.join('')}`,
        ),
      );
    }, STARTUP_TIMEOUT_MS);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      finish(
        new Error(
          `simulator exited before ready (code=${String(code)}, signal=${String(signal)}): ${stderrChunks.join('')}`,
        ),
      );
    });
  });

  log('booted', { host, port });
  return {
    host,
    port,
    baseUrl: `http://${host}:${port}`,
    async stop(): Promise<void> {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (child.exitCode === null) child.kill('SIGKILL');
          resolve();
        }, 2_000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}
