import { defineConfig } from '@playwright/test';

import { ensurePlaywrightRuntime } from './scripts/playwright-runtime.mjs';

const baseURL = process.env.PUBLIC_E2E_BASE_URL;
if (baseURL === undefined || !baseURL.startsWith('https://')) {
  throw new Error(
    'PUBLIC_E2E_BASE_URL must be the deployed HTTPS origin; local origins are refused.',
  );
}

ensurePlaywrightRuntime();

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'public-release.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL, trace: 'on-first-retry' },
});
