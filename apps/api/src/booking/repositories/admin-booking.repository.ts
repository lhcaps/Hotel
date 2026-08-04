import type { DatabasePool } from '@room/database';

import type { AdminBookingListQuery, AdminOperationalReviewListQuery } from '@room/contracts';

export type AdminBookingStatus =
  'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_IN' | 'CHECKED_OUT';

export type AdminPaymentStatusSummary =
  'NONE' | 'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED';

export type AdminReviewPresence = 'OPEN' | 'RESOLVED' | 'NONE';

export interface AdminBookingListRow {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly propertyId: string;
  readonly status: AdminBookingStatus;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly finalAmountVnd: bigint;
  readonly currency: 'VND';
  readonly createdAt: Date;
  readonly roomTypeId: string;
  readonly roomTypeCode: string;
  readonly roomTypeName: string;
  readonly roomId: string | null;
  readonly roomNumber: string | null;
  readonly fullName: string;
  readonly paymentStatus: AdminPaymentStatusSummary;
  readonly reviewPresence: AdminReviewPresence;
}

export interface AdminBookingDetailRow extends AdminBookingListRow {
  readonly propertyCode: string;
  readonly propertyName: string;
  readonly propertyTimezone: string;
  readonly adults: number;
  readonly children: number;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly pricingRuleVersion: string | null;
  readonly priceSnapshot: unknown;
  readonly holdExpiresAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly checkedInAt: Date | null;
  readonly checkedOutAt: Date | null;
  readonly noShowAt: Date | null;
  readonly cancellationReason: string | null;
  readonly normalizedEmail: string;
  readonly normalizedPhoneE164: string;
  readonly maxOccupancy: number;
  readonly coupon: AdminBookingDetailCoupon | null;
  readonly paymentAmountVnd: bigint | null;
  readonly paymentConfirmationSource: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  readonly paymentSucceededAt: Date | null;
  readonly reviewId: string | null;
  readonly reviewCategory: 'PAID_CANCELLATION' | null;
  readonly reviewOpenedAt: Date | null;
  readonly reviewOpenedReason: string | null;
  readonly reviewResolvedAt: Date | null;
  readonly reviewResolvedNote: string | null;
}

export interface AdminBookingDetailCoupon {
  readonly code: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
}

