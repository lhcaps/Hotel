import { Controller, Get, Inject, Post, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { forwardAuthResponseHeaders, type AuthRequestHandler } from './auth-fastify-bridge.js';
import { ROOM_AUTH } from './auth.providers.js';
import { createLogger } from '@room/observability';

// Routes mounted at /api/auth (via @Controller('auth') + app.setGlobalPrefix('api')).
// The catch-all `*` route handles Better Auth's generic OAuth endpoints
// (e.g., /api/auth/sign-in/oauth2) by delegating to the auth handler.
//
// Better Auth clients call the routes without the `/v1` API version segment
// (the api publishes the OAuth endpoints under `/api/auth/*`, not
// `/api/v1/auth/*`), so the controller is version-neutral via VERSION_NEUTRAL.
@Controller({ path: 'auth', version: VERSION_NEUTRAL })
export class AuthController {
  private readonly auth: AuthRequestHandler;
  private readonly logger = createLogger({
    service: 'api',
    environment: process.env.NODE_ENV ?? 'unknown',
  });

  constructor(@Inject(ROOM_AUTH) auth: AuthRequestHandler) {
    this.auth = auth;
  }

  private async handleAuthRequest(req: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    try {
      const host = req.headers.host ?? 'localhost';
      const protocol = req.protocol ?? 'http';
      const baseUrl = `${protocol}://${host}`;
      const url = new URL(req.url, baseUrl);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') {
          headers[k] = v;
        } else if (Array.isArray(v)) {
          headers[k] = v.join(', ');
        }
      }
      const rawBody = req.body;
      const bodyStr =
        rawBody !== undefined &&
        req.method !== 'GET' &&
        rawBody !== null &&
        Object.keys(rawBody).length > 0
          ? JSON.stringify(rawBody)
          : undefined;
      this.logger.debug(
        {
          method: req.method,
          url: url.toString(),
          headers: Object.keys(headers),
          body: bodyStr?.slice(0, 200),
        },
        'Better Auth request',
      );
      const authReq = new Request(url, {
        method: req.method,
        headers: fromNodeHeaders(headers as never),
        ...(bodyStr !== undefined ? { body: bodyStr } : {}),
      });
      const authRes = await this.auth.handler(authReq);
      const status = authRes.status;
      const resBody = await authRes.text();
      this.logger.debug(
        { status, url: url.toString(), method: req.method, body: resBody.slice(0, 200) },
        'Better Auth response',
      );
      forwardAuthResponseHeaders(authRes, reply);
      return reply.status(status).send(resBody);
    } catch (err) {
      this.logger.error({ err }, 'Auth controller error');
      return (reply as unknown as { status: (code: number) => { send: (body: unknown) => void } })
        .status(500)
        .send({ code: 'AUTH_FAILURE', message: 'Authentication service unavailable.' });
    }
  }

  // Catch-all for Better Auth endpoints. NestJS @Get('*') under a controller
  // prefix matches anything after the prefix, e.g. /api/auth/sign-in/oauth2.
  @Get('*')
  async handleGet(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<unknown> {
    return this.handleAuthRequest(req, reply as FastifyReply);
  }

  @Post('*')
  async handlePost(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<unknown> {
    return this.handleAuthRequest(req, reply as FastifyReply);
  }
}
