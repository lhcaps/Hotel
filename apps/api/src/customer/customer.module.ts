import { Module } from '@nestjs/common';

import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClaimBookingController } from './claim-booking.controller.js';
import { ClaimBookingService } from './claim-booking.service.js';
import { CustomerAuditAdapter } from './customer-audit.adapter.js';
import { CustomerBookingService } from './customer-booking.service.js';
import { CustomerBookingsController } from './customer-bookings.controller.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';

export const CUSTOMER_AUDIT_ADAPTER = Symbol('CUSTOMER_AUDIT_ADAPTER');

@Module({
  imports: [AppDatabaseModule, AuthModule],
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
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): CustomerBookingService =>
        new CustomerBookingService(database.client),
    },
  ],
  exports: [CustomerProfileService, ClaimBookingService, CustomerBookingService],
})
export class CustomerModule {}
