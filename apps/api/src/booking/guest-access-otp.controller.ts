import { Body, Controller, Inject, Post, Req, Res, Version } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Buffer } from 'node:buffer';

import {
  buildClearCookieHeader,
  parseGuestSessionCookie,
  serializeGuestSessionCookie,
  GUEST_SESSION_COOKIE_PATH,
  type GuestSessionCookieAttributes,
} from './cookie.js';
import {
  GuestAccessOtpRequestService,
  OtpRateLimitedError,
} from './services/guest-access-otp-request.service.js';
import {
  GuestAccessOtpVerifyService,
  OtpInvalidOrExpiredError,
} from './services/guest-access-otp-verify.service.js';

interface RequestLike {
  readonly id: string;
  readonly cookies?: Record<string, string | undefined>;
  readonly socket?: { readonly remoteAddress?: string | null } | null;
  readonly headers?: Record<string, string | string[] | undefined>;
}

interface ReplyWithSetCookie {
  readonly header: (name: string, value: string) => ReplyWithSetCookie;
}

function readSessionCookie(request: RequestLike): Buffer | null {
  const raw = request.cookies?.['rm_guest_session_v1'];
  if (raw === undefined || raw === '') return null;
  return parseGuestSessionCookie(raw);
}

function extractIp(
  request: RequestLike,
  _trustedCidrs: readonly { readonly cidr: string }[],
): string {
  const socketAddress = request.socket?.remoteAddress ?? null;
  // Without trusted proxies we fall back to socket address (no spoofable
  // surface). TRUSTED_PROXY_CIDRS handling is enforced at the Fastify
  // hook level when the deploy wants to honour X-Forwarded-For.
  void _trustedCidrs;
  return socketAddress ?? '127.0.0.1';
}

@Controller('public/guest-access')
export class GuestAccessOtpController {
  public constructor(
    @Inject(GuestAccessOtpRequestService)
    private readonly requestService: GuestAccessOtpRequestService,
    @Inject(GuestAccessOtpVerifyService)
    private readonly verifyService: GuestAccessOtpVerifyService,
  ) {}

  @Post('otp/request')
  @Version('1')
  public async requestOtp(@Body() body: unknown, @Req() request: RequestLike) {
    try {
      return await this.requestService.request(body, extractIp(request, []));
    } catch (error) {
      if (error instanceof OtpRateLimitedError) {
        const response = error as OtpRateLimitedError & {
          readonly retryAfterSeconds: number;
        };
        throw new OtpRateLimitedHttpError(response.retryAfterSeconds);
      }
      throw error;
    }
  }

  @Post('otp/verify')
  @Version('1')
  public async verifyOtp(
    @Body() body: unknown,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    try {
      const { response, sessionToken } = await this.verifyService.verify(
        body,
        extractIp(request, []),
        new Date(),
      );
      const attributes: GuestSessionCookieAttributes = {
        nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        ttlSeconds: 1800,
        path: GUEST_SESSION_COOKIE_PATH,
      };
      const cookie = serializeGuestSessionCookie(sessionToken, attributes);
      (reply as unknown as ReplyWithSetCookie).header('Set-Cookie', cookie.header);
      return response;
    } catch (error) {
      if (error instanceof OtpInvalidOrExpiredError) {
        throw error;
      }
      throw error;
    }
  }
}

class OtpRateLimitedHttpError extends Error {
  public readonly status = 429;
  public readonly code = 'OTP_RATE_LIMITED';
  public constructor(public readonly retryAfterSeconds: number) {
    super('OTP rate-limited');
    this.name = 'OtpRateLimitedHttpError';
  }
}

void readSessionCookie;
void buildClearCookieHeader;
