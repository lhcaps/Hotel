import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as scheduleTimeout, clearTimeout } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FullConfig } from '@playwright/test';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import { resolvePnpmInvocation } from '../../../scripts/command-executable.mjs';
import { startOidcTestServer, type OidcTestServer } from './oauth/oidc-test-server.js';
import {
  startPaymentProviderSimulator,
  type PaymentProviderSimulator,
} from './payment/payment-provider-simulator-runner.js';

const execFileAsync = promisify(execFile);
const serverStartupTimeoutMs = 60_000;
const processStopTimeoutMs = 10_000;
const playwrightDatabaseBaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://room:room@127.0.0.1:5432/room_management_test_base';

// Deterministic OAuth configuration shared between the API and web
// processes. The provider id, client id, client secret, and OIDC
// URL must match across processes so the web login page can target
// the test provider and the API can complete the authorization-code
// exchange against the same loopback test server.
const PLAYWRIGHT_OIDC_HOST = '127.0.0.1';
const PLAYWRIGHT_OIDC_PORT = 3420;
const PLAYWRIGHT_OIDC_PROVIDER_ID = 'det-oauth';
const PLAYWRIGHT_OIDC_CLIENT_ID = 'playwright-oauth-test-client';
const PLAYWRIGHT_OIDC_CLIENT_SECRET = 'playwright-oauth-test-secret-with-enough-length';

function buildOauthAuthorizationUrl(port: number): string {
  return `http://${PLAYWRIGHT_OIDC_HOST}:${port}/oauth2/authorize`;
}

function buildOauthTokenUrl(port: number): string {
  return `http://${PLAYWRIGHT_OIDC_HOST}:${port}/oauth2/token`;
}

function buildOauthUserinfoUrl(port: number): string {
  return `http://${PLAYWRIGHT_OIDC_HOST}:${port}/oauth2/userinfo`;
}

function requirePlaywrightAdminPassword(): string {
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  if (password === undefined || password.length === 0) {
    throw new Error('PLAYWRIGHT_ADMIN_PASSWORD is required for Playwright ADMIN bootstrap.');
  }
  return password;
}

function requirePlaywrightAuthSecret(): string {
  const secret = process.env.PLAYWRIGHT_BETTER_AUTH_SECRET;
  if (secret === undefined || secret.length === 0) {
    throw new Error('PLAYWRIGHT_BETTER_AUTH_SECRET is required for Playwright authentication.');
  }
  return secret;
}

// Playwright needs the same guest/booking secrets the API requires at boot.
// NODE_ENV=test permits the documented test placeholder values. The auth
// bootstrap script (with-local-env.mjs) loads .env, so any non-NODE_ENV-test
// secret mismatch would surface as a login failure here.
const PLAYWRIGHT_GUEST_SECRETS = {
  GUEST_OTP_SECRET: 'test-guest-otp-secret-32-chars-min-aaaaaa',
  GUEST_CHALLENGE_REF_SECRET: 'test-challenge-ref-secret-32-chars-aaaa',
  GUEST_SESSION_SECRET: 'test-guest-session-secret-32-chars-aaaa',
  BOOKING_IP_DIGEST_SECRET: 'test-ip-digest-secret-32-chars-aaaaa',
} as const;

interface ManagedServer {
  readonly name: string;
  readonly process: ChildProcess;
  readonly startupFailure: Promise<never>;
  readonly logCapture?: LogCapture;
}

interface LogCapture {
  readonly ready: Promise<void>;
  readonly fullText: () => string;
  readonly drainStderr: () => string;
}

const READY_LOG_TOKEN = 'worker.started';
const workerStartupTimeoutMs = 30_000;

function startServer(name: string, args: readonly string[], environment: typeof process.env) {
  return startServerInternal(name, args, environment, { captureLogs: false });
}

function startServerWithLogCapture(
  name: string,
  args: readonly string[],
  environment: typeof process.env,
  readyToken: string,
): ManagedServer {
  return startServerInternal(name, args, environment, { captureLogs: true, readyToken });
}

