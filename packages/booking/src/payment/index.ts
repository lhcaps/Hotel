import {
  PaymentAlreadySettledError,
  PaymentCoreError,
  PaymentCurrencyMismatchError,
} from './errors.js';
import type { PaymentAttemptStatus, VerifiedPaymentProviderEvent } from './types.js';

export * from './adapter.js';
export * from './errors.js';
export * from './types.js';
export * from './payment-service.js';
export * from './reconciliation.js';

export function transitionPaymentAttempt(
  current: PaymentAttemptStatus,
  next: PaymentAttemptStatus,
): PaymentAttemptStatus {
  if (current === 'SUCCEEDED' && next !== 'SUCCEEDED') {
    throw new PaymentAlreadySettledError('A succeeded payment attempt is terminal');
  }
  return next;
}

export function assertVerifiedPaymentProviderEvent(event: VerifiedPaymentProviderEvent): void {
  if (event.verificationMarker !== 'VERIFIED_BY_ADAPTER') {
    throw new PaymentCoreError('PAYMENT_EVENT_UNVERIFIED');
  }
  if (event.currency !== null && event.currency !== 'VND') {
    throw new PaymentCurrencyMismatchError('Verified provider event must use VND');
  }
  if (
    event.currency !== 'VND' ||
    event.amountVnd === null ||
    event.amountVnd < 0n ||
    event.providerOrderId.trim() === '' ||
    event.providerTransactionId === null ||
    event.providerTransactionId.trim() === ''
  ) {
    throw new PaymentCoreError('PAYMENT_EVENT_INVALID');
  }
  if (event.rawBodyDigest.length !== 32) {
    throw new PaymentCoreError('PAYMENT_EVENT_INVALID');
  }
}
