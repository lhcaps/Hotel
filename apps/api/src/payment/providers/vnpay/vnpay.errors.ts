import {
  PaymentProviderAdapterError,
  PaymentProviderConfigError,
  PaymentProviderNetworkError,
} from '@room/booking';

export class VnpayAdapterError extends Error {
  public constructor(
    public readonly code:
      | 'VNPAY_DISABLED'
      | 'VNPAY_INITIATION_REJECTED'
      | 'VNPAY_IPN_INVALID_PAYLOAD'
      | 'VNPAY_IPN_SIGNATURE_INVALID',
  ) {
    super(code);
    this.name = 'VnpayAdapterError';
  }
}

/**
 * Typed status-query errors. Reuses the same discriminated codes as the
 * MoMo adapter so the booking core can write a single switch over the
 * provider-error family.
 */
export type VnpayQueryNetworkCode =
  'PROVIDER_TIMEOUT' | 'PROVIDER_ABORTED' | 'PROVIDER_UNREACHABLE' | 'PROVIDER_INVALID_RESPONSE';

export type VnpayQueryConfigCode =
  'PROVIDER_CONFIG_MISSING' | 'PROVIDER_CONFIG_INVALID' | 'PROVIDER_TIMEOUT_FLOOR';

export type VnpayQueryAdapterCode =
  | 'PROVIDER_PAYLOAD_INVALID'
  | 'PROVIDER_SIGNATURE_INVALID'
  | 'PROVIDER_ORDER_MISMATCH'
  | 'PROVIDER_MERCHANT_MISMATCH'
  | 'PROVIDER_AMOUNT_MISMATCH'
  | 'PROVIDER_TRANSACTION_MISMATCH';

export class VnpayQueryNetworkError extends PaymentProviderNetworkError {
  override readonly name = 'VnpayQueryNetworkError';
  public constructor(public readonly vnpayCode: VnpayQueryNetworkCode) {
    super(vnpayCode);
  }
}

export class VnpayQueryConfigError extends PaymentProviderConfigError {
  override readonly name = 'VnpayQueryConfigError';
  public constructor(public readonly vnpayCode: VnpayQueryConfigCode) {
    super(vnpayCode);
  }
}

export class VnpayQueryAdapterError extends PaymentProviderAdapterError {
  override readonly name = 'VnpayQueryAdapterError';
  public constructor(public readonly vnpayCode: VnpayQueryAdapterCode) {
    super(vnpayCode);
  }
}
