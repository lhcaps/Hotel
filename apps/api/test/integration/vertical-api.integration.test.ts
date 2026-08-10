import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

const FASTIFY_PORT = 3025;
const BASE = `http://127.0.0.1:${FASTIFY_PORT}/api/v1`;

let apiProc: ChildProcess | undefined;

async function waitForApi(timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (apiProc?.exitCode !== null && apiProc?.exitCode !== undefined) {
      throw new Error(`API subprocess exited before readiness with code ${apiProc.exitCode}.`);
    }
    try {
      const r = await fetch(`${BASE}/health/live`);
      if (r.status === 200) return true;
    } catch {
      // not ready
    }
    await delay(500);
  }
  return false;
}

beforeAll(async () => {
  apiProc = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      API_PORT: String(FASTIFY_PORT),
      LOG_LEVEL: 'warn',
      API_HOST: '127.0.0.1',
      WEB_ORIGIN: 'http://localhost:3000',
      AUTH_BASE_URL: `http://127.0.0.1:${FASTIFY_PORT}`,
      DATABASE_URL: process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL,
      REDIS_URL: 'redis://127.0.0.1:6379',
      MAIL_HOST: '127.0.0.1',
      MAIL_PORT: '1025',
      MAIL_FROM: 'no-reply@room-management.local',
      BETTER_AUTH_SECRET: 'local-dev-only-secret-with-at-least-thirty-two-characters',
      GUEST_OTP_SECRET: 'test-guest-otp-secret-32-chars-min-aaaaaa',
      GUEST_CHALLENGE_REF_SECRET: 'test-challenge-ref-secret-32-chars-aaaa',
      GUEST_SESSION_SECRET: 'test-guest-session-secret-32-chars-aaaaa',
      BOOKING_IP_DIGEST_SECRET: 'test-ip-digest-secret-32-chars-aaaaa',
      BOOKING_ACCESS_QR_SECRET:
        process.env.BOOKING_ACCESS_QR_SECRET ?? 'local-test-booking-access-qr-secret-32-bytes',
      MOMO_ENABLED: 'false',
      VNPAY_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  apiProc.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[api] ${chunk.toString('utf8')}`);
  });
  const ready = await waitForApi();
  expect(ready).toBe(true);
}, 60_000);

afterAll(async () => {
  if (apiProc && !apiProc.killed) {
    apiProc.kill();
  }
});

describe('API HTTP bootstrap (vertical slice smoke test)', () => {
  it('responds 200 on health/live', async () => {
    const r = await fetch(`${BASE}/health/live`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('accepts the equivalent local loopback origin for availability preflight', async () => {
    const r = await fetch(`${BASE}/availability/search`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:3000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:3000');
    expect(r.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it.each(['http://127.0.0.1:3001', 'http://api.example.test:3000', 'https://localhost:3000'])(
    'rejects non-equivalent preflight origin %s',
    async (origin) => {
      const r = await fetch(`${BASE}/availability/search`, {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });

      expect(r.headers.get('access-control-allow-origin')).not.toBe(origin);
    },
  );

  it('rejects without cookie on bookings GET with 401 (no session check first)', async () => {
    const r = await fetch(`${BASE}/public/bookings/RM-INVALID-CODE-AAAA`, {
      headers: { origin: 'http://localhost:3000' },
    });
    expect(r.status).toBe(401);
  });

  it('rejects invalid OTP request body with 400', async () => {
    const r = await fetch(`${BASE}/public/guest-access/otp/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
  });

  it('returns 401/403 for bookings GET without valid cookie', async () => {
    const r = await fetch(`${BASE}/public/bookings/RM-AB23-CD45-EF67`, {
      headers: { origin: 'http://localhost:3000' },
    });
    expect([401, 403]).toContain(r.status);
  });
});
