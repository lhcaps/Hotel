import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DatabasePool } from '@room/database';
import { createRoomAuth } from '@room/auth';
import { requireApiEnvironment } from '@room/config';

import { AdminSessionService } from '../auth/admin-session.service.js';
import { createAdminSessionService, ROOM_AUTH } from '../auth/auth.providers.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { BookingModule } from '../booking/booking.module.js';
import { BookingDetailRepository } from '../booking/repositories/booking-detail.repository.js';
import { GuestSessionService } from '../booking/services/guest-session.service.js';
import { DatabaseProvider } from '../database/database.provider.js';
import { AppDatabaseModule } from '../database/database.module.js';
import { AdminPaymentReconciliationController } from './admin-payment-reconciliation.controller.js';
import {
  ADMIN_PAYMENT_RECONCILIATION_SERVICE,
  type AdminPaymentReconciliationService as AdminPaymentReconciliationServiceInterface,
} from './admin-payment-reconciliation.service.js';
import { MomoAdapter } from './providers/momo/momo.adapter.js';
import { loadMomoConfig } from './providers/momo/momo.config.js';
import { VnpayAdapter } from './providers/vnpay/vnpay.adapter.js';
import { loadVnpayConfig } from './providers/vnpay/vnpay.config.js';
import { MomoPaymentController } from './momo-payment.controller.js';
import { MomoWebhookController } from './momo-webhook.controller.js';
import { MomoReturnController } from './momo-return.controller.js';
import { MomoPaymentInitiationService } from './services/momo-payment-initiation.service.js';
import { VnpayPaymentInitiationService } from './services/vnpay-payment-initiation.service.js';
import { PaymentProviderSettingsService } from './services/payment-provider-settings.service.js';
import {
  AdminPaymentReconciliationService,
  createNoopAdminPaymentReconciliationServiceInjectionToken,
} from './services/admin-payment-reconciliation.service.js';
import { PaymentProviderController } from './payment-provider.controller.js';
import { AdminPaymentProviderController } from './admin-payment-provider.controller.js';
import { VnpayPaymentController } from './vnpay-payment.controller.js';
import { VnpayReturnController } from './vnpay-return.controller.js';
import { VnpayWebhookController } from './vnpay-webhook.controller.js';
import { PaymentStatusController } from './payment-status.controller.js';
import { AdminPaymentRepository } from './repositories/admin-payment.repository.js';
import { PaymentStatusRepository } from './repositories/payment-status.repository.js';
import { PaymentStatusService } from './services/payment-status.service.js';
import { MOMO_ADAPTER, VNPAY_ADAPTER } from './payment.tokens.js';

export { MOMO_ADAPTER, VNPAY_ADAPTER } from './payment.tokens.js';
export { ADMIN_PAYMENT_RECONCILIATION_SERVICE } from './admin-payment-reconciliation.service.js';
export { MomoPaymentInitiationService } from './services/momo-payment-initiation.service.js';
export { VnpayPaymentInitiationService } from './services/vnpay-payment-initiation.service.js';
export { PaymentStatusService } from './services/payment-status.service.js';

/**
 * Internal-only payment composition boundary. Provider adapters and every
 * HTTP routes are limited to the Phase 7D MoMo sandbox boundary.
 */
