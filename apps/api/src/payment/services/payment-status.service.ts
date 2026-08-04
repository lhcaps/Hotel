import { Buffer } from 'node:buffer';
import { paymentStatusResponseSchema } from '@room/contracts';

import { BookingDetailRepository } from '../../booking/repositories/booking-detail.repository.js';
import { GuestSessionService } from '../../booking/services/guest-session.service.js';
import {
  PaymentStatusRepository,
  type PaymentStatusRecord,
} from '../repositories/payment-status.repository.js';
import { PaymentInitiationError } from '../payment.errors.js';

function amount(value: string | number | bigint): number {
  const normalized = typeof value === 'string' ? BigInt(value) : BigInt(value);
  if (normalized < 0n || normalized > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Payment amount is out of safe display range.');
  }
  return Number(normalized);
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Payment timestamp is invalid.');
  return parsed.toISOString();
}

function toResponse(record: PaymentStatusRecord) {
  const reviewRequired =
    record.paymentStatus === 'REVIEW_REQUIRED' || record.attemptStatus === 'REVIEW_REQUIRED';
  return paymentStatusResponseSchema.parse({
    provider: record.provider,
    paymentStatus: record.paymentStatus,
    attemptStatus: record.attemptStatus,
    bookingStatus: record.bookingStatus,
    amountVnd: amount(record.amountVnd),
    currency: record.currency,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    completedAt: iso(record.completedAt),
    reviewRequired,
    customerMessage: reviewRequired
      ? 'Payment requires review. Please contact the property.'
      : null,
  });
}

export class PaymentStatusService {
  public constructor(
    private readonly bookings: BookingDetailRepository,
    private readonly sessions: GuestSessionService,
    private readonly payments: PaymentStatusRepository,
  ) {}

  public async get(
    bookingCode: string,
    sessionToken: Buffer | null,
    now: Date,
    customerUserId?: string,
  ) {
    const booking = await this.bookings.findByBookingCodeForSession(bookingCode);
    if (booking === null) throw new PaymentInitiationError('VNPAY_INITIATION_REJECTED');
    if (customerUserId !== undefined) {
      if (booking.customerUserId !== customerUserId) {
        throw new PaymentInitiationError('VNPAY_INITIATION_REJECTED');
      }
    } else {
      await this.sessions.requireForBooking(sessionToken, booking.bookingId, now);
    }
    const payment = await this.payments.findByBookingId(booking.bookingId);
    if (payment === null) throw new Error('Booking disappeared while resolving payment status.');
    return toResponse(payment);
  }
}
