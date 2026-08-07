import type {
  PublishedPricingPolicyAggregate,
  PricingPolicyApplicabilityBasis,
} from './pricing-policy.domain.js';
import { PricingPolicyConflictError } from './pricing-policy.errors.js';
import { OperationsV3PricingCatalogGate } from './pricing-policy.gate.js';
import { PricingPolicyRepository } from './pricing-policy.repository.js';

export type PublishedPricingPolicyLookupResult =
  | {
      readonly kind: 'NOT_CONFIGURED';
      readonly propertyId: string;
      readonly basis: PricingPolicyApplicabilityBasis;
      readonly instant: Date;
    }
  | { readonly kind: 'FOUND'; readonly policy: PublishedPricingPolicyAggregate };

export class PublishedPricingPolicyLookupService {
  public constructor(
    private readonly gate: OperationsV3PricingCatalogGate,
    private readonly repository: PricingPolicyRepository,
  ) {}

  public async resolve(
    propertyId: string,
    basis: PricingPolicyApplicabilityBasis,
    instant: Date,
  ): Promise<PublishedPricingPolicyLookupResult> {
    this.gate.assertEnabled();
    const lineage = await this.repository.getLineage(undefined, propertyId);
    const establishedBasis = lineage[0]?.applicabilityBasis;
    if (establishedBasis !== undefined && establishedBasis !== basis)
      throw new PricingPolicyConflictError(
        'Lookup basis is not the server-authoritative property basis.',
        'PROPERTY_BASIS_MISMATCH',
      );
    const matches = await this.repository.findPublishedAt(undefined, propertyId, basis, instant);
    if (matches.length === 0) return { kind: 'NOT_CONFIGURED', propertyId, basis, instant };
    if (matches.length !== 1)
      throw new PricingPolicyConflictError(
        'Published policy lookup found more than one authoritative release.',
        'PUBLISHED_LOOKUP_AMBIGUOUS',
      );
    const match = matches[0];
    if (match === undefined)
      throw new PricingPolicyConflictError(
        'Published policy lookup found no deterministically addressable release.',
        'PUBLISHED_LOOKUP_INCONSISTENT',
      );
    const policy = await this.repository.getPublishedAggregate(undefined, match.id);
    if (policy === undefined)
      throw new PricingPolicyConflictError(
        'Published policy disappeared during lookup.',
        'PUBLISHED_LOOKUP_INCONSISTENT',
      );
    return { kind: 'FOUND', policy };
  }
}
