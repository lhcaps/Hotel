export class PricingPolicyError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'PricingPolicyError';
  }
}

export class PricingPolicyNotFoundError extends PricingPolicyError {
  public constructor() {
    super('Pricing policy was not found in the server-owned catalog.', 'PRICING_POLICY_NOT_FOUND');
  }
}

export class PricingPolicyConflictError extends PricingPolicyError {
  public constructor(message: string, code = 'PRICING_POLICY_CONFLICT') {
    super(message, code);
  }
}

export class PricingPolicyValidationError extends PricingPolicyError {
  public constructor(
    public readonly violations: readonly {
      readonly code: string;
      readonly path: string;
      readonly message: string;
    }[],
  ) {
    super('Pricing policy is not publication-ready.', 'PRICING_POLICY_VALIDATION_FAILED');
  }
}
