import { type DatabasePool, type DatabasePoolClient } from '@room/database';

import {
  adminBookingCancelRequestSchema,
  adminBookingCancellationPreviewSchema,
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
  type AdminBookingCancellationPreview,
  type AdminBookingListResponse,
  type AdminBookingSummary,
  type AdminOperationalReviewDetail,
  type AdminOperationalReviewListResponse,
} from '@room/contracts';

import {
  evaluateCancellationPolicy,
  maskEmailForDisplay,
  type CancellationPolicySnapshot,
} from '@room/booking';

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

function toBigIntAmount(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  return typeof value === 'bigint' ? value : BigInt(value);
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
    roomStatus: row.roomStatus,
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
    roomStatus: row.roomStatus,
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
  readonly property_timezone: string;
  readonly cancellation_policy_snapshot: unknown;
  readonly cancellation_idempotency_key: string | null;
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

  public async listBookings(propertyId: string, query: unknown): Promise<AdminBookingListResponse> {
    const parsed = adminBookingListQuerySchema.parse(query);
    const result = await this.repository.listBookings(propertyId, parsed);
    return adminBookingListResponseSchema.parse({
      items: result.items.map(toAdminBookingSummary),
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalItems: result.totalItems,
    });
  }

  public async getDetail(bookingCode: string, now: Date): Promise<AdminBookingDetail> {
    const detail = await this.repository.findDetailByBookingCode(bookingCode);
    if (detail === null) {
      throw new BookingNotFoundError();
    }
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId);
    return toAdminBookingDetail(detail, timeline, now);
  }

  public async cancellationPreview(
    bookingCode: string,
    now: Date,
  ): Promise<AdminBookingCancellationPreview> {
    const result = await this.pool.query<{
      booking_code: string;
      status: AdminBookingStatus;
      check_in: Date | string;
      property_timezone: string;
      cancellation_policy_snapshot: unknown;
      paid_amount_vnd: string | number | bigint | null;
    }>(
      `SELECT b.booking_code,
              b.status,
              b.check_in,
              p.timezone AS property_timezone,
              b.cancellation_policy_snapshot,
              pay.amount_vnd AS paid_amount_vnd
         FROM bookings b
         JOIN properties p ON p.id = b.property_id
         LEFT JOIN payments pay
           ON pay.booking_id = b.id AND pay.status = 'SUCCEEDED'
        WHERE b.booking_code = $1
        LIMIT 1`,
      [bookingCode],
    );
    const row = result.rows[0];
    if (row === undefined) throw new BookingNotFoundError();
    const checkIn = asDate(row.check_in, 'check_in');
    const snapshot = readCancellationPolicySnapshot(row.cancellation_policy_snapshot);
    if (snapshot === null) {
      return adminBookingCancellationPreviewSchema.parse({
        bookingCode: row.booking_code,
        bookingStatus: row.status,
        eligible: false,
        outcome: 'NOT_ELIGIBLE',
        refundBasis: 'PAID_AMOUNT',
        refundPercent: 0,
        estimatedRefundVnd: 0,
        paidAmountVnd:
          toBigIntAmount(row.paid_amount_vnd) > 0n
            ? bigIntToNumber(toBigIntAmount(row.paid_amount_vnd))
            : 0,
        retainedAmountVnd:
          toBigIntAmount(row.paid_amount_vnd) > 0n
            ? bigIntToNumber(toBigIntAmount(row.paid_amount_vnd))
            : 0,
        policy: null,
        policyMessage:
          'Booking has no immutable cancellation policy snapshot; operations review is required before cancellation.',
      });
    }
    const evaluation = evaluateCancellationPolicy({
      snapshot,
      now,
      paidAmountVnd: toBigIntAmount(row.paid_amount_vnd),
      bookingEligible:
        (row.status === 'HOLD' || row.status === 'CONFIRMED') && checkIn.getTime() > now.getTime(),
    });
    return adminBookingCancellationPreviewSchema.parse({
      bookingCode: row.booking_code,
      bookingStatus: row.status,
      eligible: evaluation.eligible,
      outcome: evaluation.outcome,
      refundBasis: 'PAID_AMOUNT',
      refundPercent: evaluation.refundPercent,
      estimatedRefundVnd: bigIntToNumber(evaluation.refundAmountVnd),
      paidAmountVnd: bigIntToNumber(evaluation.paidAmountVnd),
      retainedAmountVnd: bigIntToNumber(evaluation.retainedAmountVnd),
      policy: {
        code: snapshot.code,
        version: snapshot.version,
        timezone: snapshot.timezone,
        refundBasis: snapshot.refundBasis,
        capturedAt: snapshot.capturedAt,
        checkIn: snapshot.checkIn,
        sevenDayDeadline: snapshot.sevenDayDeadline,
        threeDayDeadline: snapshot.threeDayDeadline,
      },
      policyMessage: evaluation.policyMessage,
    });
  }

  public async cancel(
    actor: ActorContext,
    bookingCode: string,
    input: unknown,
    now: Date,
    idempotencyKey?: string,
  ): Promise<AdminBookingDetail> {
    const command = adminBookingCancelRequestSchema.parse(input);
    const cancellationKey = normalizeCancellationKey(
      idempotencyKey ?? `legacy-admin:${actor.userId}:${bookingCode}:${now.getTime()}`,
    );
    return this.runTransition(actor, bookingCode, now, async (client, row) => {
      if (row.status === 'CANCELLED') {
        if (row.cancellation_idempotency_key === cancellationKey) return;
        throw new BookingTransitionError('Booking is already cancelled.');
      }
      if (row.status !== 'HOLD' && row.status !== 'CONFIRMED') {
        throw new BookingTransitionError(`Cannot cancel a booking in status ${row.status}.`);
      }
      const from = row.status;
      const succeededPayment = await getSucceededPayment(client, row.id);
      const paid = succeededPayment !== null;
      const checkIn = asDate(row.check_in, 'check_in');
      const snapshot = readCancellationPolicySnapshot(row.cancellation_policy_snapshot);
      if (snapshot === null) {
        throw new BookingTransitionError(
          'Booking has no immutable cancellation policy snapshot; operations review is required before cancellation.',
        );
      }
      const evaluation = evaluateCancellationPolicy({
        snapshot,
        now,
        paidAmountVnd: succeededPayment?.amountVnd ?? 0n,
        bookingEligible: checkIn.getTime() > now.getTime(),
      });

      await client.query(
        `UPDATE bookings
            SET status = 'CANCELLED',
                cancelled_at = $2,
                cancellation_reason = $3,
                cancellation_policy_snapshot = $4,
                cancellation_idempotency_key = $5,
                cancellation_requested_at = $2,
                cancellation_refund_state = $6,
                cancellation_refund_amount_vnd = $7,
                cancellation_retained_amount_vnd = $8,
                updated_at = $2
          WHERE id = $1`,
        [
          row.id,
          now,
          command.reason,
          JSON.stringify(snapshot),
          cancellationKey,
          evaluation.refundAmountVnd > 0n ? 'REVIEW_REQUIRED' : 'NO_REFUND',
          evaluation.refundAmountVnd.toString(),
          evaluation.retainedAmountVnd.toString(),
        ],
      );

      await cancelFutureArrivalPreparation(client, row.id, now);

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
          policyCode: snapshot.code,
          policyVersion: snapshot.version,
          refundBasis: snapshot.refundBasis,
          refundPercent: evaluation.refundPercent,
          refundAmountVnd: evaluation.refundAmountVnd.toString(),
          retainedAmountVnd: evaluation.retainedAmountVnd.toString(),
          idempotencyKey: cancellationKey,
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
        throw new BookingTransitionError(`Cannot check in a booking in status ${row.status}.`);
      }
      await assertCheckInReadiness(client, row, now);
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
        throw new BookingTransitionError(`Cannot check out a booking in status ${row.status}.`);
      }
      await lockAssignedRoom(client, row.property_id, row.room_id);
      await client.query(
        `UPDATE bookings
            SET status = 'CHECKED_OUT',
                checked_out_at = $2,
                updated_at = $2
          WHERE id = $1`,
        [row.id, now],
      );
      await client.query(
        `UPDATE rooms
            SET housekeeping_status = 'DIRTY',
                updated_at = $2
          WHERE id = $1
            AND property_id = $3`,
        [row.room_id, now, row.property_id],
      );
      await client.query(
        `INSERT INTO housekeeping_tasks (
            property_id, room_id, booking_id, type, status, due_at
         )
         VALUES ($1, $2, $3, 'TURNOVER', 'DUE', $4)
         ON CONFLICT (booking_id, type)
         WHERE booking_id IS NOT NULL
         DO NOTHING`,
        [row.property_id, row.room_id, row.id, now],
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
      await cancelFutureArrivalPreparation(client, row.id, now);
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
        `SELECT b.id, b.property_id, b.room_id, b.booking_code, b.status,
                p.timezone AS property_timezone,
                b.cancellation_policy_snapshot,
                b.cancellation_idempotency_key,
                check_in, check_out, cancelled_at, checked_in_at,
                checked_out_at, no_show_at, cancellation_reason, hold_expires_at
           FROM bookings b
           JOIN properties p ON p.id = b.property_id
          WHERE b.booking_code = $1
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

async function lockAssignedRoom(
  client: DatabasePoolClient,
  propertyId: string,
  roomId: string,
): Promise<void> {
  const locked = await client.query<{ id: string }>(
    `SELECT id
       FROM rooms
      WHERE property_id = $1
        AND id = $2
      FOR UPDATE`,
    [propertyId, roomId],
  );
  if (locked.rows[0] === undefined) {
    throw new BookingTransitionError('Assigned room is unavailable for check-out.');
  }
}

async function assertCheckInReadiness(
  client: DatabasePoolClient,
  row: BookingLifecycleRow,
  now: Date,
): Promise<void> {
  if (!(await isPaymentSucceeded(client, row.id))) {
    throw new BookingTransitionError('A successful payment is required before check-in.');
  }
  const checkIn = asDate(row.check_in, 'check_in');
  const checkOut = asDate(row.check_out, 'check_out');
  if (now.getTime() < checkIn.getTime() || now.getTime() >= checkOut.getTime()) {
    throw new BookingTransitionError(
      'Check-in is not permitted outside the scheduled stay window.',
    );
  }
  const room = await client.query<{
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    housekeeping_status: 'CLEAN' | 'DIRTY' | 'CLEANING';
    maintenance_active: boolean;
    occupied_by_another_booking: boolean;
  }>(
    `SELECT r.status, r.housekeeping_status,
            EXISTS (
              SELECT 1 FROM maintenance_blocks mb
               WHERE mb.property_id = r.property_id AND mb.room_id = r.id
                 AND mb.status = 'ACTIVE' AND mb.starts_at <= $3 AND mb.ends_at > $3
            ) AS maintenance_active,
            EXISTS (
              SELECT 1 FROM bookings b
               WHERE b.property_id = r.property_id AND b.room_id = r.id
                 AND b.id <> $1 AND b.status = 'CHECKED_IN'
            ) AS occupied_by_another_booking
       FROM rooms r
      WHERE r.id = $2 AND r.property_id = $4
      FOR UPDATE`,
    [row.id, row.room_id, now, row.property_id],
  );
  const state = room.rows[0];
  if (state === undefined) {
    throw new BookingTransitionError('Assigned room is unavailable for check-in.');
  }
  if (state.status !== 'ACTIVE') {
    throw new BookingTransitionError('Assigned room is not operationally active.');
  }
  if (state.maintenance_active) {
    throw new BookingTransitionError('Assigned room has an active maintenance block.');
  }
  if (state.housekeeping_status !== 'CLEAN') {
    throw new BookingTransitionError('Assigned room is not clean and ready for check-in.');
  }
  if (state.occupied_by_another_booking) {
    throw new BookingTransitionError('Assigned room is already occupied by another booking.');
  }
}

async function isPaymentSucceeded(client: DatabasePoolClient, bookingId: string): Promise<boolean> {
  return (await getSucceededPayment(client, bookingId)) !== null;
}

async function getSucceededPayment(
  client: DatabasePoolClient,
  bookingId: string,
): Promise<{ readonly id: string; readonly amountVnd: bigint } | null> {
  const result = await client.query<{ id: string; amount_vnd: string }>(
    `SELECT id, amount_vnd::text AS amount_vnd
       FROM payments
      WHERE booking_id = $1 AND status = 'SUCCEEDED'
      ORDER BY succeeded_at DESC NULLS LAST, id DESC
      LIMIT 1`,
    [bookingId],
  );
  const row = result.rows[0];
  return row === undefined ? null : { id: row.id, amountVnd: BigInt(row.amount_vnd) };
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

async function cancelFutureArrivalPreparation(
  client: DatabasePoolClient,
  bookingId: string,
  now: Date,
): Promise<void> {
  await client.query(
    `UPDATE housekeeping_tasks
        SET status = 'CANCELLED', updated_at = $2
      WHERE booking_id = $1
        AND type = 'ARRIVAL_PREP'
        AND status IN ('SCHEDULED', 'DUE')
        AND due_at > $2`,
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

function normalizeCancellationKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 200) {
    throw new BookingTransitionError('A valid cancellation idempotency key is required.');
  }
  return normalized;
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
    [input.propertyId, input.bookingId, input.eventType, JSON.stringify(input.payload)],
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
