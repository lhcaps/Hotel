export class AdminPaymentReconciliationError extends Error {
  public readonly code: string;
  public constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'AdminPaymentReconciliationError';
    this.code = code;
  }
}

export class AdminPaymentNotFoundError extends AdminPaymentReconciliationError {
  public constructor() {
    super('ADMIN_PAYMENT_NOT_FOUND', 'Payment not found for the current property.');
    this.name = 'AdminPaymentNotFoundError';
  }
}

export class AdminPaymentReconciliationStaleError extends AdminPaymentReconciliationError {
  public constructor() {
    super(
      'ADMIN_PAYMENT_RECONCILIATION_STALE',
      'Payment changed since reconciliation request was issued; reload the payment and retry.',
    );
    this.name = 'AdminPaymentReconciliationStaleError';
  }
}

export class AdminPaymentReconciliationUnavailableError extends AdminPaymentReconciliationError {
  public constructor(reason: string) {
    super('ADMIN_PAYMENT_RECONCILIATION_UNAVAILABLE', `Reconciliation is not available: ${reason}`);
    this.name = 'AdminPaymentReconciliationUnavailableError';
  }
}

export class AdminPaymentReconciliationRateLimitedError extends AdminPaymentReconciliationError {
  public readonly retryAt: Date;
  public constructor(retryAt: Date) {
    super(
      'ADMIN_PAYMENT_RECONCILIATION_RATE_LIMITED',
      `Reconciliation request rate-limited; next eligible at ${retryAt.toISOString()}.`,
    );
    this.name = 'AdminPaymentReconciliationRateLimitedError';
    this.retryAt = retryAt;
  }
}
