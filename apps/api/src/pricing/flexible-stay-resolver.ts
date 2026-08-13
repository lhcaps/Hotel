import type { MultiNightPricingCandidate } from '../pricing-policy/pricing-policy.composer.js';
import type { PricingBreakdown } from './pricing-engine.js';

/**
 * Server-only comparison for a mode-free Customer interval.  Both the active
 * catalog matcher and the published pricing-policy composer are candidate
 * producers; neither gets priority merely because of its representation.
 */
export type FlexibleStayPricing =
  | { readonly family: 'CATALOG'; readonly pricing: PricingBreakdown }
  | { readonly family: 'POLICY'; readonly pricing: MultiNightPricingCandidate };

interface RankedCandidate {
  readonly value: FlexibleStayPricing;
  readonly totalAmountVnd: number;
  readonly componentCount: number;
  readonly conditionComplexity: number;
  readonly restrictionRank: number;
  readonly stableId: string;
}

export function resolveFlexibleStay(
  input: Readonly<{
    checkIn: string;
    checkOut: string;
    catalog?: PricingBreakdown;
    policy?: readonly MultiNightPricingCandidate[];
  }>,
): FlexibleStayPricing | undefined {
  const catalog = input.catalog;
  const candidates: RankedCandidate[] = [
    ...(catalog === undefined ? [] : [catalogCandidate(input, catalog)]),
    ...(input.policy ?? [])
      .filter((candidate) => hasExactPolicyCoverage(input, candidate))
      .map((candidate) => policyCandidate(candidate)),
  ];
  return candidates.sort(compareCandidates)[0]?.value;
}

function catalogCandidate(
  input: Readonly<{ checkIn: string; checkOut: string }>,
  pricing: PricingBreakdown,
): RankedCandidate {
  const checkIn = new Date(input.checkIn).getTime();
  const checkOut = new Date(input.checkOut).getTime();
  if (
    !Number.isFinite(checkIn) ||
    !Number.isFinite(checkOut) ||
    checkOut <= checkIn ||
    !Number.isSafeInteger(pricing.totalAmountVnd) ||
    pricing.totalAmountVnd < 0
  ) {
    throw new RangeError('Catalog pricing did not produce a valid exact interval candidate.');
  }
  return {
    value: { family: 'CATALOG', pricing },
    totalAmountVnd: pricing.totalAmountVnd,
    componentCount: pricing.lineItems.length,
    conditionComplexity: 0,
    restrictionRank: 0,
    stableId: `catalog:${pricing.selectedPlanCode}:${pricing.baseMinutes}:${pricing.extraUnits}`,
  };
}

function policyCandidate(pricing: MultiNightPricingCandidate): RankedCandidate {
  return {
    value: { family: 'POLICY', pricing },
    totalAmountVnd: pricing.finalAmountVnd,
    componentCount: pricing.componentCount,
    conditionComplexity: pricing.conditionComplexity,
    restrictionRank: pricing.restrictionRank,
    stableId: `policy:${pricing.stableCandidateId}`,
  };
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  return (
    left.totalAmountVnd - right.totalAmountVnd ||
    left.componentCount - right.componentCount ||
    left.conditionComplexity - right.conditionComplexity ||
    left.restrictionRank - right.restrictionRank ||
    left.stableId.localeCompare(right.stableId)
  );
}

function hasExactPolicyCoverage(
  input: Readonly<{ checkIn: string; checkOut: string }>,
  candidate: MultiNightPricingCandidate,
): boolean {
  const expectedStart = new Date(input.checkIn).getTime();
  const expectedEnd = new Date(input.checkOut).getTime();
  if (
    !Number.isFinite(expectedStart) ||
    !Number.isFinite(expectedEnd) ||
    expectedEnd <= expectedStart
  ) {
    return false;
  }
  if (
    candidate.requestedInterval.checkInAt.getTime() !== expectedStart ||
    candidate.requestedInterval.checkOutAt.getTime() !== expectedEnd ||
    candidate.lines.length === 0
  ) {
    return false;
  }
  return candidate.lines.every((line, index) => {
    const previous = candidate.lines[index - 1];
    return (
      line.endAt.getTime() > line.startAt.getTime() &&
      (index === 0
        ? line.startAt.getTime() === expectedStart
        : previous?.endAt.getTime() === line.startAt.getTime()) &&
      (index === candidate.lines.length - 1 ? line.endAt.getTime() === expectedEnd : true)
    );
  });
}