@Module({
  imports: [AppDatabaseModule, BookingModule],
  controllers: [
    MomoPaymentController,
    MomoWebhookController,
    MomoReturnController,
    VnpayPaymentController,
    VnpayWebhookController,
    VnpayReturnController,
    PaymentProviderController,
    AdminPaymentProviderController,
    AdminPaymentReconciliationController,
    PaymentStatusController,
  ],
  providers: [
    {
      provide: MOMO_ADAPTER,
      useFactory: (): MomoAdapter | null => {
        const config = loadMomoConfig(requireApiEnvironment());
        return config === null ? null : new MomoAdapter(config);
      },
    },
    Reflector,
    {
      provide: ROOM_AUTH,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) => {
        const environment = requireApiEnvironment();
        return createRoomAuth(database.client, {
          BETTER_AUTH_SECRET: environment.BETTER_AUTH_SECRET,
          WEB_ORIGIN: environment.WEB_ORIGIN,
          AUTH_BASE_URL: environment.AUTH_BASE_URL,
          NODE_ENV: environment.NODE_ENV,
          googleAuth: {
            enabled: environment.GOOGLE_AUTH_ENABLED,
            clientId: environment.GOOGLE_CLIENT_ID,
            clientSecret: environment.GOOGLE_CLIENT_SECRET,
            redirectUri: environment.GOOGLE_REDIRECT_URI ?? environment.GOOGLE_AUTH_BASE_URL,
          },
        });
      },
    },
    {
      provide: AdminSessionService,
      inject: [ROOM_AUTH, DatabaseProvider],
      useFactory: (auth: ReturnType<typeof createRoomAuth>, database: DatabaseProvider) =>
        createAdminSessionService(auth, database),
    },
    AdminPermissionGuard,
    {
      provide: MomoPaymentInitiationService,
      inject: [
        DatabaseProvider,
        BookingDetailRepository,
        GuestSessionService,
        MOMO_ADAPTER,
        PaymentProviderSettingsService,
      ],
      useFactory: (
        database: DatabaseProvider,
        bookings: BookingDetailRepository,
        sessions: GuestSessionService,
        adapter: MomoAdapter | null,
        settings: PaymentProviderSettingsService,
      ) => new MomoPaymentInitiationService(database, bookings, sessions, adapter, settings),
    },
    {
      provide: PaymentProviderSettingsService,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new PaymentProviderSettingsService(database.client, requireApiEnvironment()),
    },
    {
      provide: PaymentStatusRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) => new PaymentStatusRepository(database.client),
    },
    {
      provide: PaymentStatusService,
      inject: [BookingDetailRepository, GuestSessionService, PaymentStatusRepository],
      useFactory: (
        bookings: BookingDetailRepository,
        sessions: GuestSessionService,
        payments: PaymentStatusRepository,
      ) => new PaymentStatusService(bookings, sessions, payments),
    },
    {
      provide: VNPAY_ADAPTER,
      useFactory: (): VnpayAdapter | null => {
        const config = loadVnpayConfig(requireApiEnvironment());
        return config === null ? null : new VnpayAdapter(config);
      },
    },
    {
      provide: VnpayPaymentInitiationService,
      inject: [
        DatabaseProvider,
        BookingDetailRepository,
        GuestSessionService,
        VNPAY_ADAPTER,
        PaymentProviderSettingsService,
      ],
      useFactory: (
        database: DatabaseProvider,
        bookings: BookingDetailRepository,
        sessions: GuestSessionService,
        adapter: VnpayAdapter | null,
        settings: PaymentProviderSettingsService,
      ) => new VnpayPaymentInitiationService(database, bookings, sessions, adapter, settings),
    },
    {
      provide: AdminPaymentRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) => {
        const environment = requireApiEnvironment();
        return new AdminPaymentRepository(database.pool as unknown as DatabasePool, {
          momoEnvironment: environment.MOMO_ENVIRONMENT,
          vnpayEnvironment: environment.VNPAY_ENVIRONMENT,
          momoEnabled: environment.MOMO_ENABLED,
          vnpayEnabled: environment.VNPAY_ENABLED,
        });
      },
    },
    createNoopAdminPaymentReconciliationServiceInjectionToken(),
    {
      provide: AdminPaymentReconciliationService,
      inject: [AdminPaymentRepository, ADMIN_PAYMENT_RECONCILIATION_SERVICE],
      useFactory: (
        repository: AdminPaymentRepository,
        reconciliation: AdminPaymentReconciliationServiceInterface,
      ) => new AdminPaymentReconciliationService(repository, reconciliation),
    },
  ],
  exports: [MomoPaymentInitiationService, VnpayPaymentInitiationService, PaymentStatusService],
})
export class PaymentModule {}
