/** A stable, safe-to-expose payment-domain failure. Provider payloads never become its message. */
export class PaymentCoreError extends Error {
  override readonly name: string = 'PaymentCoreError';

  constructor(readonly code: string) {
    super(code);
  }
}

export class PaymentAlreadySettledError extends Error {
  override readonly name: string = 'PaymentAlreadySettledError';
  readonly code = 'PAYMENT_ALREADY_SETTLED';

  constructor(message: string) {
    super(`PAYMENT_ALREADY_SETTLED: ${message}`);
  }
}

export class PaymentCurrencyMismatchError extends Error {
  override readonly name: string = 'PaymentCurrencyMismatchError';
  readonly code = 'PAYMENT_CURRENCY_MISMATCH';

  constructor(message: string) {
    super(`PAYMENT_CURRENCY_MISMATCH: ${message}`);
  }
}

/**
 * Typed error families thrown from the provider-status-query boundary. These
 * live alongside the existing core errors because the adapter contract exposes
 * a richer failure shape to booking core: callers must be able to distinguish
 * a transient network failure from a hard configuration drift from an
 * authoritative provider rejection.
 *
 * The message is always a stable, internal-only code. Provider payloads and
 * credentials never leak into the message string.
 */

export type PaymentProviderNetworkErrorCode =
  'PROVIDER_TIMEOUT' | 'PROVIDER_ABORTED' | 'PROVIDER_UNREACHABLE' | 'PROVIDER_INVALID_RESPONSE';

export class PaymentProviderNetworkError extends Error {
  override readonly name: string = 'PaymentProviderNetworkError';

  public constructor(readonly code: PaymentProviderNetworkErrorCode) {
    super(`PAYMENT_PROVIDER_NETWORK:${code}`);
  }
}

export type PaymentProviderConfigErrorCode =
  'PROVIDER_CONFIG_MISSING' | 'PROVIDER_CONFIG_INVALID' | 'PROVIDER_TIMEOUT_FLOOR';

export class PaymentProviderConfigError extends Error {
  override readonly name: string = 'PaymentProviderConfigError';

  public constructor(readonly code: PaymentProviderConfigErrorCode) {
    super(`PAYMENT_PROVIDER_CONFIG:${code}`);
  }
}

export type PaymentProviderAdapterErrorCode =
  | 'PROVIDER_PAYLOAD_INVALID'
  | 'PROVIDER_SIGNATURE_INVALID'
  | 'PROVIDER_ORDER_MISMATCH'
  | 'PROVIDER_MERCHANT_MISMATCH'
  | 'PROVIDER_AMOUNT_MISMATCH'
  | 'PROVIDER_TRANSACTION_MISMATCH';

export class PaymentProviderAdapterError extends Error {
  override readonly name: string = 'PaymentProviderAdapterError';

  public constructor(readonly code: PaymentProviderAdapterErrorCode) {
    super(`PAYMENT_PROVIDER_ADAPTER:${code}`);
  }
}
