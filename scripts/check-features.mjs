import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const statuses = [];
const configured = (keys) => keys.every((key) => typeof env[key] === 'string' && env[key] !== '');
const validFlag = (key) => env[key] === undefined || env[key] === 'true' || env[key] === 'false';

function record(name, status) {
  statuses.push([name, status]);
  process.stdout.write(`${name}=${status}\n`);
}

record(
  'CORE_BOOKING',
  configured(['DATABASE_URL', 'WEB_ORIGIN', 'AUTH_BASE_URL']) ? 'READY' : 'BLOCKED_MISSING_CONFIG',
);
record(
  'SMTP_MAILPIT',
  configured(['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM']) ? 'READY' : 'BLOCKED_MISSING_CONFIG',
);
record(
  'WORKER',
  env.WORKER_MODE === undefined || env.WORKER_MODE === 'continuous' || env.WORKER_MODE === 'once'
    ? 'READY'
    : 'INVALID',
);
record(
  'GOOGLE_OAUTH',
  !validFlag('GOOGLE_AUTH_ENABLED') || !validFlag('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED')
    ? 'INVALID'
    : env.GOOGLE_AUTH_ENABLED === 'true'
      ? configured(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'])
        ? 'READY'
        : 'BLOCKED_MISSING_CONFIG'
      : 'DISABLED',
);
record(
  'GOOGLE_TRANSLATION',
  !validFlag('GOOGLE_TRANSLATION_ENABLED')
    ? 'INVALID'
    : env.GOOGLE_TRANSLATION_ENABLED === 'true'
      ? configured(['GOOGLE_TRANSLATION_API_KEY'])
        ? 'READY'
        : 'BLOCKED_MISSING_CONFIG'
      : 'DISABLED',
);
record(
  'MOMO',
  !validFlag('MOMO_ENABLED')
    ? 'INVALID'
    : env.MOMO_ENABLED === 'true'
      ? configured([
          'MOMO_PARTNER_CODE',
          'MOMO_ACCESS_KEY',
          'MOMO_SECRET_KEY',
          'MOMO_API_BASE_URL',
          'MOMO_RETURN_URL',
          'MOMO_IPN_URL',
        ])
        ? 'EXTERNAL_BLOCKED'
        : 'BLOCKED_MISSING_CONFIG'
      : 'DISABLED',
);
record(
  'VNPAY',
  !validFlag('VNPAY_ENABLED')
    ? 'INVALID'
    : env.VNPAY_ENABLED === 'true'
      ? configured([
          'VNPAY_TMN_CODE',
          'VNPAY_HASH_SECRET',
          'VNPAY_API_BASE_URL',
          'VNPAY_RETURN_URL',
          'VNPAY_IPN_URL',
        ])
        ? 'EXTERNAL_BLOCKED'
        : 'BLOCKED_MISSING_CONFIG'
      : 'DISABLED',
);

if (statuses.some(([, status]) => status === 'INVALID')) process.exitCode = 1;
