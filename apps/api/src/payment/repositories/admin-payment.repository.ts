import type { DatabasePool } from '@room/database';

import type { AdminPaymentListQuery } from '@room/contracts';

export type AdminPaymentListStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'REVIEW_REQUIRED'
  | 'CANCELLED'
  | 'EXPIRED';

export type AdminPaymentAttemptStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REVIEW_REQUIRED'
  | 'EXPIRED'
  | 'CANCELLED';

export type AdminPaymentConfirmationSource = 'PROVIDER_EVENT' | 'NO_CHARGE' | null;

export type AdminPaymentProvider = 'MOMO' | 'VNPAY';

export interface AdminPaymentBookingSnapshot {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly bookingStatus:
    | 'HOLD'
    | 'CONFIRMED'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'NO_SHOW'
    | 'CHECKED_IN'
    | 'CHECKED_OUT';
  readonly finalAmountVnd: bigint;
  readonly currency: 'VND';
  readonly fullName: string;
  readonly normalizedEmail: string;
  readonly normalizedPhoneE164: string;
}

export interface AdminPaymentAttemptRefRow {
  readonly paymentAttemptId: string;
  readonly provider: AdminPaymentProvider;
  readonly status: AdminPaymentAttemptStatus;
  readonly initiatedAt: Date;
  readonly completedAt: Date | null;
  readonly amountVnd: bigint;
  readonly currency: 'VND';
  readonly idempotencyKey: string;
  readonly providerOrderId: string;
  readonly providerTransactionId: string | null;
  readonly reconciliationAttemptCount: number;
  readonly nextReconciliationAt: Date | null;
  readonly lastReconciledAt: Date | null;
  readonly lastErrorCode: string | null;
}

export interface AdminPaymentProviderRefRow {
  readonly provider: AdminPaymentProvider;
  readonly displayName: string;
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly environment: 'sandbox' | 'production';
  readonly checkoutExpiryMinutes: number;
}

export interface AdminPaymentOperationalReviewRow {
  readonly reviewId: string;
  readonly category: 'PAID_CANCELLATION';
  readonly status: 'OPEN' | 'RESOLVED';
  readonly openedAt: Date;
  readonly openedReason: string;
  readonly resolvedAt: Date | null;
  readonly resolvedNote: string | null;
}

export interface AdminPaymentListRow {
  readonly paymentId: string;
  readonly propertyId: string;
  readonly bookingId: string;
  readonly status: AdminPaymentListStatus;
  readonly amountVnd: bigint;
  readonly currency: 'VND';
  readonly confirmationSource: AdminPaymentConfirmationSource;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
  readonly booking: AdminPaymentBookingSnapshot;
  readonly latestAttempt: AdminPaymentAttemptRefRow | null;
  readonly providerRef: AdminPaymentProviderRefRow | null;
  readonly operationalReview: AdminPaymentOperationalReviewRow | null;
}

export interface AdminPaymentDetailRow extends AdminPaymentListRow {
  readonly succeededAt: Date | null;
  readonly reviewRequiredAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly expiredAt: Date | null;
}

export interface AdminPaymentEventRow {
  readonly id: string;
  readonly source: 'AUDIT' | 'PROVIDER_EVENT';
  readonly eventType: string;
  readonly actorType: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM' | 'PROVIDER';
  readonly actorId: string | null;
  readonly occurredAt: Date;
  readonly summary: string;
}

export interface AdminPaymentRepositoryEnvironment {
  readonly momoEnvironment: 'sandbox' | 'production';
  readonly vnpayEnvironment: 'sandbox' | 'production';
  readonly momoEnabled: boolean;
  readonly vnpayEnabled: boolean;
}

