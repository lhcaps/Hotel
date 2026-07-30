import {
  type DatabasePool,
  type DatabasePoolClient,
} from '@room/database';

import {
  adminBookingCancelRequestSchema,
  adminBookingDetailSchema,
  adminBookingListResponseSchema,
  adminBookingListQuerySchema,
  adminBookingNoShowRequestSchema,
  adminBookingOperationalReviewSchema,
  adminBookingPaymentSummarySchema,
  adminBookingPricingSchema,
  adminBookingSummarySchema,
  adminOperationalReviewDetailSchema,
  adminOperationalReviewListQuerySchema,
  adminOperationalReviewListResponseSchema,
  adminOperationalReviewResolveRequestSchema,
  type AdminBookingAction,
  type AdminBookingDetail,
  type AdminBookingListResponse,
  type AdminBookingSummary,
  type AdminOperationalReviewDetail,
  type AdminOperationalReviewListResponse,
} from '@room/contracts';

import { maskEmailForDisplay } from '@room/booking';

import type { ActorContext } from '../../auth/actor-context.js';
import {
  BookingTransitionError,
  NoShowBeforeCheckInError,
  OperationalReviewAlreadyResolvedError,
  OperationalReviewNotFoundError,
} from '../admin-booking.errors.js';
import { BookingNotFoundError } from './booking-detail.service.js';
import {
  AdminBookingRepository,
  type AdminBookingDetailRow,
  type AdminBookingStatus,
  type AdminBookingTimelineRow,
  type AdminOperationalReviewDetailRow,
  type AdminOperationalReviewSummaryRow,
} from '../repositories/admin-booking.repository.js';

function bigIntToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('BigInt amount is out of safe range');
  }
  return Number(value);
}

function maskPhone(value: string): string {
  if (value.length <= 4) return value;
  return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}

function toAdminBookingSummary(
  row: Awaited<ReturnType<AdminBookingRepository['listBookings']>>['items'][number],
): AdminBookingSummary {
  return adminBookingSummarySchema.parse({
    bookingCode: row.bookingCode,
    status: row.status,
    checkIn: row.checkIn.toISOString(),
    checkOut: row.checkOut.toISOString(),
    roomType: {
      id: row.roomTypeId,
      code: row.roomTypeCode,
      name: row.roomTypeName,
    },
    room:
      row.roomId === null || row.roomNumber === null
        ? null
        : { id: row.roomId, roomNumber: row.roomNumber },
    guestName: row.fullName,
    finalAmountVnd: bigIntToNumber(row.finalAmountVnd),
    currency: 'VND',
    paymentStatus: row.paymentStatus,
    reviewPresence: row.reviewPresence,
    createdAt: row.createdAt.toISOString(),
  });
}

function deriveAvailableActions(status: AdminBookingStatus): readonly AdminBookingAction[] {
  switch (status) {
    case 'HOLD':
      return ['cancel'];
    case 'CONFIRMED':
      return ['cancel', 'check-in', 'no-show'];
    case 'CHECKED_IN':
      return ['check-out'];
    default:
      return [];
  }
}

