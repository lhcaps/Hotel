// playwright.rehearse.config.ts
//
// Phase 6F human-visible browser rehearsal. Boots Playwright against the
// live demo on 3100/3101 with NO globalSetup (the demo is already up
// from `pnpm demo:phase6`). The user picks a focused subset of specs
// via --grep; no video, no trace; screenshots are left to the spec.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/api-unavailable.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
});
