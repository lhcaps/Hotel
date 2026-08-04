import { bookings, eq, payments, roomTypes, type DatabaseClient, sql } from '@room/database';
import {
  customerAlterationPreviewRequestSchema,
  customerAlterationPreviewSchema,
  customerBookingDetailSchema,
  customerCancellationPreviewSchema,
  bookingAccessPassResponseSchema,
  type BookingAccessPassResponse,
} from '@room/contracts';

import { QuoteService } from '../pricing/quote.service.js';
import {
  BookingAccessPassError,
  BookingAccessPassService,
} from '../booking/services/booking-access-pass.service.js';

export interface CustomerBookingSummary {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly currency: string;
  readonly finalAmountVnd: string;
  readonly createdAt: string;
}

export interface CustomerBookingListResult {
  readonly items: readonly CustomerBookingSummary[];
  readonly nextCursor: string | null;
}

export interface CustomerBookingDetail {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly currency: string;
  readonly grossAmountVnd: string;
  readonly discountAmountVnd: string;
  readonly finalAmountVnd: string;
  readonly paymentStatus: string;
  readonly roomType: { readonly id: string; readonly name: string };
  readonly offer: { readonly code: string; readonly label: string } | null;
  readonly createdAt: string;
}

export class CustomerBookingNotFoundError extends Error {
  public constructor() {
    super('Booking not found for this CUSTOMER');
    this.name = 'CustomerBookingNotFoundError';
  }
}

export class CustomerBookingService {
  public constructor(
    private readonly database: DatabaseClient,
    private readonly quotes?: QuoteService,
    private readonly accessPasses?: BookingAccessPassService,
  ) {}

  public async listForCustomer(
    userId: string,
    options: { limit: number },
  ): Promise<CustomerBookingListResult> {
    const rows = await this.database
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        currency: bookings.currency,
        finalAmountVnd: bookings.finalAmountVnd,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .where(eq(bookings.customerUserId, userId))
      .orderBy(sql`${bookings.createdAt} DESC`, sql`${bookings.id} DESC`)
      .limit(options.limit + 1);
    const items = rows.slice(0, options.limit).map((row) => ({
      bookingId: row.id,
      bookingCode: row.bookingCode,
      status: row.status,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      currency: row.currency,
      finalAmountVnd: row.finalAmountVnd.toString(),
      createdAt: row.createdAt.toISOString(),
    }));
    const hasMore = rows.length > options.limit;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last !== undefined ? `${last.createdAt}|${last.bookingId}` : null;
    return { items, nextCursor };
  }

