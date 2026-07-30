export class PaymentInitiationError extends Error {
  public constructor(
    public readonly code:
      | 'PAYMENT_IDEMPOTENCY_REQUIRED'
      | 'MOMO_DISABLED'
      | 'MOMO_INITIATION_OUTCOME_UNKNOWN'
      | 'MOMO_INITIATION_REJECTED'
      | 'VNPAY_DISABLED'
      | 'VNPAY_INITIATION_REJECTED',
  ) {
    super(code);
    this.name = 'PaymentInitiationError';
  }
}
