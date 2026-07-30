import type { DatabasePool } from '@room/database';
import type { ReconciliationStatusQueryPort } from '@room/booking';

import { processReconciliation } from '../reconciliation/process-reconciliation.js';

export interface ReconciliationJobOptions {
  readonly pool: DatabasePool;
  readonly queryProvider: ReconciliationStatusQueryPort;
  readonly batchSize: number;
  readonly leaseTtlMs: number;
  readonly concurrency: number;
  readonly maxAttempts: number;
  readonly leaseOwner: string;
  readonly queryTimeoutMs: number;
}

export function createReconciliationJob(options: ReconciliationJobOptions) {
  return {
    name: 'PAYMENT_RECONCILIATION' as const,
    run: () => processReconciliation(options),
  };
}
