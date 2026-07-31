import { Buffer } from 'node:buffer';
import {
  createPaymentAttempt,
  getOrCreatePaymentForBooking,
  markPaymentAttemptInitiationUnknown,
  PaymentCoreError,
} from '@room/booking';
import type { DatabasePool } from '@room/database';

import { DatabaseProvider } from '../../database/database.provider.js';
import { BookingDetailRepository } from '../../booking/repositories/booking-detail.repository.js';
import {
  GuestSessionService,
  type AuthenticatedSession,
} from '../../booking/services/guest-session.service.js';
import { MomoAdapter } from '../providers/momo/momo.adapter.js';
import { MomoAdapterError } from '../providers/momo/momo.errors.js';
import { PaymentInitiationError } from '../payment.errors.js';
import { PaymentProviderSettingsService } from './payment-provider-settings.service.js';
import { publishSimulatorBookingCodeMapping } from './payment-simulator-mapping.service.js';

export interface InitiateMomoPaymentInput {
  readonly bookingCode: string;
  readonly sessionToken: Buffer | null;
  readonly idempotencyKey: string | undefined;
  readonly requestId: string;
}

export interface InitiateMomoPaymentResult {
  readonly paymentId: string;
  readonly paymentAttemptId: string;
  readonly provider: 'MOMO';
  readonly status: 'PENDING';
  readonly redirectUrl: string;
  readonly expiresAt: Date;
}

export class MomoPaymentInitiationService {
  public constructor(
    private readonly database: DatabaseProvider,
    private readonly bookings: BookingDetailRepository,
    private readonly sessions: GuestSessionService,
    private readonly adapter: MomoAdapter | null,
    private readonly settings: PaymentProviderSettingsService,
  ) {}

  public async initiate(input: InitiateMomoPaymentInput): Promise<InitiateMomoPaymentResult> {
    if (input.idempotencyKey === undefined || input.idempotencyKey.trim() === '') {
      throw new PaymentInitiationError('PAYMENT_IDEMPOTENCY_REQUIRED');
    }
    const booking = await this.bookings.findByBookingCodeForSession(input.bookingCode);
    if (booking === null) throw new PaymentInitiationError('MOMO_INITIATION_REJECTED');
    await this.requireBookingSession(input.sessionToken, booking.bookingId);
    if (this.adapter === null || !(await this.settings.isAvailable('MOMO', booking.propertyId))) {
      throw new PaymentInitiationError('MOMO_DISABLED');
    }
    const pool = this.database.pool as DatabasePool;
    let payment: Awaited<ReturnType<typeof getOrCreatePaymentForBooking>>;
    let attempt: Awaited<ReturnType<typeof createPaymentAttempt>>;
    try {
      payment = await getOrCreatePaymentForBooking({
        pool,
        propertyId: booking.propertyId,
        bookingId: booking.bookingId,
        actor: { type: 'SYSTEM', requestId: input.requestId },
      });
      attempt = await createPaymentAttempt({
        pool,
        propertyId: booking.propertyId,
        bookingId: booking.bookingId,
        provider: 'MOMO',
        idempotencyKey: input.idempotencyKey,
        now: new Date(),
      });
    } catch (error) {
      if (error instanceof PaymentCoreError) {
        throw new PaymentInitiationError('MOMO_INITIATION_REJECTED');
      }
      throw error;
    }
    try {
      const checkout = await this.adapter.createCheckout({
        merchantOrderId: attempt.providerOrderId,
        amountVnd: attempt.amountVnd,
        currency: 'VND',
        returnUrl: '',
        webhookUrl: '',
        description: `Room booking ${booking.bookingCode}`,
        expiresAt: booking.holdExpiresAt ?? new Date(),
      });
      if (checkout.providerOrderId !== attempt.providerOrderId) {
        throw new PaymentInitiationError('MOMO_INITIATION_REJECTED');
      }
      // Side-effect: in development, tell the local simulator which booking
      // code corresponds to the provider's orderId so the simulator's
      // browser-side redirect lands on the persistent booking page without
      // any test control-plane backRedirectUrl setup. The simulator refuses
      // any non-loopback base, so production environments (which never
      // start the simulator) remain unaffected.
      await publishSimulatorBookingCodeMapping({
        provider: 'momo',
        orderId: attempt.providerOrderId,
        bookingCode: booking.bookingCode,
      });
      return {
        paymentId: payment.id,
        paymentAttemptId: attempt.id,
        provider: 'MOMO',
        status: 'PENDING',
        redirectUrl: checkout.redirectUrl,
        expiresAt: checkout.expiresAt,
      };
    } catch (error) {
      if (error instanceof MomoAdapterError) {
        if (error.code !== 'MOMO_INITIATION_REJECTED') {
          await markPaymentAttemptInitiationUnknown({
            pool,
            provider: 'MOMO',
            providerOrderId: attempt.providerOrderId,
            requestId: input.requestId,
          });
          throw new PaymentInitiationError('MOMO_INITIATION_OUTCOME_UNKNOWN');
        }
        throw new PaymentInitiationError('MOMO_INITIATION_REJECTED');
      }
      throw error;
    }
  }

  private async requireBookingSession(
    token: Buffer | null,
    bookingId: string,
  ): Promise<AuthenticatedSession> {
    return this.sessions.requireForBooking(token, bookingId, new Date());
  }
}
