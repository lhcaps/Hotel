import {
  createPaymentAttempt,
  getOrCreatePaymentForBooking,
  PaymentCoreError,
} from '@room/booking';
import type { DatabasePool } from '@room/database';
import { Buffer } from 'node:buffer';

import { BookingDetailRepository } from '../../booking/repositories/booking-detail.repository.js';
import { GuestSessionService } from '../../booking/services/guest-session.service.js';
import { DatabaseProvider } from '../../database/database.provider.js';
import { PaymentInitiationError } from '../payment.errors.js';
import { VnpayAdapter } from '../providers/vnpay/vnpay.adapter.js';
import { PaymentProviderSettingsService } from './payment-provider-settings.service.js';
import { publishSimulatorBookingCodeMapping } from './payment-simulator-mapping.service.js';

export class VnpayPaymentInitiationService {
  public constructor(
    private readonly database: DatabaseProvider,
    private readonly bookings: BookingDetailRepository,
    private readonly sessions: GuestSessionService,
    private readonly adapter: VnpayAdapter | null,
    private readonly settings: PaymentProviderSettingsService,
  ) {}
  public async initiate(input: {
    readonly bookingCode: string;
    readonly sessionToken: Buffer | null;
    readonly idempotencyKey: string | undefined;
    readonly requestId: string;
  }) {
    if (!input.idempotencyKey?.trim())
      throw new PaymentInitiationError('PAYMENT_IDEMPOTENCY_REQUIRED');
    const booking = await this.bookings.findByBookingCodeForSession(input.bookingCode);
    if (!booking) throw new PaymentInitiationError('VNPAY_INITIATION_REJECTED');
    await this.sessions.requireForBooking(input.sessionToken, booking.bookingId, new Date());
    if (!this.adapter || !(await this.settings.isAvailable('VNPAY', booking.propertyId))) {
      throw new PaymentInitiationError('VNPAY_DISABLED');
    }
    try {
      const pool = this.database.pool as DatabasePool;
      const payment = await getOrCreatePaymentForBooking({
        pool,
        propertyId: booking.propertyId,
        bookingId: booking.bookingId,
        actor: { type: 'SYSTEM', requestId: input.requestId },
      });
      const attempt = await createPaymentAttempt({
        pool,
        propertyId: booking.propertyId,
        bookingId: booking.bookingId,
        provider: 'VNPAY',
        idempotencyKey: input.idempotencyKey,
        now: new Date(),
      });
      const checkout = await this.adapter.createCheckout({
        merchantOrderId: attempt.providerOrderId,
        amountVnd: attempt.amountVnd,
        currency: 'VND',
        returnUrl: '',
        webhookUrl: '',
        description: `Room booking ${booking.bookingCode}`,
        expiresAt: booking.holdExpiresAt ?? new Date(),
      });
      // Side-effect: in development, tell the local simulator which booking
      // code corresponds to the provider's orderId so the simulator's
      // browser-side redirect lands on the persistent booking page without
      // any test control-plane backRedirectUrl setup. VNPAY happens to use
      // the booking code as vnp_TxnRef so the legacy fallback also works;
      // pushing the explicit mapping makes that an implementation detail
      // rather than a contract.
      await publishSimulatorBookingCodeMapping({
        provider: 'vnpay',
        orderId: attempt.providerOrderId,
        bookingCode: booking.bookingCode,
      });
      return {
        paymentId: payment.id,
        paymentAttemptId: attempt.id,
        provider: 'VNPAY' as const,
        status: 'PENDING' as const,
        redirectUrl: checkout.redirectUrl,
        expiresAt: checkout.expiresAt,
      };
    } catch (error) {
      if (error instanceof PaymentCoreError)
        throw new PaymentInitiationError('VNPAY_INITIATION_REJECTED');
      throw error;
    }
  }
}
