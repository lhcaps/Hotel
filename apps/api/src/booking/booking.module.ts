import { Module } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { requireApiEnvironment } from '@room/config';
import { type DatabasePool } from '@room/database';

import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PropertyContextService } from '../catalog/property-context.service.js';
import { AdminBookingOperationsController } from './admin-booking-operations.controller.js';
import { RoomOperationsController } from './room-operations.controller.js';
import { RoomOperationsRepository } from './repositories/room-operations.repository.js';
import { RoomOperationsService } from './services/room-operations.service.js';
import { BookingDetailController } from './booking-detail.controller.js';
import { BookingHoldController } from './booking-hold.controller.js';
import { BookingHoldStatusController } from './booking-hold-status.controller.js';
import { GuestAccessLogoutController } from './guest-access-logout.controller.js';
import { GuestAccessOtpController } from './guest-access-otp.controller.js';
import { AdminBookingRepository } from './repositories/admin-booking.repository.js';
import { CouponDeliveryRepository } from './repositories/coupon-delivery.repository.js';
import { BookingDetailRepository } from './repositories/booking-detail.repository.js';
import {
  GuestAccessRepository,
  type GuestAccessRateLimitConfig,
} from './repositories/guest-access.repository.js';
import { GuestSessionRepository } from './repositories/guest-session.repository.js';
import { AdminBookingLifecycleService } from './services/admin-booking-lifecycle.service.js';
import { AdminBookingAccessPassService } from './services/admin-booking-access-pass.service.js';
import { BookingDetailService } from './services/booking-detail.service.js';
import { BookingAccessPassService } from './services/booking-access-pass.service.js';
import { BookingHoldService } from './services/booking-hold.service.js';
import { BookingHoldStatusService } from './services/booking-hold-status.service.js';
import { GuestAccessOtpRequestService } from './services/guest-access-otp-request.service.js';
import { GuestAccessOtpVerifyService } from './services/guest-access-otp-verify.service.js';
import { GuestLogoutService } from './services/guest-logout.service.js';
import { CouponDeliveryService } from './services/coupon-delivery.service.js';
import { GuestSessionService } from './services/guest-session.service.js';
import { loadGuestSecrets, type GuestSecrets } from './secrets.js';

export const GUEST_SECRETS = Symbol('GUEST_SECRETS');
export const GUEST_RATE_LIMIT_CONFIG = Symbol('GUEST_RATE_LIMIT_CONFIG');

