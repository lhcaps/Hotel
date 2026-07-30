import { Controller, Headers, HttpCode, Inject, Param, Post, Req, Version } from '@nestjs/common';

import { parseGuestSessionCookie } from '../booking/cookie.js';
import { MomoPaymentInitiationService } from './services/momo-payment-initiation.service.js';

interface RequestLike {
  readonly cookies?: Record<string, string | undefined>;
  readonly id: string;
}

@Controller('public/bookings')
export class MomoPaymentController {
  public constructor(
    @Inject(MomoPaymentInitiationService) private readonly payments: MomoPaymentInitiationService,
  ) {}

  @Post(':bookingCode/payments/momo/attempts')
  @Version('1')
  @HttpCode(200)
  public async initiate(
    @Param('bookingCode') bookingCode: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestLike,
  ) {
    const raw = request.cookies?.['rm_guest_session_v1'];
    return this.payments.initiate({
      bookingCode,
      sessionToken: raw === undefined || raw === '' ? null : parseGuestSessionCookie(raw),
      idempotencyKey,
      requestId: request.id,
    });
  }
}
