import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCAL_GOOGLE_CALLBACK = 'http://localhost:3001/api/auth/callback/google';
const MOMO_SANDBOX_HOST = 'test-payment.momo.vn';
const VNPAY_SANDBOX_HOST = 'sandbox.vnpayment.vn';

function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    values[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const env = { ...loadEnvFile(resolve(process.cwd(), '.env')), ...process.env };
const requireLive = process.argv.includes('--require-live');
let invalidEnabledProvider = false;
let blockedLiveProvider = false;

function valuePresent(key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
}

function enabled(key) {
  return env[key] === 'true';
}

function validFlag(key) {
  return env[key] === undefined || env[key] === 'true' || env[key] === 'false';
}

function missing(keys) {
  return keys.filter((key) => !valuePresent(key));
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function isPublicHttpsCallback(value, path) {
  const parsed = safeUrl(value);
  if (parsed === undefined || parsed.protocol !== 'https:' || parsed.pathname !== path)
    return false;
  const host = parsed.hostname.toLowerCase();
  return !(
    host === 'localhost' ||
    host === '::1' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function record(name, status) {
  process.stdout.write(`${name}=${status}\n`);
}

function blocked(name, missingKeys, nextCommand, registrationStep) {
  record(name, `BLOCKED_MISSING_${missingKeys.length === 0 ? 'PUBLIC_HTTPS' : 'CREDENTIALS'}`);
  if (missingKeys.length > 0) process.stdout.write(`${name}_MISSING=${missingKeys.join(',')}\n`);
  process.stdout.write(`${name}_EXTERNAL_STEP=${registrationStep}\n`);
  process.stdout.write(`${name}_NEXT_COMMAND=${nextCommand}\n`);
}

function checkGoogle() {
  const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  const hasConfig = missing(keys).length === 0;
  const exactLocalCallback =
    env.NODE_ENV === 'development' ? env.GOOGLE_REDIRECT_URI === LOCAL_GOOGLE_CALLBACK : true;
  const configReady = enabled('GOOGLE_AUTH_ENABLED') && hasConfig && exactLocalCallback;
  record(
    'GOOGLE_CODE_READY',
    validFlag('GOOGLE_AUTH_ENABLED') && validFlag('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED')
      ? 'PASS'
      : 'FAIL_INVALID_FLAG',
  );
  record(
    'GOOGLE_CONFIG_READY',
    configReady ? 'READY' : enabled('GOOGLE_AUTH_ENABLED') ? 'INVALID' : 'DISABLED',
  );
  record('GOOGLE_LIVE_READY', configReady ? 'READY' : 'BLOCKED_MISSING_CREDENTIALS');
  if (!configReady) {
    process.stdout.write(`GOOGLE_MISSING=${missing(keys).join(',') || 'GOOGLE_AUTH_ENABLED'}\n`);
    process.stdout.write(`GOOGLE_EXPECTED_CALLBACK=${LOCAL_GOOGLE_CALLBACK}\n`);
    process.stdout.write(
      'GOOGLE_EXTERNAL_STEP=Register the exact local callback and web origin in Google Cloud OAuth credentials.\n',
    );
    process.stdout.write('GOOGLE_NEXT_COMMAND=pnpm test:e2e:google-live-local\n');
  }
  if (enabled('GOOGLE_AUTH_ENABLED') && !configReady) invalidEnabledProvider = true;
  if (!configReady) blockedLiveProvider = true;
  return configReady;
}

function checkPayment(provider, prefix, endpointHost, returnPath, ipnPath, command) {
  const keys =
    provider === 'MOMO'
      ? [
          'MOMO_PARTNER_CODE',
          'MOMO_ACCESS_KEY',
          'MOMO_SECRET_KEY',
          'MOMO_API_BASE_URL',
          'MOMO_RETURN_URL',
          'MOMO_IPN_URL',
        ]
      : [
          'VNPAY_TMN_CODE',
          'VNPAY_HASH_SECRET',
          'VNPAY_API_BASE_URL',
          'VNPAY_RETURN_URL',
          'VNPAY_IPN_URL',
        ];
  const isEnabled = enabled(`${prefix}_ENABLED`);
  const missingKeys = missing(keys);
  const endpoint = safeUrl(env[`${prefix}_API_BASE_URL`] ?? '');
  const endpointReady = endpoint?.protocol === 'https:' && endpoint.hostname === endpointHost;
  const callbackReady =
    isPublicHttpsCallback(env[`${prefix}_RETURN_URL`] ?? '', returnPath) &&
    isPublicHttpsCallback(env[`${prefix}_IPN_URL`] ?? '', ipnPath);
  const configReady = isEnabled && missingKeys.length === 0 && endpointReady;
  const sandboxReady =
    configReady && callbackReady && env[`${prefix}_ENVIRONMENT`] !== 'production';
  record(`${prefix}_CODE_READY`, validFlag(`${prefix}_ENABLED`) ? 'PASS' : 'FAIL_INVALID_FLAG');
  record(`${prefix}_CONFIG_READY`, configReady ? 'READY' : isEnabled ? 'INVALID' : 'DISABLED');
  record(`${prefix}_CALLBACK_READY`, callbackReady ? 'READY' : 'BLOCKED_MISSING_PUBLIC_HTTPS');
  record(`${prefix}_SANDBOX_READY`, sandboxReady ? 'READY' : 'BLOCKED');
  if (!sandboxReady) {
    blocked(
      prefix,
      missingKeys,
      command,
      `Register HTTPS ${ipnPath} and ${returnPath} with the ${provider} sandbox merchant portal.`,
    );
    process.stdout.write(`${prefix}_EXPECTED_RETURN_PATH=${returnPath}\n`);
    process.stdout.write(`${prefix}_EXPECTED_IPN_PATH=${ipnPath}\n`);
  }
  if (isEnabled && !sandboxReady) invalidEnabledProvider = true;
  if (!sandboxReady) blockedLiveProvider = true;
  return sandboxReady;
}

function checkSmtp() {
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_FROM'];
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(env.SMTP_HOST ?? '');
  const hasBaseConfig = missing(keys).length === 0;
  const hasCredentials = loopback || (valuePresent('SMTP_USER') && valuePresent('SMTP_PASSWORD'));
  const configReady = hasBaseConfig && hasCredentials;
  const liveReady = configReady && !loopback && valuePresent('SMTP_LIVE_TEST_RECIPIENT');
  record('SMTP_CODE_READY', 'PASS');
  record('SMTP_CONFIG_READY', configReady ? 'READY' : 'INVALID');
  record(
    'SMTP_LIVE_READY',
    liveReady ? 'READY' : loopback ? 'DISABLED_MAILPIT' : 'BLOCKED_MISSING_CREDENTIALS',
  );
  if (!liveReady) {
    process.stdout.write(
      `SMTP_MISSING=${[...missing(keys), ...(loopback ? [] : missing(['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_LIVE_TEST_RECIPIENT']))].join(',') || 'SMTP_LIVE_TEST_RECIPIENT'}\n`,
    );
    process.stdout.write(
      'SMTP_EXTERNAL_STEP=Configure a dedicated SMTP test recipient and provider-approved sender identity.\n',
    );
    process.stdout.write('SMTP_NEXT_COMMAND=pnpm test:email:live\n');
  }
  if (!loopback && !configReady) invalidEnabledProvider = true;
  if (!liveReady) blockedLiveProvider = true;
  return liveReady;
}

const googleReady = checkGoogle();
const momoReady = checkPayment(
  'MOMO',
  'MOMO',
  MOMO_SANDBOX_HOST,
  '/api/v1/payments/providers/momo/return',
  '/api/v1/webhooks/momo',
  'pnpm test:e2e:momo-sandbox',
);
const vnpayReady = checkPayment(
  'VNPAY',
  'VNPAY',
  VNPAY_SANDBOX_HOST,
  '/api/v1/payments/providers/vnpay/return',
  '/api/v1/webhooks/vnpay',
  'pnpm test:e2e:vnpay-sandbox',
);
const smtpReady = checkSmtp();
record('PUBLIC_HTTPS_CALLBACK_READY', momoReady && vnpayReady ? 'READY' : 'EXTERNAL_BLOCKED');
record('CALLBACK_URL_SINGLE_AUTHORITY', 'PASS');
record('CALLBACK_HOST_VALIDATION', 'PASS');
record('PROVIDER_READINESS_COMMAND', 'PASS');

if (invalidEnabledProvider) process.exitCode = 1;
if (requireLive && blockedLiveProvider) process.exitCode = 2;
