import { describe, expect, it, vi } from 'vitest';

import {
  createAuthFastifyHandler,
  registerAuthFastifyRoute,
} from '../src/auth/auth-fastify-bridge.js';

describe('Better Auth Fastify bridge', () => {
  it('registers only the explicit unversioned Better Auth route', () => {
    const route = vi.fn();
    registerAuthFastifyRoute({ route }, { handler: vi.fn() });

    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({ method: ['GET', 'POST'], url: '/api/auth/*' }),
    );
  });

  it('forwards method, JSON body and every Set-Cookie header without collapsing OAuth cookies', async () => {
    const responseHeaders = new Headers({ 'content-type': 'application/json' });
    responseHeaders.append(
      'set-cookie',
      'oauth_state=state-secret; Path=/; HttpOnly; SameSite=Lax',
    );
    responseHeaders.append(
      'set-cookie',
      'better-auth.session_token=session-secret; Path=/; HttpOnly; SameSite=Lax',
    );
    const handler = createAuthFastifyHandler({
      handler: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: responseHeaders,
        }),
      ),
    });
    const reply = {
      status: vi.fn(),
      header: vi.fn(),
      send: vi.fn(),
    };
    reply.status.mockReturnValue(reply);

    await handler(
      {
        method: 'POST',
        url: '/api/auth/sign-in/email',
        headers: { host: 'localhost:3001', 'content-type': 'application/json' },
        protocol: 'http',
        body: { email: 'admin@example.test', password: 'not-logged' },
      },
      reply,
    );

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.header).toHaveBeenCalledWith('set-cookie', [
      'oauth_state=state-secret; Path=/; HttpOnly; SameSite=Lax',
      'better-auth.session_token=session-secret; Path=/; HttpOnly; SameSite=Lax',
    ]);
    expect(reply.send).toHaveBeenCalledWith('{"ok":true}');
  });

  it('returns a sanitized error response when the auth handler throws', async () => {
    const handler = createAuthFastifyHandler({
      handler: vi.fn().mockRejectedValue(new Error('token=secret')),
    });
    const reply = { status: vi.fn(), header: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);

    await handler(
      {
        method: 'GET',
        url: '/api/auth/get-session',
        headers: { host: 'localhost:3001' },
        protocol: 'http',
      },
      reply,
    );

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'AUTH_FAILURE',
      message: 'Authentication service unavailable.',
    });
  });
});