@Module({
  imports: [AppDatabaseModule, AuthModule],
  controllers: [
    BookingHoldController,
    GuestAccessOtpController,
    BookingDetailController,
    BookingHoldStatusController,
    GuestAccessLogoutController,
    AdminBookingOperationsController,
    RoomOperationsController,
  ],
  providers: [
    {
      provide: GUEST_SECRETS,
      useFactory: (): GuestSecrets =>
        loadGuestSecrets({
          GUEST_OTP_SECRET: process.env.GUEST_OTP_SECRET ?? '',
          GUEST_CHALLENGE_REF_SECRET: process.env.GUEST_CHALLENGE_REF_SECRET ?? '',
          GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET ?? '',
          BOOKING_IP_DIGEST_SECRET: process.env.BOOKING_IP_DIGEST_SECRET ?? '',
        }),
    },
    {
      provide: GUEST_RATE_LIMIT_CONFIG,
      useFactory: (): GuestAccessRateLimitConfig => ({
        requestWindowMs: Number(process.env.GUEST_OTP_REQUEST_WINDOW_MS ?? 900_000),
        requestLimit: Number(process.env.GUEST_OTP_REQUEST_LIMIT ?? 3),
        ipWindowMs: Number(process.env.GUEST_OTP_IP_WINDOW_MS ?? 3_600_000),
        ipLimit: Number(process.env.GUEST_OTP_IP_LIMIT ?? 20),
        resendCooldownMs: Number(process.env.GUEST_OTP_RESEND_COOLDOWN_MS ?? 60_000),
        otpTtlMs: Number(process.env.GUEST_OTP_TTL_MS ?? 600_000),
        sessionTtlMs: Number(process.env.GUEST_SESSION_TTL_MS ?? 1_800_000),
      }),
    },
    {
      provide: GuestAccessRepository,
      inject: [DatabaseProvider, GUEST_SECRETS, GUEST_RATE_LIMIT_CONFIG],
      useFactory: (
        database: DatabaseProvider,
        secrets: GuestSecrets,
        config: GuestAccessRateLimitConfig,
      ): GuestAccessRepository =>
        new GuestAccessRepository(
          database.pool as unknown as DatabasePool,
          database.client,
          secrets,
          config,
        ),
    },
    {
      provide: GuestSessionRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): GuestSessionRepository =>
        new GuestSessionRepository(database.pool as unknown as DatabasePool),
    },
    {
      provide: BookingDetailRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): BookingDetailRepository =>
        new BookingDetailRepository(database.client),
    },
    {
      provide: BookingHoldService,
      inject: [DatabaseProvider, GUEST_SECRETS],
      useFactory: (database: DatabaseProvider, secrets: GuestSecrets): BookingHoldService =>
        new BookingHoldService({
          pool: database.pool as unknown as DatabasePool,
          holdDurationMs: Number(process.env.BOOKING_HOLD_DURATION_MS ?? 900_000),
          ipDigestSecret: secrets.ipDigestSecret,
        }),
    },
    {
      provide: GuestSessionService,
      inject: [GuestSessionRepository, GUEST_SECRETS],
      useFactory: (
        repository: GuestSessionRepository,
        secrets: GuestSecrets,
      ): GuestSessionService => new GuestSessionService(repository, secrets),
    },
    {
      provide: GuestAccessOtpRequestService,
      inject: [GuestAccessRepository, GUEST_SECRETS, GUEST_RATE_LIMIT_CONFIG],
      useFactory: (
        repository: GuestAccessRepository,
        secrets: GuestSecrets,
        config: GuestAccessRateLimitConfig,
      ): GuestAccessOtpRequestService =>
        new GuestAccessOtpRequestService(repository, secrets, config),
    },
    {
      provide: GuestAccessOtpVerifyService,
      inject: [GuestAccessRepository, GUEST_SECRETS],
      useFactory: (
        repository: GuestAccessRepository,
        secrets: GuestSecrets,
      ): GuestAccessOtpVerifyService => new GuestAccessOtpVerifyService(repository, secrets),
    },
    {
      provide: BookingDetailService,
      inject: [BookingDetailRepository, GuestSessionService],
      useFactory: (
        repository: BookingDetailRepository,
        session: GuestSessionService,
      ): BookingDetailService => new BookingDetailService(repository, session),
    },
    {
      provide: BookingAccessPassService,
      useFactory: (): BookingAccessPassService =>
        new BookingAccessPassService(
          Buffer.from(requireApiEnvironment().BOOKING_ACCESS_QR_SECRET, 'utf8'),
        ),
    },
    {
      provide: BookingHoldStatusService,
      inject: [DatabaseProvider, GUEST_SECRETS],
      useFactory: (database: DatabaseProvider, secrets: GuestSecrets): BookingHoldStatusService =>
        new BookingHoldStatusService(database.client, secrets),
    },
    {
      provide: GuestLogoutService,
      inject: [GuestAccessRepository, GuestSessionService],
      useFactory: (
        repository: GuestAccessRepository,
        session: GuestSessionService,
      ): GuestLogoutService => new GuestLogoutService(repository, session),
    },
    {
      provide: PropertyContextService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): PropertyContextService =>
        new PropertyContextService(database.client),
    },
    {
      provide: AdminBookingRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): AdminBookingRepository =>
        new AdminBookingRepository(database.pool as unknown as DatabasePool),
    },
    {
      provide: RoomOperationsRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): RoomOperationsRepository =>
        new RoomOperationsRepository(database.pool as unknown as DatabasePool),
    },
    {
      provide: RoomOperationsService,
      inject: [RoomOperationsRepository],
      useFactory: (repository: RoomOperationsRepository): RoomOperationsService =>
        new RoomOperationsService(repository),
    },
    {
      provide: AdminBookingLifecycleService,
      inject: [DatabaseProvider, AdminBookingRepository],
      useFactory: (
        database: DatabaseProvider,
        repository: AdminBookingRepository,
      ): AdminBookingLifecycleService =>
        new AdminBookingLifecycleService(database.pool as unknown as DatabasePool, repository),
    },
    {
      provide: AdminBookingAccessPassService,
      inject: [BookingAccessPassService, BookingDetailRepository],
      useFactory: (
        passes: BookingAccessPassService,
        bookings: BookingDetailRepository,
      ): AdminBookingAccessPassService => new AdminBookingAccessPassService(passes, bookings),
    },
    {
      provide: CouponDeliveryService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider): CouponDeliveryService =>
        new CouponDeliveryService(
          new CouponDeliveryRepository(database.pool as unknown as DatabasePool),
        ),
    },
  ],
  exports: [
    BookingDetailRepository,
    GuestSessionService,
    AdminBookingLifecycleService,
    AdminBookingRepository,
    PropertyContextService,
  ],
})
export class BookingModule {}
