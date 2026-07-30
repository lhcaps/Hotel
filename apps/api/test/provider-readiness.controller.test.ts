import { describe, expect, it } from 'vitest';

import { ProviderReadinessController } from '../src/auth/provider-readiness.controller.js';

describe('ProviderReadinessController', () => {
  it('returns only a safe disabled Google readiness state', () => {
    const controller = new ProviderReadinessController({ GOOGLE_AUTH_ENABLED: false } as never);

    expect(controller.get()).toEqual({
      google: { enabled: false, unavailableReason: 'CONFIGURATION_REQUIRED' },
    });
  });

  it('returns a safe enabled Google readiness state', () => {
    const controller = new ProviderReadinessController({ GOOGLE_AUTH_ENABLED: true } as never);

    expect(controller.get()).toEqual({ google: { enabled: true, unavailableReason: null } });
  });
});
