/**
 * Local loopback OAuth2/OIDC provider used exclusively by the Phase 7F
 * deterministic OAuth harness. The provider is wired to Better Auth's
 * `genericOAuth` plugin and never participates in the production
 * authentication surface.
 *
 * Implements the minimal subset of OAuth2 required to drive a real
 * Better Auth social sign-in flow:
 *   - GET  /oauth2/authorize — issues an authorization code and 302
 *     redirects to the registered client redirect URI.
 *   - POST /oauth2/token     — exchanges the authorization code for an
 *     access token.
 *   - GET  /oauth2/userinfo  — returns the configured user profile as
 *     a JSON object.
 *
 * The server is driven by `setNextUser(...)`. The next authorization
 * request will mint a code bound to the next user, and the matching
 * userinfo call returns that user's profile. `resetState()` clears all
 * transient state. `setForceError` and `setReplayMode` allow the
 * focused test cases to assert fail-closed behaviour.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';

export interface OidcTestUser {
  readonly sub: string;
  readonly email: string;
  readonly email_verified: true;
  readonly name: string;
}

export interface OidcTestServerOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly host?: string;
  readonly port?: number;
}

interface IssuedCode {
  readonly code: string;
  readonly subject: string;
  readonly clientId: string;
  readonly issuedAt: number;
  redeemed: boolean;
}

export interface OidcTestServer {
  readonly baseUrl: string;
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly userInfoUrl: string;
  setNextUser(user: OidcTestUser | null): void;
  setNextUserWithoutEmail(): void;
  setForceError(message: string): void;
  clearForceError(): void;
  setReplayProtectionMode(mode: 'none' | 'block-replay'): void;
  resetState(): void;
  getIssuedCodeCount(): number;
  close(): Promise<void>;
}

interface TestControlPayload {
  readonly sub?: string;
  readonly email?: string;
  readonly name?: string;
  readonly message?: string;
}

const DEFAULT_HOST = '127.0.0.1';
const CODE_TTL_MS = 60_000;

export async function startOidcTestServer(
  options: OidcTestServerOptions,
): Promise<OidcTestServer> {
  const host = options.host ?? DEFAULT_HOST;
  const codes = new Map<string, IssuedCode>();

  let nextUser: OidcTestUser | null = null;
  let nextUserWithoutEmail = false;
  let forcedError: string | null = null;
  let replayMode: 'none' | 'block-replay' = 'block-replay';

  const server: Server = createServer((request, response) => {
    void handle(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Local OIDC test server did not bind a port');
  }
  if (address.port === undefined || address.address === undefined) {
    throw new Error('Local OIDC test server returned an incomplete address');
  }
  const baseUrl = `http://${address.address}:${address.port}`;

  function cleanupExpired(): void {
    const now = Date.now();
    for (const [code, entry] of codes) {
      if (now - entry.issuedAt > CODE_TTL_MS) codes.delete(code);
    }
  }

  function json(response: ServerResponse, status: number, body: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify(body));
  }

  function redirect(response: ServerResponse, location: string): void {
    response.statusCode = 302;
    response.setHeader('location', location);
    response.setHeader('cache-control', 'no-store');
    response.end();
  }

  async function readBody(request: IncomingMessage): Promise<URLSearchParams> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(new URLSearchParams(text));
      });
      request.on('error', (error) => reject(error));
    });
  }

  async function readJsonBody<T>(request: IncomingMessage): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (text.length === 0) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(text) as T);
        } catch {
          resolve(null);
        }
      });
      request.on('error', (error) => reject(error));
    });
  }

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    cleanupExpired();
    const url = new URL(request.url ?? '/', baseUrl);
    const pathname = url.pathname;

    // Test orchestration endpoints. The Playwright global setup and
    // the browser identity vertical drive the server through these
    // routes. They never appear in the OIDC/OAuth2 surface and are
    // only bound on this localhost test server.
    if (request.method === 'POST' && pathname === '/test/set-next-user') {
      const payload = (await readJsonBody<TestControlPayload>(request)) ?? {};
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        json(response, 400, { error: 'sub is required' });
        return;
      }
      const user: OidcTestUser = {
        sub: payload.sub,
        email: payload.email ?? `${payload.sub}@example.test`,
        email_verified: true,
        name: payload.name ?? payload.sub,
      };
      nextUser = user;
      json(response, 200, { ok: true });
      return;
    }
    if (request.method === 'POST' && pathname === '/test/force-error') {
      const payload = (await readJsonBody<TestControlPayload>(request)) ?? {};
      const message = payload.message ?? 'forced error';
      forcedError = message;
      json(response, 200, { ok: true });
      return;
    }
    if (request.method === 'POST' && pathname === '/test/reset') {
      nextUser = null;
      nextUserWithoutEmail = false;
      forcedError = null;
      codes.clear();
      json(response, 200, { ok: true });
      return;
    }

    if (forcedError !== null) {
      const message = forcedError;
      forcedError = null;
      json(response, 400, { error: 'temporarily_unavailable', error_description: message });
      return;
    }

    if (request.method === 'GET' && pathname === '/oauth2/authorize') {
      const clientId = url.searchParams.get('client_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = url.searchParams.get('state');
      if (clientId === null || redirectUri === null || state === null) {
        json(response, 400, { error: 'invalid_request' });
        return;
      }
      if (clientId !== options.clientId) {
        json(response, 400, { error: 'unauthorized_client' });
        return;
      }
      const code = randomBytes(16).toString('hex');
      const subject = nextUser?.sub ?? `subject-${code}`;
      codes.set(code, {
        code,
        subject,
        clientId,
        issuedAt: Date.now(),
        redeemed: false,
      });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      target.searchParams.set('state', state);
      redirect(response, target.toString());
      return;
    }

    if (request.method === 'POST' && pathname === '/oauth2/token') {
      const body = await readBody(request);
      const grantType = body.get('grant_type');
      const code = body.get('code');
      const clientId = body.get('client_id');
      const clientSecret = body.get('client_secret');
      if (grantType !== 'authorization_code') {
        json(response, 400, { error: 'unsupported_grant_type' });
        return;
      }
      if (code === null || clientId === null || clientSecret === null) {
        json(response, 400, { error: 'invalid_request' });
        return;
      }
      if (clientId !== options.clientId || clientSecret !== options.clientSecret) {
        json(response, 400, { error: 'invalid_client' });
        return;
      }
      const entry = codes.get(code);
      if (entry === undefined) {
        json(response, 400, { error: 'invalid_grant' });
        return;
      }
      if (replayMode === 'block-replay' && entry.redeemed) {
        json(response, 400, { error: 'invalid_grant', error_description: 'code already used' });
        return;
      }
      entry.redeemed = true;
      json(response, 200, {
        access_token: `at-${entry.code}`,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email profile',
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/oauth2/userinfo') {
      const auth = request.headers['authorization'];
      if (typeof auth !== 'string' || !auth.startsWith('Bearer at-')) {
        json(response, 401, { error: 'invalid_token' });
        return;
      }
      const code = auth.slice('Bearer at-'.length);
      const entry = codes.get(code);
      if (entry === undefined) {
        json(response, 401, { error: 'invalid_token' });
        return;
      }
      if (nextUserWithoutEmail) {
        nextUserWithoutEmail = false;
        json(response, 200, {
          sub: entry.subject,
          email_verified: false,
          name: 'No Email',
        });
        return;
      }
      if (nextUser === null) {
        json(response, 200, {
          sub: entry.subject,
          email: `${entry.subject}@example.test`,
          email_verified: true,
          name: entry.subject,
        });
        return;
      }
      const user = nextUser;
      nextUser = null;
      json(response, 200, user);
      return;
    }

    json(response, 404, { error: 'not_found' });
  }

  return {
    baseUrl,
    authorizationUrl: `${baseUrl}/oauth2/authorize`,
    tokenUrl: `${baseUrl}/oauth2/token`,
    userInfoUrl: `${baseUrl}/oauth2/userinfo`,
    setNextUser(user) {
      nextUser = user;
    },
    setNextUserWithoutEmail() {
      nextUserWithoutEmail = true;
    },
    setForceError(message) {
      forcedError = message;
    },
    clearForceError() {
      forcedError = null;
    },
    setReplayProtectionMode(mode) {
      replayMode = mode;
    },
    resetState() {
      nextUser = null;
      nextUserWithoutEmail = false;
      forcedError = null;
      codes.clear();
    },
    getIssuedCodeCount() {
      return codes.size;
    },
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
