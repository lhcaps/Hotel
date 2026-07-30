import type { ReconciliationStatusQueryPort } from '@room/booking';

export function createUnavailableReconciliationQueryProvider(): ReconciliationStatusQueryPort {
  return {
    query: async () => ({
      category: 'permanent',
      code: 'RECONCILIATION_PROVIDER_QUERY_NOT_CONFIGURED',
    }),
  };
}
