import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  loadEnvironmentSchema,
  renderServiceEnvironments,
  validateEnvironment,
  validateEnvironmentSchema,
} from './lib/environment.mjs';

const schema = loadEnvironmentSchema(resolve('deploy/environment-schema.json'));

function validValues() {
  return {
    NODE_ENV: 'production',
    RELEASE_ID: `sha256:${'1'.repeat(64)}`,
    RELEASE_SHA: 'a'.repeat(40),
    RELEASE_WORKING_DIRECTORY: `/opt/room-management/releases/sha256-${'1'.repeat(64)}`,
    RELEASE_CURRENT_POINTER: `/opt/room-management/releases/sha256-${'1'.repeat(64)}`,
    RELEASE_COMPOSE_SHA256: 'b'.repeat(64),
    RELEASE_CADDY_SHA256: 'c'.repeat(64),
    RELEASE_MIGRATION_COMPLETED: 'true',
    PUBLIC_DOMAIN: 'room.example.com',
    PAYMENT_DEMO_DOMAIN: 'payments.room.example.com',
    WEB_ORIGIN: 'https://room.example.com',
    NEXT_PUBLIC_API_BASE_URL: 'https://room.example.com/api/v1',
    INTERNAL_API_BASE_URL: 'http://api:3001/api/v1',
    AUTH_BASE_URL: 'https://room.example.com',
    DATABASE_URL: 'postgresql://room:synthetic@postgres:5432/room',
    REDIS_URL: 'redis://redis:6379',
    MAIL_HOST: 'smtp.room.example.com',
    MAIL_PORT: '587',
    MAIL_FROM: 'no-reply@room.example.com',
    POSTGRES_USER: 'room',
    POSTGRES_PASSWORD: 'synthetic-password',
    POSTGRES_DB: 'room',
    BETTER_AUTH_SECRET: 'a'.repeat(40),
    GUEST_OTP_SECRET: 'b'.repeat(40),
    GUEST_CHALLENGE_REF_SECRET: 'c'.repeat(40),
    GUEST_SESSION_SECRET: 'd'.repeat(40),
    BOOKING_IP_DIGEST_SECRET: 'e'.repeat(40),
    BOOKING_ACCESS_QR_SECRET: 'f'.repeat(40),
    PAYMENT_DEMO_CONTROL_TOKEN: 'g'.repeat(40),
    MOMO_ACCESS_KEY: 'synthetic-access-key',
    MOMO_SECRET_KEY: 'h'.repeat(40),
    VNPAY_HASH_SECRET: 'i'.repeat(40),
    SMTP_PASSWORD: 'synthetic-smtp-password',
    PAYMENT_DEMO_ENABLED: 'true',
    PAYMENT_DEMO_PUBLIC_ORIGIN: 'https://payments.room.example.com',
    PAYMENT_DEMO_WEB_ORIGIN: 'https://room.example.com',
    PAYMENT_DEMO_INTERNAL_BASE_URL: 'http://payment-demo:3090',
  };
}

test('environment schema classifies every production template key', () => {
  const templateKeys = readFileSync('deploy/.env.production.example', 'utf8')
    .split(/\r?\n/u)
    .flatMap((line) => /^([A-Z][A-Z0-9_]*)=/u.exec(line)?.[1] ?? []);

  for (const key of templateKeys) {
    assert.ok(schema.keys[key], `${key} is missing from the release environment schema`);
  }
});

test('environment validation rejects real-production placeholders without echoing values', () => {
  const invalid = { ...validValues(), SMTP_HOST: 'smtp.pending.invalid' };
  assert.throws(
    () => validateEnvironment({ values: invalid, schema, deploymentClass: 'real-production' }),
    (error) =>
      error instanceof Error &&
      /SMTP_HOST/u.test(error.message) &&
      !error.message.includes(invalid.SMTP_HOST),
  );
});

test('environment schema rejects a web allowlist that contains database access', () => {
  const invalidSchema = structuredClone(schema);
  invalidSchema.services.web.allowedKeys.push('DATABASE_URL');
  assert.throws(() => validateEnvironmentSchema(invalidSchema), /web.*DATABASE_URL/i);
});

test('service environment rendering keeps database and SMTP secrets out of web and payment-demo', () => {
  const destinationDirectory = mkdtempSync(join(tmpdir(), 'room-release-env-'));
  try {
    const rendered = renderServiceEnvironments({
      values: { ...validValues(), SMTP_PASSWORD: 'not-disclosed' },
      schema,
      destinationDirectory,
    });
    const webKeys = readFileSync(rendered.services.web.file, 'utf8');
    const paymentDemoKeys = readFileSync(rendered.services['payment-demo'].file, 'utf8');
    const caddyKeys = readFileSync(rendered.services.caddy.file, 'utf8');
    const apiKeys = readFileSync(rendered.services.api.file, 'utf8');

    assert.match(webKeys, /^NEXT_PUBLIC_API_BASE_URL=/mu);
    assert.doesNotMatch(webKeys, /DATABASE_URL|SMTP_PASSWORD/u);
    assert.doesNotMatch(paymentDemoKeys, /DATABASE_URL|SMTP_PASSWORD|BETTER_AUTH_SECRET/u);
    assert.match(apiKeys, /^MAIL_HOST=/mu);
    assert.match(apiKeys, /^MAIL_PORT=/mu);
    assert.match(apiKeys, /^MAIL_FROM=/mu);
    assert.doesNotMatch(
      caddyKeys,
      /BETTER_AUTH_SECRET|GUEST_SESSION_SECRET|PAYMENT_DEMO_CONTROL_TOKEN/u,
    );
    assert.deepEqual(rendered.services.web.keys, [
      'INTERNAL_API_BASE_URL',
      'NEXT_PUBLIC_API_BASE_URL',
      'NODE_ENV',
      'RELEASE_ID',
      'RELEASE_SHA',
    ]);
  } finally {
    rmSync(destinationDirectory, { recursive: true, force: true });
  }
});

test('real production accepts Demo payment only with canonical public and private origins', () => {
  assert.deepEqual(
    validateEnvironment({ values: validValues(), schema, deploymentClass: 'real-production' }),
    { ok: true },
  );
  assert.throws(
    () =>
      validateEnvironment({
        values: { ...validValues(), WEB_ORIGIN: 'https://other.room.example.com' },
        schema,
        deploymentClass: 'real-production',
      }),
    /WEB_ORIGIN/u,
  );
  assert.throws(
    () =>
      validateEnvironment({
        values: { ...validValues(), INTERNAL_API_BASE_URL: 'https://room.example.com/api/v1' },
        schema,
        deploymentClass: 'real-production',
      }),
    /INTERNAL_API_BASE_URL/u,
  );
  assert.throws(
    () =>
      validateEnvironment({
        values: {
          ...validValues(),
          PAYMENT_DEMO_PUBLIC_ORIGIN: 'https://other-payments.example.com',
        },
        schema,
        deploymentClass: 'real-production',
      }),
    /PAYMENT_DEMO_PUBLIC_ORIGIN/u,
  );
  assert.throws(
    () =>
      validateEnvironment({
        values: { ...validValues(), RELEASE_MIGRATION_COMPLETED: 'false' },
        schema,
        deploymentClass: 'real-production',
      }),
    /RELEASE_MIGRATION_COMPLETED/u,
  );
});