function toAdminBookingDetail(
  row: AdminBookingDetailRow,
  timeline: readonly AdminBookingTimelineRow[],
  now: Date,
): AdminBookingDetail {
  return adminBookingDetailSchema.parse({
    bookingCode: row.bookingCode,
    status: row.status,
    property: {
      code: row.propertyCode,
      name: row.propertyName,
      timezone: row.propertyTimezone,
    },
    contact: {
      fullName: row.fullName,
      emailMasked: maskEmailForDisplay(row.normalizedEmail),
      phoneMasked: maskPhone(row.normalizedPhoneE164),
    },
    occupancy: { adults: row.adults, children: row.children },
    roomType: {
      id: row.roomTypeId,
      code: row.roomTypeCode,
      name: row.roomTypeName,
      maxOccupancy: row.maxOccupancy,
    },
    room:
      row.roomId === null || row.roomNumber === null
        ? null
        : { id: row.roomId, roomNumber: row.roomNumber },
    interval: {
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
    },
    pricing: adminBookingPricingSchema.parse({
      grossAmountVnd: bigIntToNumber(row.grossAmountVnd),
      discountAmountVnd: bigIntToNumber(row.discountAmountVnd),
      finalAmountVnd: bigIntToNumber(row.finalAmountVnd),
      currency: 'VND',
      coupon:
        row.coupon === null
          ? null
          : {
              code: row.coupon.code,
              discountType: row.coupon.discountType,
              grossAmountVnd: bigIntToNumber(row.coupon.grossAmountVnd),
              discountAmountVnd: bigIntToNumber(row.coupon.discountAmountVnd),
              finalAmountVnd: bigIntToNumber(row.coupon.finalAmountVnd),
            },
    }),
    payment: adminBookingPaymentSummarySchema.parse({
      status: row.paymentStatus,
      amountVnd:
        row.paymentAmountVnd === null
          ? bigIntToNumber(row.finalAmountVnd)
          : bigIntToNumber(row.paymentAmountVnd),
      confirmationSource: row.paymentConfirmationSource,
      succeededAt: row.paymentSucceededAt?.toISOString() ?? null,
    }),
    operationalReview:
      row.reviewId === null
        ? null
        : adminBookingOperationalReviewSchema.parse({
            reviewId: row.reviewId,
            category: row.reviewCategory ?? 'PAID_CANCELLATION',
            status:
              row.reviewResolvedAt === null && row.reviewResolvedNote === null
                ? 'OPEN'
                : 'RESOLVED',
            openedAt: row.reviewOpenedAt?.toISOString() ?? new Date(0).toISOString(),
            openedReason: row.reviewOpenedReason ?? '',
            resolvedAt: row.reviewResolvedAt?.toISOString() ?? null,
            resolvedNote: row.reviewResolvedNote,
          }),
    timeline: timeline.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      actorType: entry.actorType,
      actorId: entry.actorId,
      occurredAt: entry.occurredAt.toISOString(),
      payload: entry.payload,
    })),
    availableActions: deriveAvailableActions(row.status),
    serverTime: now.toISOString(),
  });
}

function toAdminOperationalReviewDetail(
  row: AdminOperationalReviewDetailRow,
  timeline: readonly AdminBookingTimelineRow[],
  now: Date,
): AdminOperationalReviewDetail {
  const paymentSummary = adminBookingPaymentSummarySchema.parse({
    status: row.paymentStatus,
    amountVnd:
      row.paymentAmountVnd === null
        ? bigIntToNumber(row.finalAmountVnd)
        : bigIntToNumber(row.paymentAmountVnd),
    confirmationSource: row.paymentConfirmationSource,
    succeededAt: row.paymentSucceededAt?.toISOString() ?? null,
  });
  return adminOperationalReviewDetailSchema.parse({
    reviewId: row.reviewId,
    bookingCode: row.bookingCode,
    bookingStatus: row.bookingStatus,
    category: row.category,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    openedReason: row.openedReason,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    paymentStatus: row.paymentStatus,
    amountVnd: bigIntToNumber(row.finalAmountVnd),
    booking: {
      bookingCode: row.bookingCode,
      status: row.bookingStatus,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      roomType: { code: row.roomTypeCode, name: row.roomTypeName },
      room:
        row.roomId === null || row.roomNumber === null
          ? null
          : { id: row.roomId, roomNumber: row.roomNumber },
      finalAmountVnd: bigIntToNumber(row.finalAmountVnd),
    },
    payment: paymentSummary,
    timeline: timeline.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      actorType: entry.actorType,
      actorId: entry.actorId,
      occurredAt: entry.occurredAt.toISOString(),
      payload: entry.payload,
    })),
    serverTime: now.toISOString(),
  });
}

interface BookingLifecycleRow {
  readonly id: string;
  readonly property_id: string;
  readonly room_id: string;
  readonly booking_code: string;
  readonly status: AdminBookingStatus;
  readonly check_in: Date | string;
  readonly check_out: Date | string;
  readonly cancelled_at: Date | string | null;
  readonly checked_in_at: Date | string | null;
  readonly checked_out_at: Date | string | null;
  readonly no_show_at: Date | string | null;
  readonly cancellation_reason: string | null;
  readonly hold_expires_at: Date | string | null;
}

