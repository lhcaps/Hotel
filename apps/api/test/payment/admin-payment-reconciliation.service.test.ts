import { describe, expect, it, vi } from 'vitest';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { AdminPaymentRepository } from '../../src/payment/repositories/admin-payment.repository.js';
import { AdminPaymentReconciliationService } from '../../src/payment/services/admin-payment-reconciliation.service.js';
import {
  AdminPaymentNotFoundError,
  AdminPaymentReconciliationStaleError,
} from '../../src/payment/admin-payment-reconciliation.errors.js';
import type {
  AdminPaymentAttemptRefRow,
  AdminPaymentBookingSnapshot,
  AdminPaymentDetailRow,
  AdminPaymentListRow,
  AdminPaymentProviderRefRow,
} from '../../src/payment/repositories/admin-payment.repository.js';
import type {
  AdminPaymentReconciliationOutcome,
  AdminPaymentReconciliationService as ReconciliationProvider,
} from '../../src/payment/admin-payment-reconciliation.service.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440010';
const paymentId = '550e8400-e29b-41d4-a716-446655440020';
const bookingId = '550e8400-e29b-41d4-a716-446655440030';
const adminId = '550e8400-e29b-41d4-a716-446655440040';

const actor: ActorContext = {
  userId: adminId,
  email: 'admin@example.test',
  displayName: 'Admin User',
  role: 'ADMIN',
  permissions: ['payment.reconciliation.read', 'payment.reconciliation.manage'],
  sessionId: 'session-id',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'request-id',
  correlationId: 'correlation-id',
};

const booking: AdminPaymentBookingSnapshot = {
  bookingId,
  bookingCode: 'BK-MASKED-01',
  bookingStatus: 'CONFIRMED',
  finalAmountVnd: 359_000n,
  currency: 'VND',
  fullName: 'Nguyen Van A',
  normalizedEmail: 'guest@example.test',
  normalizedPhoneE164: '+84909000001',
};

const attempt: AdminPaymentAttemptRefRow = {
  paymentAttemptId: '550e8400-e29b-41d4-a716-446655440050',
  provider: 'VNPAY',
  status: 'PENDING',
  initiatedAt: new Date('2026-07-28T00:00:00.000Z'),
  completedAt: null,
  amountVnd: 359_000n,
  currency: 'VND',
  idempotencyKey: 'idem-att-1234567890',
  providerOrderId: 'po-1234567890',
  providerTransactionId: null,
  reconciliationAttemptCount: 0,
  nextReconciliationAt: null,
  lastReconciledAt: null,
  lastErrorCode: null,
};

const providerRef: AdminPaymentProviderRefRow = {
  provider: 'VNPAY',
  displayName: 'VNPay',
  configured: true,
  enabled: true,
  environment: 'sandbox',
  checkoutExpiryMinutes: 15,
};

function buildListRow(overrides: Partial<AdminPaymentListRow> = {}): AdminPaymentListRow {
  return {
    paymentId,
    propertyId,
    bookingId,
    status: 'PENDING',
    amountVnd: 359_000n,
    currency: 'VND',
    confirmationSource: null,
    createdAt: new Date('2026-07-28T00:00:00.000Z'),
    updatedAt: new Date('2026-07-28T00:00:00.000Z'),
    completedAt: null,
    booking,
    latestAttempt: attempt,
    providerRef,
    operationalReview: null,
    ...overrides,
  };
}

function buildDetailRow(overrides: Partial<AdminPaymentDetailRow> = {}): AdminPaymentDetailRow {
  return {
    ...buildListRow(),
    succeededAt: null,
    reviewRequiredAt: null,
    cancelledAt: null,
    expiredAt: null,
    ...overrides,
  };
}

