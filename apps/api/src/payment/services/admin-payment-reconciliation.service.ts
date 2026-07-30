import { randomUUID } from 'node:crypto';
import {
  adminPaymentDetailSchema,
  adminPaymentListResponseSchema,
  adminPaymentReconcileRequestSchema,
  adminPaymentReconcileResponseSchema,
  adminPaymentReferenceSchema,
  adminPaymentSummarySchema,
  type AdminPaymentAttemptRef,
  type AdminPaymentAuditEntry,
  type AdminPaymentDetail,
  type AdminPaymentEvent,
  type AdminPaymentListQuery,
  type AdminPaymentListResponse,
  type AdminPaymentOperationalReview,
  type AdminPaymentProviderRef,
  type AdminPaymentReconcileRequest,
  type AdminPaymentReconcileResponse,
  type AdminPaymentReconciliationState,
  type AdminPaymentReference,
  type AdminPaymentSummary,
} from '@room/contracts';

import { maskEmailForDisplay } from '@room/booking';

import type { ActorContext } from '../../auth/actor-context.js';
import {
  AdminPaymentNotFoundError,
  AdminPaymentReconciliationStaleError,
} from '../admin-payment-reconciliation.errors.js';
import {
  ADMIN_PAYMENT_RECONCILIATION_SERVICE,
  NOOP_RECONCILIATION_OUTCOME_NOTE,
  type AdminPaymentReconciliationOutcome,
  type AdminPaymentReconciliationService as AdminPaymentReconciliationServiceInterface,
} from '../admin-payment-reconciliation.service.js';
import {
  AdminPaymentRepository,
  type AdminPaymentAttemptRefRow,
  type AdminPaymentDetailRow,
  type AdminPaymentEventRow,
  type AdminPaymentListRow,
  type AdminPaymentOperationalReviewRow,
  type AdminPaymentProviderRefRow,
} from '../repositories/admin-payment.repository.js';

const SAFE_IDEMPOTENCY_PREFIX = 'payatt_';
const SAFE_PROVIDER_ORDER_PREFIX = 'po_';
const SAFE_PROVIDER_TRANSACTION_PREFIX = 'ptxn_';

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < 0n) {
    throw new Error('admin payment amount is out of safe display range');
  }
  return Number(value);
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function maskPhone(phoneE164: string): string {
  if (phoneE164.length <= 4) return phoneE164;
  return `${phoneE164.slice(0, 3)}••••${phoneE164.slice(-2)}`;
}

function maskIdentifier(value: string, prefix: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return `${prefix}0`;
  const tail = trimmed.slice(-6).padStart(6, '0');
  return `${prefix}${tail}`;
}

function deriveReviewRequired(row: AdminPaymentListRow): boolean {
  if (row.status === 'REVIEW_REQUIRED') return true;
  if (row.latestAttempt?.status === 'REVIEW_REQUIRED') return true;
  return false;
}

function toBookingReference(row: AdminPaymentListRow['booking']): AdminPaymentReference {
  return adminPaymentReferenceSchema.parse({
    bookingId: row.bookingId,
    bookingCode: row.bookingCode,
    bookingStatus: row.bookingStatus,
    finalAmountVnd: toSafeNumber(row.finalAmountVnd),
    currency: 'VND',
    contact: {
      fullName: row.fullName,
      emailMasked: maskEmailForDisplay(row.normalizedEmail),
      phoneMasked: maskPhone(row.normalizedPhoneE164),
    },
  });
}

function toAttemptRef(row: AdminPaymentAttemptRefRow): AdminPaymentAttemptRef {
  return {
    paymentAttemptId: row.paymentAttemptId,
    provider: row.provider,
    status: row.status,
    initiatedAt: row.initiatedAt.toISOString(),
    completedAt: toIso(row.completedAt),
    amountVnd: toSafeNumber(row.amountVnd),
    currency: 'VND',
    idempotencyKeyMasked: maskIdentifier(row.idempotencyKey, SAFE_IDEMPOTENCY_PREFIX),
    providerOrderIdMasked: maskIdentifier(row.providerOrderId, SAFE_PROVIDER_ORDER_PREFIX),
    providerTransactionIdMasked:
      row.providerTransactionId === null
        ? null
        : maskIdentifier(row.providerTransactionId, SAFE_PROVIDER_TRANSACTION_PREFIX),
  };
}

function toProviderRef(row: AdminPaymentProviderRefRow): AdminPaymentProviderRef {
  return {
    provider: row.provider,
    displayName: row.displayName,
    configured: row.configured,
    enabled: row.enabled,
    environment: row.environment,
    checkoutExpiryMinutes: row.checkoutExpiryMinutes,
  };
}

