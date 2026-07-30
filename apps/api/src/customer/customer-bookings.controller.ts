import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Query,
  Req,
  Version,
} from '@nestjs/common';

import { CustomerSessionService } from '../auth/customer-session.service.js';
import {
  CustomerBookingNotFoundError,
  CustomerBookingService,
} from './customer-booking.service.js';

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
}

function clampLimit(rawLimit: string | undefined): number {
  if (rawLimit === undefined) return DEFAULT_LIMIT;
  const value = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}
