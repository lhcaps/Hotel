import type { ApiEnvironment } from '@room/config';

export const OPERATIONS_V3_PRICING_CATALOG_RUNTIME_GATE =
  'OPERATIONS_V3_PRICING_CATALOG_RUNTIME' as const;

export class PricingCatalogRuntimeDisabledError extends Error {
  public readonly code = 'PRICING_CATALOG_RUNTIME_DISABLED';

  public constructor() {
    super('Operations V3 pricing catalog runtime is disabled.');
    this.name = 'PricingCatalogRuntimeDisabledError';
  }
}

export class PricingPolicyBootstrapDisabledError extends Error {
  public readonly code = 'PRICING_POLICY_BOOTSTRAP_DISABLED';

  public constructor() {
    super(
      'Operations V3 B0 bootstrap is limited to an explicitly enabled development environment.',
    );
    this.name = 'PricingPolicyBootstrapDisabledError';
  }
}

export class OperationsV3PricingCatalogGate {
  public readonly enabled: boolean;

  public constructor(enabled = false) {
    this.enabled = enabled;
  }

  public assertEnabled(): void {
    if (!this.enabled) throw new PricingCatalogRuntimeDisabledError();
  }
}

export function createOperationsV3PricingCatalogGate(
  environment: Pick<ApiEnvironment, 'OPERATIONS_V3_PRICING_CATALOG_RUNTIME_ENABLED'>,
): OperationsV3PricingCatalogGate {
  return new OperationsV3PricingCatalogGate(
    environment.OPERATIONS_V3_PRICING_CATALOG_RUNTIME_ENABLED,
  );
}
