import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

function resolveDatabaseUrl(): string {
  try {
    const url = readFileSync(join(tmpdir(), 'playwright-test-database-url.txt'), 'utf8').trim();
    if (url.length > 0) return url;
  } catch {
    // Fall through to env vars.
  }
  return (
    process.env.PLAYWRIGHT_TEST_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    'postgresql://room:room@127.0.0.1:5432/room_management_test_base'
  );
}

const DATABASE_URL = resolveDatabaseUrl();

const PLAYWRIGHT_GUEST_SECRETS = {
  GUEST_OTP_SECRET: 'test-guest-otp-secret-32-chars-min-aaaaaa',
  GUEST_CHALLENGE_REF_SECRET: 'test-challenge-ref-secret-32-chars-aaaa',
  GUEST_SESSION_SECRET: 'test-guest-session-secret-32-chars-aaaa',
  BOOKING_IP_DIGEST_SECRET: 'test-ip-digest-secret-32-chars-aaaaa',
} as const;

interface WorkerRunResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

async function runWorkerOnce(): Promise<WorkerRunResult> {
  // Use `spawn` + `Promise`-based stream collection so we can read stdout
  // line-by-line and time out cleanly if the worker hangs. `execFile` does
  // not give us that level of control on Windows.
  const { spawn } = await import('node:child_process');
  const windows = process.platform === 'win32';
  const executable = windows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
  const args = windows
    ? ['/d', '/s', '/c', 'pnpm', '--filter', '@room/worker', 'exec', 'tsx', 'src/main.ts']
    : ['--filter', '@room/worker', 'exec', 'tsx', 'src/main.ts'];
  const child = spawn(executable, args, {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      DATABASE_URL,
      REDIS_URL: 'redis://127.0.0.1:6379',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'no-reply@room-management.local',
      ...PLAYWRIGHT_GUEST_SECRETS,
      WORKER_MODE: 'once',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const collect = (stream: NodeJS.ReadableStream | null): Promise<string> => {
    if (stream === null) {
      return Promise.resolve('');
    }
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer | string) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', () => resolve(''));
    });
  };
  const [stdout, stderr, exitCode] = await Promise.all([
    collect(child.stdout),
    collect(child.stderr),
    new Promise<number | null>((resolve) => {
      child.once('exit', (code) => resolve(code));
    }),
  ]);
  return { exitCode, stdout, stderr };
}

test('explicit WORKER_MODE=once runs one iteration and exits 0', async () => {
  test.setTimeout(60_000);

  const result = await runWorkerOnce();

  // The one-shot worker must exit 0 to satisfy the recovery/debugging
  // contract that Phase 5 relied on. The packaged `once` entry point
  // continues to be a supported execution mode even though the default
  // runtime mode is continuous.
  expect(
    result.exitCode,
    `one-shot worker exited with code ${String(result.exitCode)}\nstdout=${result.stdout}\nstderr=${result.stderr}`,
  ).toBe(0);
  // Sanity-check that the structured shutdown event was emitted.
  expect(result.stdout).toContain('worker.shutdown.completed');
});
