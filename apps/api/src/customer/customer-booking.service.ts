import {
  and,
  auditEvents,
  bookingCouponApplications,
  bookings,
  eq,
  housekeepingTasks,
  operationalReviews,
  outboxEvents,
  payments,
  roomInventoryBlocks,
  roomTypes,
  type DatabaseClient,
  sql,
} from '@room/database';
import {
  bookingAccessPassResponseSchema,
  customerAlterationPreviewRequestSchema,
  customerAlterationPreviewSchema,
  customerBookingDetailSchema,
  customerCancellationPreviewSchema,
  customerCancellationRequestSchema,
  customerCancellationResponseSchema,
  type BookingAccessPassResponse,
  type CustomerCancellationPolicy,
} from '@room/contracts';
import {
  evaluateCancellationPolicy,
  toCancellationPolicyDisplaySnapshot,
  type CancellationPolicySnapshot,
} from '@room/booking';

import { QuoteService } from '../pricing/quote.service.js';
import {
  BookingAccessPassError,
  BookingAccessPassService,
  isAccessPassWithinArrivalWindow,
} from '../booking/services/booking-access-pass.service.js';
import {
  ArrivalAccessConfigService,
  ArrivalAccessConfigurationIncompleteError,
} from '../booking/services/arrival-access-config.service.js';
import { readBookingStayRepresentation } from '../booking/stay-representation.js';

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
  readonly adults: number;
  readonly children: number;
  readonly paymentStatus: string;
  readonly roomType: { readonly id: string; readonly name: string };
  readonly offer: { readonly code: string; readonly label: string } | null;
  readonly cancellationPolicy: CustomerCancellationPolicy | null;
  readonly cancellationRefundState: string | null;
  readonly cancellationRefundAmountVnd: string | null;
  readonly cancellationRetainedAmountVnd: string | null;
  readonly createdAt: string;
}

export class CustomerBookingNotFoundError extends Error {
  public constructor() {
    super('Booking not found for this CUSTOMER');
    this.name = 'CustomerBookingNotFoundError';
  }
}

export class CustomerCancellationConflictError extends Error {
  public constructor(message = 'Booking cancellation is already completed') {
    super(message);
    this.name = 'CustomerCancellationConflictError';
  }
}

export class CustomerCancellationPolicyError extends Error {
  public constructor() {
    super('Booking has no immutable cancellation policy snapshot');
    this.name = 'CustomerCancellationPolicyError';
  }
}

