import { defineConfig } from '@playwright/test';

import { ensurePlaywrightRuntime } from './scripts/playwright-runtime.mjs';

ensurePlaywrightRuntime();

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'multi-night-b0.spec.ts',
  fullyParallel: false,
  workers: 1,
  globalSetup: './apps/api/test/playwright-global-setup.ts',
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
});
