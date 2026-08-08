import { describe, expect, it } from 'vitest';
import { multiNightPricingSchema } from '@room/contracts';

import type {
  PublishedPricingPolicyAggregate,
  DraftPricingPolicyComponent,
} from '../src/pricing-policy/pricing-policy.domain.js';
import { composeMultiNightPricing } from '../src/pricing-policy/pricing-policy.composer.js';

/**
 * Stage 4 P1 quote-boundary red-green regression.
 *
 * Reproduces the exact production failure:
 *   POST /api/v1/quotes (mode=multi_night, 2 nights)
 *   → HTTP 400 pricing.lines.1.componentId "Invalid UUID"
 *
 * The composer emits `componentId: component.id` unchanged, the quote repository
 * spreads each line into the persisted snapshot, and QuoteService validates that
 * snapshot with `quoteSchema` (whose `pricing` is `multiNightPricingSchema`).
 *
 * This test drives the real composer + the real serialization shape used by
 * `QuoteRepository.serializePricing` + the real public contract schema. It does
 * NOT re-implement UUID rules — it asserts behaviour at the exact boundary.
 *
 * BAD aggregate (production v1 FINAL_NIGHT/TRAILING variant nibbles 0/1) => FAIL.
 * GOOD aggregate (canonical RFC 4122 IDs)                               => PASS.
 */

const PROPERTY_ID = '00000000-0000-4000-8000-000000000001';
const POLICY_ID = '00000000-0000-4000-8000-000000000002';
const TIER_ID = '00000000-0000-4000-8000-000000000003';

// Canonical, contract-valid component IDs (variant nibble 8/9/a/b).
const VALID_IDS = {
  leading: '11111111-1111-4111-8111-111111111111',
  continuation: '22222222-2222-4222-9222-222222222222',
  final: '33333333-3333-4333-a333-333333333333',
  trailing: '44444444-4444-4444-b444-444444444444',
} as const;

// Exact production v1 IDs from 0030_b0_production_bootstrap.sql.
// FINAL_NIGHT variant nibble = 0, TRAILING variant nibble = 1 (both invalid).
const PRODUCTION_IDS = {
  leading: 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d',
  continuation: 'b2c3d4e5-f6a1-4b2c-9d0e-1f2a3b4c5d6e',
  final: 'c3d4e5f6-a1b2-4c3d-0e1f-2a3b4c5d6e7f',
  trailing: 'd4e5f6a1-b2c3-4d4e-1f2a-3b4c5d6e7f8a',
} as const;

interface ComponentIds {
  readonly leading: string;
  readonly continuation: string;
  readonly final: string;
  readonly trailing: string;
}

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