interface ListQueryDbRow {
  payment_id: string;
  property_id: string;
  booking_id: string;
  status: AdminPaymentListStatus;
  amount_vnd: string | number | bigint;
  currency: 'VND';
  confirmation_source: 'PROVIDER_EVENT' | 'NO_CHARGE' | null;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  booking_id_b: string;
  booking_code: string;
  booking_status: AdminPaymentBookingSnapshot['bookingStatus'];
  booking_final_amount_vnd: string | number | bigint;
  contact_full_name: string;
  contact_normalized_email: string;
  contact_normalized_phone_e164: string;
  attempt_id: string | null;
  attempt_provider: AdminPaymentProvider | null;
  attempt_status: AdminPaymentAttemptStatus | null;
  attempt_initiated_at: Date | string | null;
  attempt_completed_at: Date | string | null;
  attempt_amount_vnd: string | number | bigint | null;
  attempt_idempotency_key: string | null;
  attempt_provider_order_id: string | null;
  attempt_provider_transaction_id: string | null;
  attempt_reconciliation_attempt_count: number | null;
  attempt_next_reconciliation_at: Date | string | null;
  attempt_last_reconciled_at: Date | string | null;
  attempt_last_error_code: string | null;
  provider_display_name: string | null;
  provider_enabled: boolean | null;
  provider_environment: 'sandbox' | 'production' | null;
  provider_checkout_expiry_minutes: number | null;
  provider_configured: boolean | null;
  provider_environment_momo: string | null;
  provider_environment_vnpay: string | null;
  provider_configured_momo: boolean | null;
  provider_configured_vnpay: boolean | null;
  review_id: string | null;
  review_category: 'PAID_CANCELLATION' | null;
  review_status: 'OPEN' | 'RESOLVED' | null;
  review_opened_at: Date | string | null;
  review_opened_reason: string | null;
  review_resolved_at: Date | string | null;
  review_resolved_note: string | null;
  pay_succeeded_at: Date | string | null;
  pay_review_required_at: Date | string | null;
  pay_cancelled_at: Date | string | null;
  pay_expired_at: Date | string | null;
}

interface ListFilters {
  whereSql: string;
  params: unknown[];
}

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

function asBigIntAmount(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(value);
}

function toBooking(row: ListQueryDbRow): AdminPaymentBookingSnapshot {
  return {
    bookingId: row.booking_id_b,
    bookingCode: row.booking_code,
    bookingStatus: row.booking_status,
    finalAmountVnd: asBigIntAmount(row.booking_final_amount_vnd),
    currency: 'VND',
    fullName: row.contact_full_name,
    normalizedEmail: row.contact_normalized_email,
    normalizedPhoneE164: row.contact_normalized_phone_e164,
  };
}

function toAttempt(row: ListQueryDbRow): AdminPaymentAttemptRefRow | null {
  if (row.attempt_id === null) return null;
  if (
    row.attempt_provider === null ||
    row.attempt_status === null ||
    row.attempt_initiated_at === null ||
    row.attempt_amount_vnd === null ||
    row.attempt_idempotency_key === null ||
    row.attempt_provider_order_id === null
  ) {
    return null;
  }
  return {
    paymentAttemptId: row.attempt_id,
    provider: row.attempt_provider,
    status: row.attempt_status,
    initiatedAt: asDate(row.attempt_initiated_at, 'attempt_initiated_at'),
    completedAt: asOptionalDate(row.attempt_completed_at, 'attempt_completed_at'),
    amountVnd: asBigIntAmount(row.attempt_amount_vnd),
    currency: 'VND',
    idempotencyKey: row.attempt_idempotency_key,
    providerOrderId: row.attempt_provider_order_id,
    providerTransactionId: row.attempt_provider_transaction_id,
    reconciliationAttemptCount: row.attempt_reconciliation_attempt_count ?? 0,
    nextReconciliationAt: asOptionalDate(
      row.attempt_next_reconciliation_at,
      'attempt_next_reconciliation_at',
    ),
    lastReconciledAt: asOptionalDate(row.attempt_last_reconciled_at, 'attempt_last_reconciled_at'),
    lastErrorCode: row.attempt_last_error_code,
  };
}

