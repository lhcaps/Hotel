import { Body, Controller, Inject, Param, Post, Req, Version } from '@nestjs/common';

import { CustomerSessionService } from '../auth/customer-session.service.js';
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
  ) {}

  @Post(':quoteId/bookings')
  @Version('1')
  public async issue(
    @Param('quoteId') quoteId: string,
    @Body() body: unknown,
    @Req() request: RequestWithCorrelation,
  ) {
    const customerUserId = await this.resolveOptionalCustomerUserId(request);
    return this.holds.issue(quoteId, body, request.id, customerUserId);
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
