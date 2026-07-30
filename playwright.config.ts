import { defineConfig } from '@playwright/test';

import { ensurePlaywrightRuntime } from './scripts/playwright-runtime.mjs';

ensurePlaywrightRuntime();

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/api-unavailable.spec.ts',
  fullyParallel: false,
  workers: 1,
  globalSetup: './apps/api/test/playwright-global-setup.ts',
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'off',
  },
});
