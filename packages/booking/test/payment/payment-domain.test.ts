import { describe, expect, it } from 'vitest';

import * as booking from '../../src/index.js';

const paymentDomain = booking as typeof booking & {
  transitionPaymentAttempt: (current: string, next: string) => string;
  assertVerifiedPaymentProviderEvent: (event: unknown) => void;
};

const verifiedSuccess = {
  provider: 'MOMO' as const,
  eventKey: 'evt-001',
  providerOrderId: 'order-001',
  providerTransactionId: 'txn-001',
  normalizedOutcome: 'SUCCEEDED' as const,
  amountVnd: 349000n,
  currency: 'VND' as const,
  occurredAt: new Date('2026-07-26T10:00:00.000Z'),
  rawBodyDigest: Buffer.alloc(32, 1),
  verificationMarker: 'VERIFIED_BY_ADAPTER' as const,
};

describe('Phase 7C payment domain vocabulary', () => {
  it('does not allow a non-success outcome to downgrade a successful attempt', () => {
    expect(() => paymentDomain.transitionPaymentAttempt('SUCCEEDED', 'FAILED')).toThrow(
      'PAYMENT_ALREADY_SETTLED',
    );
  });

  it('rejects a normalized provider event with a non-VND currency', () => {
    expect(() =>
      paymentDomain.assertVerifiedPaymentProviderEvent({
        ...verifiedSuccess,
        currency: 'USD',
      }),
    ).toThrow('PAYMENT_CURRENCY_MISMATCH');
  });

  it('requires the adapter verification marker before an event enters the core', () => {
    expect(() =>
      paymentDomain.assertVerifiedPaymentProviderEvent({
        ...verifiedSuccess,
        verificationMarker: 'UNVERIFIED',
      }),
    ).toThrow('PAYMENT_EVENT_UNVERIFIED');
  });
});