function startServerInternal(
  name: string,
  args: readonly string[],
  environment: typeof process.env,
  options: { captureLogs: boolean; readyToken?: string },
): ManagedServer {
  const invocation = resolvePnpmInvocation(args);
  const stdio: ('inherit' | 'pipe')[] = options.captureLogs
    ? ['pipe', 'pipe', 'pipe']
    : ['inherit', 'inherit', 'inherit'];
  const child = spawn(invocation.executable, invocation.args, {
    detached: process.platform !== 'win32',
    env: environment,
    stdio,
    windowsHide: true,
    shell: false,
  });

  const startupFailure = new Promise<never>((_resolve, reject) => {
    child.once('error', (error) => {
      reject(new Error(`${name} failed to start: ${error.message}`));
    });
  });
  void startupFailure.catch(() => undefined);

  if (!options.captureLogs || options.readyToken === undefined) {
    return { name, process: child, startupFailure } satisfies ManagedServer;
  }

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let resolveReady: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const readyToken = options.readyToken;
  if (child.stdout !== null) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdoutChunks.push(chunk);
      if (resolveReady !== undefined && chunk.includes(readyToken)) {
        resolveReady();
        resolveReady = undefined;
      }
    });
  }
  if (child.stderr !== null) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderrChunks.push(chunk);
    });
  }

  const logCapture: LogCapture = {
    ready,
    fullText: () => stdoutChunks.join(''),
    drainStderr: () => {
      const text = stderrChunks.join('');
      stderrChunks.length = 0;
      return text;
    },
  };
  return { name, process: child, startupFailure, logCapture } satisfies ManagedServer;
}

function hasExited(server: ManagedServer): boolean {
  return server.process.exitCode !== null || server.process.signalCode !== null;
}

async function runCommand(
  name: string,
  args: readonly string[],
  environment: typeof process.env,
): Promise<void> {
  const command = startServer(name, args, environment);
  await Promise.race([
    command.startupFailure,
    new Promise<void>((resolve, reject) => {
      command.process.once('exit', (code, signal) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`${name} exited with code ${String(code)} and signal ${String(signal)}`),
          );
        }
      });
    }),
  ]);
}

async function migrateTestDatabase(databaseUrl: string): Promise<void> {
  await runCommand('Playwright database migration', ['--filter', '@room/database', 'db:migrate'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
  });
}

async function bootstrapPlaywrightAdmin(databaseUrl: string): Promise<void> {
  await runCommand('Playwright ADMIN bootstrap', ['--filter', '@room/auth', 'admin:bootstrap'], {
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    API_HOST: '127.0.0.1',
    API_PORT: '3101',
    WEB_ORIGIN: 'http://127.0.0.1:3100',
    AUTH_BASE_URL: 'http://127.0.0.1:3101',
    DATABASE_URL: databaseUrl,
    REDIS_URL: 'redis://127.0.0.1:6379',
    MAIL_HOST: '127.0.0.1',
    MAIL_PORT: '1025',
    MAIL_FROM: 'no-reply@room-management.local',
    BETTER_AUTH_SECRET: requirePlaywrightAuthSecret(),
    ...PLAYWRIGHT_GUEST_SECRETS,
    ADMIN_BOOTSTRAP_EMAIL: 'admin.playwright@example.test',
    ADMIN_BOOTSTRAP_PASSWORD: requirePlaywrightAdminPassword(),
    // Deterministic OAuth vars (NODE_ENV=test allows these without BROWSER_ENABLED)
    ROOM_TEST_OAUTH_PROVIDER_ID: PLAYWRIGHT_OIDC_PROVIDER_ID,
    ROOM_TEST_OAUTH_CLIENT_ID: PLAYWRIGHT_OIDC_CLIENT_ID,
    ROOM_TEST_OAUTH_CLIENT_SECRET: PLAYWRIGHT_OIDC_CLIENT_SECRET,
    ROOM_TEST_OAUTH_AUTHORIZATION_URL: buildOauthAuthorizationUrl(PLAYWRIGHT_OIDC_PORT),
    ROOM_TEST_OAUTH_TOKEN_URL: buildOauthTokenUrl(PLAYWRIGHT_OIDC_PORT),
    ROOM_TEST_OAUTH_USERINFO_URL: buildOauthUserinfoUrl(PLAYWRIGHT_OIDC_PORT),
    ROOM_TEST_OAUTH_SCOPES: 'openid,email,profile',
  });
}

