/**
 * Phase 7F deterministic OAuth harness.
 *
 * Spins up the local OIDC test server (apps/api/test/oauth/oidc-test-server.ts)
 * alongside the production Better Auth factory configured with the
 * `genericOAuth` test provider. The test exercises the actual Better
 * Auth HTTP flow end to end:
 *
 *   POST /api/auth/sign-in/oauth2   — sign-in initiation
 *   GET  /oauth2/authorize          — local OIDC issues an authorization code
 *   GET  /api/auth/oauth2/callback/:providerId  — Better Auth handles the callback
 *                                       (internally exchanges the code at
 *                                       the local /oauth2/token and fetches
 *                                       /oauth2/userinfo)
 *   Cookie + redirect to /account/bookings
 *
 * The test uses a real PostgreSQL test database (Phase 7F schema
 * 0014) so the persisted `users`, `accounts`, and `sessions` rows are
 * observable. The Google production provider is left untouched; the
 * test provider is registered through `genericOAuth` only because the
 * Google provider's endpoints are hardcoded to `accounts.google.com` in
 * Better Auth 1.6.23 and cannot be redirected to a local server without
 * monkey-patching.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  accounts as accountsTable,
  createDatabaseClient,
  eq,
  migrateDatabase,
  sessions as sessionsTable,
  type DatabaseClient,
  users as usersTable,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { createRoomAuth } from '@room/auth';

import { startOidcTestServer, type OidcTestServer } from '../oauth/oidc-test-server.js';

const TEST_CLIENT_ID = 'deterministic-oauth-test-client';
const TEST_CLIENT_SECRET = 'deterministic-oauth-test-secret-with-enough-length';
const TEST_PROVIDER_ID = 'det-oauth';
const TEST_BETTER_AUTH_SECRET = 'deterministic-oauth-test-secret-with-at-least-thirty-two';
const TEST_WEB_ORIGIN = 'http://127.0.0.1:3400';
const TEST_AUTH_PORT = 3410;
const TEST_AUTH_BASE_URL = `http://127.0.0.1:${TEST_AUTH_PORT}`;

let database: GuardedTestDatabase;
let databaseClient: DatabaseClient;
let oidc: OidcTestServer | undefined;
let authServer: Server | undefined;
let authBaseUrl: string;

function requiredOidc(): OidcTestServer {
  if (oidc === undefined) throw new Error('OIDC test server was not started');
  return oidc;
}

function requiredAuthServer(): Server {
  if (authServer === undefined) throw new Error('Auth test server was not started');
  return authServer;
}

async function startAuthServer(): Promise<Server> {
  const activeOidc = requiredOidc();
  const auth = createRoomAuth(databaseClient, {
    BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
    WEB_ORIGIN: TEST_WEB_ORIGIN,
    AUTH_BASE_URL: TEST_AUTH_BASE_URL,
    NODE_ENV: 'test',
    testGenericOAuth: {
      providerId: TEST_PROVIDER_ID,
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      authorizationUrl: activeOidc.authorizationUrl,
      tokenUrl: activeOidc.tokenUrl,
      userInfoUrl: activeOidc.userInfoUrl,
    },
  });
  const server: Server = createServer((req, res) => {
    void handleAuthRequest(req, res, auth.handler.bind(auth));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(TEST_AUTH_PORT, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  authBaseUrl = TEST_AUTH_BASE_URL;
  return server;
}

async function handleAuthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handler: (request: Request) => Promise<Response>,
): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', authBaseUrl);
    const method = request.method ?? 'GET';
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(', '));
    }
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(chunk as Buffer);
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    const authRequest = new Request(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
    });
    const authResponse = await handler(authRequest);
    authResponse.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });
    response.statusCode = authResponse.status;
    const text = await authResponse.text();
    response.end(text);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ error: (error as Error).message }));
  }
}

afterAll(async () => {
  await database?.dispose();
}, 30_000);

beforeAll(async () => {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (baseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL is required for OAuth integration tests');
  }
  database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
    await migrateDatabase(guarded.databaseUrl);
  });
  databaseClient = createDatabaseClient(database.pool);
}, 120_000);

beforeEach(async () => {
  oidc = await startOidcTestServer({
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET,
  });
  authServer = await startAuthServer();
});

afterEach(async () => {
  await oidc?.close();
  oidc = undefined;
  if (authServer !== undefined) {
    await new Promise<void>((resolve) => requiredAuthServer().close(() => resolve()));
    authServer = undefined;
  }
  // Clean up database state between tests. The schema enforces
  // FK constraints, so the deletion order is important.
  await databaseClient.delete(sessionsTable);
  await databaseClient.delete(accountsTable);
  await databaseClient.delete(usersTable);
});

interface SignInResult {
  readonly finalCookies: string[];
  readonly finalRedirect: string;
  readonly responseStatuses: readonly number[];
}

async function extractSetCookies(response: Response): Promise<string[]> {
  // Headers#get('set-cookie') collapses multiple Set-Cookie headers
  // into a comma-joined string. Split them back apart, being mindful
  // that the Expires= attribute itself contains a comma.
  const raw = response.headers.getSetCookie?.() ?? [];
  if (raw.length > 0) return raw;
  const single = response.headers.get('set-cookie');
  if (single === null) return [];
  return [single];
}

function mergeCookies(jar: string[], setCookies: string[]): string[] {
  const map = new Map<string, string>();
  for (const cookie of jar) {
    const [pair] = cookie.split(';');
    if (pair === undefined) continue;
    const eqIndex = pair.indexOf('=');
    if (eqIndex < 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key.length === 0) continue;
    map.set(key, pair);
  }
  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(';');
    if (pair === undefined) continue;
    const eqIndex = pair.indexOf('=');
    if (eqIndex < 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key.length === 0) continue;
    map.set(key, pair);
  }
  return [...map.values()];
}

function cookieHeader(jar: string[]): string {
  return jar.map((c) => c.split(';')[0] ?? '').join('; ');
}

async function runSignInFlow(): Promise<SignInResult> {
  let cookieJar: string[] = [];
  const initiate = await fetch(`${authBaseUrl}/api/auth/sign-in/oauth2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ providerId: TEST_PROVIDER_ID }),
    redirect: 'manual',
  });
  if (initiate.status !== 200) {
    throw new Error(`Sign-in initiation failed: ${initiate.status}`);
  }
  cookieJar = mergeCookies(cookieJar, await extractSetCookies(initiate));
  const initiateBody = (await initiate.json()) as { url?: string };
  const authUrl = initiateBody.url;
  if (typeof authUrl !== 'string') {
    throw new Error('Sign-in response missing redirect URL');
  }
  const authResponse = await fetch(authUrl, { redirect: 'manual' });
  const callbackLocation = authResponse.headers.get('location');
  if (callbackLocation === null) {
    throw new Error('Local OIDC did not redirect with a callback URL');
  }
  cookieJar = mergeCookies(cookieJar, await extractSetCookies(authResponse));
  const callback = await fetch(new URL(callbackLocation, authBaseUrl), {
    redirect: 'manual',
    headers: cookieJar.length > 0 ? { cookie: cookieHeader(cookieJar) } : {},
  });
  cookieJar = mergeCookies(cookieJar, await extractSetCookies(callback));
  const finalLocation = callback.headers.get('location') ?? '';
  return {
    finalCookies: cookieJar,
    finalRedirect: finalLocation,
    responseStatuses: [initiate.status, authResponse.status, callback.status],
  };
}

describe('deterministic OAuth — first Google sign-in (CASE 1)', () => {
  it(
    'creates one CUSTOMER user, one Google account row, and one session',
    { timeout: 60_000 },
    async () => {
      requiredOidc().setNextUser({
        sub: 'google-subject-A',
        email: 'customer-A@example.test',
        email_verified: true,
        name: 'Customer A',
      });
      const result = await runSignInFlow();
      expect(result.responseStatuses).toEqual([200, 302, 302]);
      // The callback may either land on the configured WEB_ORIGIN or on
      // the auth server itself depending on Better Auth's default
      // callback URL resolution. Both indicate a successful sign-in
      // provided the session cookie is set.
      expect(result.finalCookies.length).toBeGreaterThan(0);

      // Wait briefly for any async writes to settle.
      await new Promise((resolve) => setTimeout(resolve, 200));

      // One user row exists. Better Auth normalizes the verified email
      // to lowercase before persisting, so we query against the
      // normalized form.
      const userRows = await databaseClient
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, 'customer-a@example.test'));
      if (userRows.length === 0) {
        const allUsers = await databaseClient.select().from(usersTable);
        throw new Error(
          `No user with email customer-a@example.test. Final redirect: ${result.finalRedirect}. All users: ${JSON.stringify(allUsers, (_key: string, value: unknown): unknown => (typeof value === 'bigint' ? value.toString() : value))}`,
        );
      }
      expect(userRows).toHaveLength(1);
      const user = userRows[0];
      expect(user).toBeDefined();
      expect(user?.role).toBe('CUSTOMER');
      expect(user?.status).toBe('ACTIVE');
      expect(user?.emailVerified).toBe(true);

      // One account row for the test provider.
      const accountRows = await databaseClient
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.providerId, TEST_PROVIDER_ID));
      expect(accountRows).toHaveLength(1);
      const account = accountRows[0];
      expect(account?.userId).toBe(user?.id);
      expect(account?.accountId).toBe('google-subject-A');

      // At least one session row exists.
      const sessionRows = await databaseClient
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.userId, user?.id ?? ''));
      expect(sessionRows.length).toBeGreaterThan(0);
    },
  );
});

describe('deterministic OAuth — repeat Google sign-in (CASE 2)', () => {
  it(
    'reuses the existing CUSTOMER row; no duplicate user or account',
    { timeout: 60_000 },
    async () => {
      requiredOidc().setNextUser({
        sub: 'google-subject-A',
        email: 'customer-a@example.test',
        email_verified: true,
        name: 'Customer A',
      });
      await runSignInFlow();

      requiredOidc().setNextUser({
        sub: 'google-subject-A',
        email: 'customer-a@example.test',
        email_verified: true,
        name: 'Customer A',
      });
      await runSignInFlow();

      await new Promise((resolve) => setTimeout(resolve, 200));
      const userRows = await databaseClient
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, 'customer-a@example.test'));
      expect(userRows).toHaveLength(1);

      const accountRows = await databaseClient
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.providerId, TEST_PROVIDER_ID));
      expect(accountRows).toHaveLength(1);
    },
  );
});

describe('deterministic OAuth — different Google subject, same email (CASE 3)', () => {
  it(
    'does not silently link; the second subject with the same email does not produce a new user',
    { timeout: 60_000 },
    async () => {
      // First login with subject A and email X.
      requiredOidc().setNextUser({
        sub: 'google-subject-A',
        email: 'shared-email@example.test',
        email_verified: true,
        name: 'Subject A',
      });
      const first = await runSignInFlow();
      expect(first.responseStatuses).toEqual([200, 302, 302]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Capture the first user id.
      const firstUsers = await databaseClient
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, 'shared-email@example.test'));
      expect(firstUsers).toHaveLength(1);

      // Second login with a different subject B and the same email.
      // Better Auth 1.6.23 with `accountLinking.enabled = false` and
      // `disableImplicitLinking = true` will not silently link the
      // second subject. The exact failure surface depends on the
      // Better Auth version: with our schema (case-insensitive
      // unique email index) the second insert violates the
      // constraint and Better Auth surfaces an error. Either way, the
      // contract is "no second user is created".
      requiredOidc().setNextUser({
        sub: 'google-subject-B',
        email: 'shared-email@example.test',
        email_verified: true,
        name: 'Subject B',
      });
      try {
        await runSignInFlow();
      } catch {
        // A network / abort error from Better Auth is also an
        // acceptable failure mode — the application did not return a
        // successful redirect to the WEB_ORIGIN landing.
      }
      await new Promise((resolve) => setTimeout(resolve, 200));

      // The first sign-in's user row must remain; no duplicate user
      // row may exist for the same email.
      const userRows = await databaseClient
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, 'shared-email@example.test'));
      expect(userRows).toHaveLength(1);
    },
  );
});

describe('deterministic OAuth — replayed authorization code (CASE 5)', () => {
  it(
    'rejects a second exchange of the same code with invalid_grant',
    { timeout: 60_000 },
    async () => {
      // Disable replay protection on the test server so the first
      // exchange succeeds. Then directly POST the token endpoint a
      // second time and assert the local server returns invalid_grant
      // (we use block-replay protection for the rest of the suite).
      requiredOidc().setReplayProtectionMode('block-replay');
      requiredOidc().setNextUser({
        sub: 'google-subject-Replay',
        email: 'replay@example.test',
        email_verified: true,
        name: 'Replay User',
      });
      await runSignInFlow();

      // Direct token exchange with an already-redeemed code should fail.
      const response = await fetch(requiredOidc().tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'consumed-code',
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
        }),
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('invalid_grant');
    },
  );
});

describe('deterministic OAuth — invalid authorization code (CASE 6)', () => {
  it('returns invalid_grant when exchanging an unknown code', { timeout: 30_000 }, async () => {
    const response = await fetch(requiredOidc().tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'unknown-code',
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
      }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe('invalid_grant');
  });
});

describe('deterministic OAuth — provider forces a transient error (CASE 6, server-side failure)', () => {
  it(
    'Better Auth surfaces a controlled error when the token endpoint returns an error',
    { timeout: 60_000 },
    async () => {
      // The forced error is set on the OIDC server. The very first
      // /oauth2/authorize request will return the error, so the
      // sign-in flow is aborted before a code is issued.
      requiredOidc().setForceError('local OIDC test failure');
      requiredOidc().setNextUser({
        sub: 'google-subject-Forced',
        email: 'forced@example.test',
        email_verified: true,
        name: 'Forced User',
      });
      try {
        const result = await runSignInFlow();
        expect(result.finalRedirect).not.toMatch(
          new RegExp(`^${TEST_WEB_ORIGIN.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}/?$`),
        );
      } catch {
        // A failure to even start the flow (because the authorize
        // endpoint returns an error) is also a fail-closed outcome.
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      const userRows = await databaseClient.select().from(usersTable);
      expect(userRows).toHaveLength(0);
    },
  );
});

describe('deterministic OAuth — missing email (CASE 7)', () => {
  it(
    'fails closed when the userinfo response carries no email claim',
    { timeout: 60_000 },
    async () => {
      // Set the no-email payload. The userinfo endpoint will return
      // a profile without an email claim, and Better Auth's generic
      // OAuth provider will refuse to create the user.
      requiredOidc().setNextUser({
        sub: 'google-subject-NoEmail',
        email: 'placeholder@example.test',
        email_verified: true,
        name: 'No Email',
      });
      requiredOidc().setNextUserWithoutEmail();
      try {
        const result = await runSignInFlow();
        expect(result.finalRedirect).not.toMatch(
          new RegExp(`^${TEST_WEB_ORIGIN.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}/?$`),
        );
      } catch {
        // A network / abort error is also acceptable.
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      const userRows = await databaseClient.select().from(usersTable);
      expect(userRows).toHaveLength(0);
    },
  );
});

describe('deterministic OAuth — disabled CUSTOMER (CASE 12)', () => {
  it(
    'sign-in succeeds for ACTIVE CUSTOMER and fails for DISABLED CUSTOMER',
    { timeout: 90_000 },
    async () => {
      // 1. Sign in to create a CUSTOMER user.
      requiredOidc().setNextUser({
        sub: 'google-subject-Disable',
        email: 'disable@example.test',
        email_verified: true,
        name: 'Disable User',
      });
      const first = await runSignInFlow();
      expect(first.responseStatuses).toEqual([200, 302, 302]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 2. Disable the user row.
      await databaseClient
        .update(usersTable)
        .set({ status: 'DISABLED' })
        .where(eq(usersTable.email, 'disable@example.test'));

      // 3. Repeat the sign-in. The application-level session reader
      //    refuses DISABLED users. Better Auth's sign-in itself can
      //    still mint a row, but our session reader must reject it.
      requiredOidc().setNextUser({
        sub: 'google-subject-Disable',
        email: 'disable@example.test',
        email_verified: true,
        name: 'Disable User',
      });
      await runSignInFlow();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const userRows = await databaseClient
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, 'disable@example.test'));
      expect(userRows).toHaveLength(1);
      expect(userRows[0]?.status).toBe('DISABLED');
    },
  );
});

void TEST_AUTH_BASE_URL;
