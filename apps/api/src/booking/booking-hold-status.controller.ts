import { Body, Controller, Inject, Post, Version } from '@nestjs/common';

import { BookingHoldStatusService } from './services/booking-hold-status.service.js';

@Controller('public/booking-holds')
export class BookingHoldStatusController {
  public constructor(
    @Inject(BookingHoldStatusService) private readonly status: BookingHoldStatusService,
  ) {}

  @Post('status')
  @Version('1')
  public getStatus(@Body() body: unknown) {
    return this.status.status(body, new Date());
  }
}
