import { describe, expect, it } from 'vitest';

import {
  PRICING_POLICY_RULE_SCHEMA_VERSION,
  validatePricingPolicyAggregate,
  type DraftPricingPolicyComponent,
  type DraftPricingPolicyAggregate,
} from '../src/pricing-policy/pricing-policy.validator.js';

const propertyId = '00000000-0000-4000-8000-000000000101';
const actorId = '00000000-0000-4000-8000-000000000901';
const tierA = '00000000-0000-4000-8000-000000000201';
const tierB = '00000000-0000-4000-8000-000000000202';

function makeAggregate(
  overrides: Partial<DraftPricingPolicyAggregate> = {},
): DraftPricingPolicyAggregate {
  const base: DraftPricingPolicyAggregate = {
    root: {
      id: '00000000-0000-4000-8000-000000001001',
      propertyId,
      versionNumber: 1n,
      internalName: 'Standard stay policy',
      status: 'DRAFT',
      applicabilityBasis: 'STAY_START',
      effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      ruleSchemaVersion: PRICING_POLICY_RULE_SCHEMA_VERSION,
      maximumComponentLines: 8,
      createdBy: actorId,
      createdAt: new Date('2026-08-07T00:00:00.000Z'),
      updatedAt: new Date('2026-08-07T00:00:00.000Z'),
      changeNote: null,
      legacyProvenance: null,
    },
    components: [
      {
        id: '00000000-0000-4000-8000-000000002001',
        policyVersionId: '00000000-0000-4000-8000-000000001001',
        componentCode: 'BASE_STAY',
        componentKind: 'BASE_STAY',
        coverageModel: 'FIXED_ELAPSED',
        billingModel: 'FIXED_OCCURRENCE',
        fixedDurationMinutes: 1440,
        localStartMinuteInclusive: null,
        localEndMinuteExclusive: null,
        localEndDayOffset: null,
        boundaryPosition: null,
        boundaryMinDurationMinutes: null,
        boundaryMaxDurationMinutes: null,
        billingUnitMinutes: null,
        minimumBillingUnits: null,
        maximumBillingUnits: null,
        maximumOccurrencesPerCandidate: 1,
        conditionComplexityRank: 0,
        tieBreakRank: 0,
        restrictionMetadata: {},
        displayMetadata: {},
        legacyProvenance: null,
      },
    ],
    prices: [
      {
        id: '00000000-0000-4000-8000-000000003001',
        propertyId,
        policyVersionId: '00000000-0000-4000-8000-000000001001',
        componentId: '00000000-0000-4000-8000-000000002001',
        priceTierId: tierA,
        amountVnd: 350000n,
      },
    ],
    edges: [],
  };
  return {
    ...base,
    ...overrides,
    root: { ...base.root, ...overrides.root },
    components: overrides.components ?? base.components,
    prices: overrides.prices ?? base.prices,
    edges: overrides.edges ?? base.edges,
  };
}

function context(overrides: Partial<Parameters<typeof validatePricingPolicyAggregate>[1]> = {}) {
  return {
    propertyId,
    propertyTimezone: 'Asia/Ho_Chi_Minh',
    priceTierIds: new Set([tierA, tierB]),
    ...overrides,
  };
}

function baseComponent(): DraftPricingPolicyComponent {
  const component = makeAggregate().components[0];
  if (component === undefined) throw new Error('test aggregate must contain a component');
  return component;
}