function buildRepository(rows: {
  list?: { items: AdminPaymentListRow[]; totalItems: number };
  detail?: AdminPaymentDetailRow | null;
  attempts?: AdminPaymentAttemptRefRow[];
}): {
  repository: AdminPaymentRepository;
  listPayments: ReturnType<typeof vi.fn>;
  findDetailByPaymentId: ReturnType<typeof vi.fn>;
  listAttempts: ReturnType<typeof vi.fn>;
  listTimelineByBookingId: ReturnType<typeof vi.fn>;
} {
  const listPayments = vi.fn().mockResolvedValue(rows.list ?? { items: [], totalItems: 0 });
  const findDetailByPaymentId = vi.fn().mockResolvedValue(rows.detail ?? null);
  const listAttempts = vi.fn().mockResolvedValue(rows.attempts ?? []);
  const listTimelineByBookingId = vi.fn().mockResolvedValue([]);
  const repository = {
    listPayments,
    findDetailByPaymentId,
    listAttempts,
    listTimelineByBookingId,
  } as unknown as AdminPaymentRepository;
  return { repository, listPayments, findDetailByPaymentId, listAttempts, listTimelineByBookingId };
}

function buildService(rows: {
  list?: { items: AdminPaymentListRow[]; totalItems: number };
  detail?: AdminPaymentDetailRow | null;
  attempts?: AdminPaymentAttemptRefRow[];
  reconciliation?: (request: {
    paymentId: string;
    propertyId: string;
    actor: ActorContext;
  }) => Promise<AdminPaymentReconciliationOutcome>;
}): {
  service: AdminPaymentReconciliationService;
  repository: AdminPaymentRepository;
  provider: ReconciliationProvider;
  listPayments: ReturnType<typeof vi.fn>;
  findDetailByPaymentId: ReturnType<typeof vi.fn>;
  listAttempts: ReturnType<typeof vi.fn>;
  listTimelineByBookingId: ReturnType<typeof vi.fn>;
} {
  const { repository, listPayments, findDetailByPaymentId, listAttempts, listTimelineByBookingId } =
    buildRepository(rows);
  const provider: ReconciliationProvider = {
    triggerProviderQuery: vi.fn(
      rows.reconciliation ??
        (async () => ({
          kind: 'TRIGGERED' as const,
          triggeredAt: new Date(),
          providerQueryId: null,
        })),
    ),
  };
  return {
    service: new AdminPaymentReconciliationService(repository, provider),
    repository,
    provider,
    listPayments,
    findDetailByPaymentId,
    listAttempts,
    listTimelineByBookingId,
  };
}

describe('AdminPaymentReconciliationService.listPayments', () => {
  it('returns safe summary data with masked identifiers, no raw provider fields', async () => {
    const row = buildListRow();
    const { service } = buildService({ list: { items: [row], totalItems: 1 } });

    const result = await service.listPayments(propertyId, {
      page: 1,
      pageSize: 20,
      reviewRequired: undefined,
    });

    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalItems).toBe(1);
    const summary = result.items[0];
    if (!summary) {
      throw new Error('expected summary item');
    }
    expect(summary.paymentId).toBe(paymentId);
    expect(summary.provider).toBe('VNPAY');
    expect(summary.latestAttempt?.idempotencyKeyMasked).toMatch(/^payatt_/);
    expect(summary.latestAttempt?.providerOrderIdMasked).toMatch(/^po_/);
    expect(summary.latestAttempt?.providerTransactionIdMasked).toBeNull();
    expect(summary.booking.contact.emailMasked).toContain('*');
    expect(summary.booking.contact.phoneMasked).toContain('•');
    expect(JSON.stringify(summary)).not.toMatch(/idem-att-1234567890/);
    expect(JSON.stringify(summary)).not.toMatch(/guest@example.test/);
  });

  it('marks reviewRequired when payment status is REVIEW_REQUIRED', async () => {
    const row = buildListRow({ status: 'REVIEW_REQUIRED' });
    const { service } = buildService({ list: { items: [row], totalItems: 1 } });

    const result = await service.listPayments(propertyId, {
      page: 1,
      pageSize: 20,
      reviewRequired: undefined,
    });

    expect(result.items[0]?.reviewRequired).toBe(true);
  });

  it('marks reviewRequired when latest attempt is REVIEW_REQUIRED but payment is PENDING', async () => {
    const row = buildListRow({
      status: 'PENDING',
      latestAttempt: { ...attempt, status: 'REVIEW_REQUIRED' },
    });
    const { service } = buildService({ list: { items: [row], totalItems: 1 } });

    const result = await service.listPayments(propertyId, {
      page: 1,
      pageSize: 20,
      reviewRequired: undefined,
    });

    expect(result.items[0]?.reviewRequired).toBe(true);
  });

  it('passes validated filters through to the repository without coercion', async () => {
    const { service, listPayments } = buildService({ list: { items: [], totalItems: 0 } });
    await service.listPayments(propertyId, {
      page: 1,
      pageSize: 20,
      status: 'SUCCEEDED',
      provider: 'VNPAY',
      bookingCode: 'BK-X',
      reviewRequired: true,
      createdFrom: '2026-07-01T00:00:00.000Z',
      createdTo: '2026-07-31T23:59:59.000Z',
    });
    expect(listPayments).toHaveBeenCalledWith(
      propertyId,
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        status: 'SUCCEEDED',
        provider: 'VNPAY',
        bookingCode: 'BK-X',
        reviewRequired: true,
      }),
    );
  });
});