function asDate(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export class AdminBookingLifecycleService {
  public constructor(
    private readonly pool: DatabasePool,
    private readonly repository: AdminBookingRepository,
  ) {}

  public async listBookings(
    propertyId: string,
    query: unknown,
  ): Promise<AdminBookingListResponse> {
    const parsed = adminBookingListQuerySchema.parse(query);
    const result = await this.repository.listBookings(propertyId, parsed);
    return adminBookingListResponseSchema.parse({
      items: result.items.map(toAdminBookingSummary),
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalItems: result.totalItems,
    });
  }

  public async getDetail(
    bookingCode: string,
    now: Date,
  ): Promise<AdminBookingDetail> {
    const detail = await this.repository.findDetailByBookingCode(bookingCode);
    if (detail === null) {
      throw new BookingNotFoundError();
    }
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId);
    return toAdminBookingDetail(detail, timeline, now);
  }

  public async cancel(
    actor: ActorContext,
    bookingCode: string,
    input: unknown,
    now: Date,
  ): Promise<AdminBookingDetail> {
    const command = adminBookingCancelRequestSchema.parse(input);
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status === 'CANCELLED') {
        throw new BookingTransitionError('Booking is already cancelled.');
      }
      if (row.status !== 'HOLD' && row.status !== 'CONFIRMED') {
        throw new BookingTransitionError(
          `Cannot cancel a booking in status ${row.status}.`,
        );
      }
      const from = row.status;
      const paid = await isPaymentSucceeded(client, row.id);

      await client.query(
        `UPDATE bookings
            SET status = 'CANCELLED',
                cancelled_at = $2,
                cancellation_reason = $3,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now, command.reason],
      );

      await releaseInventoryBlock(client, row.id, now);

      if (from === 'HOLD') {
        await releaseCouponReservation(client, row.id, now);
      }

      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_CANCELLED',
        payload: {
          bookingCode: row.booking_code,
          from,
          reason: command.reason,
          paid,
        },
      });

      let reviewId: string | null = null;
      if (paid && from === 'CONFIRMED') {
        const openedReview = await openPaidCancellationReview(
          client,
          row.property_id,
          row.id,
          now,
          command.reason,
          actor,
        );
        reviewId = openedReview.id;
      }
      void reviewId;

      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.cancelled',
        payload: {
          eventVersion: 1,
          bookingId: row.id,
          from,
          reason: command.reason,
        },
      });
    });
  }

  public async checkIn(
    actor: ActorContext,
    bookingCode: string,
    now: Date,
  ): Promise<AdminBookingDetail> {
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status !== 'CONFIRMED') {
        throw new BookingTransitionError(
          `Cannot check in a booking in status ${row.status}.`,
        );
      }
      await client.query(
        `UPDATE bookings
            SET status = 'CHECKED_IN',
                checked_in_at = $2,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now],
      );
      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_CHECKED_IN',
        payload: { bookingCode: row.booking_code },
      });
      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.checked_in',
        payload: { eventVersion: 1, bookingId: row.id },
      });
    });
  }

  public async checkOut(
    actor: ActorContext,
    bookingCode: string,
    now: Date,
  ): Promise<AdminBookingDetail> {
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status !== 'CHECKED_IN') {
        throw new BookingTransitionError(
          `Cannot check out a booking in status ${row.status}.`,
        );
      }
      await client.query(
        `UPDATE bookings
            SET status = 'CHECKED_OUT',
                checked_out_at = $2,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now],
      );
      await releaseInventoryBlock(client, row.id, now);
      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_CHECKED_OUT',
        payload: { bookingCode: row.booking_code },
      });
      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.checked_out',
        payload: { eventVersion: 1, bookingId: row.id },
      });
    });
  }

  public async markNoShow(
    actor: ActorContext,
    bookingCode: string,
    input: unknown,
    now: Date,
  ): Promise<AdminBookingDetail> {
    const command = adminBookingNoShowRequestSchema.parse(input);
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status !== 'CONFIRMED') {
        throw new BookingTransitionError(
          `Cannot mark no-show for a booking in status ${row.status}.`,
        );
      }
      const checkIn = asDate(row.check_in, 'check_in');
      if (now.getTime() < checkIn.getTime()) {
        throw new NoShowBeforeCheckInError();
      }
      const lateBySeconds = Math.max(0, Math.round((now.getTime() - checkIn.getTime()) / 1000));
      await client.query(
        `UPDATE bookings
            SET status = 'NO_SHOW',
                no_show_at = $2,
                cancellation_reason = $3,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now, command.reason],
      );
      await releaseInventoryBlock(client, row.id, now);
      await appendAudit(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        bookingCode: row.booking_code,
        actor,
        eventType: 'BOOKING_NO_SHOW',
        payload: {
          bookingCode: row.booking_code,
          reason: command.reason,
          lateBySeconds,
        },
      });
      await enqueueBookingOutbox(client, {
        propertyId: row.property_id,
        bookingId: row.id,
        eventType: 'booking.no_show',
        payload: { eventVersion: 1, bookingId: row.id, lateBySeconds },
      });
    });
  }

  public async listOperationalReviews(
    propertyId: string,
    query: unknown,
  ): Promise<AdminOperationalReviewListResponse> {
    const parsed = adminOperationalReviewListQuerySchema.parse(query);
    const result = await this.repository.listOperationalReviews(propertyId, parsed);
    return adminOperationalReviewListResponseSchema.parse({
      items: result.items.map(toSummaryItem),
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalItems: result.totalItems,
    });
  }

  public async getOperationalReviewDetail(
    reviewId: string,
    now: Date,
  ): Promise<AdminOperationalReviewDetail> {
    const detail = await this.repository.findOperationalReviewById(reviewId);
    if (detail === null) {
      throw new OperationalReviewNotFoundError();
    }
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId);
    return toAdminOperationalReviewDetail(detail, timeline, now);
  }

  public async resolveOperationalReview(
    actor: ActorContext,
    reviewId: string,
    input: unknown,
    now: Date,
  ): Promise<AdminOperationalReviewDetail> {
    const command = adminOperationalReviewResolveRequestSchema.parse(input);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const lockResult = await client.query<{ status: 'OPEN' | 'RESOLVED' }>(
        `SELECT status FROM operational_reviews WHERE id = $1 FOR UPDATE`,
        [reviewId],
      );
      const current = lockResult.rows[0];
      if (current === undefined) {
        await client.query('ROLLBACK');
        throw new OperationalReviewNotFoundError();
      }
      if (current.status !== 'OPEN') {
        await client.query('ROLLBACK');
        throw new OperationalReviewAlreadyResolvedError();
      }
      const reviewRowResult = await client.query<{ booking_id: string; property_id: string }>(
        `SELECT booking_id, property_id FROM operational_reviews WHERE id = $1`,
        [reviewId],
      );
      const reviewRow = reviewRowResult.rows[0];
      if (reviewRow === undefined) {
        await client.query('ROLLBACK');
        throw new OperationalReviewNotFoundError();
      }
      await client.query(
        `UPDATE operational_reviews
            SET status = 'RESOLVED',
                resolved_at = $2,
                resolver_id = $3,
                resolved_note = $4,
                updated_at = $2
          WHERE id = $1`,
        [reviewId, now, actor.userId, command.note],
      );
      await appendAudit(client, {
        propertyId: reviewRow.property_id,
        bookingId: reviewRow.booking_id,
        bookingCode: '',
        actor,
        eventType: 'OPERATIONAL_REVIEW_RESOLVED',
        payload: { reviewId, note: command.note },
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    const detail = await this.repository.findOperationalReviewById(reviewId);
    if (detail === null) {
      throw new OperationalReviewNotFoundError();
    }
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId);
    return toAdminOperationalReviewDetail(detail, timeline, now);
  }

  private async runTransition(
    actor: ActorContext,
    bookingCode: string,
    now: Date,
    operation: (client: DatabasePoolClient, row: BookingLifecycleRow) => Promise<void>,
  ): Promise<AdminBookingDetail> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const lockResult = await client.query<BookingLifecycleRow>(
        `SELECT id, property_id, room_id, booking_code, status,
                check_in, check_out, cancelled_at, checked_in_at,
                checked_out_at, no_show_at, cancellation_reason, hold_expires_at
           FROM bookings
          WHERE booking_code = $1
          FOR UPDATE`,
        [bookingCode],
      );
      const row = lockResult.rows[0];
      if (row === undefined) {
        await client.query('ROLLBACK');
        throw new BookingNotFoundError();
      }
      await operation(client, row);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return this.getDetail(bookingCode, now);
  }
}

