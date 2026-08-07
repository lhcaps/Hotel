import { describe, expect, it } from 'vitest';

import type {
  PublishedPricingPolicyAggregate,
  DraftPricingPolicyComponent,
} from '../src/pricing-policy/pricing-policy.domain.js';
import {
  composeMultiNightPricing,
  MultiNightPricingError,
} from '../src/pricing-policy/pricing-policy.composer.js';

const PROPERTY_ID = '00000000-0000-4000-8000-000000000001';
const POLICY_ID = '00000000-0000-4000-8000-000000000002';
const TIER_ID = '00000000-0000-4000-8000-000000000003';
const LEADING_ID = '00000000-0000-4000-8000-000000000004';
const CONTINUATION_ID = '00000000-0000-4000-8000-000000000005';
const FINAL_ID = '00000000-0000-4000-8000-000000000006';
const TRAILING_ID = '00000000-0000-4000-8000-000000000007';
const RESTRICTED_CONTINUATION_ID = '00000000-0000-4000-8000-000000000009';

function component(
  id: string,
  code: string,
  patch: Partial<DraftPricingPolicyComponent>,
): DraftPricingPolicyComponent {
  return {
    id,
    policyVersionId: POLICY_ID,
    componentCode: code,
    componentKind: 'BASE_STAY',
    coverageModel: 'FIXED_ELAPSED',
    billingModel: 'FIXED_OCCURRENCE',
    fixedDurationMinutes: 1_440,
    localStartMinuteInclusive: null,
    localEndMinuteExclusive: null,
    localEndDayOffset: null,
    boundaryPosition: null,
    boundaryMinDurationMinutes: null,
    boundaryMaxDurationMinutes: null,
    billingUnitMinutes: null,
    minimumBillingUnits: null,
    maximumBillingUnits: null,
    maximumOccurrencesPerCandidate: 31,
    conditionComplexityRank: 0,
    tieBreakRank: 0,
    restrictionMetadata: {},
    displayMetadata: {},
    legacyProvenance: null,
    ...patch,
  };
}

function policy(window: '21-09' | '22-10' = '21-09'): PublishedPricingPolicyAggregate {
  const leading = component(LEADING_ID, 'B0_LEADING', {
    componentKind: 'EXTENSION',
    coverageModel: 'REQUEST_BOUNDARY',
    billingModel: 'STARTED_UNIT',
    fixedDurationMinutes: null,
    boundaryPosition: 'LEADING',
    boundaryMinDurationMinutes: 15,
    boundaryMaxDurationMinutes: 300,
    billingUnitMinutes: 60,
    minimumBillingUnits: 1,
    maximumBillingUnits: 5,
    maximumOccurrencesPerCandidate: 1,
  });
  const continuation = component(CONTINUATION_ID, 'B0_CONTINUATION', {});
  const final = component(FINAL_ID, 'B0_FINAL_NIGHT', {
    coverageModel: 'LOCAL_CLOCK_WINDOW',
    fixedDurationMinutes: null,
    localStartMinuteInclusive: window === '21-09' ? 1_260 : 1_320,
    localEndMinuteExclusive: window === '21-09' ? 540 : 600,
    localEndDayOffset: 1,
    maximumOccurrencesPerCandidate: 1,
  });
  const trailing = component(TRAILING_ID, 'B0_TRAILING', {
    componentKind: 'EXTENSION',
    coverageModel: 'REQUEST_BOUNDARY',
    billingModel: 'STARTED_UNIT',
    fixedDurationMinutes: null,
    boundaryPosition: 'TRAILING',
    boundaryMinDurationMinutes: 15,
    boundaryMaxDurationMinutes: 300,
    billingUnitMinutes: 60,
    minimumBillingUnits: 1,
    maximumBillingUnits: 5,
    maximumOccurrencesPerCandidate: 1,
  });
  const edgePairs: readonly (readonly [string, string])[] = [
    [LEADING_ID, CONTINUATION_ID],
    [LEADING_ID, FINAL_ID],
    [CONTINUATION_ID, CONTINUATION_ID],
    [CONTINUATION_ID, FINAL_ID],
    [FINAL_ID, TRAILING_ID],
  ];
  return {
    root: {
      id: POLICY_ID,
      propertyId: PROPERTY_ID,
      versionNumber: 1n,
      internalName: 'B0 test policy',
      status: 'PUBLISHED',
      applicabilityBasis: 'STAY_START',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      ruleSchemaVersion: 'operations-v3-b0.2-policy-v1',
      maximumComponentLines: 64,
      createdBy: PROPERTY_ID,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      changeNote: null,
      legacyProvenance: null,
    },
    components: [leading, continuation, final, trailing],
    prices: [leading, continuation, final, trailing].map((item) => ({
      id: `${item.id.slice(0, -1)}8`,
      propertyId: PROPERTY_ID,
      policyVersionId: POLICY_ID,
      componentId: item.id,
      priceTierId: TIER_ID,
      amountVnd: item.id === LEADING_ID || item.id === TRAILING_ID ? 50_000n : 500_000n,
    })),
    edges: edgePairs.map(([predecessorComponentId, successorComponentId], index) => ({
      id: `00000000-0000-4000-8000-00000000001${index}`,
      policyVersionId: POLICY_ID,
      predecessorComponentId,
      successorComponentId,
      restrictionMetadata: null,
    })),
  };
}

