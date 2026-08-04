import { Buffer } from 'node:buffer';
import {
  maskEmailForDisplay,
  toCancellationPolicyDisplaySnapshot,
  type CancellationPolicySnapshot,
} from '@room/booking';
import {
  bookingDetailResponseSchema,
  bookingHoldCouponSummarySchema,
  bookingAccessPassResponseSchema,
  type BookingDetailResponse,
  type BookingAccessPassResponse,
} from '@room/contracts';

import {
  type BookingDetailRecord,
  type BookingDetailRepository,
} from '../repositories/booking-detail.repository.js';
import { GuestSessionService } from './guest-session.service.js';
import { BookingAccessPassError, BookingAccessPassService } from './booking-access-pass.service.js';

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
  const cancellationPolicy = readCancellationPolicySnapshot(record.cancellationPolicySnapshot);
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
    cancellationPolicy:
      cancellationPolicy === null ? null : toCancellationPolicyDisplaySnapshot(cancellationPolicy),
    ...(coupon !== undefined ? { coupon } : {}),
    serverTime: serverTime.toISOString(),
  });
}

function readCancellationPolicySnapshot(value: unknown): CancellationPolicySnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<CancellationPolicySnapshot>;
  if (
    candidate.code !== 'PEACENEST_STANDARD_V1' ||
    candidate.version !== 1 ||
    typeof candidate.timezone !== 'string' ||
    candidate.refundBasis !== 'PAID_AMOUNT' ||
    typeof candidate.capturedAt !== 'string' ||
    typeof candidate.checkIn !== 'string' ||
    typeof candidate.sevenDayDeadline !== 'string' ||
    typeof candidate.threeDayDeadline !== 'string'
  ) {
    return null;
  }
  return value as CancellationPolicySnapshot;
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

  public async getAccessPass(
    bookingCode: string,
    sessionToken: Buffer | null,
    now: Date,
    passes: BookingAccessPassService,
  ): Promise<BookingAccessPassResponse> {
    const record = await this.repository.findByBookingCodeForSession(bookingCode);
    if (record === null) throw new BookingNotFoundError();
    await this.session.requireForBooking(sessionToken, record.bookingId, now);
    if (record.status !== 'CONFIRMED' || record.accessPassRevokedAt !== null) {
      throw new BookingAccessPassError();
    }
    const expiresAt = new Date(record.checkOut.getTime() + 60 * 60 * 1000);
    const pass = passes.issue({
      bookingId: record.bookingId,
      version: record.accessPassVersion,
      expiresAt,
    });
    return bookingAccessPassResponseSchema.parse({
      bookingCode: record.bookingCode,
      expiresAt: expiresAt.toISOString(),
      svg: await passes.toSvg(pass),
    });
  }
}
