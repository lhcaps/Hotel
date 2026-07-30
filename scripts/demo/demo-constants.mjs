// scripts/demo/demo-constants.mjs
//
// Shared constants and helpers for the Phase 6F local demo runner.
// The runner is repository-equivalent: thin wrappers around existing
// scripts (with-local-env.mjs, pnpm db:*, pnpm --filter @room/* dev).
// It MUST NOT import private credentials or print secrets.
//
// Naming convention: every disposable demo artefact uses the
// "room_management_demo_" prefix so cleanup can target only resources
// the runner created and refuse persistent/shared database names.

import { randomUUID } from 'node:crypto';

export const DEMO_DATABASE_PREFIX = 'room_management_demo_';
// base64url alphabet is [A-Za-z0-9_-]. We constrain the first
// suffix character to [A-Za-z0-9] (no dashes or underscores) so the
// generated name is always a valid identifier; subsequent characters
// may include '-' and '_' to cover the full base64url alphabet.
export const DEMO_DATABASE_NAME_PATTERN = /^room_management_demo_[A-Za-z0-9][A-Za-z0-9_-]*$/;

// Preferred isolated ports. 3001 is OFF LIMITS (owned by the unrelated
// QLLaw project per docs/runbooks/phase-5-demo.md).
export const DEMO_WEB_PORT = 3100;
export const DEMO_API_PORT = 3101;
export const DEMO_PROTECTED_PORT = 3001;

// Demo coupon codes. Stable so the runbook can reference them.
export const DEMO_COUPONS = Object.freeze({
  FIXED: 'DEMO-FIXED',
  PERCENT: 'DEMO-PERCENT',
  DISABLED: 'DEMO-DISABLED',
});

// Demo ADMIN email. Stable so the runbook can reference it.
// Password is generated per-run (never committed, never printed).
export const DEMO_ADMIN_EMAIL = 'admin.demo@example.local';

// Manifest filename inside the OS temp directory. We never include the
// database name in the manifest filename so observers cannot correlate
// manifest discovery with the demo database.
export const DEMO_MANIFEST_FILENAME = 'room-management-demo-state.json';

// Schema version stored in the manifest. Bumped if the shape changes.
export const DEMO_MANIFEST_SCHEMA = 1;

// AUTH/DEMO secrets generated per run. Minimum 256 bits of entropy each
// (randomBytes(32) -> 32 bytes = 256 bits). These names match the
// runtime env contract documented in docs/runbooks/phase-6-local-demo.md
// and must not appear as committed string literals in any file.
export const DEMO_SECRET_KEYS = Object.freeze([
  'GUEST_OTP_SECRET',
  'GUEST_CHALLENGE_REF_SECRET',
  'GUEST_SESSION_SECRET',
  'BOOKING_IP_DIGEST_SECRET',
]);

export function createUniqueDemoDatabaseName() {
  return `${DEMO_DATABASE_PREFIX}${randomUUID().replaceAll('-', '')}`;
}

export function assertSafeDemoDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Demo runner refused unsafe database URL: malformed value.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`Demo runner refused unsafe protocol: ${url.protocol}`);
  }
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`Demo runner refused non-loopback hostname: ${url.hostname}`);
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error('Demo runner refused URL with query/hash overrides.');
  }
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!DEMO_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      `Demo runner refused database name "${databaseName}": must match ${DEMO_DATABASE_NAME_PATTERN}.`,
    );
  }
  if (
    databaseName === 'room_management' ||
    databaseName === 'postgres' ||
    databaseName === 'template0' ||
    databaseName === 'template1'
  ) {
    throw new Error(`Demo runner refused persistent/shared database name "${databaseName}".`);
  }
  return url;
}

export function buildDemoDatabaseUrl(adminBaseUrl, databaseName) {
  const base = new URL(adminBaseUrl);
  base.pathname = `/${databaseName}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}
