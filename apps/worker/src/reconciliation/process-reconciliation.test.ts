import { setTimeout as waitTimer } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';

import { processReconciliation } from './process-reconciliation.js';

vi.mock('@room/booking', () => ({
  DEFAULT_RECONCILIATION_DELAY_MINUTES: [1, 5, 15, 60, 240],
  recoverExpiredReconciliationLeases: vi.fn().mockResolvedValue(2),
  claimReconciliationAttempts: vi.fn().mockResolvedValue([
    { id: 'a', leaseId: 'lease-a' },
    { id: 'b', leaseId: 'lease-b' },
    { id: 'c', leaseId: 'lease-c' },
  ]),
  reconcilePaymentAttempt: vi.fn(async ({ attemptId }: { attemptId: string }) => ({
    outcome: attemptId === 'a' ? 'PROCESSED' : 'LEASE_LOST',
    attemptId,
    errorCode: null,
    nextReconciliationAt: null,
  } satisfies {
    outcome: 'PROCESSED' | 'LEASE_LOST';
    attemptId: string;
    errorCode: null;
    nextReconciliationAt: null;
  })),
}));

describe('processReconciliation', () => {
  it('bounds provider work by configured concurrency and preserves canonical outcomes', async () => {
    let active = 0;
    let peak = 0;
    const booking = await import('@room/booking');
    vi.mocked(booking.reconcilePaymentAttempt).mockImplementation(async ({ attemptId }) => {
      active += 1;
      peak = Math.max(peak, active);
      await waitTimer(1);
      active -= 1;
      return {
        outcome: attemptId === 'a' ? 'PROCESSED' : 'LEASE_LOST',
        attemptId,
        errorCode: null,
        nextReconciliationAt: null,
      };
    });
    const result = await processReconciliation({
      pool: {} as never,
      queryProvider: {} as never,
      batchSize: 25,
      leaseTtlMs: 120_000,
      concurrency: 2,
      maxAttempts: 8,
      leaseOwner: 'worker-test',
      queryTimeoutMs: 30_000,
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(result.byOutcome.PROCESSED).toBe(1);
    expect(result.byOutcome.LEASE_LOST).toBe(2);
    expect(result.recovered).toBe(2);
  });

  it('rejects unbounded concurrency', async () => {
    await expect(
      processReconciliation({
        pool: {} as never,
        queryProvider: {} as never,
        batchSize: 25,
        leaseTtlMs: 120_000,
        concurrency: 26,
        maxAttempts: 8,
        leaseOwner: 'worker-test',
        queryTimeoutMs: 30_000,
      }),
    ).rejects.toThrow(/concurrency/);
  });
});
