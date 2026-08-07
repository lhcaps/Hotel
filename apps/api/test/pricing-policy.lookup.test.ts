import { describe, expect, it, vi } from 'vitest';

import { PricingCatalogRuntimeDisabledError } from '../src/pricing-policy/pricing-policy.gate.js';
import { PublishedPricingPolicyLookupService } from '../src/pricing-policy/pricing-policy.lookup.service.js';
import { PricingPolicyRepository } from '../src/pricing-policy/pricing-policy.repository.js';

const propertyId = '00000000-0000-4000-8000-000000000101';

describe('published pricing policy lookup', () => {
  it('fails closed while the dark gate is disabled', async () => {
    const repository = {} as PricingPolicyRepository;
    const service = new PublishedPricingPolicyLookupService(
      {
        enabled: false,
        assertEnabled: () => {
          throw new PricingCatalogRuntimeDisabledError();
        },
      },
      repository,
    );

    await expect(service.resolve(propertyId, 'STAY_START', new Date())).rejects.toBeInstanceOf(
      PricingCatalogRuntimeDisabledError,
    );
  });

  it('returns not configured for zero authoritative matches and rejects an ambiguous match', async () => {
    const repository = {
      getLineage: vi.fn().mockResolvedValue([]),
      findPublishedAt: vi.fn().mockResolvedValue([]),
    } as unknown as PricingPolicyRepository;
    const service = new PublishedPricingPolicyLookupService(
      { enabled: true, assertEnabled: vi.fn() },
      repository,
    );

    await expect(
      service.resolve(propertyId, 'STAY_START', new Date('2027-01-01T00:00:00.000Z')),
    ).resolves.toMatchObject({ kind: 'NOT_CONFIGURED' });

    vi.mocked(repository.findPublishedAt).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await expect(
      service.resolve(propertyId, 'STAY_START', new Date('2027-01-01T00:00:00.000Z')),
    ).rejects.toMatchObject({ code: 'PUBLISHED_LOOKUP_AMBIGUOUS' });
  });
});
