import { Controller, Get, Inject, Param, Req, Version } from '@nestjs/common';

import { BookingDetailService } from './services/booking-detail.service.js';
import { GuestSessionRequiredError, GuestSessionService } from './services/guest-session.service.js';
import { parseGuestSessionCookie } from './cookie.js';

interface RequestLike {
  readonly cookies?: Record<string, string | undefined>;
}

@Controller('public/bookings')
export class BookingDetailController {
  public constructor(
    @Inject(BookingDetailService) private readonly details: BookingDetailService,
    @Inject(GuestSessionService) private readonly sessions: GuestSessionService,
  ) {}

  @Get(':bookingCode')
  @Version('1')
  public async get(@Param('bookingCode') bookingCode: string, @Req() request: RequestLike) {
    const raw = request.cookies?.['rm_guest_session_v1'];
    const token = raw === undefined || raw === '' ? null : parseGuestSessionCookie(raw);
    if (token === null) {
      throw new GuestSessionRequiredError();
    }
    return this.details.getByBookingCode(bookingCode, token, new Date());
  }
}