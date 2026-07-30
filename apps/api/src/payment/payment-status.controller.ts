import { Controller, Get, Inject, Param, Req, Version } from '@nestjs/common';

import { parseGuestSessionCookie } from '../booking/cookie.js';
import { GuestSessionRequiredError } from '../booking/services/guest-session.service.js';
import { PaymentStatusService } from './services/payment-status.service.js';

interface RequestLike {
  readonly cookies?: Record<string, string | undefined>;
}

@Controller('public/bookings')
export class PaymentStatusController {
  public constructor(@Inject(PaymentStatusService) private readonly status: PaymentStatusService) {}

  @Get(':bookingCode/payment')
  @Version('1')
  public async get(@Param('bookingCode') bookingCode: string, @Req() request: RequestLike) {
    const raw = request.cookies?.['rm_guest_session_v1'];
    const token = raw === undefined || raw === '' ? null : parseGuestSessionCookie(raw);
    if (token === null) throw new GuestSessionRequiredError();
    return this.status.get(bookingCode, token, new Date());
  }
}