function toProviderRef(row: ListQueryDbRow): AdminPaymentProviderRefRow | null {
  if (
    row.provider_display_name === null ||
    row.provider_environment === null ||
    row.attempt_provider === null
  ) {
    return null;
  }
  return {
    provider: row.attempt_provider,
    displayName: row.provider_display_name,
    configured: row.provider_configured ?? false,
    enabled: row.provider_enabled ?? false,
    environment: row.provider_environment,
    checkoutExpiryMinutes: row.provider_checkout_expiry_minutes ?? 15,
  };
}

function toOperationalReview(row: ListQueryDbRow): AdminPaymentOperationalReviewRow | null {
  if (
    row.review_id === null ||
    row.review_category === null ||
    row.review_status === null ||
    row.review_opened_at === null ||
    row.review_opened_reason === null
  ) {
    return null;
  }
  return {
    reviewId: row.review_id,
    category: row.review_category,
    status: row.review_status,
    openedAt: asDate(row.review_opened_at, 'review_opened_at'),
    openedReason: row.review_opened_reason,
    resolvedAt: asOptionalDate(row.review_resolved_at, 'review_resolved_at'),
    resolvedNote: row.review_resolved_note,
  };
}

function toListRow(row: ListQueryDbRow): AdminPaymentListRow {
  return {
    paymentId: row.payment_id,
    propertyId: row.property_id,
    bookingId: row.booking_id,
    status: row.status,
    amountVnd: asBigIntAmount(row.amount_vnd),
    currency: 'VND',
    confirmationSource: row.confirmation_source,
    createdAt: asDate(row.created_at, 'created_at'),
    updatedAt: asDate(row.updated_at, 'updated_at'),
    completedAt: asOptionalDate(row.completed_at, 'completed_at'),
    booking: toBooking(row),
    latestAttempt: toAttempt(row),
    providerRef: toProviderRef(row),
    operationalReview: toOperationalReview(row),
  };
}

function baseSelect(environmentParamStart: number): string {
  const momoEnvironment = environmentParamStart;
  const vnpayEnvironment = environmentParamStart + 1;
  const momoConfigured = environmentParamStart + 2;
  const vnpayConfigured = environmentParamStart + 3;
  return `
  pay.id                 AS payment_id,
  pay.property_id        AS property_id,
  pay.booking_id         AS booking_id,
  pay.status             AS status,
  pay.amount_vnd         AS amount_vnd,
  pay.currency           AS currency,
  pay.confirmation_source AS confirmation_source,
  pay.created_at         AS created_at,
  pay.updated_at         AS updated_at,
  pay.succeeded_at       AS pay_succeeded_at,
  pay.review_required_at AS pay_review_required_at,
  pay.cancelled_at       AS pay_cancelled_at,
  pay.expired_at         AS pay_expired_at,
  COALESCE(latest_attempt.completed_at, pay.succeeded_at, pay.review_required_at,
           pay.cancelled_at, pay.expired_at) AS completed_at,
  b.id                   AS booking_id_b,
  b.booking_code         AS booking_code,
  b.status               AS booking_status,
  b.final_amount_vnd     AS booking_final_amount_vnd,
  bc.full_name           AS contact_full_name,
  bc.normalized_email    AS contact_normalized_email,
  bc.normalized_phone_e164 AS contact_normalized_phone_e164,
  latest_attempt.id              AS attempt_id,
  latest_attempt.provider        AS attempt_provider,
  latest_attempt.status          AS attempt_status,
  latest_attempt.initiated_at    AS attempt_initiated_at,
  latest_attempt.completed_at    AS attempt_completed_at,
  latest_attempt.amount_vnd      AS attempt_amount_vnd,
  latest_attempt.idempotency_key AS attempt_idempotency_key,
  latest_attempt.provider_order_id AS attempt_provider_order_id,
  latest_attempt.provider_transaction_id AS attempt_provider_transaction_id,
  latest_attempt.reconciliation_attempt_count AS attempt_reconciliation_attempt_count,
  latest_attempt.next_reconciliation_at AS attempt_next_reconciliation_at,
  latest_attempt.last_reconciled_at AS attempt_last_reconciled_at,
  latest_attempt.last_error_code AS attempt_last_error_code,
  pps.display_name        AS provider_display_name,
  pps.enabled             AS provider_enabled,
  pps.checkout_expiry_minutes AS provider_checkout_expiry_minutes,
  $${momoEnvironment}::text               AS provider_environment_momo,
  $${vnpayEnvironment}::text               AS provider_environment_vnpay,
  $${momoConfigured}::boolean            AS provider_configured_momo,
  $${vnpayConfigured}::boolean            AS provider_configured_vnpay,
  rv.id                   AS review_id,
  rv.category             AS review_category,
  rv.status               AS review_status,
  rv.opened_at            AS review_opened_at,
  rv.opened_reason        AS review_opened_reason,
  rv.resolved_at          AS review_resolved_at,
  rv.resolved_note        AS review_resolved_note
`;
}