describe('AdminPaymentReconciliationService.getDetail', () => {
  it('returns a SAFE detail envelope with attempts, timeline, audit, and operational review', async () => {
    const detail = buildDetailRow({
      succeededAt: new Date('2026-07-28T01:00:00.000Z'),
      status: 'SUCCEEDED',
      confirmationSource: 'PROVIDER_EVENT',
    });
    const { service } = buildService({
      detail,
      attempts: [attempt],
    });

    const now = new Date('2026-07-28T02:00:00.000Z');
    const result = await service.getDetail(paymentId, propertyId, now);

    expect(result.paymentId).toBe(paymentId);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.confirmationSource).toBe('PROVIDER_EVENT');
    const succeededAt = detail.succeededAt;
    if (succeededAt === null) {
      throw new Error('expected detail.succeededAt');
    }
    expect(result.succeededAt).toBe(succeededAt.toISOString());
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.provider).toBe('VNPAY');
    expect(result.attempts[0]?.idempotencyKeyMasked).toMatch(/^payatt_/);
    expect(result.attempts[0]?.providerOrderIdMasked).toMatch(/^po_/);
    expect(result.reconciliation.status).toBe('NOT_REQUESTED');
    expect(result.serverTime).toBe(now.toISOString());
    expect(result.booking.bookingCode).toBe('BK-MASKED-01');
    expect(JSON.stringify(result)).not.toMatch(/idem-att-1234567890/);
  });

  it('throws AdminPaymentNotFoundError when no payment exists for the property', async () => {
    const { service } = buildService({ detail: null });
    await expect(
      service.getDetail(paymentId, propertyId, new Date('2026-07-28T02:00:00.000Z')),
    ).rejects.toBeInstanceOf(AdminPaymentNotFoundError);
  });
});