describe('pricing policy aggregate validator', () => {
  it('returns a normalized publication aggregate for a valid draft', () => {
    const result = validatePricingPolicyAggregate(makeAggregate(), context());

    expect(result.errors).toEqual([]);
    expect(result.publicationReady).toBe(true);
    expect(result.normalized?.root.applicabilityBasis).toBe('STAY_START');
  });

  it('rejects duplicate component codes and incomplete tier prices', () => {
    const aggregate = makeAggregate({
      components: [
        ...makeAggregate().components,
        { ...baseComponent(), id: '00000000-0000-4000-8000-000000002002' },
      ],
    });

    const result = validatePricingPolicyAggregate(
      aggregate,
      context({ requiredPriceTierIds: new Set([tierA, tierB]) }),
    );

    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['DUPLICATE_COMPONENT_CODE', 'MISSING_COMPONENT_PRICE']),
    );
    expect(result.publicationReady).toBe(false);
  });

  it('rejects a multi-node cycle but allows only a bounded self-repeat', () => {
    const first = baseComponent();
    const second: DraftPricingPolicyComponent = {
      ...first,
      id: '00000000-0000-4000-8000-000000002002',
      componentCode: 'EXTENSION',
      componentKind: 'EXTENSION',
      maximumOccurrencesPerCandidate: 1,
    };
    const components: readonly [DraftPricingPolicyComponent, DraftPricingPolicyComponent] = [
      first,
      second,
    ];
    const [base, extension] = components;
    const cyclic = makeAggregate({
      components,
      edges: [
        {
          id: '00000000-0000-4000-8000-000000004001',
          policyVersionId: makeAggregate().root.id,
          predecessorComponentId: base.id,
          successorComponentId: extension.id,
          restrictionMetadata: null,
        },
        {
          id: '00000000-0000-4000-8000-000000004002',
          policyVersionId: makeAggregate().root.id,
          predecessorComponentId: extension.id,
          successorComponentId: base.id,
          restrictionMetadata: null,
        },
      ],
    });

    expect(
      validatePricingPolicyAggregate(cyclic, context()).errors.map((error) => error.code),
    ).toContain('MULTI_NODE_GRAPH_CYCLE');

    const repeated = makeAggregate({
      components: [{ ...base, maximumOccurrencesPerCandidate: 3 }],
      edges: [
        {
          id: '00000000-0000-4000-8000-000000004003',
          policyVersionId: makeAggregate().root.id,
          predecessorComponentId: base.id,
          successorComponentId: base.id,
          restrictionMetadata: null,
        },
      ],
    });
    expect(validatePricingPolicyAggregate(repeated, context()).errors).toEqual([]);
  });

  it('rejects a client-selected basis that differs from the property lineage', () => {
    const result = validatePricingPolicyAggregate(
      makeAggregate({ root: { ...makeAggregate().root, applicabilityBasis: 'QUOTE_INSTANT' } }),
      context({ establishedBasis: 'STAY_START' }),
    );

    expect(result.errors.map((error) => error.code)).toContain('PROPERTY_BASIS_MISMATCH');
  });

  it('fails closed for timezone mismatch and malformed local-clock shape', () => {
    const malformed = makeAggregate({
      root: { ...makeAggregate().root, timezoneSnapshot: 'UTC' },
      components: [
        {
          ...baseComponent(),
          coverageModel: 'LOCAL_CLOCK_WINDOW',
          fixedDurationMinutes: 30,
          localStartMinuteInclusive: 1380,
          localEndMinuteExclusive: 60,
          localEndDayOffset: 0,
        },
      ],
    });
    const result = validatePricingPolicyAggregate(malformed, context());

    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['TIMEZONE_SNAPSHOT_MISMATCH', 'INVALID_COVERAGE_SHAPE']),
    );
  });

  it('fails closed for local-clock windows in seasonal-offset timezones', () => {
    const result = validatePricingPolicyAggregate(
      makeAggregate({
        root: { ...makeAggregate().root, timezoneSnapshot: 'America/New_York' },
        components: [
          {
            ...baseComponent(),
            coverageModel: 'LOCAL_CLOCK_WINDOW',
            fixedDurationMinutes: null,
            localStartMinuteInclusive: 60,
            localEndMinuteExclusive: 120,
            localEndDayOffset: 0,
          },
        ],
      }),
      context({ propertyTimezone: 'America/New_York' }),
    );

    expect(result.errors.map((error) => error.code)).toContain('DST_UNRESOLVED_LOCAL_CLOCK_WINDOW');
  });
});