function baseFromClause(): string {
  return `
    FROM payments pay
    JOIN bookings b ON b.id = pay.booking_id AND b.property_id = pay.property_id
    JOIN booking_contacts bc ON bc.booking_id = b.id
    LEFT JOIN LATERAL (
      SELECT * FROM payment_attempts
       WHERE payment_id = pay.id
       ORDER BY initiated_at DESC, id DESC
       LIMIT 1
    ) latest_attempt ON TRUE
    LEFT JOIN payment_provider_settings pps
           ON pps.property_id = pay.property_id
          AND pps.provider = latest_attempt.provider
    LEFT JOIN LATERAL (
      SELECT * FROM operational_reviews
       WHERE booking_id = b.id
       ORDER BY opened_at DESC
       LIMIT 1
    ) rv ON TRUE`;
}

function buildListFilters(query: AdminPaymentListQuery, firstParameterIndex: number): ListFilters {
  const conditions: string[] = ['pay.property_id = $1'];
  const params: unknown[] = [];
  let index = firstParameterIndex;

  if (query.status !== undefined) {
    conditions.push(`pay.status = $${index}`);
    params.push(query.status);
    index += 1;
  }
  if (query.provider !== undefined) {
    conditions.push(`latest_attempt.provider = $${index}`);
    params.push(query.provider);
    index += 1;
  }
  if (query.bookingCode !== undefined) {
    conditions.push(`b.booking_code = $${index}`);
    params.push(query.bookingCode);
    index += 1;
  }
  if (query.reviewRequired === true) {
    conditions.push(
      "(pay.status = 'REVIEW_REQUIRED' OR latest_attempt.status = 'REVIEW_REQUIRED')",
    );
  } else if (query.reviewRequired === false) {
    conditions.push(
      "(pay.status <> 'REVIEW_REQUIRED' AND (latest_attempt.status IS NULL OR latest_attempt.status <> 'REVIEW_REQUIRED'))",
    );
  }
  if (query.createdFrom !== undefined) {
    conditions.push(`pay.created_at >= $${index}`);
    params.push(new Date(query.createdFrom));
    index += 1;
  }
  if (query.createdTo !== undefined) {
    conditions.push(`pay.created_at <= $${index}`);
    params.push(new Date(query.createdTo));
    index += 1;
  }
  return { whereSql: conditions.join(' AND '), params };
}

function projectEnvironment(row: ListQueryDbRow): ListQueryDbRow {
  const provider = row.attempt_provider;
  const environment =
    provider === 'MOMO'
      ? (row.provider_environment_momo as 'sandbox' | 'production' | null)
      : provider === 'VNPAY'
        ? (row.provider_environment_vnpay as 'sandbox' | 'production' | null)
        : null;
  const configured =
    provider === 'MOMO'
      ? row.provider_configured_momo
      : provider === 'VNPAY'
        ? row.provider_configured_vnpay
        : null;
  return { ...row, provider_environment: environment, provider_configured: configured };
}

export class AdminPaymentRepository {
  public constructor(
    private readonly pool: DatabasePool,
    private readonly environment: AdminPaymentRepositoryEnvironment,
  ) {}

