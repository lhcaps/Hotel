export class PaymentProviderSettingsError extends Error {
  public constructor(
    public readonly code:
      | 'PAYMENT_PROVIDER_NOT_CONFIGURED'
      | 'PAYMENT_PROVIDER_NOT_FOUND'
      | 'PAYMENT_PROVIDER_PROPERTY_NOT_FOUND',
  ) {
    super(code);
    this.name = 'PaymentProviderSettingsError';
  }
}
