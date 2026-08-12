import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertPlainObject, readJsonFile } from './canonical.mjs';

const CLASSIFICATIONS = new Set(['PUBLIC_CONFIG', 'NON_SECRET_SERVICE_CONFIG', 'SECRET']);
const FORBIDDEN_KEYS = {
  web: ['DATABASE_URL', 'POSTGRES_PASSWORD', 'SMTP_PASSWORD', 'BETTER_AUTH_SECRET'],
  caddy: [
    'DATABASE_URL',
    'POSTGRES_PASSWORD',
    'SMTP_PASSWORD',
    'BETTER_AUTH_SECRET',
    'GUEST_OTP_SECRET',
    'GUEST_CHALLENGE_REF_SECRET',
    'GUEST_SESSION_SECRET',
    'PAYMENT_DEMO_CONTROL_TOKEN',
  ],
  'payment-demo': [
    'DATABASE_URL',
    'POSTGRES_PASSWORD',
    'SMTP_PASSWORD',
    'BETTER_AUTH_SECRET',
    'GUEST_OTP_SECRET',
    'GUEST_CHALLENGE_REF_SECRET',
    'GUEST_SESSION_SECRET',
    'BOOKING_ACCESS_QR_SECRET',
  ],
  worker: ['NEXT_PUBLIC_API_BASE_URL', 'WEB_PORT'],
};

export function loadEnvironmentSchema(path) {
  const schema = readJsonFile(path, 'release environment schema');
  validateEnvironmentSchema(schema);
  return schema;
}

export function validateEnvironmentSchema(schema) {
  assertPlainObject(schema, 'Release environment schema');
  if (schema.schemaVersion !== 1) throw new Error('Release environment schema version must be 1.');
  assertPlainObject(schema.keys, 'Release environment schema keys');
  assertPlainObject(schema.services, 'Release environment schema services');
  for (const [key, definition] of Object.entries(schema.keys)) {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) throw new Error(`Invalid environment key ${key}.`);
    assertPlainObject(definition, `Environment key ${key}`);
    if (!CLASSIFICATIONS.has(definition.classification)) {
      throw new Error(`Environment key ${key} has an invalid classification.`);
    }
    if (!Array.isArray(definition.consumers)) {
      throw new Error(`Environment key ${key} must list consumers.`);
    }
  }
  for (const [service, definition] of Object.entries(schema.services)) {
    assertPlainObject(definition, `Environment service ${service}`);
    if (!Array.isArray(definition.allowedKeys)) {
      throw new Error(`Environment service ${service} must list allowed keys.`);
    }
    const allowed = new Set(definition.allowedKeys);
    for (const key of allowed) {
      if (!schema.keys[key])
        throw new Error(`Environment service ${service} allows unknown key ${key}.`);
      if ((FORBIDDEN_KEYS[service] ?? []).includes(key)) {
        throw new Error(`${service} must not receive ${key}.`);
      }
      if (!schema.keys[key].consumers.includes(service)) {
        throw new Error(`Environment key ${key} does not declare ${service} as a consumer.`);
      }
    }
  }
}

function validateRequired(values, schema, deploymentClass) {
  for (const [key, definition] of Object.entries(schema.keys)) {
    if (definition.requiredInRealProduction && deploymentClass === 'real-production') {
      if (typeof values[key] !== 'string' || values[key].trim().length === 0) {
        throw new Error(`${key} is required for real production.`);
      }
    }
  }
}

function isHttpEndpointKey(key) {
  return key.includes('ORIGIN') || key.endsWith('_URL') || key.includes('API_BASE');
}

function productionDomain(value, key) {
  if (
    typeof value !== 'string' ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu.test(
      value,
    )
  ) {
    throw new Error(`${key} must be a production host name.`);
  }
  return value.toLowerCase();
}

function requireExactEnvironmentValue(values, key, expected) {
  if (values[key] !== expected) throw new Error(`${key} does not match the production topology.`);
}

