import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiEnvironment } from '@room/config';

import { DatabaseProvider } from './database/database.provider.js';
import { AppDatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { API_ENVIRONMENT } from './auth/auth.providers.js';
import { HealthController } from './health/health.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { AuditRepository } from './catalog/audit.repository.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { CatalogRepository } from './catalog/catalog.repository.js';
import { CatalogService } from './catalog/catalog.service.js';
import { CouponController } from './coupons/coupon.controller.js';
import { CouponRepository } from './coupons/coupon.repository.js';
import { CouponService } from './coupons/coupon.service.js';
import { createRedisProbe, HealthService } from './health/health.service.js';
import { RatePlanController } from './pricing/rate-plan.controller.js';
import { RatePlanRepository } from './pricing/rate-plan.repository.js';
import { RatePlanService } from './pricing/rate-plan.service.js';
import { AvailabilityController } from './pricing/availability.controller.js';
import { AvailabilityRepository } from './pricing/availability.repository.js';
import { AvailabilityService } from './pricing/availability.service.js';
import { NearbyAvailabilityController } from './pricing/nearby-availability.controller.js';
import { NearbyAvailabilityRepository } from './pricing/nearby-availability.repository.js';
import { NearbyAvailabilityService } from './pricing/nearby-availability.service.js';
import { QuoteController } from './pricing/quote.controller.js';
import { QuoteRepository } from './pricing/quote.repository.js';
import { QuoteService } from './pricing/quote.service.js';
import { CouponRepository as QuoteCouponRepository } from './pricing/coupon.repository.js';
import { RecommendationController } from './pricing/recommendation.controller.js';
import { PublicRoomCatalogController } from './public-catalog/public-room-catalog.controller.js';
import { PublicRoomCatalogRepository } from './public-catalog/public-room-catalog.repository.js';
import { PublicRoomCatalogService } from './public-catalog/public-room-catalog.service.js';
import { BookingModule } from './booking/booking.module.js';
import { CustomerModule } from './customer/customer.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { ReportingModule } from './reporting/reporting.module.js';

@Module({
  imports: [
    AppDatabaseModule,
    AuthModule,
    BookingModule,
    CustomerModule,
    PaymentModule,
    ReportingModule,
  ],
  controllers: [
    HealthController,
    AdminController,
    CatalogController,
    CouponController,
    RatePlanController,
    AvailabilityController,
    QuoteController,
    RecommendationController,
    NearbyAvailabilityController,
    PublicRoomCatalogController,
  ],
  providers: [
    Reflector,
    {
      provide: CatalogService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new CatalogService(
          database.client,
          new CatalogRepository(database.client),
          new AuditRepository(),
        ),
    },
    {
      provide: CouponService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new CouponService(
          database.client,
          new CouponRepository(database.client),
          new AuditRepository(),
        ),
    },
    {
      provide: HealthService,
      inject: [API_ENVIRONMENT, DatabaseProvider],
      useFactory: (environment: ApiEnvironment, database: DatabaseProvider) =>
        new HealthService(environment, database, createRedisProbe(environment)),
    },
    {
      provide: RatePlanService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new RatePlanService(
          database.client,
          new RatePlanRepository(database.client),
          new AuditRepository(),
        ),
    },
    {
      provide: AvailabilityService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new AvailabilityService(new AvailabilityRepository(database.client)),
    },
    {
      provide: NearbyAvailabilityService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new NearbyAvailabilityService(new NearbyAvailabilityRepository(database.client)),
    },
    {
      provide: PublicRoomCatalogService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new PublicRoomCatalogService(new PublicRoomCatalogRepository(database.client)),
    },
    {
      provide: QuoteService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new QuoteService(new QuoteRepository(database.client), {
          couponRepository: new QuoteCouponRepository(database.client),
        }),
    },
    {
      provide: 'RecommendationOptions',
      useValue: {
        couponPreviewer: undefined,
      },
    },
    {
      provide: 'DatabaseClient',
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) => database.client,
    },
  ],
})
export class AppModule {}