async function seedPlaywrightCatalog(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO properties (id, code, name, timezone)
       VALUES ('10000000-0000-4000-8000-000000000001', 'PLAYWRIGHT', 'Playwright Hotel', 'Asia/Ho_Chi_Minh');
     INSERT INTO price_tiers (id, property_id, code, name, sort_order)
       VALUES ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'STANDARD', 'Standard', 0);
     INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ('10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', 'DELUXE', 'Deluxe', 2, 1, 3);
     INSERT INTO rooms (id, property_id, room_type_id, room_number)
       VALUES ('10000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', '101');
     INSERT INTO amenities (id, property_id, code, name)
       VALUES ('10000000-0000-4000-8000-000000000401', '10000000-0000-4000-8000-000000000001', 'WIFI', 'Wi-Fi');
     INSERT INTO room_type_amenities (property_id, room_type_id, amenity_id)
       VALUES ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000401');
     INSERT INTO payment_provider_settings (property_id, provider, enabled, display_name, display_order)
       VALUES ('10000000-0000-4000-8000-000000000001', 'MOMO', true, 'MoMo', 10),
              ('10000000-0000-4000-8000-000000000001', 'VNPAY', true, 'VNPAY', 20);
INSERT INTO rate_plans (id, property_id, code, name, status, included_duration_minutes, priority,
                            is_base_plan, min_check_in_minute_inclusive, max_check_in_minute_exclusive,
                            min_duration_minutes_inclusive, max_duration_minutes_inclusive)
      VALUES ('10000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000001', 'LUNCH_COMBO', 'Lunch combo', 'ACTIVE', 180, 30, true, 660, 900, 60, 960),
             ('10000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000001', 'THREE_HOUR_COMBO', 'Three hour combo', 'ACTIVE', 180, 10, true, NULL, NULL, 60, 240),
             ('10000000-0000-4000-8000-000000000503', '10000000-0000-4000-8000-000000000001', 'FIVE_HOUR_COMBO', 'Five hour combo', 'ACTIVE', 300, 20, true, NULL, NULL, 255, 960),
             ('10000000-0000-4000-8000-000000000504', '10000000-0000-4000-8000-000000000001', 'NIGHT_COMBO', 'Night combo', 'ACTIVE', 300, 40, true, 1080, 1440, 315, 960),
             ('10000000-0000-4000-8000-000000000505', '10000000-0000-4000-8000-000000000001', 'DAY_COMBO', 'Day combo', 'ACTIVE', 1440, 50, true, NULL, NULL, 975, 1440),
             ('10000000-0000-4000-8000-000000000506', '10000000-0000-4000-8000-000000000001', 'EXTRA_HOUR', 'Extra hour', 'ACTIVE', 60, 0, false, NULL, NULL, NULL, NULL),
             ('10000000-0000-4000-8000-000000000507', '10000000-0000-4000-8000-000000000001', 'EARLY_BIRD_FLEX', 'Early bird flex', 'ACTIVE', 180, 15, true, 360, 660, 60, 240);
     INSERT INTO rate_plan_prices (id, property_id, rate_plan_id, price_tier_id, amount_vnd)
       VALUES ('10000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000101', 359000),
              ('10000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000101', 300000),
              ('10000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000503', '10000000-0000-4000-8000-000000000101', 450000),
              ('10000000-0000-4000-8000-000000000604', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000504', '10000000-0000-4000-8000-000000000101', 600000),
              ('10000000-0000-4000-8000-000000000605', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000505', '10000000-0000-4000-8000-000000000101', 800000),
              ('10000000-0000-4000-8000-000000000606', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000506', '10000000-0000-4000-8000-000000000101', 100000),
             ('10000000-0000-4000-8000-000000000607', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000507', '10000000-0000-4000-8000-000000000101', 200000);
     INSERT INTO coupons (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd,
                         minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types)
       VALUES ('10000000-0000-4000-8000-000000000801', '10000000-0000-4000-8000-000000000001', 'DEMO-FIXED',
               'ACTIVE', 'FIXED', 50000, 0,
               CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '365 days', true);`,
  );
}

async function seedPhase8iReportingEvidence(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO users (id, name, email, email_verified, role, status)
       VALUES ('10000000-0000-4000-8000-000000000711', 'Phase 8I Customer One', 'phase8i-customer-one@example.test', true, 'CUSTOMER', 'ACTIVE'),
              ('10000000-0000-4000-8000-000000000712', 'Phase 8I Customer Two', 'phase8i-customer-two@example.test', true, 'CUSTOMER', 'ACTIVE');
     INSERT INTO bookings (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out,
                           adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
                           price_snapshot, customer_user_id, hold_expires_at, expired_at, cancelled_at,
                           cancellation_reason, created_at, updated_at)
       VALUES ('10000000-0000-4000-8000-000000000721', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000301', 'PW-UAT-HOLD-20270710', 'HOLD', '2027-07-10T02:00:00.000Z', '2027-07-10T05:00:00.000Z', 2, 0, 'VND', 359000, 0, 359000, '{"ratePlanCode":"LUNCH_COMBO","fixture":"PHASE_8I_PLAYWRIGHT"}', NULL, '2027-07-31T00:00:00.000Z', NULL, NULL, NULL, '2027-06-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
              ('10000000-0000-4000-8000-000000000722', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000301', 'PW-UAT-CONFIRMED-20270711', 'CONFIRMED', '2027-07-11T02:00:00.000Z', '2027-07-11T05:00:00.000Z', 2, 0, 'VND', 359000, 0, 359000, '{"ratePlanCode":"LUNCH_COMBO","fixture":"PHASE_8I_PLAYWRIGHT"}', '10000000-0000-4000-8000-000000000711', '2027-07-31T00:00:00.000Z', NULL, NULL, NULL, '2027-06-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
              ('10000000-0000-4000-8000-000000000723', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000301', 'PW-UAT-PENDING-20270712', 'CONFIRMED', '2027-07-12T02:00:00.000Z', '2027-07-12T05:00:00.000Z', 2, 0, 'VND', 419000, 0, 419000, '{"ratePlanCode":"LUNCH_COMBO","fixture":"PHASE_8I_PLAYWRIGHT"}', '10000000-0000-4000-8000-000000000711', '2027-07-31T00:00:00.000Z', NULL, NULL, NULL, '2027-06-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
              ('10000000-0000-4000-8000-000000000724', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000301', 'PW-UAT-CANCELLED-20270713', 'CANCELLED', '2027-07-13T02:00:00.000Z', '2027-07-13T05:00:00.000Z', 2, 0, 'VND', 419000, 0, 419000, '{"ratePlanCode":"LUNCH_COMBO","fixture":"PHASE_8I_PLAYWRIGHT"}', '10000000-0000-4000-8000-000000000712', '2027-07-31T00:00:00.000Z', NULL, '2027-07-13T01:00:00.000Z', 'Synthetic Playwright cancellation', '2027-06-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
              ('10000000-0000-4000-8000-000000000725', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000301', 'PW-UAT-EXPIRED-20270714', 'EXPIRED', '2027-07-14T02:00:00.000Z', '2027-07-14T05:00:00.000Z', 2, 0, 'VND', 489000, 0, 489000, '{"ratePlanCode":"LUNCH_COMBO","fixture":"PHASE_8I_PLAYWRIGHT"}', NULL, '2027-07-31T00:00:00.000Z', '2027-07-14T01:00:00.000Z', NULL, NULL, '2027-06-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z');
     INSERT INTO payments (id, property_id, booking_id, status, amount_vnd, currency, confirmation_source, succeeded_at)
       VALUES ('10000000-0000-4000-8000-000000000731', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000722', 'SUCCEEDED', 359000, 'VND', 'PROVIDER_EVENT', '2027-07-11T05:30:00.000Z'),
              ('10000000-0000-4000-8000-000000000732', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000723', 'PENDING', 419000, 'VND', NULL, NULL);`,
  );
}

async function waitForServer(server: ManagedServer, url: string): Promise<void> {
  const deadline = Date.now() + serverStartupTimeoutMs;
  while (Date.now() < deadline) {
    if (hasExited(server)) {
      throw new Error(`${server.name} exited before becoming ready`);
    }
    const response = await Promise.race([
      server.startupFailure,
      fetch(url, { signal: AbortSignal.timeout(1_000) }).catch(() => undefined),
    ]);
    if (response?.ok) {
      return;
    }
    await Promise.race([server.startupFailure, delay(250)]);
  }
  throw new Error(`${server.name} did not become ready within ${serverStartupTimeoutMs}ms`);
}

async function waitForExit(server: ManagedServer): Promise<void> {
  if (hasExited(server)) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timeout = scheduleTimeout(resolve, processStopTimeoutMs);
    server.process.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForLogToken(server: ManagedServer, timeoutMs: number): Promise<void> {
  const capture = server.logCapture;
  if (capture === undefined) {
    throw new Error(`${server.name} has no log capture configured`);
  }
  let timeoutHandle: ReturnType<typeof scheduleTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = scheduleTimeout(() => {
      reject(
        new Error(
          `${server.name} did not log ${READY_LOG_TOKEN} within ${timeoutMs}ms. stdout=\n${capture.fullText()}\nstderr=\n${capture.drainStderr()}`,
        ),
      );
    }, timeoutMs);
  });
  try {
    await Promise.race([server.startupFailure, capture.ready, timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
  if (hasExited(server)) {
    throw new Error(
      `${server.name} exited before logging ${READY_LOG_TOKEN}. stdout=\n${capture.fullText()}\nstderr=\n${capture.drainStderr()}`,
    );
  }
}

async function stopServer(server: ManagedServer): Promise<void> {
  if (hasExited(server) || server.process.pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill.exe', ['/pid', String(server.process.pid), '/t', '/f'], {
        windowsHide: true,
      });
    } catch (error) {
      if (!hasExited(server)) {
        throw error;
      }
    }
  } else {
    process.kill(-server.process.pid, 'SIGTERM');
  }
  await waitForExit(server);
}

async function stopServerGracefully(server: ManagedServer): Promise<void> {
  if (hasExited(server) || server.process.pid === undefined) {
    return;
  }
  // First try SIGTERM and wait for the worker to drain its active iteration.
  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill.exe', ['/pid', String(server.process.pid), '/t'], {
        windowsHide: true,
      });
    } else {
      process.kill(-server.process.pid, 'SIGTERM');
    }
    await waitForExit(server);
    return;
  } catch (error) {
    if (hasExited(server)) {
      return;
    }
    // Fall through to force kill.
    void error;
  }
  if (hasExited(server)) {
    return;
  }
  await stopServer(server);
}

