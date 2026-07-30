import {
  claimReconciliationAttempts,
  reconcilePaymentAttempt,
  recoverExpiredReconciliationLeases,
  type ReconciliationCycleOutcome,
  type ReconciliationPolicy,
  type ReconciliationStatusQueryPort,
  DEFAULT_RECONCILIATION_DELAY_MINUTES,
} from '@room/booking';
import type { DatabasePool } from '@room/database';

export interface ProcessReconciliationOptions {
  readonly pool: DatabasePool;
  readonly queryProvider: ReconciliationStatusQueryPort;
  readonly batchSize: number;
  readonly leaseTtlMs: number;
  readonly concurrency: number;
  readonly maxAttempts: number;
  readonly leaseOwner: string;
  readonly queryTimeoutMs: number;
  readonly policy?: ReconciliationPolicy;
  readonly now?: Date;
}

export interface ProcessReconciliationSummary {
  readonly claimed: number;
  readonly processed: number;
  readonly recovered: number;
  readonly byOutcome: Readonly<Record<ReconciliationCycleOutcome, number>>;
}

export async function processReconciliation(
  options: ProcessReconciliationOptions,
): Promise<ProcessReconciliationSummary> {
  if (
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 25
  ) {
    throw new RangeError('concurrency must be an integer between 1 and 25');
  }
  if (
    !Number.isInteger(options.maxAttempts) ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 32
  ) {
    throw new RangeError('maxAttempts must be an integer between 1 and 32');
  }

  const policy = options.policy ?? {
    maxAttempts: options.maxAttempts,
    delayMinutes: DEFAULT_RECONCILIATION_DELAY_MINUTES,
  };
  const recovered = await recoverExpiredReconciliationLeases({
    pool: options.pool,
    batchSize: options.batchSize,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  const claims = await claimReconciliationAttempts({
    pool: options.pool,
    batchSize: options.batchSize,
    leaseTtlMs: options.leaseTtlMs,
    leaseOwner: options.leaseOwner,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  const byOutcome = emptyOutcomeCounts();
  let cursor = 0;
  const runOne = async (): Promise<void> => {
    while (cursor < claims.length) {
      const claim = claims[cursor++];
      if (claim === undefined) return;
      const result = await reconcilePaymentAttempt({
        pool: options.pool,
        attemptId: claim.id,
        leaseId: claim.leaseId,
        leaseOwner: options.leaseOwner,
        queryProvider: options.queryProvider,
        queryTimeoutMs: options.queryTimeoutMs,
        policy,
        ...(options.now !== undefined ? { now: options.now } : {}),
      });
      byOutcome[result.outcome] += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency, claims.length) }, runOne));
  return { claimed: claims.length, processed: claims.length, recovered, byOutcome };
}

function emptyOutcomeCounts(): Record<ReconciliationCycleOutcome, number> {
  return {
    PROCESSED: 0,
    TERMINAL_NOT_FOUND: 0,
    TERMINAL_REVIEW_REQUIRED: 0,
    TRANSIENT_RETRY_SCHEDULED: 0,
    PERMANENT_RETRY_EXHAUSTED: 0,
    PERMANENT_REVIEW_REQUIRED: 0,
    TRANSIENT_RETRY_EXHAUSTED: 0,
    STALE_FAILURE_PROTECTED: 0,
    LEASE_LOST: 0,
  };
}
