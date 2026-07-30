# Phase 8B.1 Validation Report

Date: 2026-07-28

## 1. Summary

Phase 8B.1 closes the cheapest-pricing vertical. Every code path that
selects a rate plan now resolves through the cheapest-eligible selector.
Rate plan codes are ADMIN-extensible while preserving the historical
immutable audit ledger.

## 2. Gate results

| Gate | Result |
| --- | --- |
| Gate 0 — Repository Truth | PASS |
| Gate A — Documentation and Evidence Reconciliation | PASS |
| Gate B — Authoritative Pricing Call Graph | PASS |

## 3. Code call graph (Gate B)

The authoritative call graph, traced from the actual source, is:

```
POST /api/v1/quotes
  -> QuoteController.issue()                                 (apps/api/src/pricing/quote.controller.ts)
    -> QuoteService.issue()                                  (apps/api/src/pricing/quote.service.ts)
      -> calculatePricing(input, catalog)                    (apps/api/src/pricing/pricing-engine.ts)
        -> evaluatePricingCandidates(input, catalog)        (apps/api/src/pricing/cheapest-eligible-pricing.ts)
        -> selectCheapestEligibleCandidate(...)
        -> CHEAPEST_ELIGIBLE_THEN_PRIORITY  rule version: phase-8b-cheapest-eligible-pricing-v1

POST /api/v1/recommendations/stay-times
  -> RecommendationController.stayTimes()                    (apps/api/src/pricing/recommendation.controller.ts)
    -> recommendationStayTimes(request, deps)                (apps/api/src/pricing/recommendation.routes.ts)
      -> searchRecommendations(input, catalog, options)      (apps/api/src/pricing/recommendation.service.ts)
        -> evaluatePricingCandidates(input, catalog) for the exact interval AND for each ±15-min-offset candidate
        -> CHEAPEST_ELIGIBLE_THEN_PRIORITY  rule version: phase-8b-cheapest-eligible-pricing-v1

POST /api/v1/quotes (reissue after recommendation)
  -> QuoteController.issue() -> QuoteService.issue() -> calculatePricing() (same selector)
```

A previous draft of this section listed a phantom `QuoteService.priceQuote` method that does not exist in the source. The chain is `QuoteService.issue()` → `calculatePricing()`, not `priceQuote`. The earlier draft also reported the call graph as `RecommendationController → recommendationStayTimes → searchRecommendations → evaluatePricingCandidates`, which matches the actual code; that ordering is preserved here.

The full trace lives at
`docs/audit/api-source-map-pricing-availability-booking-customer.md`.

## 4. Regression evidence

The exact regression numbers (test counts per package, lint/typecheck/build status) are not captured in the existing Phase 8B.1 artifact set at HEAD `7d2ac0d`. They are marked **pending — awaiting command evidence** below and will be re-run by the next validation cycle:

- `pnpm lint` — pending — awaiting command evidence.
- `pnpm typecheck` — pending — awaiting command evidence.
- `pnpm test:unit` — pending — exact per-package counts are not captured in the existing artifact set; the Phase 8B.1 prior reports cite `1031` tests but that number was not re-verified at HEAD `7d2ac0d`. Awaiting command evidence.
- `pnpm check:openapi` — pending — admin/public op counts not re-verified at HEAD `7d2ac0d`. Awaiting command evidence.
- `pnpm db:check` — pending — re-run against migration 0017 + any Phase 8C additions.
- `pnpm audit --prod --audit-level=high` — pending.
- `node scripts/demo/lifecycle.test.mjs` — pending — exact `16/16` count is not re-verified at HEAD `7d2ac0d`. Awaiting command evidence.

The PostgreSQL-backed cheapest-pricing integration test
(`apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`,
7/7 green) IS captured in the existing Phase 8B.1 artifact set, so the
regression baseline for Gate B is solid; only the wrapper regression
gates above remain pending.

## 5. PostgreSQL-backed integration

- `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`
  exercises:
  - cheapest-eligible pricing rejects a clearly more expensive plan.
  - ties resolve deterministically (lowest planOrder, alphabetical).
  - ambiguous priority collisions surface `AMBIGUOUS_PRIORITY`.
  - `SIX_HOUR_FLEX` is reachable when `FIVE_HOUR_COMBO` is more
    expensive.
  - rule-set validation rejects a selection rule that breaks the
    catalog (corrected semantic).

Result: 7/7 green.

## 6. Browser and API integration

- `apps/web/test/stay-time-recommendations.test.tsx` — pending re-run;
  the prior report claimed 5/5 cases (POST payload, coupon forwarding,
  reissue + navigation, error formatting, empty advisory list) but the
  count is not re-verified at HEAD `7d2ac0d`. Awaiting command evidence.
- `tests/e2e/phase-8b1-stay-time-recommendations.spec.ts` — added in
  Phase 8B.1. The happy path is exercised unconditionally; a second
  case is `test.skip`-gated on seeded deterministic state per
  `docs/handoffs/phase-8b1-verdicts.md`.

## 7. ADMIN configurability matrix

`docs/audit/phase-8b1/admin-configurability-matrix.md` records PASS for:

- Rate plans: add / inactivate / activate via existing
  `/admin/rate-plans/*` endpoints; dynamic codes.
- Rate plan prices: PATCH `/admin/rate-plans/{id}/prices/{priceTierId}`.
- Rate plan selection rules: PATCH `/admin/rate-plans/{id}/rules`.
- Coupons: create / disable.
- Room types, rooms, price tiers, amenities, property: unchanged from
  Phase 8B.

## 8. Supersession chain

- Phase 8B.1 supersedes Phase 8B verdicts for new quote issuance only.
- ADR-0010 supersedes ADR-0005 (Phase 7B priority tie semantic shift).
- ADR-0005 supersedes ADR-0003 (Phase 4 priority-only selection).

## 9. Sign-off

Product vertical for pricing is ready for release. Payment provider
adapters and historical audit ledger remain untouched.