export class CustomerBookingService {
  public constructor(
    private readonly database: DatabaseClient,
    private readonly quotes?: QuoteService,
    private readonly accessPasses?: BookingAccessPassService,
    private readonly arrivalAccess?: ArrivalAccessConfigService,
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
        adults: bookings.adults,
        children: bookings.children,
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
        adults: bookings.adults,
        children: bookings.children,
        roomTypeId: roomTypes.id,
        roomTypeName: roomTypes.name,
        priceSnapshot: bookings.priceSnapshot,
        cancellationPolicySnapshot: bookings.cancellationPolicySnapshot,
        cancellationRefundState: bookings.cancellationRefundState,
        cancellationRefundAmountVnd: bookings.cancellationRefundAmountVnd,
        cancellationRetainedAmountVnd: bookings.cancellationRetainedAmountVnd,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(
        sql`${bookings.bookingCode} = ${bookingCode} AND ${bookings.customerUserId} = ${userId}`,
      )
      .limit(1);
    const row = bookingRows[0];
    if (row === undefined) throw new CustomerBookingNotFoundError();
    const paymentRows = await this.database
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.bookingId, row.id))
      .limit(1);
    const paymentStatus = paymentRows[0]?.status ?? 'NONE';
    const cancellationPolicy = readCancellationPolicySnapshot(row.cancellationPolicySnapshot);
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
      adults: row.adults,
      children: row.children,
      ...readBookingStayRepresentation(row.priceSnapshot),
      paymentStatus,
      roomType: { id: row.roomTypeId, name: row.roomTypeName },
      offer: readOffer(row.priceSnapshot),
      cancellationPolicy:
        cancellationPolicy === null
          ? null
          : toCancellationPolicyDisplaySnapshot(cancellationPolicy),
      cancellationRefundState: normalizeCustomerDetailRefundState(row.cancellationRefundState),
      cancellationRefundAmountVnd: row.cancellationRefundAmountVnd?.toString() ?? null,
      cancellationRetainedAmountVnd: row.cancellationRetainedAmountVnd?.toString() ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  }

  public async cancellationPreviewForCustomer(userId: string, bookingCode: string) {
    const booking = await this.findCustomerBooking(userId, bookingCode);
    const now = new Date();
    const policy = readCancellationPolicySnapshot(booking.cancellationPolicySnapshot);
    const eligible =
      (booking.status === 'HOLD' || booking.status === 'CONFIRMED') &&
      booking.checkIn.getTime() > now.getTime();
    if (policy === null) {
      return customerCancellationPreviewSchema.parse({
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        eligible: false,
        outcome: 'NOT_ELIGIBLE',
        estimatedRefundVnd: '0',
        paidAmountVnd: '0',
        retainedAmountVnd: '0',
        refundPercent: 0,
        refundBasis: 'PAID_AMOUNT',
        policy: null,
        policyMessage:
          'Đặt phòng chưa có bản chụp chính sách hủy; vui lòng liên hệ bộ phận vận hành để được kiểm tra.',
      });
    }
    const evaluation = evaluateCancellationPolicy({
      snapshot: policy,
      now,
      paidAmountVnd: await this.succeededPaymentAmount(booking.id),
      bookingEligible: eligible,
    });
    return customerCancellationPreviewSchema.parse({
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      eligible: evaluation.eligible,
      outcome: evaluation.outcome,
      estimatedRefundVnd: evaluation.refundAmountVnd.toString(),
      paidAmountVnd: evaluation.paidAmountVnd.toString(),
      retainedAmountVnd: evaluation.retainedAmountVnd.toString(),
      refundPercent: evaluation.refundPercent,
      refundBasis: 'PAID_AMOUNT',
      policy: toCancellationPolicyDisplaySnapshot(policy),
      policyMessage: evaluation.policyMessage,
    });
  }

  public async cancelForCustomer(
    userId: string,
    bookingCode: string,
    input: unknown,
    idempotencyKey: string | undefined,
  ) {
    const command = customerCancellationRequestSchema.parse(input);
    const key = normalizeCancellationKey(idempotencyKey);
    const result = await this.database.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.bookingCode, bookingCode), eq(bookings.customerUserId, userId)))
        .limit(1)
        .for('update');
      const booking = rows[0];
      if (booking === undefined) throw new CustomerBookingNotFoundError();
      if (booking.status === 'CANCELLED') {
        if (booking.cancellationIdempotencyKey !== key)
          throw new CustomerCancellationConflictError();
        return {
          refundState: normalizeRefundState(booking.cancellationRefundState),
          refundAmountVnd: booking.cancellationRefundAmountVnd ?? 0n,
          retainedAmountVnd: booking.cancellationRetainedAmountVnd ?? 0n,
          idempotent: true,
        };
      }
      if (booking.status !== 'HOLD' && booking.status !== 'CONFIRMED') {
        throw new CustomerCancellationConflictError(
          'Booking is not cancellable in its current state',
        );
      }
      const policy = readCancellationPolicySnapshot(booking.cancellationPolicySnapshot);
      if (policy === null) throw new CustomerCancellationPolicyError();
      const now = new Date();
      if (booking.checkIn.getTime() <= now.getTime()) {
        throw new CustomerCancellationConflictError('Booking is no longer cancellable online');
      }
      const paymentRows = await tx
        .select({ id: payments.id, amountVnd: payments.amountVnd })
        .from(payments)
        .where(and(eq(payments.bookingId, booking.id), eq(payments.status, 'SUCCEEDED')))
        .limit(1)
        .for('update');
      const payment = paymentRows[0];
      const evaluation = evaluateCancellationPolicy({
        snapshot: policy,
        now,
        paidAmountVnd: payment?.amountVnd ?? 0n,
        bookingEligible: true,
      });
      const refundState = evaluation.refundAmountVnd > 0n ? 'REVIEW_REQUIRED' : 'NO_REFUND';
      await tx
        .update(bookings)
        .set({
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: command.reason,
          cancellationPolicySnapshot: policy,
          cancellationIdempotencyKey: key,
          cancellationRequestedAt: now,
          cancellationRefundState: refundState,
          cancellationRefundAmountVnd: evaluation.refundAmountVnd,
          cancellationRetainedAmountVnd: evaluation.retainedAmountVnd,
          accessPassVersion: sql`${bookings.accessPassVersion} + 1`,
          accessPassRevokedAt: now,
          updatedAt: now,
        })
        .where(eq(bookings.id, booking.id));
      await tx
        .update(roomInventoryBlocks)
        .set({ status: 'RELEASED', releasedAt: now })
        .where(
          and(
            eq(roomInventoryBlocks.bookingId, booking.id),
            eq(roomInventoryBlocks.status, 'ACTIVE'),
          ),
        );
      await tx
        .update(housekeepingTasks)
        .set({ status: 'CANCELLED', updatedAt: now })
        .where(
          and(
            eq(housekeepingTasks.bookingId, booking.id),
            eq(housekeepingTasks.type, 'ARRIVAL_PREP'),
            sql`${housekeepingTasks.status} IN ('SCHEDULED', 'DUE') AND ${housekeepingTasks.dueAt} > ${now}`,
          ),
        );
      if (booking.status === 'HOLD') {
        await tx
          .update(bookingCouponApplications)
          .set({ applicationStatus: 'RELEASED', quotaReserved: false, releasedAt: now })
          .where(
            and(
              eq(bookingCouponApplications.bookingId, booking.id),
              sql`${bookingCouponApplications.applicationStatus} IN ('RESERVED', 'ASSOCIATED')`,
            ),
          );
      }
      await tx.insert(auditEvents).values({
        propertyId: booking.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: booking.id,
        eventType: 'BOOKING_CANCELLED',
        actorType: 'CUSTOMER',
        actorId: userId,
        payload: {
          bookingCode,
          reason: command.reason,
          policyCode: policy.code,
          policyVersion: policy.version,
          refundBasis: policy.refundBasis,
          refundPercent: evaluation.refundPercent,
          refundAmountVnd: evaluation.refundAmountVnd.toString(),
          retainedAmountVnd: evaluation.retainedAmountVnd.toString(),
          idempotencyKey: key,
        },
        occurredAt: now,
      });
      if (
        payment !== undefined &&
        evaluation.refundAmountVnd > 0n &&
        booking.status === 'CONFIRMED'
      ) {
        await tx
          .insert(operationalReviews)
          .values({
            propertyId: booking.propertyId,
            bookingId: booking.id,
            paymentId: payment.id,
            category: 'PAID_CANCELLATION',
            status: 'OPEN',
            openedAt: now,
            openedReason: command.reason,
          })
          .onConflictDoNothing();
      }
      await tx.insert(outboxEvents).values({
        propertyId: booking.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: booking.id,
        eventType: 'booking.cancelled',
        payload: {
          eventVersion: 1,
          bookingId: booking.id,
          bookingCode,
          refundState,
          refundAmountVnd: evaluation.refundAmountVnd.toString(),
        },
        status: 'PENDING',
      });
      return {
        refundState,
        refundAmountVnd: evaluation.refundAmountVnd,
        retainedAmountVnd: evaluation.retainedAmountVnd,
        idempotent: false,
      };
    });
    return customerCancellationResponseSchema.parse({
      bookingCode,
      status: 'CANCELLED',
      refundState: result.refundState,
      refundAmountVnd: result.refundAmountVnd.toString(),
      retainedAmountVnd: result.retainedAmountVnd.toString(),
      idempotent: result.idempotent,
    });
  }

  public async alterationPreviewForCustomer(userId: string, bookingCode: string, input: unknown) {
    const command = customerAlterationPreviewRequestSchema.parse(input);
    const booking = await this.findCustomerBooking(userId, bookingCode);
    const stay = readBookingStayRepresentation(booking.priceSnapshot);
    const isMultiNight = stay.stayMode === 'multi_night';
    const eligible =
      !isMultiNight &&
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
      policyMessage: isMultiNight
        ? 'Multi-night bookings do not support date, duration, or guest amendments.'
        : !eligible
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
    if (
      booking.status !== 'CONFIRMED' ||
      booking.accessPassRevokedAt !== null ||
      !isAccessPassWithinArrivalWindow(booking.checkIn, new Date())
    ) {
      throw new BookingAccessPassError();
    }
    const expiresAt = new Date(booking.checkOut.getTime() + 60 * 60 * 1000);
    const pass = this.accessPasses.issue({
      bookingId: booking.id,
      version: booking.accessPassVersion,
      expiresAt,
    });
    if (this.arrivalAccess === undefined) throw new BookingAccessPassError();
    try {
      return bookingAccessPassResponseSchema.parse({
        bookingCode: booking.bookingCode,
        expiresAt: expiresAt.toISOString(),
        svg: await this.accessPasses.toSvg(pass),
        arrival: await this.arrivalAccess.resolveCustomerPackage({
          propertyId: booking.propertyId,
          roomId: booking.roomId,
        }),
      });
    } catch (error) {
      if (error instanceof ArrivalAccessConfigurationIncompleteError) {
        throw new BookingAccessPassError();
      }
      throw error;
    }
  }

  private async findCustomerBooking(userId: string, bookingCode: string) {
    const rows = await this.database
      .select({
        id: bookings.id,
        propertyId: bookings.propertyId,
        roomId: bookings.roomId,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        finalAmountVnd: bookings.finalAmountVnd,
        roomTypeId: roomTypes.id,
        roomTypeName: roomTypes.name,
        priceSnapshot: bookings.priceSnapshot,
        cancellationPolicySnapshot: bookings.cancellationPolicySnapshot,
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

  private async succeededPaymentAmount(bookingId: string): Promise<bigint> {
    const rows = await this.database
      .select({ amountVnd: payments.amountVnd })
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), eq(payments.status, 'SUCCEEDED')))
      .limit(1);
    return rows[0]?.amountVnd ?? 0n;
  }
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

function normalizeCancellationKey(value: string | undefined): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length < 8 || normalized.length > 200) {
    throw new CustomerCancellationConflictError('A valid cancellation idempotency key is required');
  }
  return normalized;
}

function normalizeRefundState(
  value: string,
): 'NO_REFUND' | 'REVIEW_REQUIRED' | 'REFUND_PENDING' | 'REFUNDED' {
  if (value === 'REVIEW_REQUIRED' || value === 'REFUND_PENDING' || value === 'REFUNDED') {
    return value;
  }
  return 'NO_REFUND';
}

function normalizeCustomerDetailRefundState(
  value: string | null,
): 'NO_REFUND' | 'REVIEW_REQUIRED' | 'REFUND_PENDING' | 'REFUNDED' | null {
  if (value === null || value === 'NOT_APPLICABLE') return null;
  return normalizeRefundState(value);
}

function readOffer(snapshot: unknown): { code: string; label: string } | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  const pricing = (snapshot as { pricing?: unknown }).pricing;
  if (typeof pricing !== 'object' || pricing === null) return null;
  const code = (pricing as { selectedPlanCode?: unknown }).selectedPlanCode;
  if (typeof code !== 'string' || code.length === 0) return null;
  return { code, label: code };
}