describe('AdminPaymentReconciliationService.reconcile', () => {
  it('triggers the canonical reconciliation provider and never fabricates success', async () => {
    const initial = buildDetailRow({ status: 'PENDING' });
    const { repository } = buildRepository({ detail: initial });
    const provider: ReconciliationProvider = {
      triggerProviderQuery: vi.fn(async () => ({
        kind: 'TRIGGERED' as const,
        triggeredAt: new Date('2026-07-28T02:00:00.000Z'),
        providerQueryId: 'job-123',
      })) as unknown as ReconciliationProvider['triggerProviderQuery'],
    };
    const service = new AdminPaymentReconciliationService(repository, provider);

    const result = await service.reconcile(
      actor,
      paymentId,
      propertyId,
      {
        expectedAttemptId: attempt.paymentAttemptId,
        expectedUpdatedAt: '2026-07-28T00:00:00.000Z',
        note: 'manual query',
      },
      new Date('2026-07-28T02:00:00.000Z'),
    );

    expect(provider.triggerProviderQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId,
        propertyId,
        actor,
        expectedAttemptId: attempt.paymentAttemptId,
      }),
    );
    expect(result.payment.status).toBe('PENDING');
    expect(result.payment.status).not.toBe('SUCCEEDED');
    expect(result.reconciliation.status).toBe('IN_PROGRESS');
    expect(result.serverTime).toBe('2026-07-28T02:00:00.000Z');
  });

  it('rejects when the payment updated_at drifts from expectedUpdatedAt', async () => {
    const initial = buildDetailRow({
      updatedAt: new Date('2026-07-28T00:00:01.000Z'),
    });
    const { service, repository } = buildService({ detail: initial });
    void repository;
    await expect(
      service.reconcile(
        actor,
        paymentId,
        propertyId,
        { expectedUpdatedAt: '2026-07-28T00:00:00.000Z' },
        new Date('2026-07-28T02:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(AdminPaymentReconciliationStaleError);
  });

  it('rejects when the latest attempt id does not match expectedAttemptId', async () => {
    const initial = buildDetailRow();
    const { service, repository } = buildService({ detail: initial });
    void repository;
    await expect(
      service.reconcile(
        actor,
        paymentId,
        propertyId,
        { expectedAttemptId: '550e8400-e29b-41d4-a716-446655440099' },
        new Date('2026-07-28T02:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(AdminPaymentReconciliationStaleError);
  });

  it('maps a STALE outcome to a STALE reconciliation state without writing the payment', async () => {
    const initial = buildDetailRow();
    const { service } = buildService({
      detail: initial,
      reconciliation: async () => ({
        kind: 'STALE',
        currentUpdatedAt: new Date('2026-07-28T02:30:00.000Z'),
        currentAttemptId: null,
      }),
    });

    const result = await service.reconcile(
      actor,
      paymentId,
      propertyId,
      { expectedAttemptId: attempt.paymentAttemptId },
      new Date('2026-07-28T02:00:00.000Z'),
    );

    expect(result.reconciliation.status).toBe('STALE');
    expect(result.payment.status).toBe('PENDING');
  });

  it('records the rate-limited retryAt on a RATE_LIMITED outcome', async () => {
    const retryAt = new Date('2026-07-28T03:00:00.000Z');
    const { service } = buildService({
      detail: buildDetailRow(),
      reconciliation: async () => ({ kind: 'RATE_LIMITED', retryAt }),
    });

    const result = await service.reconcile(
      actor,
      paymentId,
      propertyId,
      { expectedAttemptId: attempt.paymentAttemptId },
      new Date('2026-07-28T02:00:00.000Z'),
    );

    expect(result.reconciliation.status).toBe('STALE');
    expect(result.reconciliation.nextEligibleAt).toBe(retryAt.toISOString());
  });

  it('returns the provider reason as lastErrorCode on an UNAVAILABLE outcome', async () => {
    const { service } = buildService({
      detail: buildDetailRow(),
      reconciliation: async () => ({
        kind: 'UNAVAILABLE',
        reason: 'reconciliation worker not yet wired',
      }),
    });

    const result = await service.reconcile(
      actor,
      paymentId,
      propertyId,
      { expectedAttemptId: attempt.paymentAttemptId },
      new Date('2026-07-28T02:00:00.000Z'),
    );

    expect(result.reconciliation.status).toBe('IN_PROGRESS');
    expect(result.reconciliation.lastErrorCode).toBe('reconciliation worker not yet wired');
  });

  it('throws AdminPaymentNotFoundError when the payment does not exist', async () => {
    const { service } = buildService({ detail: null });
    await expect(
      service.reconcile(
        actor,
        paymentId,
        propertyId,
        { expectedAttemptId: attempt.paymentAttemptId },
        new Date('2026-07-28T02:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(AdminPaymentNotFoundError);
  });
});
