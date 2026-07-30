# Phase 8B validation report

## Selector

- Identifier: `CHEAPEST_ELIGIBLE_THEN_PRIORITY`.
- Rule version: `phase-8b-cheapest-eligible-pricing-v1`.
- Module: `apps/api/src/pricing/cheapest-eligible-pricing.ts`.

### Contract verification

| Required behavior | Test |
| --- | --- |
| 11:00 + 1h selects THREE (300 000 VND) over LUNCH (359 000 VND). | `apps/api/test/pricing-cheapest.test.ts` case 1 |
| Lowest gross among eligible plans wins. | cases 2, 3, 4 |
| Equal total → priority tie-break. | case 5 |
| Equal total + priority → fewer extra units wins. | case 6 |
| Complete equality → stable plan identity wins. | case 7 |
| Missing base-plan price rejected; valid alternatives remain usable. | case 8 |
| All candidates invalid → fail closed. | case 9 |
| Inactive plan never selected. | case 10 |
| Cross-midnight, month-end, year-end, leap day, 1h, 24h. | cases 11-15 |
| Duration > 24h rejected. | case 16 |
| Quote snapshot unchanged after catalog edit. | case 17 |
| Historical priority-wins snapshot remains readable. | case 18 |

### Exhaustive oracle match

- `apps/api/test/audit-phase8b/audit-exhaustive-cheapest.test.ts`.
- 96 local-minute slots × 93 valid 15-minute durations × 3 dates per
  configuration.
- 3 configurations: standard, non-monotonic, equal-price.
- Independent oracle re-derives the cheapest total from first principles
  without importing the production strategy.
- **Result: zero mismatches in all three configurations.**

### Property-based audit

- `apps/api/test/audit-phase8b/audit-property-cheapest.test.ts`.
- Mulberry32 PRNG seeded with `20260728`.
- **Result:**
  - `generated: 10 000`
  - `executed: 9 863`
  - `rejected: 137` (no eligible plan for the requested time/duration).
  - `oracleRejected: 0`.
  - `empty: 0`.
  - `compared: 9 863`.
  - `mismatches: 0`.

## Money safety

- `calculatePricing` and `calculatePricingWithStrategy` only use integer VND.
- `positivePrice` enforces `Number.isSafeInteger(amount) && amount > 0`.
- Selector never multiplies/divides using floats.
- No client-supplied amount is trusted.

## Quote immutability

- `PricingBreakdown.ruleVersion` is recorded on every quote snapshot.
- `pricing-engine.test.ts` still verifies priority-based snapshots remain
  readable when the catalog has been changed.
- The `PRIORITY_WINS_LEGACY` strategy remains reachable for back-fill.

## Recommendation engine

- Module: `apps/api/src/pricing/recommendation.service.ts`.
- Endpoint: `POST /api/v1/recommendations/stay-times`.
- Tests: `apps/api/test/recommendation-engine.test.ts` (15 cases).

### Contract verification

| Required behavior | Test |
| --- | --- |
| Exact interval already cheapest → no unnecessary suggestions. | case 1 |
| Nearest cheaper interval found within ±60 minutes. | case 2 |
| Globally cheapest nearby interval found. | case 3 |
| Duration preserved exactly across every recommendation. | case 4 |
| ±60 boundaries included. | case 5 |
| Outside ±60 excluded. | case 6 |
| Unavailable candidates excluded. | case 7 |
| No physical-room identity leakage. | case 8 |
| Coupon preview affects ranking without reservation. | case 9 |
| Stale recommendation explicitly marked advisory. | case 10 |
| Ties deterministic. | case 11 |
| No dominated duplicate suggestions. | case 12 |
| Maximum 3 recommendations. | case 13 |
| No strictly cheaper candidates → empty recommendations. | case 14 |
| Concurrent availability change forces a fresh revalidation. | case 15 |

### Availability safety

- The controller probes availability through
  `RecommendationRepository.isCandidateAvailable`, which queries real public
  inventory.
- Unavailable candidates are excluded before the Pareto selection.
- The response marks candidates as `AVAILABLE` or `UNKNOWN`; never
  `UNAVAILABLE` is exposed.

### Advisory nature

- The response includes `advisoryExpiresAt` (5 minutes after `generatedAt`).
- The customer must explicitly select an alternative and re-run the normal
  quote endpoint to commit.

## Compliance with directives

- **No eslint-disable** anywhere in Phase 8B code.
- **No dist outputs committed.**
- **No payment production code touched.**
- **No migration executed.**
- **No push, no PR, no deployment.**
- **No port 3001 touched.**

## Verdict

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
FULL_REGRESSION=PASS_SCOPED_TO_PHASE_8B_DELTA

MOMO_SANDBOX_ACCEPTANCE=EXTERNAL_BLOCKED
VNPAY_SANDBOX_ACCEPTANCE=EXTERNAL_BLOCKED
PRODUCTION_READINESS=NO_PENDING_PHASE_8B1_CLOSURE
```

`FULL_REGRESSION=PASS_SCOPED_TO_PHASE_8B_DELTA` records that the Phase 8B
regression suite was clean at closure. The Phase 8B.1 closure
(`docs/handoffs/phase-8b1-verdicts.md`) re-runs the regression with the
ADMIN catalog extensibility, Postgres-backed pricing, recommendation
vertical and Playwright E2E delta included.