export interface AdminBookingTimelineRow {
  readonly id: string;
  readonly eventType: string;
  readonly actorType: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  readonly actorId: string | null;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

export interface AdminOperationalReviewSummaryRow {
  readonly reviewId: string;
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly bookingStatus: AdminBookingStatus;
  readonly category: 'PAID_CANCELLATION';
  readonly status: 'OPEN' | 'RESOLVED';
  readonly openedAt: Date;
  readonly openedReason: string;
  readonly resolvedAt: Date | null;
  readonly resolvedNote: string | null;
  readonly finalAmountVnd: bigint;
  readonly currency: 'VND';
  readonly paymentStatus: AdminPaymentStatusSummary;
  readonly paymentAmountVnd: bigint | null;
  readonly paymentSucceededAt: Date | null;
  readonly paymentConfirmationSource: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  readonly roomId: string | null;
  readonly roomNumber: string | null;
  readonly roomTypeCode: string;
  readonly roomTypeName: string;
}

export interface AdminOperationalReviewDetailRow extends AdminOperationalReviewSummaryRow {
  readonly propertyId: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
}

interface AdminBookingListDbRow {
  booking_id: string;
  booking_code: string;
  property_id: string;
  status: AdminBookingStatus;
  check_in: Date | string;
  check_out: Date | string;
  final_amount_vnd: string | number | bigint;
  currency: 'VND';
  created_at: Date | string;
  room_type_id: string;
  room_type_code: string;
  room_type_name: string;
  room_id: string | null;
  room_number: string | null;
  full_name: string;
  payment_status: string | null;
  review_status: string | null;
}

interface AdminBookingDetailDbRow extends AdminBookingListDbRow {
  property_code: string;
  property_name: string;
  property_timezone: string;
  adults: number;
  children: number;
  gross_amount_vnd: string | number | bigint;
  discount_amount_vnd: string | number | bigint;
  pricing_rule_version: string | null;
  price_snapshot: unknown;
  hold_expires_at: Date | string | null;
  cancelled_at: Date | string | null;
  checked_in_at: Date | string | null;
  checked_out_at: Date | string | null;
  no_show_at: Date | string | null;
  cancellation_reason: string | null;
  normalized_email: string;
  normalized_phone_e164: string;
  max_occupancy: number;
  coupon_code: string | null;
  coupon_discount_type: 'FIXED' | 'PERCENTAGE' | null;
  coupon_gross_amount_vnd: string | number | bigint | null;
  coupon_discount_amount_vnd: string | number | bigint | null;
  coupon_final_amount_vnd: string | number | bigint | null;
  payment_amount_vnd: string | number | bigint | null;
  payment_confirmation_source: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  payment_succeeded_at: Date | string | null;
  review_id: string | null;
  review_category: 'PAID_CANCELLATION' | null;
  review_opened_at: Date | string | null;
  review_opened_reason: string | null;
  review_resolved_at: Date | string | null;
  review_resolved_note: string | null;
}

interface AdminOperationalReviewDbRow {
  review_id: string;
  booking_id: string;
  category: 'PAID_CANCELLATION';
  status: 'OPEN' | 'RESOLVED';
  opened_at: Date | string;
  opened_reason: string;
  resolved_at: Date | string | null;
  resolved_note: string | null;
  property_id?: string;
  booking_code: string;
  booking_status: AdminBookingStatus;
  check_in: Date | string;
  check_out: Date | string;
  final_amount_vnd: string | number | bigint;
  currency: 'VND';
  room_type_code: string;
  room_type_name: string;
  room_id: string | null;
  room_number: string | null;
  payment_amount_vnd: string | number | bigint | null;
  payment_status: string | null;
  payment_succeeded_at: Date | string | null;
  payment_confirmation_source: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
}

const SAFE_PAYLOAD_KEYS = new Set([
  'bookingCode',
  'from',
  'reason',
  'paid',
  'lateBySeconds',
  'reviewId',
  'category',
  'status',
  'note',
  'correlationId',
  'idempotencyKey',
]);

function asDate(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

function asOptionalDate(value: Date | string | null, field: string): Date | null {
  if (value === null) return null;
  return asDate(value, field);
}

function asBigInt(value: string | number | bigint, _field: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(value);
}

function paymentStatusSummary(value: string | null): AdminPaymentStatusSummary {
  if (value === null) return 'NONE';
  if (
    value === 'PENDING' ||
    value === 'SUCCEEDED' ||
    value === 'REVIEW_REQUIRED' ||
    value === 'CANCELLED' ||
    value === 'EXPIRED'
  ) {
    return value;
  }
  return 'NONE';
}

function reviewPresence(value: string | null): AdminReviewPresence {
  if (value === 'OPEN') return 'OPEN';
  if (value === 'RESOLVED') return 'RESOLVED';
  return 'NONE';
}

function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SAFE_PAYLOAD_KEYS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function readDetailCoupon(row: AdminBookingDetailDbRow): AdminBookingDetailCoupon | null {
  if (row.coupon_code === null || row.coupon_discount_type === null) return null;
  if (
    row.coupon_gross_amount_vnd === null ||
    row.coupon_discount_amount_vnd === null ||
    row.coupon_final_amount_vnd === null
  ) {
    return null;
  }
  return {
    code: row.coupon_code,
    discountType: row.coupon_discount_type,
    grossAmountVnd: asBigInt(row.coupon_gross_amount_vnd, 'coupon_gross_amount_vnd'),
    discountAmountVnd: asBigInt(row.coupon_discount_amount_vnd, 'coupon_discount_amount_vnd'),
    finalAmountVnd: asBigInt(row.coupon_final_amount_vnd, 'coupon_final_amount_vnd'),
  };
}

function toAdminBookingListRow(row: AdminBookingListDbRow): AdminBookingListRow {
  return {
    bookingId: row.booking_id,
    bookingCode: row.booking_code,
    propertyId: row.property_id,
    status: row.status,
    checkIn: asDate(row.check_in, 'check_in'),
    checkOut: asDate(row.check_out, 'check_out'),
    finalAmountVnd: asBigInt(row.final_amount_vnd, 'final_amount_vnd'),
    currency: row.currency,
    createdAt: asDate(row.created_at, 'created_at'),
    roomTypeId: row.room_type_id,
    roomTypeCode: row.room_type_code,
    roomTypeName: row.room_type_name,
    roomId: row.room_id,
    roomNumber: row.room_number,
    fullName: row.full_name,
    paymentStatus: paymentStatusSummary(row.payment_status),
    reviewPresence: reviewPresence(row.review_status),
  };
}

function toAdminBookingDetailRow(row: AdminBookingDetailDbRow): AdminBookingDetailRow {
  const base = toAdminBookingListRow(row);
  return {
    ...base,
    propertyCode: row.property_code,
    propertyName: row.property_name,
    propertyTimezone: row.property_timezone,
    adults: row.adults,
    children: row.children,
    grossAmountVnd: asBigInt(row.gross_amount_vnd, 'gross_amount_vnd'),
    discountAmountVnd: asBigInt(row.discount_amount_vnd, 'discount_amount_vnd'),
    pricingRuleVersion: row.pricing_rule_version,
    priceSnapshot: row.price_snapshot,
    holdExpiresAt: asOptionalDate(row.hold_expires_at, 'hold_expires_at'),
    cancelledAt: asOptionalDate(row.cancelled_at, 'cancelled_at'),
    checkedInAt: asOptionalDate(row.checked_in_at, 'checked_in_at'),
    checkedOutAt: asOptionalDate(row.checked_out_at, 'checked_out_at'),
    noShowAt: asOptionalDate(row.no_show_at, 'no_show_at'),
    cancellationReason: row.cancellation_reason,
    normalizedEmail: row.normalized_email,
    normalizedPhoneE164: row.normalized_phone_e164,
    maxOccupancy: row.max_occupancy,
    coupon: readDetailCoupon(row),
    paymentAmountVnd:
      row.payment_amount_vnd === null
        ? null
        : asBigInt(row.payment_amount_vnd, 'payment_amount_vnd'),
    paymentConfirmationSource: row.payment_confirmation_source,
    paymentSucceededAt: asOptionalDate(row.payment_succeeded_at, 'payment_succeeded_at'),
    reviewId: row.review_id,
    reviewCategory: row.review_category,
    reviewOpenedAt: asOptionalDate(row.review_opened_at, 'review_opened_at'),
    reviewOpenedReason: row.review_opened_reason,
    reviewResolvedAt: asOptionalDate(row.review_resolved_at, 'review_resolved_at'),
    reviewResolvedNote: row.review_resolved_note,
  };
}

function toAdminOperationalReviewSummaryRow(
  row: AdminOperationalReviewDbRow,
): AdminOperationalReviewSummaryRow {
  return {
    reviewId: row.review_id,
    bookingId: row.booking_id,
    bookingCode: row.booking_code,
    bookingStatus: row.booking_status,
    category: row.category,
    status: row.status,
    openedAt: asDate(row.opened_at, 'opened_at'),
    openedReason: row.opened_reason,
    resolvedAt: asOptionalDate(row.resolved_at, 'resolved_at'),
    resolvedNote: row.resolved_note,
    finalAmountVnd: asBigInt(row.final_amount_vnd, 'final_amount_vnd'),
    currency: row.currency,
    paymentStatus: paymentStatusSummary(row.payment_status),
    paymentAmountVnd:
      row.payment_amount_vnd === null
        ? null
        : asBigInt(row.payment_amount_vnd, 'payment_amount_vnd'),
    paymentSucceededAt: asOptionalDate(row.payment_succeeded_at, 'payment_succeeded_at'),
    paymentConfirmationSource: row.payment_confirmation_source,
    roomId: row.room_id,
    roomNumber: row.room_number,
    roomTypeCode: row.room_type_code,
    roomTypeName: row.room_type_name,
  };
}

function toAdminOperationalReviewDetailRow(
  row: AdminOperationalReviewDbRow,
): AdminOperationalReviewDetailRow {
  return {
    ...toAdminOperationalReviewSummaryRow(row),
    propertyId: row.property_id ?? '',
    checkIn: asDate(row.check_in, 'check_in'),
    checkOut: asDate(row.check_out, 'check_out'),
  };
}

interface ListFilters {
  whereSql: string;
  params: unknown[];
}

function buildListFilters(propertyId: string, query: AdminBookingListQuery): ListFilters {
  const conditions: string[] = ['b.property_id = $1'];
  const params: unknown[] = [propertyId];
  let index = 2;

  if (query.q !== undefined) {
    conditions.push(`b.booking_code LIKE $${index} || '%'`);
    params.push(query.q);
    index += 1;
  }
  if (query.status !== undefined) {
    conditions.push(`b.status = $${index}`);
    params.push(query.status);
    index += 1;
  }
  if (query.paymentStatus !== undefined) {
    if (query.paymentStatus === 'NONE') {
      conditions.push('pay.status IS NULL');
    } else {
      conditions.push(`pay.status = $${index}`);
      params.push(query.paymentStatus);
      index += 1;
    }
  }
  if (query.customerUserId !== undefined) {
    conditions.push(`b.customer_user_id = $${index}`);
    params.push(query.customerUserId);
    index += 1;
  }
  if (query.roomTypeId !== undefined) {
    conditions.push(`b.room_type_id = $${index}`);
    params.push(query.roomTypeId);
    index += 1;
  }
  if (query.checkInFrom !== undefined) {
    conditions.push(`b.check_in >= $${index}`);
    params.push(new Date(query.checkInFrom));
    index += 1;
  }
  if (query.checkInTo !== undefined) {
    conditions.push(`b.check_in <= $${index}`);
    params.push(new Date(query.checkInTo));
    index += 1;
  }
  if (query.reviewPresence === 'open') {
    conditions.push("rv.status = 'OPEN'");
  } else if (query.reviewPresence === 'resolved') {
    conditions.push(
      `EXISTS (SELECT 1 FROM operational_reviews rv2 WHERE rv2.booking_id = b.id AND rv2.status = 'RESOLVED')`,
    );
  } else if (query.reviewPresence === 'none') {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM operational_reviews rv3 WHERE rv3.booking_id = b.id)`,
    );
  }

  return { whereSql: conditions.join(' AND '), params };
}

export class AdminBookingRepository {
  public constructor(private readonly pool: DatabasePool) {}

  public async listBookings(
    propertyId: string,
    query: AdminBookingListQuery,
  ): Promise<{ items: AdminBookingListRow[]; totalItems: number }> {
    const filters = buildListFilters(propertyId, query);
    const limit = query.pageSize;
    const offset = (query.page - 1) * query.pageSize;

    const listSql = `
      SELECT b.id              AS booking_id,
             b.booking_code    AS booking_code,
             b.property_id     AS property_id,
             b.status          AS status,
             b.check_in        AS check_in,
             b.check_out       AS check_out,
             b.final_amount_vnd AS final_amount_vnd,
             b.currency        AS currency,
             b.created_at      AS created_at,
             rt.id             AS room_type_id,
             rt.code           AS room_type_code,
             rt.name           AS room_type_name,
             r.id              AS room_id,
             r.room_number     AS room_number,
             bc.full_name      AS full_name,
             pay.status        AS payment_status,
             rv.status         AS review_status
        FROM bookings b
        JOIN room_types rt
             ON rt.property_id = b.property_id AND rt.id = b.room_type_id
        LEFT JOIN rooms r
             ON r.property_id = b.property_id AND r.id = b.room_id
        JOIN booking_contacts bc ON bc.booking_id = b.id
        LEFT JOIN payments pay ON pay.booking_id = b.id
        LEFT JOIN LATERAL (
          SELECT *
            FROM operational_reviews
           WHERE booking_id = b.id AND status = 'OPEN'
           ORDER BY opened_at DESC
           LIMIT 1
        ) rv ON TRUE
       WHERE ${filters.whereSql}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const totalSql = `
      SELECT COUNT(*)::text AS count
        FROM bookings b
        JOIN room_types rt
             ON rt.property_id = b.property_id AND rt.id = b.room_type_id
        LEFT JOIN rooms r
             ON r.property_id = b.property_id AND r.id = b.room_id
        JOIN booking_contacts bc ON bc.booking_id = b.id
        LEFT JOIN payments pay ON pay.booking_id = b.id
        LEFT JOIN LATERAL (
          SELECT *
            FROM operational_reviews
           WHERE booking_id = b.id AND status = 'OPEN'
           ORDER BY opened_at DESC
           LIMIT 1
        ) rv ON TRUE
       WHERE ${filters.whereSql}`;

    const [items, total] = await Promise.all([
      this.pool.query<AdminBookingListDbRow>(listSql, filters.params),
      this.pool.query<{ count: string }>(totalSql, filters.params),
    ]);
    return {
      items: items.rows.map(toAdminBookingListRow),
      totalItems: Number(total.rows[0]?.count ?? '0'),
    };
  }

  public async findDetailByBookingCode(bookingCode: string): Promise<AdminBookingDetailRow | null> {
    const result = await this.pool.query<AdminBookingDetailDbRow>(
      `SELECT b.id                       AS booking_id,
              b.booking_code             AS booking_code,
              b.property_id              AS property_id,
              b.status                   AS status,
              b.check_in                 AS check_in,
              b.check_out                AS check_out,
              b.adults                   AS adults,
              b.children                 AS children,
              b.currency                 AS currency,
              b.gross_amount_vnd         AS gross_amount_vnd,
              b.discount_amount_vnd      AS discount_amount_vnd,
              b.final_amount_vnd         AS final_amount_vnd,
              b.pricing_rule_version     AS pricing_rule_version,
              b.price_snapshot           AS price_snapshot,
              b.hold_expires_at          AS hold_expires_at,
              b.cancelled_at             AS cancelled_at,
              b.checked_in_at            AS checked_in_at,
              b.checked_out_at           AS checked_out_at,
              b.no_show_at               AS no_show_at,
              b.cancellation_reason      AS cancellation_reason,
              b.created_at               AS created_at,
              rt.id                      AS room_type_id,
              rt.code                    AS room_type_code,
              rt.name                    AS room_type_name,
              rt.max_occupancy           AS max_occupancy,
              r.id                       AS room_id,
              r.room_number              AS room_number,
              p.code                     AS property_code,
              p.name                     AS property_name,
              p.timezone                 AS property_timezone,
              bc.full_name               AS full_name,
              bc.normalized_email        AS normalized_email,
              bc.normalized_phone_e164   AS normalized_phone_e164,
              bca.coupon_code_snapshot   AS coupon_code,
              bca.discount_type          AS coupon_discount_type,
              bca.gross_amount_vnd       AS coupon_gross_amount_vnd,
              bca.discount_amount_vnd    AS coupon_discount_amount_vnd,
              bca.final_amount_vnd       AS coupon_final_amount_vnd,
              pay.amount_vnd             AS payment_amount_vnd,
              pay.confirmation_source    AS payment_confirmation_source,
              pay.succeeded_at           AS payment_succeeded_at,
              pay.status                 AS payment_status,
              rv.id                      AS review_id,
              rv.category                AS review_category,
              rv.opened_at               AS review_opened_at,
              rv.opened_reason           AS review_opened_reason,
              rv.resolved_at             AS review_resolved_at,
              rv.resolved_note           AS review_resolved_note,
              NULL::text                 AS review_status
         FROM bookings b
         JOIN properties p ON p.id = b.property_id
         JOIN room_types rt
              ON rt.property_id = b.property_id AND rt.id = b.room_type_id
         LEFT JOIN rooms r
              ON r.property_id = b.property_id AND r.id = b.room_id
         JOIN booking_contacts bc ON bc.booking_id = b.id
         LEFT JOIN booking_coupon_applications bca ON bca.booking_id = b.id
         LEFT JOIN payments pay ON pay.booking_id = b.id
         LEFT JOIN LATERAL (
           SELECT *
             FROM operational_reviews
            WHERE booking_id = b.id
            ORDER BY opened_at DESC
            LIMIT 1
         ) rv ON TRUE
        WHERE b.booking_code = $1
        LIMIT 1`,
      [bookingCode],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toAdminBookingDetailRow(row);
  }

  public async listTimelineByBookingId(bookingId: string): Promise<AdminBookingTimelineRow[]> {
    const result = await this.pool.query<{
      id: string;
      event_type: string;
      actor_type: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
      actor_id: string | null;
      occurred_at: Date | string;
      payload: unknown;
    }>(
      `SELECT id, event_type, actor_type, actor_id, occurred_at, payload
         FROM audit_events
        WHERE aggregate_type = 'BOOKING' AND aggregate_id = $1
        ORDER BY occurred_at ASC, id ASC`,
      [bookingId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      actorType: row.actor_type,
      actorId: row.actor_id,
      occurredAt: asDate(row.occurred_at, 'occurred_at'),
      payload: sanitizePayload(row.payload),
    }));
  }

  public async listOperationalReviews(
    propertyId: string,
    query: AdminOperationalReviewListQuery,
  ): Promise<{ items: AdminOperationalReviewSummaryRow[]; totalItems: number }> {
    const status = query.status ?? 'OPEN';
    const limit = query.pageSize;
    const offset = (query.page - 1) * query.pageSize;
    const conditions: string[] = ['rv.property_id = $1', 'rv.status = $2'];
    const params: unknown[] = [propertyId, status];
    let index = 3;
    if (query.bookingCode !== undefined) {
      conditions.push(`b.booking_code LIKE $${index} || '%'`);
      params.push(query.bookingCode);
      index += 1;
    }
    const whereSql = conditions.join(' AND ');

    const itemsSql = `
      SELECT rv.id              AS review_id,
             rv.booking_id      AS booking_id,
             rv.category        AS category,
             rv.status          AS status,
             rv.opened_at       AS opened_at,
             rv.opened_reason   AS opened_reason,
             rv.resolved_at     AS resolved_at,
             rv.resolved_note   AS resolved_note,
             b.booking_code     AS booking_code,
             b.status           AS booking_status,
             b.check_in         AS check_in,
             b.check_out        AS check_out,
             b.final_amount_vnd AS final_amount_vnd,
             b.currency         AS currency,
             rt.code            AS room_type_code,
             rt.name            AS room_type_name,
             r.id               AS room_id,
             r.room_number      AS room_number,
             pay.amount_vnd     AS payment_amount_vnd,
             pay.status         AS payment_status,
             pay.succeeded_at   AS payment_succeeded_at,
             pay.confirmation_source AS payment_confirmation_source
        FROM operational_reviews rv
        JOIN bookings b ON b.id = rv.booking_id AND b.property_id = rv.property_id
        JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id
        LEFT JOIN rooms r ON r.property_id = b.property_id AND r.id = b.room_id
        LEFT JOIN payments pay ON pay.booking_id = b.id
       WHERE ${whereSql}
       ORDER BY rv.opened_at DESC, rv.id DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const totalSql = `
      SELECT COUNT(*)::text AS count
        FROM operational_reviews rv
        JOIN bookings b ON b.id = rv.booking_id AND b.property_id = rv.property_id
       WHERE ${whereSql}`;

    const [items, total] = await Promise.all([
      this.pool.query<AdminOperationalReviewDbRow>(itemsSql, params),
      this.pool.query<{ count: string }>(totalSql, params),
    ]);
    return {
      items: items.rows.map(toAdminOperationalReviewSummaryRow),
      totalItems: Number(total.rows[0]?.count ?? '0'),
    };
  }

  public async findOperationalReviewById(
    reviewId: string,
  ): Promise<AdminOperationalReviewDetailRow | null> {
    const result = await this.pool.query<AdminOperationalReviewDbRow>(
      `SELECT rv.id              AS review_id,
              rv.booking_id      AS booking_id,
              rv.category        AS category,
              rv.status          AS status,
              rv.opened_at       AS opened_at,
              rv.opened_reason   AS opened_reason,
              rv.resolved_at     AS resolved_at,
              rv.resolved_note   AS resolved_note,
              rv.property_id     AS property_id,
              b.booking_code     AS booking_code,
              b.status           AS booking_status,
              b.check_in         AS check_in,
              b.check_out        AS check_out,
              b.final_amount_vnd AS final_amount_vnd,
              b.currency         AS currency,
              rt.code            AS room_type_code,
              rt.name            AS room_type_name,
              r.id               AS room_id,
              r.room_number      AS room_number,
              pay.amount_vnd     AS payment_amount_vnd,
              pay.status         AS payment_status,
              pay.succeeded_at   AS payment_succeeded_at,
              pay.confirmation_source AS payment_confirmation_source
         FROM operational_reviews rv
         JOIN bookings b ON b.id = rv.booking_id AND b.property_id = rv.property_id
         JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id
         LEFT JOIN rooms r ON r.property_id = b.property_id AND r.id = b.room_id
         LEFT JOIN payments pay ON pay.booking_id = b.id
        WHERE rv.id = $1
        LIMIT 1`,
      [reviewId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toAdminOperationalReviewDetailRow(row);
  }
}
