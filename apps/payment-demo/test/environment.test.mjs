import assert from 'node:assert/strict';
import test from 'node:test';

import { loadEnvironment } from '../main.mjs';

const base = {
  PAYMENT_DEMO_PUBLIC_ORIGIN: 'https://payments.example.test',
  PAYMENT_DEMO_WEB_ORIGIN: 'https://example.test',
  PAYMENT_DEMO_MOMO_IPN_URL: 'http://api:3001/api/v1/webhooks/momo',
  PAYMENT_DEMO_VNPAY_IPN_URL: 'http://api:3001/api/v1/webhooks/vnpay',
  PAYMENT_DEMO_CONTROL_TOKEN: 'a-demo-control-token-that-is-at-least-32-characters',
  MOMO_PARTNER_CODE: 'DEMO_MOMO',
  MOMO_ACCESS_KEY: 'demo-momo-access',
  MOMO_SECRET_KEY: 'demo-momo-secret-key-that-is-at-least-32-characters',
  VNPAY_TMN_CODE: 'DEMOVNPAY',
  VNPAY_HASH_SECRET: 'demo-vnpay-hash-secret-that-is-at-least-32-characters',
};

test('requires an HTTPS public origin and a distinct trusted browser origin', () => {
  assert.throws(
    () => loadEnvironment({ ...base, PAYMENT_DEMO_PUBLIC_ORIGIN: 'http://payments.example.test' }),
    /PAYMENT_DEMO_PUBLIC_ORIGIN must be HTTPS/,
  );
  assert.throws(
    () => loadEnvironment({ ...base, PAYMENT_DEMO_WEB_ORIGIN: 'https://payments.example.test' }),
    /must not equal PAYMENT_DEMO_PUBLIC_ORIGIN/,
  );
});

test('rejects a short control token and accepts private callback URLs', () => {
  assert.throws(
    () => loadEnvironment({ ...base, PAYMENT_DEMO_CONTROL_TOKEN: 'too-short' }),
    /PAYMENT_DEMO_CONTROL_TOKEN must be at least 32 characters/,
  );
  const environment = loadEnvironment(base);
  assert.equal(environment.publicOrigin, 'https://payments.example.test');
  assert.equal(environment.momoIpnUrl, 'http://api:3001/api/v1/webhooks/momo');
});