  public async detailForCustomer(
    userId: string,
    bookingCode: string,
  ): Promise<CustomerBookingDetail> {
    const bookingRows = await this.database
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        currency: bookings.currency,
        grossAmountVnd: bookings.grossAmountVnd,
        discountAmountVnd: bookings.discountAmountVnd,
        finalAmountVnd: bookings.finalAmountVnd,
        roomTypeId: roomTypes.id,
        roomTypeName: roomTypes.name,
        priceSnapshot: bookings.priceSnapshot,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(
        sql`${bookings.bookingCode} = ${bookingCode} AND ${bookings.customerUserId} = ${userId}`,
      )
      .limit(1);
    const row = bookingRows[0];
    if (row === undefined) {
      throw new CustomerBookingNotFoundError();
    }
    // Authoritative payment status is derived from the `payments` table.
    // The `payments` row is the single source of truth for the booking's
    // payment state; it is uniquely keyed by `booking_id`. A booking with
    // no payment row yet (HOLD, payment not initiated) returns 'NONE'.
    // The `payment_attempts` table is the provider-side state; the
    // surface here intentionally exposes the customer-facing `payments`
    // lifecycle so provider attempt IDs, raw provider event payloads, and
    // outbox/audit envelopes never leak through the CUSTOMER route.
    const paymentRows = await this.database
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.bookingId, row.id))
      .limit(1);
    const paymentRow = paymentRows[0];
    const paymentStatus = paymentRow?.status ?? 'NONE';
    const offer = readOffer(row.priceSnapshot);
    return customerBookingDetailSchema.parse({
      bookingId: row.id,
      bookingCode: row.bookingCode,
      status: row.status,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      currency: row.currency,
      grossAmountVnd: row.grossAmountVnd.toString(),
      discountAmountVnd: row.discountAmountVnd.toString(),
      finalAmountVnd: row.finalAmountVnd.toString(),
      paymentStatus,
      roomType: { id: row.roomTypeId, name: row.roomTypeName },
      offer,
      createdAt: row.createdAt.toISOString(),
    });
  }

  public async cancellationPreviewForCustomer(userId: string, bookingCode: string) {
    const booking = await this.findCustomerBooking(userId, bookingCode);
    const now = new Date();
    const eligible =
      (booking.status === 'HOLD' || booking.status === 'CONFIRMED') &&
      booking.checkIn.getTime() > now.getTime();
    const paid = await this.hasSucceededPayment(booking.id);
    const outcome = !eligible ? 'NOT_ELIGIBLE' : paid ? 'REVIEW_REQUIRED' : 'NO_CHARGE';
    return customerCancellationPreviewSchema.parse({
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      eligible,
      outcome,
      estimatedRefundVnd: paid && eligible ? booking.finalAmountVnd.toString() : '0',
      policyMessage: !eligible
        ? 'Đặt phòng này không còn đủ điều kiện hủy trực tuyến.'
        : paid
          ? 'Khoản hoàn tiền cần được bộ phận vận hành kiểm tra trước khi xử lý.'
          : 'Hủy trước giờ nhận phòng sẽ giải phóng giữ chỗ mà không phát sinh giao dịch.',
    });
  }

  public async alterationPreviewForCustomer(userId: string, bookingCode: string, input: unknown) {
    const command = customerAlterationPreviewRequestSchema.parse(input);
    const booking = await this.findCustomerBooking(userId, bookingCode);
    const eligible =
      (booking.status === 'HOLD' || booking.status === 'CONFIRMED') &&
      booking.checkIn.getTime() > Date.now();
    let quote = null;
    if (eligible && this.quotes !== undefined) {
      try {
        quote = await this.quotes.issue({
          roomTypeId: booking.roomTypeId,
          checkIn: command.checkIn,
          checkOut: command.checkOut,
          adults: command.adults,
          children: command.children,
          ...(command.selectedPlanCode === undefined
            ? {}
            : { selectedPlanCode: command.selectedPlanCode }),
        });
      } catch {
        quote = null;
      }
    }
    return customerAlterationPreviewSchema.parse({
      bookingCode,
      eligible: eligible && quote !== null,
      currentFinalAmountVnd: booking.finalAmountVnd.toString(),
      quote,
      policyMessage: !eligible
        ? 'Chỉ có thể thay đổi đặt phòng đang hoạt động trước giờ nhận phòng.'
        : quote === null
          ? 'Khoảng thời gian mới chưa có báo giá hoặc phòng phù hợp.'
          : 'Báo giá mới chỉ là bản xem trước; đặt phòng cũ chưa bị thay đổi.',
    });
  }

  public async accessPassForCustomer(
    userId: string,
    bookingCode: string,
  ): Promise<BookingAccessPassResponse> {
    if (this.accessPasses === undefined) throw new BookingAccessPassError();
    const booking = await this.findCustomerBooking(userId, bookingCode);
    if (booking.status !== 'CONFIRMED' || booking.accessPassRevokedAt !== null) {
      throw new BookingAccessPassError();
    }
    const expiresAt = new Date(booking.checkOut.getTime() + 60 * 60 * 1000);
    const pass = this.accessPasses.issue({
      bookingId: booking.id,
      version: booking.accessPassVersion,
      expiresAt,
    });
    return bookingAccessPassResponseSchema.parse({
      bookingCode: booking.bookingCode,
      expiresAt: expiresAt.toISOString(),
      svg: await this.accessPasses.toSvg(pass),
    });
  }

  private async findCustomerBooking(userId: string, bookingCode: string) {
    const rows = await this.database
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        finalAmountVnd: bookings.finalAmountVnd,
        roomTypeId: roomTypes.id,
        roomTypeName: roomTypes.name,
        priceSnapshot: bookings.priceSnapshot,
        accessPassVersion: bookings.accessPassVersion,
        accessPassRevokedAt: bookings.accessPassRevokedAt,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(
        sql`${bookings.bookingCode} = ${bookingCode} AND ${bookings.customerUserId} = ${userId}`,
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) throw new CustomerBookingNotFoundError();
    return row;
  }

  private async hasSucceededPayment(bookingId: string): Promise<boolean> {
    const rows = await this.database
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .limit(1);
    return rows[0]?.status === 'SUCCEEDED';
  }
}

function readOffer(snapshot: unknown): { code: string; label: string } | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  const pricing = (snapshot as { pricing?: unknown }).pricing;
  if (typeof pricing !== 'object' || pricing === null) return null;
  const code = (pricing as { selectedPlanCode?: unknown }).selectedPlanCode;
  if (typeof code !== 'string' || code.length === 0) return null;
  return { code, label: code };
}