function policy(ids: ComponentIds): PublishedPricingPolicyAggregate {
  const leading = component(ids.leading, 'B0_LEADING', {
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
  const continuation = component(ids.continuation, 'B0_CONTINUATION', {});
  const final = component(ids.final, 'B0_FINAL_NIGHT', {
    coverageModel: 'LOCAL_CLOCK_WINDOW',
    fixedDurationMinutes: null,
    localStartMinuteInclusive: 1_260,
    localEndMinuteExclusive: 540,
    localEndDayOffset: 1,
    maximumOccurrencesPerCandidate: 1,
  });
  const trailing = component(ids.trailing, 'B0_TRAILING', {
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
    [ids.leading, ids.continuation],
    [ids.leading, ids.final],
    [ids.continuation, ids.continuation],
    [ids.continuation, ids.final],
    [ids.final, ids.trailing],
  ];
  return {
    root: {
      id: POLICY_ID,
      propertyId: PROPERTY_ID,
      versionNumber: 1n,
      internalName: 'B0 regression policy',
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
    prices: [leading, continuation, final, trailing].map((item, index) => ({
      // Price IDs are always canonical; only component IDs vary between cases.
      id: `55555555-5555-4555-8555-00000000000${index}`,
      propertyId: PROPERTY_ID,
      policyVersionId: POLICY_ID,
      componentId: item.id,
      priceTierId: TIER_ID,
      amountVnd: item.id === ids.leading || item.id === ids.trailing ? 50_000n : 500_000n,
    })),
    edges: edgePairs.map(([predecessorComponentId, successorComponentId], index) => ({
      id: `66666666-6666-4666-8666-00000000000${index}`,
      policyVersionId: POLICY_ID,
      predecessorComponentId,
      successorComponentId,
      restrictionMetadata: null,
    })),
  };
}

/**
 * Mirror of QuoteRepository.serializePricing for the multi-night branch. This is
 * the exact shape persisted to the quote snapshot and later validated by
 * quoteSchema before the public response is returned.
 */
function serializeSelectedCandidate(currentPolicy: PublishedPricingPolicyAggregate) {
  const composed = composeMultiNightPricing({
    // Two local overnight occurrences: CONTINUATION + FINAL_NIGHT.
    checkInAt: new Date('2026-08-09T21:00:00+07:00'),
    checkOutAt: new Date('2026-08-11T09:00:00+07:00'),
    propertyTimezone: 'Asia/Ho_Chi_Minh',
    priceTierId: TIER_ID,
    policy: currentPolicy,
    applicabilityInstant: new Date('2026-08-09T21:00:00+07:00'),
  });
  const value = composed.selected;
  return {
    ...value,
    ruleVersion: 'operations-v3-b0.2-pricing-candidate-v1',
    applicabilityInstant: value.applicabilityInstant.toISOString(),
    observedPolicyInterval: {
      effectiveFrom: value.observedPolicyInterval.effectiveFrom.toISOString(),
      effectiveUntil: value.observedPolicyInterval.effectiveUntil?.toISOString() ?? null,
    },
    requestedInterval: {
      checkInAt: value.requestedInterval.checkInAt.toISOString(),
      checkOutAt: value.requestedInterval.checkOutAt.toISOString(),
    },
    lines: value.lines.map((line) => ({
      ...line,
      startAt: line.startAt.toISOString(),
      endAt: line.endAt.toISOString(),
    })),
  };
}

describe('multi-night quote component UUID boundary regression', () => {
  it('RED: production v1 component IDs fail the public quote pricing schema on line[1]', () => {
    const serialized = serializeSelectedCandidate(policy(PRODUCTION_IDS));

    // Line ordering for this stay is [CONTINUATION, FINAL_NIGHT]; line[1] is the
    // FINAL_NIGHT component whose production UUID has variant nibble 0.
    expect(serialized.lines).toHaveLength(2);
    expect(serialized.lines[1]?.componentCode).toBe('B0_FINAL_NIGHT');
    expect(serialized.lines[1]?.componentId).toBe(PRODUCTION_IDS.final);

    const result = multiNightPricingSchema.safeParse(serialized);
    expect(result.success).toBe(false);
    if (!result.success) {
      const componentIdIssue = result.error.issues.find(
        (issue) => issue.path.at(-1) === 'componentId',
      );
      expect(componentIdIssue).toBeDefined();
      expect(componentIdIssue?.message).toBe('Invalid UUID');
      // Exact production failure coordinate: pricing.lines.1.componentId
      expect(componentIdIssue?.path).toEqual(['lines', 1, 'componentId']);
    }
  });

  it('GREEN: canonical RFC 4122 component IDs pass the public quote pricing schema', () => {
    const serialized = serializeSelectedCandidate(policy(VALID_IDS));

    expect(serialized.lines).toHaveLength(2);
    expect(serialized.lines.map((line) => line.componentCode)).toEqual([
      'B0_CONTINUATION',
      'B0_FINAL_NIGHT',
    ]);

    const result = multiNightPricingSchema.safeParse(serialized);
    expect(result.success).toBe(true);
    if (result.success) {
      for (const line of result.data.lines) {
        expect(line.componentId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
      // Two-night STANDARD-equivalent total: 2 × 500,000 = 1,000,000 VND.
      expect(result.data.finalAmountVnd).toBe(1_000_000);
    }
  });
});
