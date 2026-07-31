import { defineConfig } from '@playwright/test';
import { ensurePlaywrightRuntime } from './scripts/playwright-runtime.mjs';

ensurePlaywrightRuntime();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
  },
  testMatch: [
    'verify-admin-contract.spec.ts',
    'verify-admin-pages.spec.ts',
    'verify-enable-providers.spec.ts',
    'verify-login-flow.spec.ts',
    'verify-screenshots.spec.ts',
    'final-local-demo-acceptance.spec.ts',
  ],
});
