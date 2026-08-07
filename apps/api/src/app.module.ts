import { Module } from '@nestjs/common';
import type { createRoomAuth } from '@room/auth';
import { Reflector } from '@nestjs/core';
import type { ApiEnvironment } from '@room/config';

import { DatabaseProvider } from './database/database.provider.js';
import { AppDatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { API_ENVIRONMENT, ROOM_AUTH } from './auth/auth.providers.js';
import { HealthController } from './health/health.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminAccessController } from './admin/admin-access.controller.js';
import { AdminAccessService } from './admin/admin-access.service.js';
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
import { PricingPolicyEventWriter } from './pricing-policy/pricing-policy.events.js';
import {
  createOperationsV3PricingCatalogGate,
  OperationsV3PricingCatalogGate,
} from './pricing-policy/pricing-policy.gate.js';
import { PublishedPricingPolicyLookupService } from './pricing-policy/pricing-policy.lookup.service.js';
import { PricingPolicyRepository } from './pricing-policy/pricing-policy.repository.js';
import { PricingPolicyService } from './pricing-policy/pricing-policy.service.js';
import { PricingPolicyAdminController } from './pricing-policy/pricing-policy.admin.controller.js';
import {
  createMultiNightPricingGate,
  createMultiNightPublicGate,
  MultiNightPricingGate,
  MultiNightPublicGate,
} from './pricing-policy/multi-night.gate.js';
import { MultiNightOfferService } from './pricing/multi-night-offer.service.js';

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
    AdminAccessController,
    CatalogController,
    CouponController,
    RatePlanController,
    AvailabilityController,
    QuoteController,
    RecommendationController,
    NearbyAvailabilityController,
    PublicRoomCatalogController,
    PricingPolicyAdminController,
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
      provide: AdminAccessService,
      inject: [DatabaseProvider, ROOM_AUTH],
      useFactory: (database: DatabaseProvider, auth: ReturnType<typeof createRoomAuth>) =>
        new AdminAccessService(database.client, auth),
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
      inject: [DatabaseProvider, MultiNightOfferService],
      useFactory: (database: DatabaseProvider, multiNight: MultiNightOfferService) =>
        new AvailabilityService(new AvailabilityRepository(database.client), multiNight),
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
      inject: [DatabaseProvider, MultiNightOfferService],
      useFactory: (database: DatabaseProvider, multiNight: MultiNightOfferService) =>
        new QuoteService(new QuoteRepository(database.client), {
          couponRepository: new QuoteCouponRepository(database.client),
          multiNight,
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
    {
      provide: PricingPolicyRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) => new PricingPolicyRepository(database.client),
    },
    PricingPolicyEventWriter,
    {
      provide: MultiNightPricingGate,
      inject: [API_ENVIRONMENT],
      useFactory: createMultiNightPricingGate,
    },
    {
      provide: MultiNightPublicGate,
      inject: [API_ENVIRONMENT],
      useFactory: createMultiNightPublicGate,
    },
    {
      provide: OperationsV3PricingCatalogGate,
      inject: [API_ENVIRONMENT],
      useFactory: createOperationsV3PricingCatalogGate,
    },
    {
      provide: PricingPolicyService,
      inject: [DatabaseProvider, PricingPolicyRepository, PricingPolicyEventWriter],
      useFactory: (
        database: DatabaseProvider,
        repository: PricingPolicyRepository,
        events: PricingPolicyEventWriter,
      ) =>
        new PricingPolicyService(
          database.client as unknown as import('./pricing-policy/pricing-policy.service.js').PricingPolicyTransactionManager,
          repository,
          events,
        ),
    },
    {
      provide: PublishedPricingPolicyLookupService,
      inject: [OperationsV3PricingCatalogGate, PricingPolicyRepository],
      useFactory: (gate: OperationsV3PricingCatalogGate, repository: PricingPolicyRepository) =>
        new PublishedPricingPolicyLookupService(gate, repository),
    },
    {
      provide: MultiNightOfferService,
      inject: [
        DatabaseProvider,
        PublishedPricingPolicyLookupService,
        MultiNightPricingGate,
        MultiNightPublicGate,
      ],
      useFactory: (
        database: DatabaseProvider,
        lookup: PublishedPricingPolicyLookupService,
        pricingGate: MultiNightPricingGate,
        publicGate: MultiNightPublicGate,
      ) =>
        new MultiNightOfferService({
          database: database.client,
          lookup,
          pricingGate,
          publicGate,
        }),
    },
  ],
})
export class AppModule {}
