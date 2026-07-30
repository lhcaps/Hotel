import { describe, expect, it, vi } from 'vitest';

import { AdminPaymentReconciliationController } from '../../src/payment/admin-payment-reconciliation.controller.js';
import type { PropertyContextService } from '../../src/catalog/property-context.service.js';
import type {
  AdminPaymentListResponse,
  AdminPaymentDetail,
  AdminPaymentReconcileResponse,
} from '@room/contracts';
import type { ActorContext } from '../../src/auth/actor-context.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440010';
const paymentId = '550e8400-e29b-41d4-a716-446655440020';
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

interface ControllerServiceShape {
  listPayments(propertyId: string, query: unknown): Promise<AdminPaymentListResponse>;
  getDetail(paymentId: string, propertyId: string, now: Date): Promise<AdminPaymentDetail>;
  reconcile(
    actor: ActorContext,
    paymentId: string,
    propertyId: string,
    input: unknown,
    now: Date,
  ): Promise<AdminPaymentReconcileResponse>;
}

function buildPropertyContext(): PropertyContextService {
  return {
    getCurrent: vi.fn().mockResolvedValue({
      id: propertyId,
      code: 'MAIN',
      name: 'Main',
      timezone: 'Asia/Ho_Chi_Minh',
    }),
  } as unknown as PropertyContextService;
}

function buildController(service: Partial<ControllerServiceShape>): {
  controller: AdminPaymentReconciliationController;
  service: Partial<ControllerServiceShape>;
} {
  const controller = new AdminPaymentReconciliationController(
    service as never,
    buildPropertyContext(),
  );
  return { controller, service };
}

describe('AdminPaymentReconciliationController', () => {
  it('delegates listPayments to the service with the current property id', async () => {
    const listResponse: AdminPaymentListResponse = {
      page: 1,
      pageSize: 20,
      totalItems: 0,
      items: [],
    };
    const listPayments = vi.fn().mockResolvedValue(listResponse);
    const { controller, service } = buildController({ listPayments });

    const response = await controller.listPayments({ page: 1, pageSize: 20 }, {
      actor,
      id: 'request-id',
    } as never);

    expect(service.listPayments).toHaveBeenCalledWith(
      propertyId,
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
    expect(response.totalItems).toBe(0);
  });

  it('delegates getPaymentDetail to the service with the current property id and Date', async () => {
    const detail = { paymentId } as unknown as AdminPaymentDetail;
    const getDetail = vi.fn().mockResolvedValue(detail);
    const { controller, service } = buildController({ getDetail });

    const response = await controller.getPaymentDetail(paymentId, {
      actor,
      id: 'request-id',
    } as never);

    expect(service.getDetail).toHaveBeenCalledWith(paymentId, propertyId, expect.any(Date));
    expect(response).toBe(detail);
  });

  it('delegates reconcilePayment to the service with the actor and current property id', async () => {
    const reconciled: AdminPaymentReconcileResponse = {
      paymentId,
      reconciliation: {
        status: 'IN_PROGRESS',
        requestedAt: '2026-07-28T02:00:00.000Z',
        requestedBy: adminId,
        lastAttemptCount: 0,
        lastErrorCode: null,
        lastReconciledAt: null,
        nextEligibleAt: null,
        providerResponse: null,
      },
      payment: {
        paymentId,
        status: 'PENDING',
        amountVnd: 359000,
        currency: 'VND',
        confirmationSource: null,
        reviewRequired: false,
        createdAt: '2026-07-28T00:00:00.000Z',
        updatedAt: '2026-07-28T00:00:00.000Z',
        completedAt: null,
        provider: 'VNPAY',
        booking: {
          bookingId: '550e8400-e29b-41d4-a716-446655440030',
          bookingCode: 'BK-CTRL',
          bookingStatus: 'HOLD',
          finalAmountVnd: 359000,
          currency: 'VND',
          contact: {
            fullName: 'Tester',
            emailMasked: 't****r@example.test',
            phoneMasked: '+84••••01',
          },
        },
        latestAttempt: null,
        providerRef: null,
        operationalReview: null,
      },
      serverTime: '2026-07-28T02:00:00.000Z',
    };
    const reconcile = vi.fn().mockResolvedValue(reconciled);
    const { controller, service } = buildController({ reconcile });

    const body = { expectedAttemptId: '550e8400-e29b-41d4-a716-446655440050' };
    const result = await controller.reconcilePayment(paymentId, body, {
      actor,
      id: 'request-id',
    } as never);

    expect(service.reconcile).toHaveBeenCalledWith(
      actor,
      paymentId,
      propertyId,
      body,
      expect.any(Date),
    );
    expect(result.reconciliation.status).toBe('IN_PROGRESS');
  });
});