  public async listPayments(
    propertyId: string,
    query: AdminPaymentListQuery,
  ): Promise<{ items: AdminPaymentListRow[]; totalItems: number }> {
    const filters = buildListFilters(query, 6);
    const totalFilters = buildListFilters(query, 2);
    const limit = query.pageSize;
    const offset = (query.page - 1) * query.pageSize;

    const params: unknown[] = [
      propertyId,
      this.environment.momoEnvironment,
      this.environment.vnpayEnvironment,
      this.environment.momoEnabled,
      this.environment.vnpayEnabled,
      ...filters.params,
    ];
    const whereSql = filters.whereSql;

    const itemsSql = `
      SELECT ${baseSelect(2)}
      ${baseFromClause()}
       WHERE ${whereSql}
       ORDER BY pay.created_at DESC, pay.id DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const totalSql = `
      SELECT COUNT(*)::text AS count
        FROM payments pay
        JOIN bookings b ON b.id = pay.booking_id AND b.property_id = pay.property_id
        LEFT JOIN LATERAL (
          SELECT * FROM payment_attempts
           WHERE payment_id = pay.id
           ORDER BY initiated_at DESC, id DESC
           LIMIT 1
        ) latest_attempt ON TRUE
        LEFT JOIN LATERAL (
          SELECT * FROM operational_reviews
           WHERE booking_id = b.id
           ORDER BY opened_at DESC
           LIMIT 1
        ) rv ON TRUE
       WHERE ${totalFilters.whereSql}`;

    const [items, total] = await Promise.all([
      this.pool.query<ListQueryDbRow>(itemsSql, params),
      this.pool.query<{ count: string }>(totalSql, [propertyId, ...totalFilters.params]),
    ]);
    return {
      items: items.rows.map((row) => toListRow(projectEnvironment(row))),
      totalItems: Number(total.rows[0]?.count ?? '0'),
    };
  }

  public async findDetailByPaymentId(
    paymentId: string,
    propertyId: string,
  ): Promise<AdminPaymentDetailRow | null> {
    const params: unknown[] = [
      paymentId,
      propertyId,
      this.environment.momoEnvironment,
      this.environment.vnpayEnvironment,
      this.environment.momoEnabled,
      this.environment.vnpayEnabled,
    ];
    const detailSql = `
      SELECT ${baseSelect(3)}
      ${baseFromClause()}
       WHERE pay.id = $1 AND pay.property_id = $2
       LIMIT 1`;
    const result = await this.pool.query<ListQueryDbRow>(detailSql, params);
    const rawRow = result.rows[0];
    if (rawRow === undefined) return null;
    const row = projectEnvironment(rawRow);
    const base = toListRow(row);
    return {
      ...base,
      succeededAt: asOptionalDate(row.pay_succeeded_at, 'pay_succeeded_at'),
      reviewRequiredAt: asOptionalDate(row.pay_review_required_at, 'pay_review_required_at'),
      cancelledAt: asOptionalDate(row.pay_cancelled_at, 'pay_cancelled_at'),
      expiredAt: asOptionalDate(row.pay_expired_at, 'pay_expired_at'),
    };
  }

  public async listAttempts(paymentId: string): Promise<AdminPaymentAttemptRefRow[]> {
    const result = await this.pool.query<{
      id: string;
      provider: AdminPaymentProvider;
      status: AdminPaymentAttemptStatus;
      initiated_at: Date | string;
      completed_at: Date | string | null;
      amount_vnd: string | number | bigint;
      idempotency_key: string;
      provider_order_id: string;
      provider_transaction_id: string | null;
      reconciliation_attempt_count: number;
      next_reconciliation_at: Date | string | null;
      last_reconciled_at: Date | string | null;
      last_error_code: string | null;
    }>(
      `SELECT id, provider, status, initiated_at, completed_at, amount_vnd,
              idempotency_key, provider_order_id, provider_transaction_id,
              reconciliation_attempt_count, next_reconciliation_at,
              last_reconciled_at, last_error_code
         FROM payment_attempts
        WHERE payment_id = $1
        ORDER BY initiated_at DESC, id DESC`,
      [paymentId],
    );
    return result.rows.map((row) => ({
      paymentAttemptId: row.id,
      provider: row.provider,
      status: row.status,
      initiatedAt: asDate(row.initiated_at, 'initiated_at'),
      completedAt: asOptionalDate(row.completed_at, 'completed_at'),
      amountVnd: asBigIntAmount(row.amount_vnd),
      currency: 'VND',
      idempotencyKey: row.idempotency_key,
      providerOrderId: row.provider_order_id,
      providerTransactionId: row.provider_transaction_id,
      reconciliationAttemptCount: row.reconciliation_attempt_count,
      nextReconciliationAt: asOptionalDate(
        row.next_reconciliation_at,
        'next_reconciliation_at',
      ),
      lastReconciledAt: asOptionalDate(row.last_reconciled_at, 'last_reconciled_at'),
      lastErrorCode: row.last_error_code,
    }));
  }

  public async listTimelineByBookingId(
    bookingId: string,
    paymentId: string,
  ): Promise<AdminPaymentEventRow[]> {
    const auditRows = await this.pool.query<{
      id: string;
      event_type: string;
      actor_type: 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
      actor_id: string | null;
      occurred_at: Date | string;
      payload: unknown;
    }>(
      `SELECT id, event_type, actor_type, actor_id, occurred_at, payload
         FROM audit_events
        WHERE (aggregate_type = 'BOOKING' AND aggregate_id = $1)
           OR (aggregate_type IN ('PAYMENT', 'PAYMENT_ATTEMPT') AND aggregate_id = $2)
        ORDER BY occurred_at ASC, id ASC`,
      [bookingId, paymentId],
    );
    const providerRows = await this.pool.query<{
      id: string;
      event_key: string;
      provider: 'MOMO' | 'VNPAY';
      normalized_outcome: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
      received_at: Date | string;
      processed_at: Date | string | null;
      processing_status: 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'REVIEW_REQUIRED';
    }>(
      `SELECT id, event_key, provider, normalized_outcome, received_at,
              processed_at, processing_status
         FROM payment_provider_events
        WHERE payment_attempt_id IN (
          SELECT id FROM payment_attempts WHERE payment_id = $1
        )
        ORDER BY received_at ASC, id ASC`,
      [paymentId],
    );
    const audit: AdminPaymentEventRow[] = auditRows.rows.map((row) => ({
      id: row.id,
      source: 'AUDIT',
      eventType: row.event_type,
      actorType: row.actor_type,
      actorId: row.actor_id,
      occurredAt: asDate(row.occurred_at, 'occurred_at'),
      summary: safeAuditSummary(row.event_type, row.payload),
    }));
    const providerEvents: AdminPaymentEventRow[] = providerRows.rows.map((row) => ({
      id: row.id,
      source: 'PROVIDER_EVENT',
      eventType: `PROVIDER_${row.normalized_outcome}`,
      actorType: 'PROVIDER',
      actorId: null,
      occurredAt: asDate(row.received_at, 'received_at'),
      summary: safeProviderSummary(row.provider, row.normalized_outcome, row.processing_status),
    }));
    return [...audit, ...providerEvents].sort((a, b) => {
      const diff = a.occurredAt.getTime() - b.occurredAt.getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  }
}

const SAFE_AUDIT_KEYS = new Set([
  'bookingCode',
  'paymentId',
  'paymentAttemptId',
  'provider',
  'from',
  'to',
  'reason',
  'status',
  'category',
  'reviewId',
  'note',
  'idempotencyKey',
  'reconciliationAttemptCount',
  'nextReconciliationAt',
  'lastReconciledAt',
  'lastErrorCode',
]);

function safeAuditSummary(eventType: string, payload: unknown): string {
  const summary = [`event=${eventType}`];
  if (payload !== null && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (SAFE_AUDIT_KEYS.has(key)) {
        if (
          value === null ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          summary.push(`${key}=${String(value)}`);
        }
      }
    }
  }
  return summary.join(' ').slice(0, 280);
}

function safeProviderSummary(
  provider: 'MOMO' | 'VNPAY',
  outcome: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED',
  status: 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'REVIEW_REQUIRED',
): string {
  return `provider=${provider} outcome=${outcome} processing=${status}`.slice(0, 280);
}
