import { bookings, type DatabaseClient, eq, payments, sql } from '@room/database';

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
  readonly createdAt: string;
}

export class CustomerBookingNotFoundError extends Error {
  public constructor() {
    super('Booking not found for this CUSTOMER');
    this.name = 'CustomerBookingNotFoundError';
  }
}

export class CustomerBookingService {
  public constructor(private readonly database: DatabaseClient) {}

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
        createdAt: bookings.createdAt,
      })
      .from(bookings)
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
    return {
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
      createdAt: row.createdAt.toISOString(),
    };
  }
}
