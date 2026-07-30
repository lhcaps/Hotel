import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCAL_WEB_ORIGIN = 'http://localhost:3000';
const LOCAL_API_ORIGIN = 'http://localhost:3001';
const LOCAL_CALLBACK = 'http://localhost:3001/api/auth/callback/google';

function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }
  return values;
}

const source = { ...loadEnvFile(resolve(process.cwd(), '.env')), ...process.env };
const problems = [];
const enabled = source.GOOGLE_AUTH_ENABLED === 'true';
const publicFlag = source.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED;
const clientId = source.GOOGLE_CLIENT_ID ?? '';
const clientSecret = source.GOOGLE_CLIENT_SECRET ?? '';
const redirectUri = source.GOOGLE_REDIRECT_URI ?? '';
const webOrigin = source.WEB_ORIGIN ?? '';
const authBaseUrl = source.AUTH_BASE_URL ?? '';

function invalidPlaceholder(value) {
  const normalized = value.toLowerCase();
  return (
    value === '' ||
    normalized.includes('placeholder') ||
    normalized.includes('your-google') ||
    normalized === 'changeme' ||
    normalized.startsWith('test-')
  );
}

if (publicFlag !== undefined && publicFlag !== 'true' && publicFlag !== 'false')
  problems.push('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED must be true or false when present.');
if (enabled && invalidPlaceholder(clientId))
  problems.push('Google Client ID is missing or a placeholder.');
if (
  enabled &&
  (clientSecret.length < 16 || clientSecret.length > 1024 || invalidPlaceholder(clientSecret))
)
  problems.push('Google Client Secret is missing, a placeholder, or outside the accepted length.');
if (enabled && redirectUri === '') problems.push('Google redirect URI is required.');

let redirect;
try {
  redirect = redirectUri === '' ? undefined : new URL(redirectUri);
} catch {
  problems.push('Google redirect URI must be a valid URL.');
}

if (redirect !== undefined) {
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname);
  if (source.NODE_ENV === 'development' && redirectUri !== LOCAL_CALLBACK) {
    problems.push(`Local Google redirect URI must exactly equal ${LOCAL_CALLBACK}.`);
  }
  if (!loopback && redirect.protocol !== 'https:')
    problems.push('Google redirect URI must use HTTPS outside loopback development.');
  if (redirect.pathname !== '/api/auth/callback/google')
    problems.push('Google redirect URI must use the API callback path /api/auth/callback/google.');
}

if (source.NODE_ENV === 'development' && webOrigin !== LOCAL_WEB_ORIGIN)
  problems.push(`Local WEB_ORIGIN must equal ${LOCAL_WEB_ORIGIN}.`);
if (source.NODE_ENV === 'development' && authBaseUrl !== LOCAL_API_ORIGIN)
  problems.push(`Local AUTH_BASE_URL must equal ${LOCAL_API_ORIGIN}.`);
for (const key of Object.keys(source)) {
  if (key.startsWith('NEXT_PUBLIC_') && /(SECRET|GOOGLE_CLIENT_ID)/.test(key))
    problems.push(`${key} exposes a credential in a public variable.`);
}

process.stdout.write(`GOOGLE_OAUTH_ENABLED=${enabled ? 'true' : 'false'}\n`);
process.stdout.write('GOOGLE_OAUTH_PUBLIC_FLAG=NON_AUTHORITATIVE\n');
if (!enabled) {
  process.stdout.write('GOOGLE_OAUTH_CODE_READINESS=PASS\n');
  process.stdout.write('GOOGLE_OAUTH_LOCAL_CONFIG=BLOCKED_MISSING_USER_CREDENTIALS\n');
  process.stdout.write('GOOGLE_OAUTH_LIVE_ACCEPTANCE=EXTERNAL_BLOCKED\n');
} else if (problems.length === 0) {
  process.stdout.write('GOOGLE_OAUTH_CODE_READINESS=PASS\n');
  process.stdout.write('GOOGLE_OAUTH_LOCAL_CONFIG=READY\n');
  process.stdout.write('GOOGLE_OAUTH_LIVE_ACCEPTANCE=NOT_RUN_OPT_IN_REQUIRED\n');
} else {
  process.stdout.write('GOOGLE_OAUTH_CODE_READINESS=INVALID\n');
  for (const problem of problems) process.stdout.write(`GOOGLE_OAUTH_PROBLEM=${problem}\n`);
}
process.stdout.write(`GOOGLE_CLOUD_AUTHORIZED_JAVASCRIPT_ORIGIN=${LOCAL_WEB_ORIGIN}\n`);
process.stdout.write(`GOOGLE_CLOUD_AUTHORIZED_REDIRECT_URI=${LOCAL_CALLBACK}\n`);
process.exitCode = enabled && problems.length > 0 ? 1 : 0;
