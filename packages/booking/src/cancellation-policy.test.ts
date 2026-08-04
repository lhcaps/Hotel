import { describe, expect, it } from 'vitest';

import {
  createCancellationPolicySnapshot,
  evaluateCancellationPolicy,
} from './cancellation-policy.js';

const checkIn = new Date('2026-08-20T12:00:00.000Z');
const snapshot = createCancellationPolicySnapshot({
  checkIn,
  timezone: 'Asia/Ho_Chi_Minh',
  capturedAt: new Date('2026-08-01T00:00:00.000Z'),
});

describe('cancellation policy snapshot', () => {
  it('captures immutable deadlines and paid-amount basis', () => {
    expect(snapshot.refundBasis).toBe('PAID_AMOUNT');
    expect(snapshot.sevenDayDeadline).toBe('2026-08-13T12:00:00.000Z');
    expect(snapshot.threeDayDeadline).toBe('2026-08-17T12:00:00.000Z');
  });

  it.each([
    ['2026-08-13T12:00:00.000Z', 100, 1000000n, 'REVIEW_REQUIRED'],
    ['2026-08-13T12:00:01.000Z', 50, 500000n, 'REVIEW_REQUIRED'],
    ['2026-08-17T12:00:00.000Z', 50, 500000n, 'REVIEW_REQUIRED'],
    ['2026-08-17T12:00:01.000Z', 0, 0n, 'NO_REFUND'],
  ] as const)('applies the exact boundary at %s', (now, percent, refund, outcome) => {
    const evaluation = evaluateCancellationPolicy({
      snapshot,
      now: new Date(now),
      paidAmountVnd: 1000000n,
      bookingEligible: true,
    });
    expect(evaluation.refundPercent).toBe(percent);
    expect(evaluation.refundAmountVnd).toBe(refund);
    expect(evaluation.outcome).toBe(outcome);
  });

  it('never treats an unpaid HOLD as a refundable payment', () => {
    const evaluation = evaluateCancellationPolicy({
      snapshot,
      now: new Date('2026-08-01T00:00:00.000Z'),
      paidAmountVnd: 0n,
      bookingEligible: true,
    });
    expect(evaluation.outcome).toBe('NO_CHARGE');
    expect(evaluation.refundAmountVnd).toBe(0n);
  });
});
