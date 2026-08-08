import { test, expect } from 'vitest';
import { validatePricingPolicyAggregate } from './pricing-policy.validator.js';
import type { DraftPricingPolicyAggregate } from './pricing-policy.domain.js';

/**
 * Test that the policy validator rejects component IDs with invalid UUID variant bits
 * before a policy can be published.
 * 
 * This prevents the Stage 4 P1 defect where hardcoded bootstrap UUIDs with wrong
 * variant nibbles were accepted by PostgreSQL but rejected by quote validation.
 */

const createMinimalDraftPolicy = (componentId: string): DraftPricingPolicyAggregate => ({
  root: {
    id: '00000000-0000-4000-8000-000000000001',
    propertyId: '00000000-0000-4000-8000-000000000002',
    versionNumber: 1n,
    internalName: 'Test Policy',
    status: 'DRAFT',
    applicabilityBasis: 'STAY_START',
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveUntil: null,
    timezoneSnapshot: 'Asia/Ho_Chi_Minh',
    ruleSchemaVersion: 'operations-v3-b0.2-pricing-candidate-v1',
    maximumComponentLines: 64,
    createdBy: '00000000-0000-4000-8000-000000000003',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  components: [
    {
      id: componentId,
      propertyId: '00000000-0000-4000-8000-000000000002',
      policyVersionId: '00000000-0000-4000-8000-000000000001',
      componentCode: 'TEST_COMPONENT',
      componentKind: 'BASE_STAY',
      coverageModel: 'FIXED_ELAPSED',
      boundaryPosition: null,
      billingModel: 'FIXED_OCCURRENCE',
      fixedBillingOccurrenceMinutes: 1440,
      billingUnitMinutes: null,
      minimumBillingUnits: null,
      maximumBillingUnits: null,
      boundaryMinDurationMinutes: null,
      boundaryMaxDurationMinutes: null,
      maximumOccurrencesPerCandidate: 1,
      conditionComplexityRank: 1,
      restrictionMetadata: {},
      legacyProvenance: null,
    },
  ],
  prices: [
    {
      id: '00000000-0000-4000-8000-000000000004',
      propertyId: '00000000-0000-4000-8000-000000000002',
      policyVersionId: '00000000-0000-4000-8000-000000000001',
      componentId: componentId,
      priceTierId: '00000000-0000-4000-8000-000000000005',
      amountVnd: 500000n,
    },
  ],
  edges: [],
});

const validationContext = {
  propertyId: '00000000-0000-4000-8000-000000000002',
  propertyTimezone: 'Asia/Ho_Chi_Minh',
  priceTierIds: new Set(['00000000-0000-4000-8000-000000000005']),
  establishedBasis: undefined,
};

test('validator accepts component with valid RFC 4122 UUID (variant 8)', () => {
  const policy = createMinimalDraftPolicy('a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d');
  const result = validatePricingPolicyAggregate(policy, validationContext);
  
  const uuidErrors = result.errors.filter(e => e.code === 'INVALID_COMPONENT_UUID');
  expect(uuidErrors).toHaveLength(0);
});

test('validator accepts component with valid RFC 4122 UUID (variant 9)', () => {
  const policy = createMinimalDraftPolicy('b2c3d4e5-f6a1-4b2c-9d0e-1f2a3b4c5d6e');
  const result = validatePricingPolicyAggregate(policy, validationContext);
  
  const uuidErrors = result.errors.filter(e => e.code === 'INVALID_COMPONENT_UUID');
  expect(uuidErrors).toHaveLength(0);
});

test('validator rejects component with invalid UUID variant nibble 0', () => {
  const policy = createMinimalDraftPolicy('c3d4e5f6-a1b2-4c3d-0e1f-2a3b4c5d6e7f');
  const result = validatePricingPolicyAggregate(policy, validationContext);
  
  const uuidErrors = result.errors.filter(e => e.code === 'INVALID_COMPONENT_UUID');
  expect(uuidErrors).toHaveLength(1);
  expect(uuidErrors[0].path).toBe('components[0].id');
  expect(uuidErrors[0].message).toContain('RFC 4122 UUID');
});

test('validator rejects component with invalid UUID variant nibble 1', () => {
  const policy = createMinimalDraftPolicy('d4e5f6a1-b2c3-4d4e-1f2a-3b4c5d6e7f8a');
  const result = validatePricingPolicyAggregate(policy, validationContext);
  
  const uuidErrors = result.errors.filter(e => e.code === 'INVALID_COMPONENT_UUID');
  expect(uuidErrors).toHaveLength(1);
  expect(uuidErrors[0].path).toBe('components[0].id');
  expect(uuidErrors[0].message).toContain('RFC 4122 UUID');
});

test('validator prevents publication of policy with invalid component UUIDs', () => {
  const policy = createMinimalDraftPolicy('c3d4e5f6-a1b2-4c3d-0e1f-2a3b4c5d6e7f');
  const result = validatePricingPolicyAggregate(policy, validationContext);
  
  expect(result.publicationReady).toBe(false);
  expect(result.errors.some(e => e.code === 'INVALID_COMPONENT_UUID')).toBe(true);
});
