import {
  Controller,
  Body,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Version,
} from '@nestjs/common';

import { CustomerSessionService } from '../auth/customer-session.service.js';
import { MomoPaymentInitiationService } from '../payment/services/momo-payment-initiation.service.js';
import { VnpayPaymentInitiationService } from '../payment/services/vnpay-payment-initiation.service.js';
import { PaymentStatusService } from '../payment/services/payment-status.service.js';
import {
  CustomerBookingNotFoundError,
  CustomerBookingService,
} from './customer-booking.service.js';
import { BookingAccessPassError } from '../booking/services/booking-access-pass.service.js';

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly id: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Controller('customer/bookings')
export class CustomerBookingsController {
  public constructor(
    @Inject(CustomerBookingService) private readonly bookings: CustomerBookingService,
    @Inject(CustomerSessionService) private readonly sessions: CustomerSessionService,
    @Inject(MomoPaymentInitiationService)
    private readonly momoPayments: MomoPaymentInitiationService,
    @Inject(VnpayPaymentInitiationService)
    private readonly vnpayPayments: VnpayPaymentInitiationService,
    @Inject(PaymentStatusService) private readonly paymentStatus: PaymentStatusService,
  ) {}

  @Get()
  @Version('1')
  public async list(
    @Req() request: RequestLike,
    @Query('limit') rawLimit?: string,
    @Query('cursor') _cursor?: string,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    const limit = clampLimit(rawLimit);
    return this.bookings.listForCustomer(actor.userId, { limit });
  }

  @Get(':bookingCode')
  @Version('1')
  public async detail(@Req() request: RequestLike, @Param('bookingCode') bookingCode: string) {
    const actor = await this.sessions.requireCustomer(request);
    try {
      return await this.bookings.detailForCustomer(actor.userId, bookingCode);
    } catch (error) {
      if (error instanceof CustomerBookingNotFoundError) {
        throw new HttpException({ code: 'BOOKING_NOT_FOUND' }, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  @Post(':bookingCode/cancellation-preview')
  @Version('1')
  public async cancellationPreview(
    @Req() request: RequestLike,
    @Param('bookingCode') bookingCode: string,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    return this.bookings.cancellationPreviewForCustomer(actor.userId, bookingCode);
  }

  @Post(':bookingCode/alteration-preview')
  @Version('1')
  public async alterationPreview(
    @Req() request: RequestLike,
    @Param('bookingCode') bookingCode: string,
    @Body() body: unknown,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    return this.bookings.alterationPreviewForCustomer(actor.userId, bookingCode, body);
  }

  @Get(':bookingCode/access-pass')
  @Version('1')
  public async accessPass(@Req() request: RequestLike, @Param('bookingCode') bookingCode: string) {
    const actor = await this.sessions.requireCustomer(request);
    try {
      return await this.bookings.accessPassForCustomer(actor.userId, bookingCode);
    } catch (error) {
      if (
        error instanceof CustomerBookingNotFoundError ||
        error instanceof BookingAccessPassError
      ) {
        throw new HttpException({ code: 'BOOKING_ACCESS_PASS_INVALID' }, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  @Post(':bookingCode/payments/momo/attempts')
  @Version('1')
  public async initiateMomo(
    @Req() request: RequestLike,
    @Param('bookingCode') bookingCode: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    return this.momoPayments.initiate({
      bookingCode,
      customerUserId: actor.userId,
      sessionToken: null,
      idempotencyKey,
      requestId: request.id,
    });
  }

  @Post(':bookingCode/payments/vnpay/attempts')
  @Version('1')
  public async initiateVnpay(
    @Req() request: RequestLike,
    @Param('bookingCode') bookingCode: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    return this.vnpayPayments.initiate({
      bookingCode,
      customerUserId: actor.userId,
      sessionToken: null,
      idempotencyKey,
      requestId: request.id,
    });
  }

  @Get(':bookingCode/payment')
  @Version('1')
  public async payment(@Req() request: RequestLike, @Param('bookingCode') bookingCode: string) {
    const actor = await this.sessions.requireCustomer(request);
    return this.paymentStatus.get(bookingCode, null, new Date(), actor.userId);
  }
}

function clampLimit(rawLimit: string | undefined): number {
  if (rawLimit === undefined) return DEFAULT_LIMIT;
  const value = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}
