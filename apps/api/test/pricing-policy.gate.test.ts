import { describe, expect, it } from 'vitest';

import {
  OperationsV3PricingCatalogGate,
  PricingCatalogRuntimeDisabledError,
} from '../src/pricing-policy/pricing-policy.gate.js';
import {
  MultiNightPricingGate,
  MultiNightPublicGate,
  MultiNightGateDisabledError,
} from '../src/pricing-policy/multi-night.gate.js';

describe('operations v3 pricing catalog dark gate', () => {
  it('defaults closed and fails closed when the runtime is disabled', () => {
    const gate = new OperationsV3PricingCatalogGate();

    expect(gate.enabled).toBe(false);
    expect(() => gate.assertEnabled()).toThrow(PricingCatalogRuntimeDisabledError);
  });

  it('opens only when the server configuration explicitly enables it', () => {
    const gate = new OperationsV3PricingCatalogGate(true);

    expect(gate.enabled).toBe(true);
    expect(gate.assertEnabled()).toBeUndefined();
  });

  it('keeps internal pricing and public exposure independently fail-closed', () => {
    const pricing = new MultiNightPricingGate(false);
    const publicExposure = new MultiNightPublicGate(false);

    expect(pricing.enabled).toBe(false);
    expect(publicExposure.enabled).toBe(false);
    expect(() => pricing.assertEnabled()).toThrow(MultiNightGateDisabledError);
    expect(() => publicExposure.assertEnabled()).toThrow(MultiNightGateDisabledError);
    expect(new MultiNightPricingGate(true).assertEnabled()).toBeUndefined();
    expect(new MultiNightPublicGate(true).assertEnabled()).toBeUndefined();
  });
});