async function isPaymentSucceeded(client: DatabasePoolClient, bookingId: string): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED'`,
    [bookingId],
  );
  return Number(result.rows[0]?.count ?? '0') > 0;
}

async function releaseInventoryBlock(
  client: DatabasePoolClient,
  bookingId: string,
  now: Date,
): Promise<void> {
  await client.query(
    `UPDATE room_inventory_blocks
        SET status = 'RELEASED',
            released_at = $2
      WHERE booking_id = $1
        AND status = 'ACTIVE'`,
    [bookingId, now],
  );
}

async function releaseCouponReservation(
  client: DatabasePoolClient,
  bookingId: string,
  now: Date,
): Promise<void> {
  await client.query(
    `UPDATE booking_coupon_applications
        SET application_status = 'RELEASED',
            quota_reserved = false,
            released_at = $2
      WHERE booking_id = $1
        AND application_status IN ('RESERVED', 'ASSOCIATED')`,
    [bookingId, now],
  );
}

async function openPaidCancellationReview(
  client: DatabasePoolClient,
  propertyId: string,
  bookingId: string,
  now: Date,
  reason: string,
  actor: ActorContext,
): Promise<{ id: string }> {
  const paymentResult = await client.query<{ id: string }>(
    `SELECT id FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED' LIMIT 1`,
    [bookingId],
  );
  const paymentId = paymentResult.rows[0]?.id ?? null;
  if (paymentId === null) {
    throw new Error('Paid cancellation attempted without a SUCCEEDED payment row');
  }
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM operational_reviews
      WHERE booking_id = $1 AND category = 'PAID_CANCELLATION' AND status = 'OPEN'
      LIMIT 1`,
    [bookingId],
  );
  if (existing.rows[0] !== undefined) {
    return { id: existing.rows[0].id };
  }
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO operational_reviews (
        property_id, booking_id, payment_id, category, status,
        opened_at, opened_reason
     )
     VALUES ($1, $2, $3, 'PAID_CANCELLATION', 'OPEN', $4, $5)
     RETURNING id`,
    [propertyId, bookingId, paymentId, now, reason],
  );
  const id = inserted.rows[0]?.id;
  if (id === undefined) {
    throw new Error('Operational review insert returned no rows');
  }
  await client.query(
    `INSERT INTO audit_events (property_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, payload, occurred_at)
     VALUES ($1, 'BOOKING', $2, 'OPERATIONAL_REVIEW_OPENED', 'ADMIN', $3, $4::jsonb, $5)`,
    [
      propertyId,
      bookingId,
      actor.userId,
      JSON.stringify({ reviewId: id, category: 'PAID_CANCELLATION', status: 'OPEN' }),
      now,
    ],
  );
  return { id };
}

