# Phase 8B handoff — cheapest-eligible pricing + advisory recommendations

## What changed

- `apps/api/src/pricing/cheapest-eligible-pricing.ts` (new)
  - Pure module that evaluates every eligible ACTIVE base plan and selects
    the cheapest according to
    `CHEAPEST_ELIGIBLE_THEN_PRIORITY`.
  - Exports `evaluatePricingCandidates`, `selectCheapestEligibleCandidate`,
    `calculateCheapestPricing`, `ruleSetValidationFromCatalog`,
    `RULE_VERSION_PHASE_8B`.
- `apps/api/src/pricing/pricing-engine.ts`
  - Default selector is now `CHEAPEST_ELIGIBLE_THEN_PRIORITY`.
  - `calculatePricingWithStrategy(input, catalog, strategy)` is the explicit
    boundary for future strategies.
- `apps/api/src/pricing/selection-rule-matcher.ts`
  - Added `RULE_VERSION_PHASE_8B`.
  - Widened `PricingRuleVersion` and `PricingBreakdown.ruleVersion`.
- `apps/api/src/pricing/recommendation.service.ts` (new)
  - Pure advisory engine that walks ±60 minute offsets in 15-minute steps,
    reuses the cheapest pricing domain, and returns up to three Pareto
    recommendations.
- `apps/api/src/pricing/recommendation.repository.ts` (new)
  - DB layer for `isCandidateAvailable` and request validation via
    `createQuoteRequestSchema`.
- `apps/api/src/pricing/recommendation.controller.ts` (new)
  - Exposes `POST /api/v1/recommendations/stay-times`.
- `apps/api/src/app.module.ts`
  - Wires the new controller.

## Tests

- `apps/api/test/pricing-cheapest.test.ts` — 18 required exact-time cases.
- `apps/api/test/recommendation-engine.test.ts` — 15 required recommendation cases.
- `apps/api/test/audit-phase8b/audit-exhaustive-cheapest.test.ts` — exhaustive
  comparison against the independent oracle; zero mismatches.
- `apps/api/test/audit-phase8b/audit-property-cheapest.test.ts` — seeded
  property-based audit, 10 000 cases, zero mismatches.
- `apps/api/test/audit-phase8a/*` — preserved; uses
  `PRIORITY_WINS_LEGACY` to keep the audit-intent verbatim.

## Backwards compatibility

- Historical quote snapshots remain readable.
- `PRIORITY_WINS_LEGACY` strategy still reachable for back-fill and audit.
- `RULE_VERSION_PHASE_7B` still exported.

## Risks

- Money math is strictly integer VND; never floats.
- Recommendations are advisory only; the customer must re-run a regular
  quote endpoint to commit.
- No schema change, no migration, no dist-output commit.

## Next steps

- Phase 8B+1 (out of scope here): web UI for cheapest-quote display,
  recommendation cards, and e2e Playwright coverage.
- Phase 8C is **not** started.
