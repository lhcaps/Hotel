import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveCommandInvocation } from '../../../scripts/command-executable.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const templatePath = resolve(root, 'deploy/.env.production.example');
const validatorPath = resolve(root, 'scripts/deploy/validate-production-environment.mts');

function parseTemplate() {
  return Object.fromEntries(
    readFileSync(templatePath, 'utf8')
      .split(/\r?\n/u)
      .flatMap((line) => {
        const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
        return match === null ? [] : [[match[1], match[2]]];
      }),
  );
}

function substitutedProductionEnvironment() {
  const replacements = {
    REPLACE_WITH_FULL_40_CHAR_COMMIT_SHA: 'a'.repeat(40),
    REPLACE_WITH_PUBLIC_DOMAIN: 'room.example.test',
    REPLACE_WITH_PAYMENT_DEMO_DOMAIN: 'payments.room.example.test',
    REPLACE_WITH_CADDY_NETWORK_CIDR: '172.16.0.0/12',
    REPLACE_WITH_POSTGRES_USER: 'room_deploy',
    REPLACE_WITH_POSTGRES_PASSWORD: 'generated-postgres-password',
    REPLACE_WITH_POSTGRES_DATABASE: 'room_management',
    REPLACE_WITH_SMTP_HOST: 'smtp.room.example.test',
    REPLACE_WITH_VERIFIED_SENDER: 'no-reply',
    REPLACE_WITH_SMTP_USER: 'generated-smtp-user',
    REPLACE_WITH_SMTP_PASSWORD: 'generated-smtp-password',
    REPLACE_WITH_32_PLUS_CHAR_AUTH_SECRET: 'a'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_OTP_SECRET: 'b'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_CHALLENGE_SECRET: 'c'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_SESSION_SECRET: 'd'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_IP_DIGEST_SECRET: 'e'.repeat(40),
    REPLACE_WITH_32_PLUS_CHAR_PAYMENT_DEMO_CONTROL_TOKEN: 'f'.repeat(40),
    REPLACE_WITH_MOMO_PARTNER_CODE: 'generated-momo-partner-code',
    REPLACE_WITH_MOMO_ACCESS_KEY: 'generated-momo-access-key',
    REPLACE_WITH_32_PLUS_CHAR_MOMO_SECRET: 'g'.repeat(40),
    REPLACE_WITH_VNPAY_TMN_CODE: 'generated-vnpay-tmn-code',
    REPLACE_WITH_32_PLUS_CHAR_VNPAY_SECRET: 'h'.repeat(40),
  };
  return Object.fromEntries(
    Object.entries(parseTemplate()).map(([key, value]) => [
      key,
      Object.entries(replacements).reduce(
        (resolved, [placeholder, replacement]) => resolved.replaceAll(placeholder, replacement),
        value,
      ),
    ]),
  );
}

function validate(environment) {
  const invocation = resolveCommandInvocation('tsx', [validatorPath]);
  return spawnSync(invocation.executable, invocation.args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    windowsHide: true,
  });
}

test('fully substituted production template satisfies every service environment boundary', () => {
  const result = validate(substitutedProductionEnvironment());

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Production deployment environment contract passed/u);
});

test('former sandbox and payment-demo callback topology is rejected without exposing secrets', () => {
  const environment = {
    ...substitutedProductionEnvironment(),
    MOMO_ENVIRONMENT: 'sandbox',
    MOMO_API_BASE_URL: 'https://test-payment.momo.vn',
    MOMO_RETURN_URL: 'https://payments.room.example.test/momo/return',
    MOMO_IPN_URL: 'https://payments.room.example.test/momo/ipn',
    VNPAY_ENVIRONMENT: 'sandbox',
    VNPAY_API_BASE_URL: 'https://sandbox.vnpayment.vn',
    VNPAY_RETURN_URL: 'https://payments.room.example.test/vnpay/return',
    VNPAY_IPN_URL: 'https://payments.room.example.test/vnpay/ipn',
  };
  const result = validate(environment);
  const output = `${result.stdout}${result.stderr}`;

  assert.notEqual(result.status, 0);
  assert.match(output, /MOMO_API_BASE_URL/u);
  assert.doesNotMatch(output, new RegExp(environment.MOMO_SECRET_KEY, 'u'));
  assert.doesNotMatch(output, new RegExp(environment.VNPAY_HASH_SECRET, 'u'));
});
