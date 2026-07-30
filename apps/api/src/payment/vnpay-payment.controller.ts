import { Controller, Headers, HttpCode, Inject, Param, Post, Req, Version } from '@nestjs/common';
import { parseGuestSessionCookie } from '../booking/cookie.js';
import { VnpayPaymentInitiationService } from './services/vnpay-payment-initiation.service.js';
@Controller('public/bookings')
export class VnpayPaymentController {
  public constructor(
    @Inject(VnpayPaymentInitiationService) private readonly payments: VnpayPaymentInitiationService,
  ) {}
  @Post(':bookingCode/payments/vnpay/attempts') @Version('1') @HttpCode(200) public initiate(
    @Param('bookingCode') bookingCode: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: { readonly cookies?: Record<string, string | undefined>; readonly id: string },
  ) {
    const raw = request.cookies?.['rm_guest_session_v1'];
    return this.payments.initiate({
      bookingCode,
      idempotencyKey,
      requestId: request.id,
      sessionToken: raw ? parseGuestSessionCookie(raw) : null,
    });
  }
}
