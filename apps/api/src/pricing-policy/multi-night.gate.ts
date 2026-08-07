import type { ApiEnvironment } from '@room/config';

export const OPERATIONS_V3_MULTI_NIGHT_PRICING_GATE = 'OPERATIONS_V3_MULTI_NIGHT_PRICING' as const;
export const OPERATIONS_V3_MULTI_NIGHT_PUBLIC_GATE = 'OPERATIONS_V3_MULTI_NIGHT_PUBLIC' as const;

export class MultiNightGateDisabledError extends Error {
  public readonly code = 'SERVICE_UNAVAILABLE';

  public constructor(public readonly gateName: string) {
    super('The requested multi-night capability is not enabled.');
    this.name = 'MultiNightGateDisabledError';
  }
}

export class MultiNightPricingGate {
  public constructor(public readonly enabled: boolean) {}

  public assertEnabled(): void {
    if (!this.enabled)
      throw new MultiNightGateDisabledError(OPERATIONS_V3_MULTI_NIGHT_PRICING_GATE);
  }
}

export class MultiNightPublicGate {
  public constructor(public readonly enabled: boolean) {}

  public assertEnabled(): void {
    if (!this.enabled) throw new MultiNightGateDisabledError(OPERATIONS_V3_MULTI_NIGHT_PUBLIC_GATE);
  }
}

export function createMultiNightPricingGate(environment: ApiEnvironment): MultiNightPricingGate {
  return new MultiNightPricingGate(environment.OPERATIONS_V3_MULTI_NIGHT_PRICING_ENABLED);
}

export function createMultiNightPublicGate(environment: ApiEnvironment): MultiNightPublicGate {
  return new MultiNightPublicGate(environment.OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED);
}
