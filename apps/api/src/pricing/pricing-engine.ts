import {
  InvalidPricingIntervalError as MatcherInvalidPricingIntervalError,
  PricingRuleAmbiguousError,
  PricingRuleInvalidError,
  PricingRuleNotFoundError,
  PricingConfigurationError,
  PricingPriceMissingError,
  PricingExtraPriceMissingError,
  validateActiveRuleSet,
  calculatePricing as calculatePricingDelegate,
  RULE_VERSION_PHASE_7B,
  RULE_VERSION_PHASE_4,
  type PricingInput,
  type PricingCatalog,
  type PricingBreakdown,
  type RatePlanCode,
  type BasePlanCode,
  type PricingRuleVersion,
} from './selection-rule-matcher.js';
import {
  RULE_VERSION_PHASE_8B,
  calculateCheapestPricing,
  selectCheapestEligibleCandidate,
  evaluatePricingCandidates,
  ruleSetValidationFromCatalog,
  type PricingCandidate,
  type PricingSelectionResult,
  type CheapestRuleVersion,
} from './cheapest-eligible-pricing.js';

export type {
  PricingInput,
  PricingCatalog,
  PricingBreakdown,
  RatePlanCode,
  BasePlanCode,
  PricingRuleVersion,
  PricingCandidate,
  PricingSelectionResult,
  CheapestRuleVersion,
};

export const RULE_VERSION = RULE_VERSION_PHASE_8B;

export { RULE_VERSION_PHASE_7B, RULE_VERSION_PHASE_4, RULE_VERSION_PHASE_8B };

export const InvalidPricingIntervalError = MatcherInvalidPricingIntervalError;
export {
  PricingConfigurationError,
  PricingRuleAmbiguousError,
  PricingRuleInvalidError,
  PricingRuleNotFoundError,
};
export { PricingPriceMissingError, PricingExtraPriceMissingError };
export { validateActiveRuleSet, ruleSetValidationFromCatalog };

/**
 * Public API: compute the Phase 8B pricing breakdown for a quote.
 *
 * `calculatePricing` selects the cheapest eligible base plan using the
 * CHEAPEST_ELIGIBLE_THEN_PRIORITY policy. Priority, extra-unit count, and
 * stable plan identity are deterministic tie-breakers only.
 *
 * Historical priority-first snapshots remain readable because each persisted
 * snapshot retains its own `ruleVersion` field. The selection strategy is
 * pluggable through `calculatePricingWithStrategy` so a future approved
 * strategy can be added without rewriting quote persistence.
 */
export function calculatePricing(input: PricingInput, catalog: PricingCatalog): PricingBreakdown {
  return calculateCheapestPricing(input, catalog);
}

export function calculatePricingWithStrategy(
  input: PricingInput,
  catalog: PricingCatalog,
  strategy: 'CHEAPEST_ELIGIBLE_THEN_PRIORITY' | 'PRIORITY_WINS_LEGACY',
): PricingBreakdown {
  if (strategy === 'PRIORITY_WINS_LEGACY') {
    return calculatePricingDelegate(input, catalog);
  }
  return calculateCheapestPricing(input, catalog);
}

export { selectCheapestEligibleCandidate, evaluatePricingCandidates };
