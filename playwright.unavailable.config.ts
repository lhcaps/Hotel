import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'api-unavailable.spec.ts',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3102',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm --filter @room/web exec node ../../scripts/with-local-env.mjs next dev --port 3102',
    url: 'http://127.0.0.1:3102/health',
    reuseExistingServer: process.env.CI !== 'true',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      WEB_PORT: '3102',
      NEXT_DIST_DIR: '.next-playwright-unavailable',
      NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3199/api/v1',
    },
  },
});