async function appendAudit(
  client: DatabasePoolClient,
  input: {
    readonly propertyId: string;
    readonly bookingId: string;
    readonly bookingCode: string;
    readonly actor: ActorContext;
    readonly eventType: string;
    readonly payload: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
        property_id, aggregate_type, aggregate_id, event_type,
        actor_type, actor_id, payload, occurred_at
     )
     VALUES ($1, 'BOOKING', $2, $3, 'ADMIN', $4, $5::jsonb, now())`,
    [
      input.propertyId,
      input.bookingId,
      input.eventType,
      input.actor.userId,
      JSON.stringify(input.payload),
    ],
  );
}

async function enqueueBookingOutbox(
  client: DatabasePoolClient,
  input: {
    readonly propertyId: string;
    readonly bookingId: string;
    readonly eventType: string;
    readonly payload: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events (
        property_id, aggregate_type, aggregate_id, event_type,
        payload, status
     )
     VALUES ($1, 'BOOKING', $2, $3, $4::jsonb, 'PENDING')`,
    [
      input.propertyId,
      input.bookingId,
      input.eventType,
      JSON.stringify(input.payload),
    ],
  );
}

function toSummaryItem(row: AdminOperationalReviewSummaryRow) {
  return {
    reviewId: row.reviewId,
    bookingCode: row.bookingCode,
    bookingStatus: row.bookingStatus,
    category: row.category,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    openedReason: row.openedReason,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    paymentStatus: row.paymentStatus,
    amountVnd: bigIntToNumber(row.finalAmountVnd),
  };
}