function toOperationalReviewRef(
  row: AdminPaymentOperationalReviewRow | null,
): AdminPaymentOperationalReview | null {
  if (row === null) return null;
  return {
    reviewId: row.reviewId,
    category: row.category,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    openedReason: row.openedReason,
    resolvedAt: toIso(row.resolvedAt),
    resolvedNote: row.resolvedNote,
  };
}

function toSummary(row: AdminPaymentListRow): AdminPaymentSummary {
  const reviewRequired = deriveReviewRequired(row);
  return adminPaymentSummarySchema.parse({
    paymentId: row.paymentId,
    status: row.status,
    amountVnd: toSafeNumber(row.amountVnd),
    currency: 'VND',
    confirmationSource: row.confirmationSource,
    reviewRequired,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: toIso(row.completedAt),
    provider: row.latestAttempt?.provider ?? null,
    booking: toBookingReference(row.booking),
    latestAttempt: row.latestAttempt === null ? null : toAttemptRef(row.latestAttempt),
    providerRef: row.providerRef === null ? null : toProviderRef(row.providerRef),
    operationalReview: toOperationalReviewRef(row.operationalReview),
  });
}

function toReconciliationState(
  row: AdminPaymentDetailRow | AdminPaymentListRow,
  requestedAt: Date | null,
  requestedBy: string | null,
): AdminPaymentReconciliationState {
  const attempt = row.latestAttempt;
  const lastAttemptCount = attempt?.reconciliationAttemptCount ?? 0;
  const lastErrorCode = attempt?.lastErrorCode ?? null;
  const lastReconciledAt = attempt?.lastReconciledAt ?? null;
  const nextEligibleAt = attempt?.nextReconciliationAt ?? null;
  const providerResponse: AdminPaymentReconciliationState['providerResponse'] =
    attempt?.status === 'SUCCEEDED'
      ? 'SUCCESS'
      : attempt?.status === 'FAILED'
        ? 'FAILED'
        : attempt?.status === 'REVIEW_REQUIRED'
          ? 'REVIEW_REQUIRED'
          : attempt?.status === 'PENDING'
            ? 'STILL_PENDING'
            : null;
  let status: AdminPaymentReconciliationState['status'] = 'NOT_REQUESTED';
  if (requestedAt !== null) {
    status = lastAttemptCount > 0 && lastReconciledAt !== null ? 'COMPLETED' : 'IN_PROGRESS';
    if (nextEligibleAt !== null && nextEligibleAt.getTime() > requestedAt.getTime()) {
      status = 'STALE';
    }
  }
  return {
    status,
    requestedAt: toIso(requestedAt),
    requestedBy,
    lastAttemptCount,
    lastErrorCode,
    lastReconciledAt: toIso(lastReconciledAt),
    nextEligibleAt: toIso(nextEligibleAt),
    providerResponse,
  };
}

function toEvent(row: AdminPaymentEventRow): AdminPaymentEvent {
  return {
    id: row.id,
    eventType: row.eventType,
    actorType: row.actorType,
    actorId: row.actorId,
    occurredAt: row.occurredAt.toISOString(),
    summary: row.summary,
  };
}

type AdminAuditActorType = 'GUEST' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM';

function toAuditEntry(row: AdminPaymentEventRow): AdminPaymentAuditEntry {
  const actorType: AdminAuditActorType =
    row.actorType === 'GUEST' ||
    row.actorType === 'CUSTOMER' ||
    row.actorType === 'ADMIN' ||
    row.actorType === 'SYSTEM'
      ? row.actorType
      : 'SYSTEM';
  return {
    id: row.id,
    eventType: row.eventType,
    actorType,
    actorId: row.actorId,
    occurredAt: row.occurredAt.toISOString(),
    summary: row.summary,
  };
}

export class AdminPaymentReconciliationService {
  public constructor(
    private readonly repository: AdminPaymentRepository,
    private readonly reconciliation: AdminPaymentReconciliationServiceInterface,
  ) {}

