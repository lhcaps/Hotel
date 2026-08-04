import { Module } from '@nestjs/common';

import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BookingModule } from '../booking/booking.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { BookingAccessPassService } from '../booking/services/booking-access-pass.service.js';
import { CouponRepository as QuoteCouponRepository } from '../pricing/coupon.repository.js';
import { QuoteRepository } from '../pricing/quote.repository.js';
import { QuoteService } from '../pricing/quote.service.js';
import { ClaimBookingController } from './claim-booking.controller.js';
import { ClaimBookingService } from './claim-booking.service.js';
import { CustomerAuditAdapter } from './customer-audit.adapter.js';
import { CustomerBookingService } from './customer-booking.service.js';
import { CustomerBookingsController } from './customer-bookings.controller.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';

export const CUSTOMER_AUDIT_ADAPTER = Symbol('CUSTOMER_AUDIT_ADAPTER');

@Module({
  imports: [AppDatabaseModule, AuthModule, BookingModule, PaymentModule],
  controllers: [CustomerProfileController, ClaimBookingController, CustomerBookingsController],
  providers: [
    {
      provide: CUSTOMER_AUDIT_ADAPTER,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): CustomerAuditAdapter =>
        new CustomerAuditAdapter(database.client),
    },
    {
      provide: CustomerProfileService,
      inject: [DatabaseProvider, CUSTOMER_AUDIT_ADAPTER],
      useFactory: (
        database: DatabaseProvider,
        audit: CustomerAuditAdapter,
      ): CustomerProfileService => new CustomerProfileService(database.client, audit),
    },
    {
      provide: ClaimBookingService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): ClaimBookingService =>
        new ClaimBookingService({ database: database.client }),
    },
    {
      provide: CustomerBookingService,
      inject: [DatabaseProvider, BookingAccessPassService],
      useFactory: (
        database: DatabaseProvider,
        accessPasses: BookingAccessPassService,
      ): CustomerBookingService =>
        new CustomerBookingService(
          database.client,
          new QuoteService(new QuoteRepository(database.client), {
            couponRepository: new QuoteCouponRepository(database.client),
          }),
          accessPasses,
        ),
    },
  ],
  exports: [CustomerProfileService, ClaimBookingService, CustomerBookingService],
})
export class CustomerModule {}
