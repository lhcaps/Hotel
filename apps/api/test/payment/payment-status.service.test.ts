import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import { PaymentStatusService } from '../../src/payment/services/payment-status.service.js';

const booking = {
  bookingId: '4cb8c9be-4088-490d-b1dd-3e448f92f3bb',
  propertyId: '8f622623-e576-4b80-a81c-19a32c8da545',
  bookingCode: 'RM-PAYMENT-STATUS',
};

describe('PaymentStatusService', () => {
  it('reads only persisted payment state after the booking-scoped guest session is verified', async () => {
    const sessions = { requireForBooking: vi.fn().mockResolvedValue(undefined) };
    const payments = {
      findByBookingId: vi.fn().mockResolvedValue({
        provider: 'VNPAY',
        paymentStatus: 'REVIEW_REQUIRED',
        attemptStatus: 'REVIEW_REQUIRED',
        bookingStatus: 'HOLD',
        amountVnd: '359000',
        currency: 'VND',
        createdAt: new Date('2026-07-26T00:00:00.000Z'),
        updatedAt: new Date('2026-07-26T00:01:00.000Z'),
        completedAt: new Date('2026-07-26T00:01:00.000Z'),
      }),
    };
    const service = new PaymentStatusService(
      { findByBookingCodeForSession: vi.fn().mockResolvedValue(booking) } as never,
      sessions as never,
      payments as never,
    );

    await expect(
      service.get(
        booking.bookingCode,
        Buffer.from('session', 'utf8'),
        new Date('2026-07-26T00:02:00.000Z'),
      ),
    ).resolves.toMatchObject({
      provider: 'VNPAY',
      paymentStatus: 'REVIEW_REQUIRED',
      bookingStatus: 'HOLD',
      amountVnd: 359000,
      reviewRequired: true,
      customerMessage: 'Payment requires review. Please contact the property.',
    });
    expect(sessions.requireForBooking).toHaveBeenCalledWith(
      Buffer.from('session', 'utf8'),
      booking.bookingId,
      expect.any(Date),
    );
    expect(payments.findByBookingId).toHaveBeenCalledWith(booking.bookingId);
  });

  it('keeps the settled payment summary readable after check-in', async () => {
    const sessions = { requireForBooking: vi.fn().mockResolvedValue(undefined) };
    const payments = {
      findByBookingId: vi.fn().mockResolvedValue({
        provider: 'MOMO',
        paymentStatus: 'SUCCEEDED',
        attemptStatus: 'SUCCEEDED',
        bookingStatus: 'CHECKED_IN',
        amountVnd: '359000',
        currency: 'VND',
        createdAt: new Date('2026-07-26T00:00:00.000Z'),
        updatedAt: new Date('2026-07-26T00:01:00.000Z'),
        completedAt: new Date('2026-07-26T00:01:00.000Z'),
      }),
    };
    const service = new PaymentStatusService(
      { findByBookingCodeForSession: vi.fn().mockResolvedValue(booking) } as never,
      sessions as never,
      payments as never,
    );

    await expect(
      service.get(booking.bookingCode, Buffer.alloc(32), new Date()),
    ).resolves.toMatchObject({
      bookingStatus: 'CHECKED_IN',
      paymentStatus: 'SUCCEEDED',
    });
  });
});