function validateProductionOrigins(values) {
  const publicDomain = productionDomain(values.PUBLIC_DOMAIN, 'PUBLIC_DOMAIN');
  const webOrigin = `https://${publicDomain}`;
  requireExactEnvironmentValue(values, 'WEB_ORIGIN', webOrigin);
  requireExactEnvironmentValue(values, 'NEXT_PUBLIC_API_BASE_URL', `${webOrigin}/api/v1`);
  requireExactEnvironmentValue(values, 'INTERNAL_API_BASE_URL', 'http://api:3001/api/v1');
  if (values.AUTH_BASE_URL !== undefined)
    requireExactEnvironmentValue(values, 'AUTH_BASE_URL', webOrigin);

  if (values.PAYMENT_DEMO_ENABLED === 'true') {
    const paymentDemoDomain = productionDomain(values.PAYMENT_DEMO_DOMAIN, 'PAYMENT_DEMO_DOMAIN');
    requireExactEnvironmentValue(
      values,
      'PAYMENT_DEMO_PUBLIC_ORIGIN',
      `https://${paymentDemoDomain}`,
    );
    requireExactEnvironmentValue(values, 'PAYMENT_DEMO_WEB_ORIGIN', webOrigin);
    requireExactEnvironmentValue(
      values,
      'PAYMENT_DEMO_INTERNAL_BASE_URL',
      'http://payment-demo:3090',
    );
  }
}

function validateProductionReleaseIdentity(values) {
  if (typeof values.RELEASE_ID !== 'string' || !/^sha256:[a-f0-9]{64}$/iu.test(values.RELEASE_ID)) {
    throw new Error('RELEASE_ID must be an immutable release identity.');
  }
  const expectedDirectory = `/opt/room-management/releases/${values.RELEASE_ID.replace(':', '-')}`;
  requireExactEnvironmentValue(values, 'RELEASE_WORKING_DIRECTORY', expectedDirectory);
  requireExactEnvironmentValue(values, 'RELEASE_CURRENT_POINTER', expectedDirectory);
  for (const key of ['RELEASE_COMPOSE_SHA256', 'RELEASE_CADDY_SHA256']) {
    if (typeof values[key] !== 'string' || !/^[a-f0-9]{64}$/iu.test(values[key])) {
      throw new Error(`${key} must be a SHA-256 digest.`);
    }
  }
  if (values.RELEASE_MIGRATION_COMPLETED !== 'true') {
    throw new Error('RELEASE_MIGRATION_COMPLETED must be true for production cutover.');
  }
}

export function validateEnvironment({ values, schema, deploymentClass }) {
  validateEnvironmentSchema(schema);
  assertPlainObject(values, 'Environment values');
  if (!['isolated', 'demo-production', 'real-production'].includes(deploymentClass)) {
    throw new Error('Deployment class must be isolated, demo-production, or real-production.');
  }
  for (const key of Object.keys(values)) {
    if (!schema.keys[key]) throw new Error(`Environment key ${key} is not classified.`);
  }
  validateRequired(values, schema, deploymentClass);
  if (deploymentClass !== 'real-production') return { ok: true };

  for (const [key, rawValue] of Object.entries(values)) {
    if (typeof rawValue !== 'string') continue;
    const value = rawValue.trim();
    if (value.includes('.invalid'))
      throw new Error(`${key} uses a forbidden production placeholder.`);
    if (/^(?:test-|local-dev-only|replace_with_)/iu.test(value)) {
      throw new Error(`${key} uses a known development default.`);
    }
    if (
      isHttpEndpointKey(key) &&
      /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/iu.test(value)
    ) {
      throw new Error(`${key} must not use a loopback endpoint in real production.`);
    }
  }
  if (values.WEB_ORIGIN === '*' || values.NEXT_PUBLIC_API_BASE_URL === '*') {
    throw new Error('Public origins must not use a wildcard in real production.');
  }
  validateProductionOrigins(values);
  validateProductionReleaseIdentity(values);
  return { ok: true };
}

export function renderServiceEnvironments({ values, schema, destinationDirectory }) {
  validateEnvironmentSchema(schema);
  mkdirSync(destinationDirectory, { recursive: true });
  const services = {};
  for (const [service, definition] of Object.entries(schema.services)) {
    const keys = [...definition.allowedKeys]
      .filter((key) => typeof values[key] === 'string')
      .sort();
    const file = join(destinationDirectory, `${service}.env`);
    writeFileSync(
      file,
      `${keys.map((key) => `${key}=${values[key]}`).join('\n')}${keys.length > 0 ? '\n' : ''}`,
      'utf8',
    );
    try {
      chmodSync(file, 0o600);
    } catch {
      // Windows ACLs are managed outside POSIX chmod; rendering remains deterministic.
    }
    services[service] = { file, keys };
  }
  return { services };
}

export function readEnvironmentFile(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .flatMap((line) => {
        if (line.length === 0 || line.startsWith('#')) return [];
        const separator = line.indexOf('=');
        if (separator <= 0) throw new Error('Environment file contains an invalid line.');
        return [[line.slice(0, separator), line.slice(separator + 1)]];
      }),
  );
}