function compose(
  checkInAt: string,
  checkOutAt: string,
  currentPolicy: PublishedPricingPolicyAggregate = policy(),
) {
  const input = {
    checkInAt: new Date(checkInAt),
    checkOutAt: new Date(checkOutAt),
    propertyTimezone: 'Asia/Ho_Chi_Minh',
    priceTierId: TIER_ID,
    policy: currentPolicy,
    applicabilityInstant: new Date(checkInAt),
  };
  return composeMultiNightPricing(input);
}

describe('composeMultiNightPricing', () => {
  it('prices one, two, and three local overnight occurrences without gaps', () => {
    const one = compose('2026-08-06T14:00:00.000Z', '2026-08-07T02:00:00.000Z');
    const two = compose('2026-08-06T14:00:00.000Z', '2026-08-08T02:00:00.000Z');
    const three = compose('2026-08-06T14:00:00.000Z', '2026-08-09T02:00:00.000Z');
    expect(one.selected.lines).toHaveLength(1);
    expect(two.selected.lines.map((line) => line.componentCode)).toEqual([
      'B0_CONTINUATION',
      'B0_FINAL_NIGHT',
    ]);
    expect(three.selected.lines).toHaveLength(3);
    expect(one.selected.finalAmountVnd).toBe(500_000);
    expect(two.selected.finalAmountVnd).toBe(1_000_000);
    expect(three.selected.finalAmountVnd).toBe(1_500_000);
  });

  it('charges leading and trailing started units without extending coverage', () => {
    const result = compose('2026-08-06T11:00:00.000Z', '2026-08-07T04:30:00.000Z');
    expect(result.selected.lines.map((line) => line.componentCode)).toEqual([
      'B0_LEADING',
      'B0_FINAL_NIGHT',
      'B0_TRAILING',
    ]);
    expect(result.selected.lines[0]?.billingUnitQuantity).toBe(3);
    expect(result.selected.lines[2]?.billingUnitQuantity).toBe(3);
    expect(result.selected.lines[0]?.endAt.toISOString()).toBe('2026-08-06T14:00:00.000Z');
    expect(result.selected.lines[2]?.endAt.toISOString()).toBe('2026-08-07T04:30:00.000Z');
  });

  it('supports the alternate 22:00–10:00 local overnight window', () => {
    const result = compose('2026-08-06T15:00:00.000Z', '2026-08-08T03:00:00.000Z', policy('22-10'));
    expect(result.selected.lines.map((line) => line.componentCode)).toEqual([
      'B0_CONTINUATION',
      'B0_FINAL_NIGHT',
    ]);
    expect(result.selected.displayNightCount).toBe(2);
  });

  it('keeps local calendar night counting across month, year, and leap-day boundaries', () => {
    const month = compose('2026-01-31T14:00:00.000Z', '2026-02-02T02:00:00.000Z');
    const year = compose('2027-12-31T14:00:00.000Z', '2028-01-02T02:00:00.000Z');
    const leap = compose('2028-02-28T14:00:00.000Z', '2028-03-02T02:00:00.000Z');
    expect(month.selected.displayNightCount).toBe(2);
    expect(year.selected.displayNightCount).toBe(2);
    expect(leap.selected.displayNightCount).toBe(3);
  });

  it('fails closed when a required component price is missing', () => {
    const incomplete = policy();
    const withoutContinuation = {
      ...incomplete,
      prices: incomplete.prices.filter((price) => price.componentId !== CONTINUATION_ID),
    };
    expect(() =>
      compose('2026-08-06T14:00:00.000Z', '2026-08-08T02:00:00.000Z', withoutContinuation),
    ).toThrow(MultiNightPricingError);
  });

  it('ranks customer-convenient valid coverage before a cheaper restricted alternative', () => {
    const base = policy();
    const restrictedContinuation = component(
      RESTRICTED_CONTINUATION_ID,
      'B0_RESTRICTED_CONTINUATION',
      { restrictionMetadata: { restrictionRank: 9 } },
    );
    const ranked = {
      ...base,
      components: [...base.components, restrictedContinuation],
      prices: [
        ...base.prices,
        {
          id: '00000000-0000-4000-8000-000000000019',
          propertyId: PROPERTY_ID,
          policyVersionId: POLICY_ID,
          componentId: RESTRICTED_CONTINUATION_ID,
          priceTierId: TIER_ID,
          amountVnd: 1n,
        },
      ],
      edges: [
        ...base.edges,
        {
          id: '00000000-0000-4000-8000-000000000029',
          policyVersionId: POLICY_ID,
          predecessorComponentId: RESTRICTED_CONTINUATION_ID,
          successorComponentId: FINAL_ID,
          restrictionMetadata: null,
        },
      ],
    };

    const result = compose('2026-08-06T14:00:00.000Z', '2026-08-08T02:00:00.000Z', ranked);
    expect(result.selected.lines.map((line) => line.componentCode)).toEqual([
      'B0_CONTINUATION',
      'B0_FINAL_NIGHT',
    ]);
  });

  it('is deterministic and rejects a gap outside the supported graph', () => {
    const first = compose('2026-08-06T14:00:00.000Z', '2026-08-08T02:00:00.000Z');
    const second = compose('2026-08-06T14:00:00.000Z', '2026-08-08T02:00:00.000Z');
    expect(first.selected.stableCandidateId).toBe(second.selected.stableCandidateId);
    expect(() => compose('2026-08-06T15:00:00.000Z', '2026-08-07T02:00:00.000Z')).toThrow(
      MultiNightPricingError,
    );
  });
});
