import { Buffer } from 'node:buffer';
import {
  createBookingHoldWithRetry,
  normalizeContact,
  type BookingHoldResult,
} from '@room/booking';
import {
  bookingHoldCouponSummarySchema,
  bookingHoldResponseSchema,
  createBookingHoldRequestSchema,
  type BookingHoldResponse,
  type BookingHoldCouponSummary,
} from '@room/contracts';
import { type DatabasePool } from '@room/database';

export class BookingHoldError extends Error {
  public constructor(
    public readonly code:
      | 'QUOTE_NOT_FOUND'
      | 'QUOTE_EXPIRED'
      | 'QUOTE_ALREADY_USED'
      | 'ROOM_TYPE_UNAVAILABLE'
      | 'ALLOCATION_BUSY'
      | 'STALE_HOLD_CLEANUP_RETRY'
      | 'COUPON_REQUOTE_REQUIRED'
      | 'COUPON_HOLD_WINDOW_INCOMPATIBLE'
      | 'COUPON_MINIMUM_NOT_MET'
      | 'COUPON_LIMIT_REACHED'
      | 'COUPON_CUSTOMER_LIMIT_REACHED'
      | 'COUPON_EXPIRED'
      | 'INTERNAL_ERROR',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BookingHoldError';
  }
}

export interface BookingHoldServiceOptions {
  readonly pool: DatabasePool;
  readonly holdDurationMs: number;
  readonly ipDigestSecret: Buffer;
}

function couponSnapshotToResponse(
  snapshot: BookingHoldResult['coupon'],
): BookingHoldCouponSummary | undefined {
  if (snapshot === undefined) return undefined;
  return bookingHoldCouponSummarySchema.parse({
    code: snapshot.code,
    discountType: snapshot.discountType,
    grossAmountVnd: snapshot.grossAmountVnd,
    discountAmountVnd: snapshot.discountAmountVnd,
    finalAmountVnd: snapshot.finalAmountVnd,
  });
}

export class BookingHoldService {
  public constructor(private readonly options: BookingHoldServiceOptions) {}

  public async issue(
    quoteId: string,
    input: unknown,
    correlationId: string,
    customerUserId?: string,
  ): Promise<BookingHoldResponse> {
    const request = createBookingHoldRequestSchema.parse(input);

    const contact = normalizeContact(request.contact, this.options.ipDigestSecret);

    let result: BookingHoldResult;
    try {
      result = await createBookingHoldWithRetry(this.options.pool, {
        quoteId,
        contact,
        holdDurationMs: this.options.holdDurationMs,
        correlationId,
        customerUserId,
      });
    } catch (error) {
      throw this.mapError(error);
    }
    return bookingHoldResponseSchema.parse({
      bookingId: result.bookingId,
      bookingCode: result.bookingCode,
      status: result.status,
      checkIn: result.checkIn.toISOString(),
      checkOut: result.checkOut.toISOString(),
      holdExpiresAt: result.holdExpiresAt.toISOString(),
      amountVnd: result.amountVnd,
      currency: result.currency,
      idempotent: result.idempotent,
      ...(result.coupon !== undefined ? { coupon: couponSnapshotToResponse(result.coupon) } : {}),
    });
  }

  private mapError(error: unknown): BookingHoldError {
    const name = error instanceof Error ? error.name : String(error);
    switch (name) {
      case 'QuoteNotFoundError':
        return new BookingHoldError('QUOTE_NOT_FOUND', 'Quote not found', { cause: error });
      case 'QuoteExpiredError':
        return new BookingHoldError('QUOTE_EXPIRED', 'Quote has expired', { cause: error });
      case 'QuoteAlreadyUsedError':
        return new BookingHoldError(
          'QUOTE_ALREADY_USED',
          'Quote already consumed by a different contact',
          { cause: error },
        );
      case 'RoomTypeUnavailableError':
        return new BookingHoldError(
          'ROOM_TYPE_UNAVAILABLE',
          'No eligible room is free for this interval',
          { cause: error },
        );
      case 'AllocationBusyError':
        return new BookingHoldError('ALLOCATION_BUSY', 'All free rooms are currently locked', {
          cause: error,
        });
      case 'StaleHoldCleanupRetryError':
        return new BookingHoldError(
          'STALE_HOLD_CLEANUP_RETRY',
          'Stale HOLD cleanup hit safety bound; retry shortly',
          { cause: error },
        );
      case 'CouponRequoteRequiredError':
        return new BookingHoldError(
          'COUPON_REQUOTE_REQUIRED',
          'Coupon terms changed; please request a new quote',
          { cause: error },
        );
      case 'CouponHoldWindowIncompatibleError':
        return new BookingHoldError(
          'COUPON_HOLD_WINDOW_INCOMPATIBLE',
          'Coupon is not valid for this hold window',
          { cause: error },
        );
      case 'CouponMinimumNotMetError':
        return new BookingHoldError(
          'COUPON_MINIMUM_NOT_MET',
          'Order total is below the coupon minimum',
          { cause: error },
        );
      case 'CouponLimitReachedError':
        return new BookingHoldError(
          'COUPON_LIMIT_REACHED',
          'Coupon total usage limit has been reached',
          { cause: error },
        );
      case 'CouponCustomerLimitReachedError':
        return new BookingHoldError(
          'COUPON_CUSTOMER_LIMIT_REACHED',
          'Coupon per-customer limit has been reached',
          { cause: error },
        );
      case 'CouponExpiredError':
        return new BookingHoldError(
          'COUPON_EXPIRED',
          'Coupon is no longer within its validity window',
          { cause: error },
        );
      default:
        return new BookingHoldError('INTERNAL_ERROR', 'Booking HOLD could not be created', {
          cause: error,
        });
    }
  }
}