async function cleanup(
  servers: readonly ManagedServer[],
  database: GuardedTestDatabase,
): Promise<void> {
  const errors: unknown[] = [];
  for (const server of [...servers].reverse()) {
    try {
      // The worker is identified by name. It must drain its active iteration
      // cleanly via SIGTERM; force-kill is only the fallback.
      if (server.name === 'Playwright continuous worker') {
        await stopServerGracefully(server);
      } else {
        await stopServer(server);
      }
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    await database.dispose();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Playwright environment cleanup failed');
  }
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const database = await createPreparedGuardedTestDatabase(
    playwrightDatabaseBaseUrl,
    async (database) => migrateTestDatabase(database.databaseUrl),
  );
  // Share the unique per-run database URL with worker processes spawned from
  // test specs so they hit the same isolated database.
  process.env.PLAYWRIGHT_TEST_DATABASE_URL = database.databaseUrl;
  process.env.PLAYWRIGHT_TEST_DATABASE_NAME = database.databaseName;
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(join(tmpdir(), 'playwright-test-database-url.txt'), database.databaseUrl, 'utf8'),
  );
  const servers: ManagedServer[] = [];
  let oidcServer: OidcTestServer | undefined;
  let paymentSimulator: PaymentProviderSimulator | undefined;

  try {
    // Start the local OIDC test server before the API so the API
    // boots with a known authorization/token/userinfo URL. The port
    // is fixed so the API, the web process, and Playwright specs all
    // see the same URLs through the deterministic OAuth env vars.
    oidcServer = await startOidcTestServer({
      clientId: PLAYWRIGHT_OIDC_CLIENT_ID,
      clientSecret: PLAYWRIGHT_OIDC_CLIENT_SECRET,
      host: PLAYWRIGHT_OIDC_HOST,
      port: PLAYWRIGHT_OIDC_PORT,
    });
    const oauthAuthorizationUrl = buildOauthAuthorizationUrl(PLAYWRIGHT_OIDC_PORT);
    const oauthTokenUrl = buildOauthTokenUrl(PLAYWRIGHT_OIDC_PORT);
    const oauthUserinfoUrl = buildOauthUserinfoUrl(PLAYWRIGHT_OIDC_PORT);

    // Expose the OIDC URLs and provider id to Playwright specs so they
    // can configure test subjects on the live OIDC server.
    process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL = oidcServer.baseUrl;
    process.env.PLAYWRIGHT_TEST_OIDC_AUTHORIZATION_URL = oauthAuthorizationUrl;
    process.env.PLAYWRIGHT_TEST_OIDC_TOKEN_URL = oauthTokenUrl;
    process.env.PLAYWRIGHT_TEST_OIDC_USERINFO_URL = oauthUserinfoUrl;
    process.env.PLAYWRIGHT_TEST_OIDC_PROVIDER_ID = PLAYWRIGHT_OIDC_PROVIDER_ID;

    // Payment E2E uses the real production adapters against this loopback
    // simulator. Start it before the API so the API receives the test-only
    // provider URLs at bootstrap; a Global Setup environment mutation alone
    // would not reach already-spawned Playwright workers.
    paymentSimulator = await startPaymentProviderSimulator();
    await seedPlaywrightCatalog(database);
    await seedPhase8iReportingEvidence(database);
    await bootstrapPlaywrightAdmin(database.databaseUrl);
    const api = startServer(
      'Playwright API',
      ['--filter', '@room/api', 'exec', 'tsx', 'src/main.ts'],
      {
        ...process.env,
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
        API_HOST: '127.0.0.1',
        API_PORT: '3101',
        WEB_ORIGIN: 'http://127.0.0.1:3100',
        AUTH_BASE_URL: 'http://127.0.0.1:3101/api/auth',
        DATABASE_URL: database.databaseUrl,
        REDIS_URL: 'redis://127.0.0.1:6379',
        MAIL_HOST: '127.0.0.1',
        MAIL_PORT: '1025',
        MAIL_FROM: 'no-reply@room-management.local',
        BETTER_AUTH_SECRET: requirePlaywrightAuthSecret(),
        MOMO_ENABLED: 'true',
        MOMO_PARTNER_CODE: 'PLAYWRIGHT_MOMO',
        MOMO_ACCESS_KEY: 'playwright-momo-access-key',
        MOMO_SECRET_KEY: 'playwright-momo-secret-key-at-least-thirty-two-characters',
        MOMO_API_BASE_URL: paymentSimulator.baseUrl,
        MOMO_RETURN_URL: 'http://127.0.0.1:3101/api/v1/payments/providers/momo/return',
        MOMO_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/momo',
        MOMO_REQUEST_TIMEOUT_MS: '30000',
        VNPAY_ENABLED: 'true',
        VNPAY_TMN_CODE: 'PLAYWRIGHTVNPAY',
        VNPAY_HASH_SECRET: 'playwright-vnpay-secret-at-least-thirty-two-characters',
        VNPAY_API_BASE_URL: `${paymentSimulator.baseUrl}/vnpay-test/pay`,
        VNPAY_RETURN_URL: 'http://127.0.0.1:3101/api/v1/payments/providers/vnpay/return',
        VNPAY_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/vnpay',
        VNPAY_REQUEST_TIMEOUT_MS: '10000',
        // Deterministic OAuth harness for the browser identity vertical.
        ROOM_TEST_OAUTH_PROVIDER_ID: PLAYWRIGHT_OIDC_PROVIDER_ID,
        ROOM_TEST_OAUTH_CLIENT_ID: PLAYWRIGHT_OIDC_CLIENT_ID,
        ROOM_TEST_OAUTH_CLIENT_SECRET: PLAYWRIGHT_OIDC_CLIENT_SECRET,
        ROOM_TEST_OAUTH_AUTHORIZATION_URL: oauthAuthorizationUrl,
        ROOM_TEST_OAUTH_TOKEN_URL: oauthTokenUrl,
        ROOM_TEST_OAUTH_USERINFO_URL: oauthUserinfoUrl,
        ROOM_TEST_OAUTH_SCOPES: 'openid,email,profile',
        // Browser-mode switch enables the test-oidc presentation in the
        // login server component. The web process receives the matching
        // ROOM_TEST_OAUTH_BROWSER_ENABLED and ROOM_TEST_OAUTH_PROVIDER_ID.
        ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
        ...PLAYWRIGHT_GUEST_SECRETS,
      },
    );
    servers.push(api);
    await waitForServer(api, 'http://127.0.0.1:3101/api/v1/health/live');

    const web = startServer(
      'Playwright web',
      ['--filter', '@room/web', 'exec', 'next', 'dev', '--port', '3100', '--hostname', '127.0.0.1'],
      {
        ...process.env,
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        WEB_PORT: '3100',
        NEXT_DIST_DIR: '.next-playwright',
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3101/api/v1',
        // Google is disabled in the browser OAuth vertical; the test
        // provider is the only sign-in entry point exposed by the
        // login server component.
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'false',
        // Mirror the deterministic OAuth configuration to the web so
        // the login server component can render the test-oidc
        // presentation and pass the provider id to the client.
        ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
        ROOM_TEST_OAUTH_PROVIDER_ID: PLAYWRIGHT_OIDC_PROVIDER_ID,
      },
    );
    servers.push(web);
    await waitForServer(web, 'http://127.0.0.1:3100/health');

    // Playwright owns a continuous worker process. The worker drives the
    // HOLD_EXPIRATION and OUTBOX_DELIVERY jobs without any per-spec
    // one-shot invocation. Test intervals are bounded to keep the suite
    // fast while still exercising the scheduler end-to-end.
    const worker = startServerWithLogCapture(
      'Playwright continuous worker',
      ['--filter', '@room/worker', 'exec', 'tsx', 'src/main.ts'],
      {
        ...process.env,
        NODE_ENV: 'test',
        // The worker startup detector in this file needs to see the
        // structured `worker.started` log to verify it is ready. Pino's
        // `silent` level suppresses every event, including the readiness
        // marker, so the worker uses `info` instead. Output is still
        // captured by the surrounding logCapture so it does not leak
        // into the test runner's stdout.
        LOG_LEVEL: 'info',
        DATABASE_URL: database.databaseUrl,
        REDIS_URL: 'redis://127.0.0.1:6379',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: '1025',
        SMTP_SECURE: 'false',
        SMTP_FROM: 'no-reply@room-management.local',
        ...PLAYWRIGHT_GUEST_SECRETS,
        WORKER_MODE: 'continuous',
        WORKER_OUTBOX_INTERVAL_MS: '250',
        WORKER_EXPIRATION_INTERVAL_MS: '1000',
        WORKER_ERROR_BACKOFF_MS: '100',
        WORKER_MAX_ERROR_BACKOFF_MS: '1000',
      },
      READY_LOG_TOKEN,
    );
    servers.push(worker);
    await waitForLogToken(worker, workerStartupTimeoutMs);
  } catch (error) {
    try {
      await cleanup(servers, database);
      await oidcServer?.close();
      await paymentSimulator?.stop();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Playwright environment setup failed and cleanup also failed',
      );
    }
    throw error;
  }

  return async () => {
    await cleanup(servers, database);
    await oidcServer?.close();
    await paymentSimulator?.stop();
  };
}
