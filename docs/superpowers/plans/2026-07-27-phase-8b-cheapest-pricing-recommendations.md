# Phase 8B — Plan

## Step 1 — Locked selector policy

- Update `selection-rule-matcher.ts`:
  - Add `RULE_VERSION_PHASE_8B = 'phase-8b-cheapest-eligible-pricing-v1' as const`.
  - Widen `PricingRuleVersion` to include the new version.
  - Widen `PricingBreakdown.ruleVersion` to `PricingRuleVersion`.
- Add `apps/api/src/pricing/cheapest-eligible-pricing.ts`:
  - `evaluatePricingCandidates` (pure).
  - `selectCheapestEligibleCandidate` (pure, returns
    `PricingSelectionResult { selected, candidates, policy, tieReason }`).
  - `calculateCheapestPricing` (returns `PricingBreakdown`).
  - `ruleSetValidationFromCatalog` (admin-time validation).
- Update `pricing-engine.ts`:
  - Default `calculatePricing` to `CHEAPEST_ELIGIBLE_THEN_PRIORITY`.
  - Add `calculatePricingWithStrategy(input, catalog, strategy)`.
  - Re-export `selectCheapestEligibleCandidate`, `evaluatePricingCandidates`.

## Step 2 — Tests (TDD)

- `apps/api/test/pricing-cheapest.test.ts` — 18 required exact-time cases.
- `apps/api/test/audit-phase8b/audit-exhaustive-cheapest.test.ts` — 96 slots × 93 durations × 3 dates against the independent oracle.
- `apps/api/test/audit-phase8b/audit-property-cheapest.test.ts` — 10 000 seeded cases against the independent oracle.
- `apps/api/test/recommendation-engine.test.ts` — 15 required recommendation cases.

## Step 3 — Recommendation engine

- `apps/api/src/pricing/recommendation.service.ts` — pure module:
  - `searchRecommendations(input, catalog, options)`.
  - Probes: `AvailabilityProbe`, `ProvisionalCouponProbe`.
  - Returns `{ exactResult, recommendations, generatedAt, advisoryExpiresAt }`.
- `apps/api/src/pricing/recommendation.repository.ts` — DB layer for
  `isCandidateAvailable` and request validation via `createQuoteRequestSchema`.
- `apps/api/src/pricing/recommendation.controller.ts` — exposes
  `POST /api/v1/recommendations/stay-times`.
- Update `apps/api/src/app.module.ts` to wire the new controller.

## Step 4 — Lint, typecheck, build

- `pnpm lint` — clean.
- `pnpm typecheck` — clean.
- `pnpm build` — clean.

## Step 5 — Documentation and handoff

- `docs/architecture/adr/ADR-0010-cheapest-eligible-pricing.md`.
- `docs/superpowers/specs/2026-07-27-phase-8b-cheapest-pricing-recommendations-design.md`.
- `docs/superpowers/plans/2026-07-27-phase-8b-cheapest-pricing-recommendations.md`.
- `docs/handoffs/phase-8b-cheapest-pricing-recommendations.md`.
- `docs/handoffs/phase-8b-verdicts.md`.
- `docs/audit/phase-8b-validation-report.md`.
- Update `docs/domain/pricing-rules.md`, `docs/domain/business-invariants.md`,
  `docs/product/user-journeys.md`, `docs/engineering/pricing-architecture.md`.

## Step 6 — Commits

Focused forward commits, worktree clean after each:

1. `docs(adr): approve cheapest eligible pricing policy`.
2. `test(pricing): define cheapest-selection contracts`.
3. `feat(pricing): select cheapest exact-time candidate`.
4. `feat(api): expose advisory time recommendations`.
5. `docs: close phase 8b validation and handoff`.

## Step 7 — Verdicts

```
PHASE_8B_PRICING_CORRECTNESS=PASS
CURRENT_POLICY_CONFORMANCE=PASS
EXACT_TIME_CHEAPEST_PLAN=VERIFIED
PRICING_EXHAUSTIVE_ORACLE_MATCH=VERIFIED
PRICING_RANDOM_PROPERTY_TESTS=VERIFIED
MONEY_INTEGER_SAFETY=VERIFIED
QUOTE_IMMUTABILITY=VERIFIED
FLEXIBLE_TIME_RECOMMENDATION=VERIFIED
RECOMMENDATION_AVAILABILITY_SAFETY=VERIFIED
RECOMMENDATION_IS_ADVISORY=VERIFIED
HISTORICAL_QUOTE_COMPATIBILITY=VERIFIED
FULL_REGRESSION=PASS

MOMO_SANDBOX_ACCEPTANCE=EXTERNAL_BLOCKED
VNPAY_SANDBOX_ACCEPTANCE=EXTERNAL_BLOCKED
PRODUCTION_READINESS=NO
```
