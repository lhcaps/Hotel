import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const localDemoEnvironment = {
  ...process.env,
  NODE_ENV: 'development',
  GOOGLE_AUTH_ENABLED: 'false',
  MOMO_ENABLED: 'true',
  MOMO_PARTNER_CODE: 'LOCAL_DEMO_MOMO',
  MOMO_ACCESS_KEY: 'local-demo-access-key',
  MOMO_SECRET_KEY: 'local-demo-secret-key-with-at-least-thirty-two-characters',
  MOMO_API_BASE_URL: 'http://127.0.0.1:3090',
  MOMO_RETURN_URL: 'http://127.0.0.1:3101/api/v1/payments/providers/momo/return',
  MOMO_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/momo',
  VNPAY_ENABLED: 'true',
  VNPAY_TMN_CODE: 'LOCALDEMO',
  VNPAY_HASH_SECRET: 'local-demo-vnpay-secret-with-at-least-thirty-two-characters',
  VNPAY_API_BASE_URL: 'http://127.0.0.1:3090/vnpay-test/pay',
  VNPAY_RETURN_URL: 'http://127.0.0.1:3101/api/v1/payments/providers/vnpay/return',
  VNPAY_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/vnpay',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  SMTP_FROM: 'no-reply@room-management.local',
};

test('accepts the repository-owned no-money payment simulator without claiming sandbox readiness', () => {
  const result = spawnSync(process.execPath, ['scripts/check-providers.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: localDemoEnvironment,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /MOMO_LOCAL_DEMO_READY=READY/);
  assert.match(result.stdout, /VNPAY_LOCAL_DEMO_READY=READY/);
  assert.match(result.stdout, /MOMO_SANDBOX_READY=NOT_REQUESTED_LOCAL_DEMO/);
  assert.match(result.stdout, /VNPAY_SANDBOX_READY=NOT_REQUESTED_LOCAL_DEMO/);
});
