import { Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import {
  buildClearCookieHeader,
  parseGuestSessionCookie,
  type GuestSessionCookieAttributes,
  GUEST_SESSION_COOKIE_PATH,
} from './cookie.js';
import { GuestLogoutService } from './services/guest-logout.service.js';

interface RequestLike {
  readonly cookies?: Record<string, string | undefined>;
}

@Controller('public/guest-access')
export class GuestAccessLogoutController {
  public constructor(@Inject(GuestLogoutService) private readonly service: GuestLogoutService) {}

  @Post('logout')
  @Version('1')
  public async logout(
    @Req() request: RequestLike,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const raw = request.cookies?.['rm_guest_session_v1'];
    const token = raw === undefined || raw === '' ? null : parseGuestSessionCookie(raw);
    const attributes: GuestSessionCookieAttributes = {
      nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      ttlSeconds: 1800,
      path: GUEST_SESSION_COOKIE_PATH,
    };
    const result = await this.service.logout(token, new Date());
    (reply as unknown as { header: (name: string, value: string) => void }).header(
      'Set-Cookie',
      buildClearCookieHeader(attributes),
    );
    return result;
  }
}
