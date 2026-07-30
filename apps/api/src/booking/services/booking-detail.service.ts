import { Buffer } from 'node:buffer';
import { maskEmailForDisplay } from '@room/booking';
import {
  bookingDetailResponseSchema,
  bookingHoldCouponSummarySchema,
  type BookingDetailResponse,
} from '@room/contracts';

import {
  type BookingDetailRecord,
  type BookingDetailRepository,
} from '../repositories/booking-detail.repository.js';
import { GuestSessionService } from './guest-session.service.js';

export class BookingNotFoundError extends Error {
  public readonly code = 'BOOKING_NOT_FOUND';
  public constructor() {
    super('Booking not found');
    this.name = 'BookingNotFoundError';
  }
}

function maskPhone(phoneE164: string): string {
  if (phoneE164.length <= 4) return phoneE164;
  return `${phoneE164.slice(0, 3)}••••${phoneE164.slice(-2)}`;
}

function toResponse(record: BookingDetailRecord, serverTime: Date): BookingDetailResponse {
  const coupon = record.coupon
    ? bookingHoldCouponSummarySchema.parse({
        code: record.coupon.code,
        discountType: record.coupon.discountType,
        grossAmountVnd: record.coupon.grossAmountVnd,
        discountAmountVnd: record.coupon.discountAmountVnd,
        finalAmountVnd: record.coupon.finalAmountVnd,
      })
    : undefined;
  return bookingDetailResponseSchema.parse({
    bookingCode: record.bookingCode,
    status: record.status,
    property: {
      code: record.propertyCode,
      name: record.propertyName,
      timezone: record.propertyTimezone,
    },
    roomType: {
      code: record.roomTypeCode,
      name: record.roomTypeName,
      maxOccupancy: record.maxOccupancy,
    },
    checkIn: record.checkIn.toISOString(),
    checkOut: record.checkOut.toISOString(),
    adults: record.adults,
    children: record.children,
    amountVnd: record.finalAmountVnd,
    currency: record.currency,
    holdExpiresAt: record.holdExpiresAt === null ? null : record.holdExpiresAt.toISOString(),
    contact: {
      fullName: record.fullName,
      emailMasked: maskEmailForDisplay(record.normalizedEmail),
      phoneMasked: maskPhone(record.normalizedPhoneE164),
    },
    ...(coupon !== undefined ? { coupon } : {}),
    serverTime: serverTime.toISOString(),
  });
}

export class BookingDetailService {
  public constructor(
    private readonly repository: BookingDetailRepository,
    private readonly session: GuestSessionService,
  ) {}

  public async getByBookingCode(
    bookingCode: string,
    sessionToken: Buffer | null,
    now: Date,
  ): Promise<BookingDetailResponse> {
    const record = await this.repository.findByBookingCodeForSession(bookingCode);
    if (record === null) {
      throw new BookingNotFoundError();
    }
    await this.session.requireForBooking(sessionToken, record.bookingId, now);
    return toResponse(record, now);
  }
}
