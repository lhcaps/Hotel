import type { ActorContext } from '../auth/actor-context.js';

/**
 * Result envelope from the reconciliation service. The Gate B7 controller is
 * responsible for translating this into a SAFE HTTP response — never the raw
 * provider payload.
 */
export interface AdminPaymentReconciliationRequest {
  readonly paymentId: string;
  readonly propertyId: string;
  readonly actor: ActorContext;
  readonly expectedAttemptId?: string | undefined;
  readonly expectedUpdatedAt?: Date | undefined;
  readonly note?: string | undefined;
}

export type AdminPaymentReconciliationOutcome =
  | {
      readonly kind: 'TRIGGERED';
      readonly triggeredAt: Date;
      readonly providerQueryId: string | null;
    }
  | {
      readonly kind: 'STALE';
      readonly currentUpdatedAt: Date;
      readonly currentAttemptId: string | null;
    }
  | {
      readonly kind: 'UNAVAILABLE';
      readonly reason: string;
    }
  | {
      readonly kind: 'RATE_LIMITED';
      readonly retryAt: Date;
    };

/**
 * Compile-safe injection interface. The provider-agnostic reconciliation worker
 * (Gate B6 / Phase 8B2) is not yet wired, so Gate B7 only needs an interface
 * that returns a SAFE outcome. The concrete implementation will be slotted in
 * once reconciliation work lands; until then the controller treats this as a
 * best-effort, no-op trigger.
 */
export interface AdminPaymentReconciliationService {
  triggerProviderQuery(request: AdminPaymentReconciliationRequest): Promise<AdminPaymentReconciliationOutcome>;
}

export const ADMIN_PAYMENT_RECONCILIATION_SERVICE = Symbol(
  'ADMIN_PAYMENT_RECONCILIATION_SERVICE',
);

export const NOOP_RECONCILIATION_OUTCOME_NOTE =
  'Reconciliation worker not yet wired; only a provider query was requested.';

export function createNoopAdminPaymentReconciliationService(): AdminPaymentReconciliationService {
  return {
    async triggerProviderQuery() {
      return { kind: 'UNAVAILABLE', reason: 'reconciliation worker not yet wired' };
    },
  };
}
