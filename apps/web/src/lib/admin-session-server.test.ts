import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  resolveAdminSessionFromHeaders,
  type AdminSessionResolution,
} from './admin-session-server';

const TEST_BASE_URL = 'http://127.0.0.1:3101/api/v1';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

function withBaseUrl<T>(call: () => Promise<T>): Promise<T> {
  return call();
}

function resolve(headers: Parameters<typeof resolveAdminSessionFromHeaders>[0]) {
  return resolveAdminSessionFromHeaders(headers, { baseUrl: TEST_BASE_URL });
}

describe('resolveAdminSessionFromHeaders', () => {
  it('uses the server-only internal API base instead of the browser public base', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://peacenest.vn/api/v1');
    vi.stubEnv('INTERNAL_API_BASE_URL', 'http://api:3001/api/v1');
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        emailMasked: 'a****r@example.test',
        displayName: 'Administrator',
        role: 'ADMIN',
        permissions: ['catalog.property.read'],
        sessionExpiresAt: '2027-01-01T00:00:00.000Z',
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await resolveAdminSessionFromHeaders({}, { probeCustomer: false });

    expect(fetchMock).toHaveBeenCalledWith('http://api:3001/api/v1/admin/me', expect.any(Object));
  });

  it('returns an ADMIN session when /admin/me responds with the canonical shape', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        emailMasked: 'a****r@example.test',
        displayName: 'Administrator',
        role: 'ADMIN',
        permissions: ['catalog.property.read'],
        sessionExpiresAt: '2027-01-01T00:00:00.000Z',
      }),
    ) as unknown as typeof fetch;

    const resolution: AdminSessionResolution = await withBaseUrl(() =>
      resolve({ cookie: 'better-auth.session_token=abc' }),
    );

    expect(resolution.kind).toBe('admin');
    if (resolution.kind === 'admin') {
      expect(resolution.session.role).toBe('ADMIN');
      expect(resolution.session.emailMasked).toBe('a****r@example.test');
    }
  });

  it('returns a customer rejection when /admin/me is unauthenticated and /customer/profile/session confirms a CUSTOMER session', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/admin/me')) {
        return new Response('{}', {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/customer/profile/session')) {
        return jsonResponse(200, { authenticated: true });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;

    const resolution = await resolve({ cookie: '' });
    expect(resolution.kind).toBe('customer');
  });

  it('returns unauthenticated when both /admin/me and /customer/profile/session reject', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;

    const resolution = await resolve({});
    expect(resolution.kind).toBe('unauthenticated');
  });

  it('returns unauthenticated when /admin/me responds with 401', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;

    const resolution = await resolve({});
    expect(resolution.kind).toBe('unauthenticated');
  });

  it('returns malformed when the response cannot be parsed against adminMeSchema', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, {
        id: 'not-a-uuid',
        emailMasked: 'a****r@example.test',
        displayName: 'Administrator',
        role: 'ADMIN',
        permissions: ['catalog.property.read'],
        sessionExpiresAt: 'not-a-timestamp',
      }),
    ) as unknown as typeof fetch;

    const resolution = await resolve({});
    expect(resolution.kind).toBe('malformed');
  });

  it('returns malformed when /admin/me returns invalid JSON', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    const resolution = await resolve({});
    expect(resolution.kind).toBe('malformed');
  });

  it('returns unauthenticated when the API is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const resolution = await resolve({});
    expect(resolution.kind).toBe('unauthenticated');
  });

  it('forwards the inbound cookie to /admin/me so the API session is honoured', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        emailMasked: 'a****r@example.test',
        displayName: 'Administrator',
        role: 'ADMIN',
        permissions: ['catalog.property.read'],
        sessionExpiresAt: '2027-01-01T00:00:00.000Z',
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await resolve({
      cookie: 'better-auth.session_token=abc123; path=/; HttpOnly',
    });

    const fetchCalls = fetchMock.mock.calls as unknown as ReadonlyArray<
      readonly [unknown, unknown]
    >;
    expect(fetchCalls.length).toBe(1);
    const [url, init] = fetchCalls[0] ?? [];
    expect(typeof url).toBe('string');
    expect(String(url)).toMatch(/\/admin\/me$/);
    const headers = ((init as { headers?: Record<string, string> } | undefined)?.headers ??
      {}) as Record<string, string>;
    expect(headers.cookie).toBe('better-auth.session_token=abc123; path=/; HttpOnly');
  });

  it('never trusts a browser-supplied role flag in the session payload', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        emailMasked: 'a****r@example.test',
        displayName: 'Administrator',
        // `role` is constrained by the Zod schema to the literal 'ADMIN'.
        role: 'CUSTOMER',
        permissions: ['catalog.property.read'],
        sessionExpiresAt: '2027-01-01T00:00:00.000Z',
      }),
    ) as unknown as typeof fetch;

    const resolution = await resolve({});
    // The schema rejects role != 'ADMIN'; the resolver must treat that as
    // 'malformed' rather than 'customer' so the gate redirects to login
    // (a manipulated role is not a customer session).
    expect(resolution.kind).toBe('malformed');
  });
});
