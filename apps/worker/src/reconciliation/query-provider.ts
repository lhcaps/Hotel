import { Buffer } from 'node:buffer';
import type { ReconciliationStatusQueryPort } from '@room/booking';

interface PaymentDemoQueryProviderOptions {
  readonly baseUrl: string;
  readonly controlToken: string;
}

export function createPaymentDemoReconciliationQueryProvider(
  options: PaymentDemoQueryProviderOptions,
): ReconciliationStatusQueryPort {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  return {
    query: async ({ provider, providerOrderId, signal }) => {
      try {
        const response = await fetch(
          `${baseUrl}/__internal/reconciliation?provider=${encodeURIComponent(provider)}&orderId=${encodeURIComponent(providerOrderId)}`,
          { headers: { authorization: `Bearer ${options.controlToken}` }, signal },
        );
        if (response.status === 404)
          return { category: 'not_found', code: 'PAYMENT_DEMO_ORDER_NOT_FOUND' };
        if (!response.ok) return { category: 'permanent', code: 'PAYMENT_DEMO_QUERY_REJECTED' };
        const body: unknown = await response.json();
        if (typeof body !== 'object' || body === null)
          return { category: 'unsafe_to_classify', code: 'PAYMENT_DEMO_QUERY_INVALID' };
        const result = body as Record<string, unknown>;
        if (result.outcome === 'PENDING')
          return {
            outcome: 'PENDING',
            providerTransactionId: null,
            amountVnd: null,
            occurredAt: null,
            rawBodyDigest: null,
          };
        if (
          result.outcome !== 'SUCCEEDED' ||
          typeof result.providerTransactionId !== 'string' ||
          typeof result.amountVnd !== 'string' ||
          typeof result.occurredAt !== 'string' ||
          typeof result.rawBodyDigest !== 'string'
        )
          return { category: 'unsafe_to_classify', code: 'PAYMENT_DEMO_QUERY_INVALID' };
        const amountVnd = BigInt(result.amountVnd);
        const occurredAt = new Date(result.occurredAt);
        if (amountVnd < 1n || Number.isNaN(occurredAt.getTime()))
          return { category: 'unsafe_to_classify', code: 'PAYMENT_DEMO_QUERY_INVALID' };
        return {
          outcome: 'SUCCEEDED',
          providerTransactionId: result.providerTransactionId,
          amountVnd,
          occurredAt,
          rawBodyDigest: Buffer.from(result.rawBodyDigest, 'base64'),
        };
      } catch (error) {
        return {
          category: signal.aborted ? 'transient' : 'transient',
          code:
            error instanceof Error && error.name === 'AbortError'
              ? 'PAYMENT_DEMO_QUERY_ABORTED'
              : 'PAYMENT_DEMO_QUERY_UNREACHABLE',
        };
      }
    },
  };
}

export function createUnavailableReconciliationQueryProvider(): ReconciliationStatusQueryPort {
  return {
    query: async () => ({
      category: 'permanent',
      code: 'RECONCILIATION_PROVIDER_QUERY_NOT_CONFIGURED',
    }),
  };
}
