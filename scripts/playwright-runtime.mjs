import { randomBytes } from 'node:crypto';

const minimumSecretLength = 32;
const minimumPasswordLength = 16;

export function validateBetterAuthSecret(value) {
  return typeof value === 'string' && value.length >= minimumSecretLength;
}

export function validateAdminPassword(value) {
  return (
    typeof value === 'string' &&
    value.length >= minimumPasswordLength &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function createBetterAuthSecret() {
  return randomBytes(32).toString('base64url');
}

function createAdminPassword() {
  return `Aa1!${randomBytes(32).toString('base64url')}`;
}

export function resolvePlaywrightRuntime(source = process.env) {
  const secret = source.PLAYWRIGHT_BETTER_AUTH_SECRET ?? createBetterAuthSecret();
  const password = source.PLAYWRIGHT_ADMIN_PASSWORD ?? createAdminPassword();

  if (!validateBetterAuthSecret(secret)) {
    throw new Error('PLAYWRIGHT_BETTER_AUTH_SECRET must contain at least 32 characters.');
  }
  if (!validateAdminPassword(password)) {
    throw new Error('PLAYWRIGHT_ADMIN_PASSWORD must be at least 16 characters with uppercase, lowercase, digit, and special character.');
  }

  return {
    PLAYWRIGHT_BETTER_AUTH_SECRET: secret,
    PLAYWRIGHT_ADMIN_PASSWORD: password,
  };
}

export function ensurePlaywrightRuntime(environment = process.env) {
  const resolved = resolvePlaywrightRuntime(environment);
  environment.PLAYWRIGHT_BETTER_AUTH_SECRET = resolved.PLAYWRIGHT_BETTER_AUTH_SECRET;
  environment.PLAYWRIGHT_ADMIN_PASSWORD = resolved.PLAYWRIGHT_ADMIN_PASSWORD;
  return resolved;
}
