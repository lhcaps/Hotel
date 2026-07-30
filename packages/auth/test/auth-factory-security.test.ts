import { describe, expect, it, vi } from 'vitest';

import { createRoomAuth } from '../src/auth-factory.js';

function buildFakeDatabaseClient() {
  // `createRoomAuth` does not invoke the database during construction
  // (the drizzle adapter wires the connection but does not query until
  // a request arrives). Returning a lightweight proxy keeps the test
  // hermetic.
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'session') {
          return {
            findMany: vi.fn().mockResolvedValue([]),
            findOne: vi.fn().mockResolvedValue(null),
            update: vi.fn().mockResolvedValue(undefined),
            create: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
          };
        }
        return vi.fn().mockResolvedValue(undefined);
      },
    },
  );
}

describe('createRoomAuth — origin / cookie / callback security contract', () => {
  it('registers WEB_ORIGIN as a trustedOrigin', () => {
    const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
      BETTER_AUTH_SECRET: 'phase-7f-auth-factory-trusted-origin-tests-secret',
      WEB_ORIGIN: 'https://app.example.test',
      AUTH_BASE_URL: 'https://app.example.test/api/auth',
      NODE_ENV: 'production',
    });
    const options = auth.options;
    expect(options.trustedOrigins).toContain('https://app.example.test');
  });

  it.each([
    ['http://127.0.0.1:3100', 'http://localhost:3100'],
    ['http://localhost:3000', 'http://127.0.0.1:3000'],
  ])('adds the equivalent loopback alias for WEB_ORIGIN %s', (webOrigin, alias) => {
    const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
      BETTER_AUTH_SECRET: 'phase-7f-auth-factory-loopback-tests-secret',
      WEB_ORIGIN: webOrigin,
      AUTH_BASE_URL: 'http://127.0.0.1:3101',
      NODE_ENV: 'test',
    });
    const options = auth.options;
    expect(options.trustedOrigins).toContain(webOrigin);
    expect(options.trustedOrigins).toContain(alias);
  });

  it.each(['https://localhost:3000', 'https://app.example.test'])(
    'does not widen trusted origins for %s',
    (webOrigin) => {
      const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
        BETTER_AUTH_SECRET: 'phase-7f-auth-factory-origin-boundary-tests-secret',
        WEB_ORIGIN: webOrigin,
        AUTH_BASE_URL: 'https://app.example.test/api/auth',
        NODE_ENV: 'production',
      });

      expect(auth.options.trustedOrigins).toEqual([webOrigin]);
    },
  );

  it('emits HttpOnly + SameSite=Lax + Secure cookies in production', () => {
    const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
      BETTER_AUTH_SECRET: 'phase-7f-cookie-prod-tests-secret-long-enough',
      WEB_ORIGIN: 'https://app.example.test',
      AUTH_BASE_URL: 'https://app.example.test/api/auth',
      NODE_ENV: 'production',
    });
    const cookies = (auth.options.advanced ?? {}).defaultCookieAttributes ?? {};
    expect(cookies.httpOnly).toBe(true);
    expect(cookies.sameSite).toBe('lax');
    expect(cookies.secure).toBe(true);
    expect((auth.options.advanced ?? {}).useSecureCookies).toBe(true);
  });

  it('emits HttpOnly + SameSite=Lax cookies without Secure flag in non-production', () => {
    const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
      BETTER_AUTH_SECRET: 'phase-7f-cookie-dev-tests-secret-long-enough',
      WEB_ORIGIN: 'http://localhost:3000',
      AUTH_BASE_URL: 'http://localhost:3000/api/auth',
      NODE_ENV: 'development',
    });
    const cookies = (auth.options.advanced ?? {}).defaultCookieAttributes ?? {};
    expect(cookies.httpOnly).toBe(true);
    expect(cookies.sameSite).toBe('lax');
    expect(cookies.secure).toBe(false);
    expect((auth.options.advanced ?? {}).useSecureCookies).toBe(false);
  });

  it('configures accountLinking disabled with disableImplicitLinking on', () => {
    const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
      BETTER_AUTH_SECRET: 'phase-7f-account-linking-secret-long-enough',
      WEB_ORIGIN: 'http://localhost:3000',
      AUTH_BASE_URL: 'http://localhost:3000/api/auth',
      NODE_ENV: 'development',
    });
    const account = auth.options.account ?? {};
    expect(account.accountLinking?.enabled).toBe(false);
    expect(account.accountLinking?.disableImplicitLinking).toBe(true);
  });

  it('does not enable email/password sign-up (social-only flow)', () => {
    const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
      BETTER_AUTH_SECRET: 'phase-7f-no-signup-secret-long-enough',
      WEB_ORIGIN: 'http://localhost:3000',
      AUTH_BASE_URL: 'http://localhost:3000/api/auth',
      NODE_ENV: 'development',
    });
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it('forces CUSTOMER role on every user row even without an explicit insert', () => {
    const auth = createRoomAuth(buildFakeDatabaseClient() as never, {
      BETTER_AUTH_SECRET: 'phase-7f-role-default-secret-long-enough',
      WEB_ORIGIN: 'http://localhost:3000',
      AUTH_BASE_URL: 'http://localhost:3000/api/auth',
      NODE_ENV: 'development',
    });
    const role = auth.options.user?.additionalFields?.role;
    expect(role?.defaultValue).toBe('CUSTOMER');
    expect(role?.required).toBe(false);
  });
});