  public async listPayments(
    propertyId: string,
    query: AdminPaymentListQuery,
  ): Promise<AdminPaymentListResponse> {
    const result = await this.repository.listPayments(propertyId, query);
    return adminPaymentListResponseSchema.parse({
      items: result.items.map((row) => toSummary(row)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.totalItems,
    });
  }

  public async getDetail(paymentId: string, propertyId: string, now: Date): Promise<AdminPaymentDetail> {
    const detail = await this.repository.findDetailByPaymentId(paymentId, propertyId);
    if (detail === null) {
      throw new AdminPaymentNotFoundError();
    }
    const attempts = await this.repository.listAttempts(paymentId);
    const timeline = await this.repository.listTimelineByBookingId(detail.bookingId, paymentId);
    const reconciliation = toReconciliationState(detail, null, null);
    return adminPaymentDetailSchema.parse({
      paymentId: detail.paymentId,
      status: detail.status,
      amountVnd: toSafeNumber(detail.amountVnd),
      currency: 'VND',
      confirmationSource: detail.confirmationSource,
      succeededAt: toIso(detail.succeededAt),
      reviewRequiredAt: toIso(detail.reviewRequiredAt),
      cancelledAt: toIso(detail.cancelledAt),
      expiredAt: toIso(detail.expiredAt),
      createdAt: detail.createdAt.toISOString(),
      updatedAt: detail.updatedAt.toISOString(),
      booking: toBookingReference(detail.booking),
      providerRef: detail.providerRef === null ? null : toProviderRef(detail.providerRef),
      attempts: attempts.map(toAttemptRef),
      timeline: timeline.map(toEvent),
      reconciliation,
      operationalReview: toOperationalReviewRef(detail.operationalReview),
      audit: timeline
        .filter((row) => row.source === 'AUDIT' && row.actorType !== 'PROVIDER')
        .map(toAuditEntry),
      serverTime: now.toISOString(),
    });
  }

  public async reconcile(
    actor: ActorContext,
    paymentId: string,
    propertyId: string,
    input: unknown,
    now: Date,
  ): Promise<AdminPaymentReconcileResponse> {
    const command = adminPaymentReconcileRequestSchema.parse(input);
    const detail = await this.repository.findDetailByPaymentId(paymentId, propertyId);
    if (detail === null) {
      throw new AdminPaymentNotFoundError();
    }
    this.assertFresh(command, detail);
    const outcome = await this.reconciliation.triggerProviderQuery({
      paymentId,
      propertyId,
      actor,
      expectedAttemptId: command.expectedAttemptId,
      expectedUpdatedAt:
        command.expectedUpdatedAt === undefined ? undefined : new Date(command.expectedUpdatedAt),
      note: command.note,
    });
    const refreshed = await this.repository.findDetailByPaymentId(paymentId, propertyId);
    if (refreshed === null) {
      throw new AdminPaymentNotFoundError();
    }
    const reconciliation = this.applyOutcome(outcome, refreshed, now, actor);
    const summary = toSummary(refreshed);
    const response = adminPaymentReconcileResponseSchema.parse({
      paymentId: refreshed.paymentId,
      reconciliation,
      payment: summary,
      serverTime: now.toISOString(),
    });
    return response;
  }

  private assertFresh(
    command: AdminPaymentReconcileRequest,
    detail: AdminPaymentDetailRow,
  ): void {
    if (
      command.expectedAttemptId !== undefined &&
      detail.latestAttempt !== null &&
      command.expectedAttemptId !== detail.latestAttempt.paymentAttemptId
    ) {
      throw new AdminPaymentReconciliationStaleError();
    }
    if (command.expectedUpdatedAt !== undefined) {
      const expected = new Date(command.expectedUpdatedAt).getTime();
      const actual = detail.updatedAt.getTime();
      if (Math.abs(actual - expected) > 1) {
        throw new AdminPaymentReconciliationStaleError();
      }
    }
  }

  private applyOutcome(
    outcome: AdminPaymentReconciliationOutcome,
    detail: AdminPaymentDetailRow,
    now: Date,
    actor: ActorContext,
  ): AdminPaymentReconciliationState {
    if (outcome.kind === 'STALE') {
      return {
        ...toReconciliationState(detail, now, actor.userId),
        status: 'STALE',
      };
    }
    if (outcome.kind === 'UNAVAILABLE') {
      return {
        ...toReconciliationState(detail, now, actor.userId),
        lastErrorCode: outcome.reason,
        status: 'IN_PROGRESS',
      };
    }
    if (outcome.kind === 'RATE_LIMITED') {
      return {
        ...toReconciliationState(detail, now, actor.userId),
        status: 'STALE',
        nextEligibleAt: outcome.retryAt.toISOString(),
      };
    }
    return {
      ...toReconciliationState(detail, now, actor.userId),
      status: 'IN_PROGRESS',
    };
  }
}

export function createNoopAdminPaymentReconciliationServiceInjectionToken() {
  return {
    provide: ADMIN_PAYMENT_RECONCILIATION_SERVICE,
    useValue: {
      async triggerProviderQuery(): Promise<AdminPaymentReconciliationOutcome> {
        return { kind: 'UNAVAILABLE', reason: NOOP_RECONCILIATION_OUTCOME_NOTE };
      },
    } satisfies AdminPaymentReconciliationServiceInterface,
  };
}

export function newAdminPaymentCorrelationId(): string {
  return randomUUID();
}
