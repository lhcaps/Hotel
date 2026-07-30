import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers';

import type { FullConfig } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPreparedGuardedTestDatabase: vi.fn(),
  dispose: vi.fn(),
  poolQuery: vi.fn(),
  spawn: vi.fn(),
  startOidcTestServer: vi.fn(),
  startPaymentProviderSimulator: vi.fn(),
}));

const originalAdminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const originalAuthSecret = process.env.PLAYWRIGHT_BETTER_AUTH_SECRET;

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  spawn: mocks.spawn,
}));

vi.mock('@room/database/testing', () => ({
  createPreparedGuardedTestDatabase: mocks.createPreparedGuardedTestDatabase,
}));

vi.mock('./oauth/oidc-test-server.js', () => ({
  startOidcTestServer: mocks.startOidcTestServer,
}));

vi.mock('./payment/payment-provider-simulator-runner.js', () => ({
  startPaymentProviderSimulator: mocks.startPaymentProviderSimulator,
}));

import globalSetup from './playwright-global-setup.js';

describe('Playwright server startup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLAYWRIGHT_ADMIN_PASSWORD = `Aa1-${randomBytes(32).toString('base64url')}`;
    process.env.PLAYWRIGHT_BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');
    mocks.createPreparedGuardedTestDatabase.mockResolvedValue({
      databaseUrl: 'postgresql://room:room@127.0.0.1:5432/room_management_test_spawn',
      dispose: mocks.dispose,
      pool: { query: mocks.poolQuery },
    });
    mocks.startOidcTestServer.mockResolvedValue({
      baseUrl: 'http://127.0.0.1:3420',
      close: vi.fn(),
    });
    mocks.startPaymentProviderSimulator.mockResolvedValue({
      baseUrl: 'http://127.0.0.1:3090',
      stop: vi.fn(),
    });
  });

  afterEach(() => {
    if (originalAdminPassword === undefined) {
      delete process.env.PLAYWRIGHT_ADMIN_PASSWORD;
    } else {
      process.env.PLAYWRIGHT_ADMIN_PASSWORD = originalAdminPassword;
    }
    if (originalAuthSecret === undefined) {
      delete process.env.PLAYWRIGHT_BETTER_AUTH_SECRET;
    } else {
      process.env.PLAYWRIGHT_BETTER_AUTH_SECRET = originalAuthSecret;
    }
  });

  it('rejects an asynchronous spawn failure and disposes the guarded database', async () => {
    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      pid: undefined,
      signalCode: null,
    });
    mocks.spawn.mockImplementation(() => {
      setImmediate(() => child.emit('error', new Error('asynchronous spawn failure')));
      return child;
    });

    await expect(globalSetup({} as FullConfig)).rejects.toThrow(
      'Playwright ADMIN bootstrap failed to start: asynchronous spawn failure',
    );
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
});
