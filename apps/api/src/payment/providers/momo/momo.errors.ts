import {
  PaymentProviderAdapterError,
  PaymentProviderConfigError,
  PaymentProviderNetworkError,
} from '@room/booking';

export class MomoAdapterError extends Error {
  public constructor(
    public readonly code:
      | 'MOMO_DISABLED'
      | 'MOMO_INITIATION_OUTCOME_UNKNOWN'
      | 'MOMO_INITIATION_REJECTED'
      | 'MOMO_RESPONSE_INVALID'
      | 'MOMO_RESPONSE_ORDER_MISMATCH'
      | 'MOMO_RESPONSE_REQUEST_MISMATCH'
      | 'MOMO_RESPONSE_AMOUNT_MISMATCH'
      | 'MOMO_RESPONSE_SIGNATURE_INVALID'
      | 'MOMO_RESPONSE_REDIRECT_INVALID'
      | 'MOMO_IPN_CONTENT_TYPE_INVALID'
      | 'MOMO_IPN_INVALID_PAYLOAD'
      | 'MOMO_IPN_SIGNATURE_INVALID'
      | 'MOMO_IPN_UNSUPPORTED_RESULT',
  ) {
    super(code);
    this.name = 'MomoAdapterError';
  }
}

/**
 * Typed status-query errors. The adapter never throws the legacy
 * `MomoAdapterError` codes from `queryTransactionStatus`; the booking core
 * must rely on these discriminated failures instead.
 */
export type MomoQueryNetworkCode =
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_ABORTED'
  | 'PROVIDER_UNREACHABLE'
  | 'PROVIDER_INVALID_RESPONSE';

export type MomoQueryConfigCode =
  | 'PROVIDER_CONFIG_MISSING'
  | 'PROVIDER_CONFIG_INVALID'
  | 'PROVIDER_TIMEOUT_FLOOR';

export type MomoQueryAdapterCode =
  | 'PROVIDER_PAYLOAD_INVALID'
  | 'PROVIDER_SIGNATURE_INVALID'
  | 'PROVIDER_ORDER_MISMATCH'
  | 'PROVIDER_MERCHANT_MISMATCH'
  | 'PROVIDER_AMOUNT_MISMATCH'
  | 'PROVIDER_TRANSACTION_MISMATCH';

export class MomoQueryNetworkError extends PaymentProviderNetworkError {
  override readonly name = 'MomoQueryNetworkError';
  public constructor(public readonly momoCode: MomoQueryNetworkCode) {
    super(momoCode);
  }
}

export class MomoQueryConfigError extends PaymentProviderConfigError {
  override readonly name = 'MomoQueryConfigError';
  public constructor(public readonly momoCode: MomoQueryConfigCode) {
    super(momoCode);
  }
}

export class MomoQueryAdapterError extends PaymentProviderAdapterError {
  override readonly name = 'MomoQueryAdapterError';
  public constructor(public readonly momoCode: MomoQueryAdapterCode) {
    super(momoCode);
  }
}
