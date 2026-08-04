import { Body, Controller, Inject, Param, Post, Req, Res, Version } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CustomerSessionService } from '../auth/customer-session.service.js';
import { serializeGuestSessionCookie, GUEST_SESSION_COOKIE_PATH } from './cookie.js';
import { GuestAccessRepository } from './repositories/guest-access.repository.js';
import { BookingHoldService } from './services/booking-hold.service.js';

interface RequestWithCorrelation {
  readonly id: string;
  readonly headers: Record<string, string | string[] | undefined>;
}

@Controller('public/quotes')
export class BookingHoldController {
  public constructor(
    @Inject(BookingHoldService) private readonly holds: BookingHoldService,
    @Inject(CustomerSessionService) private readonly customers: CustomerSessionService,
    @Inject(GuestAccessRepository) private readonly guestAccess: GuestAccessRepository,
  ) {}

  @Post(':quoteId/bookings')
  @Version('1')
  public async issue(
    @Param('quoteId') quoteId: string,
    @Body() body: unknown,
    @Req() request: RequestWithCorrelation,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const customerUserId = await this.resolveOptionalCustomerUserId(request);
    const hold = await this.holds.issue(quoteId, body, request.id, customerUserId);
    const checkoutSession = await this.guestAccess.createCheckoutSession({
      bookingId: hold.bookingId,
      now: new Date(),
    });
    const cookie = serializeGuestSessionCookie(checkoutSession.token, {
      nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'test',
      ttlSeconds: Math.max(
        1,
        Math.floor((checkoutSession.expiresAt.getTime() - Date.now()) / 1000),
      ),
      path: GUEST_SESSION_COOKIE_PATH,
    });
    reply.header('Set-Cookie', cookie.header);
    return hold;
  }

  /**
   * Resolve an ACTIVE CUSTOMER user id only when the request carries a
   * valid session. Guest bookings remain the default; absence of a CUSTOMER
   * session is intentionally non-fatal here.
   */
  private async resolveOptionalCustomerUserId(
    request: RequestWithCorrelation,
  ): Promise<string | undefined> {
    try {
      const actor = await this.customers.requireCustomer(request);
      return actor.userId;
    } catch {
      return undefined;
    }
  }
}
