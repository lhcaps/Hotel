import { createHash } from 'node:crypto';
import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Version,
} from '@nestjs/common';

import { CustomerSessionService } from '../auth/customer-session.service.js';
import { ClaimBookingError, ClaimBookingService } from './claim-booking.service.js';
import { parseGuestSessionCookie } from '../booking/cookie.js';

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly cookies?: Record<string, string | undefined>;
  readonly id: string;
}

function hashGuestToken(rawToken: string | null, secret: string): Buffer | null {
  if (rawToken === null || rawToken === '') return null;
  const parsed = parseGuestSessionCookie(rawToken);
  if (parsed === null) return null;
  const hmac = createHash('sha256');
  hmac.update(Buffer.from(secret, 'utf8'));
  hmac.update(parsed);
  return hmac.digest();
}

@Controller('customer/bookings')
export class ClaimBookingController {
  public constructor(
    @Inject(ClaimBookingService) private readonly claims: ClaimBookingService,
    @Inject(CustomerSessionService) private readonly sessions: CustomerSessionService,
  ) {}

  @Post(':bookingCode/claim')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  public async claim(
    @Param('bookingCode') bookingCode: string,
    @Req() request: RequestLike,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    const cookieValue = request.cookies?.['rm_guest_session_v1'] ?? null;
    const secret = process.env['GUEST_SESSION_SECRET'] ?? '';
    if (cookieValue === null || secret.length < 32) {
      throw new HttpException(
        { code: 'GUEST_SESSION_REQUIRED' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const tokenDigest = hashGuestToken(cookieValue, secret);
    if (tokenDigest === null) {
      throw new HttpException(
        { code: 'GUEST_SESSION_MALFORMED' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      return await this.claims.claim({
        bookingCode,
        userId: actor.userId,
        guestSessionTokenDigest: tokenDigest,
      });
    } catch (error) {
      if (error instanceof ClaimBookingError) {
        const statusByCode: Record<string, HttpStatus> = {
          BOOKING_NOT_FOUND: HttpStatus.NOT_FOUND,
          GUEST_SESSION_REQUIRED: HttpStatus.UNAUTHORIZED,
          GUEST_SESSION_MISMATCH: HttpStatus.FORBIDDEN,
          BOOKING_ALREADY_LINKED: HttpStatus.CONFLICT,
          CUSTOMER_NOT_FOUND: HttpStatus.UNAUTHORIZED,
          CUSTOMER_DISABLED: HttpStatus.FORBIDDEN,
        };
        const status = statusByCode[error.code] ?? HttpStatus.BAD_REQUEST;
        throw new HttpException({ code: error.code, message: error.message }, status);
      }
      throw error;
    }
  }
}
