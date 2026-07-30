import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_RECONCILIATION_POLICY,
  DEFAULT_RECONCILIATION_MAX_ATTEMPTS,
  DEFAULT_RECONCILIATION_DELAY_MINUTES,
  buildSafeAuditMetadata,
  classifyReconciliationQueryError,
  computeReconciliationDelay,
  computeReconciliationNextReconciliationAt,
  deriveAttemptExpiryAuthority,
  validateReconciliationPolicy,
  type ReconciliationPolicy,
} from '../../src/payment/reconciliation.js';

describe('Phase 8C reconciliation policy defaults and pure helpers', () => {
  afterEach(() => {
    /* no-op */
  });

  it('defaults the policy to 8 attempts and the documented delay schedule', () => {
    expect(DEFAULT_RECONCILIATION_MAX_ATTEMPTS).toBe(8);
    expect(DEFAULT_RECONCILIATION_DELAY_MINUTES).toEqual([1, 5, 15, 60, 240]);
    expect(DEFAULT_RECONCILIATION_POLICY).toEqual({
      maxAttempts: 8,
      delayMinutes: [1, 5, 15, 60, 240],
    });
  });

  it('exposes the typed delay ladder for the first 8 retries', () => {
    const policy = DEFAULT_RECONCILIATION_POLICY;
    const delays: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      delays.push(computeReconciliationDelay(i, policy));
    }
    expect(delays).toEqual([1, 5, 15, 60, 240, 240, 240, 240]);
  });

  it('uses the last ladder entry as the saturation delay for any further retry', () => {
    expect(computeReconciliationDelay(99, DEFAULT_RECONCILIATION_POLICY)).toBe(240);
  });

  it('rejects malformed policy objects', () => {
    expect(() => validateReconciliationPolicy({ maxAttempts: 0, delayMinutes: [1] } as ReconciliationPolicy)).toThrow();
    expect(() =>
      validateReconciliationPolicy({ maxAttempts: 1, delayMinutes: [] } as ReconciliationPolicy),
    ).toThrow();
    expect(() =>
      validateReconciliationPolicy({ maxAttempts: 1, delayMinutes: [0] } as ReconciliationPolicy),
    ).toThrow();
  });

  it('computes the next reconciliation wall-clock as now + ladder delay', () => {
    const now = new Date('2026-07-28T10:00:00.000Z');
    expect(
      computeReconciliationNextReconciliationAt(0, DEFAULT_RECONCILIATION_POLICY, now),
    ).toEqual(new Date('2026-07-28T10:01:00.000Z'));
    expect(
      computeReconciliationNextReconciliationAt(4, DEFAULT_RECONCILIATION_POLICY, now),
    ).toEqual(new Date('2026-07-28T14:00:00.000Z'));
  });

  it('classifies transient, permanent and not_found provider query errors', () => {
    expect(
      classifyReconciliationQueryError({
        category: 'transient',
        code: 'TIMEOUT',
        message: 'request timed out',
      }),
    ).toEqual({ category: 'transient', code: 'TIMEOUT', message: 'request timed out' });
    expect(
      classifyReconciliationQueryError({
        category: 'permanent',
        code: 'INVALID_ORDER',
      }),
    ).toEqual({ category: 'permanent', code: 'INVALID_ORDER' });
    expect(
      classifyReconciliationQueryError({
        category: 'not_found',
        code: 'NO_SUCH_TRANSACTION',
      }),
    ).toEqual({ category: 'not_found', code: 'NO_SUCH_TRANSACTION' });
  });

  it('routes an unstructured error to unsafe_to_classify without leaking the message verbatim', () => {
    const classified = classifyReconciliationQueryError(new Error('boom'));
    expect(classified.category).toBe('unsafe_to_classify');
    expect(classified.code).toBe('UNCLASSIFIED_ERROR');
  });

  it('derives the attempt expiry as the minimum of all bounded candidates', () => {
    const now = new Date('2026-07-28T10:00:00.000Z');
    const holdExpiry = new Date('2026-07-28T10:15:00.000Z');
    const adapterExpiry = new Date('2026-07-28T10:10:00.000Z');
    expect(
      deriveAttemptExpiryAuthority(
        holdExpiry,
        15, // +15 minutes
        adapterExpiry,
        now,
      ),
    ).toEqual(adapterExpiry);
    expect(
      deriveAttemptExpiryAuthority(holdExpiry, null, null, now),
    ).toEqual(holdExpiry);
    expect(
      deriveAttemptExpiryAuthority(holdExpiry, 5, null, now),
    ).toEqual(new Date(now.getTime() + 5 * 60_000));
    expect(
      deriveAttemptExpiryAuthority(null, null, adapterExpiry, now),
    ).toEqual(adapterExpiry);
  });

  it('ignores past-dated candidates so a stale provider adapter timestamp cannot extend the attempt', () => {
    const now = new Date('2026-07-28T10:00:00.000Z');
    expect(
      deriveAttemptExpiryAuthority(
        new Date('2026-07-28T09:00:00.000Z'),
        null,
        null,
        now,
      ),
    ).toBeNull();
  });

  it('produces safe audit metadata by truncating strings and rejecting non-finite numbers', () => {
    const metadata = buildSafeAuditMetadata({
      attemptId: 'a'.repeat(512),
      outcome: 'TRANSIENT_RETRY_SCHEDULED',
      errorCode: 'TIMEOUT',
      retryCount: Number.POSITIVE_INFINITY,
      leaseOwner: 'reconciler-1',
      policy: DEFAULT_RECONCILIATION_POLICY,
    });
    expect(metadata.attemptId).toHaveLength(256);
    expect(metadata.retryCount).toBeNull();
  });
});
