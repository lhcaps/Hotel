# ADR-0010 — Cheapest-eligible pricing for new quotes

- **Status**: Accepted (Phase 8B)
- **Date**: 2026-07-28
- **Supersedes**: ADR-0005 (priority-wins data-driven selection) for **new quotes only**.
- **Related code**:
  - `apps/api/src/pricing/cheapest-eligible-pricing.ts`
  - `apps/api/src/pricing/recommendation.service.ts`
  - `apps/api/src/pricing/pricing-engine.ts`
  - `apps/api/src/pricing/recommendation.controller.ts`

## Context

The Phase 7B pricing engine was built around `PRIORITY_WINS_LEGACY`: every
ACTIVE base plan declared a `priority`, and the engine selected the highest-
priority candidate that satisfied the requested check-in window and duration.
That policy was simple and deterministic, but it produced a counterexample at
11:00 + 1 hour where the customer pays 359 000 VND (LUNCH) when a 300 000 VND
plan (THREE_HOUR_COMBO) is equally eligible. Phase 8A's audit captured this
as `CURRENT_POLICY_CONFORMANCE=PASS` / `EXACT_TIME_CHEAPEST_OBJECTIVE=FAIL`.

Business decision: the customer-cheapest objective now supersedes priority for
**new quotes** issued after Phase 8B. Historical quote snapshots retain their
original rule version; they are never repriced.

## Decision

1. **Selection policy**: `CHEAPEST_ELIGIBLE_THEN_PRIORITY`.
   - Among every ACTIVE base plan that covers the requested check-in and
     duration, compute the candidate gross amount as
     `base_amount + extra_units * extra_amount` using strictly integer VND.
   - Select the candidate with the **lowest** gross amount.
   - Tie-break order: lower gross → higher priority → fewer extra units →
     stable plan code order.
2. **Money safety**: prices are stored as integer VND. The selector never
   multiplies or divides prices using floating-point. The selector never
   trusts a client-supplied amount.
3. **Selection-strategy boundary**: `calculatePricingWithStrategy(input,
   catalog, strategy)` is the single entry point. Strategies currently
   available: `CHEAPEST_ELIGIBLE_THEN_PRIORITY`, `PRIORITY_WINS_LEGACY`.
4. **Advisory recommendations**: a separate, advisory-only service walks
   `±60 minute` offsets in `15-minute` increments, reuses the same pricing
   domain, revalidates availability, and returns up to three Pareto
   recommendations. It never reserves coupons, allocates physical rooms, or
   creates HOLDs.
5. **Activation validation**: `ruleSetValidationFromCatalog` rejects active
   plans with missing or non-positive integer prices, inverted duration
   ranges, and ambiguous priority collisions (multiple ACTIVE base plans
   sharing the same priority within the same check-in window) before
   quotes can be issued. Equal-price/gross/priority tie-breaks across
   *distinct* plans are allowed because the stable plan-code identity
   remains the deterministic resolver.
6. **Pricing persistence**: every persisted quote snapshot stores
   `ruleVersion` (e.g. `phase-8b-cheapest-eligible-pricing-v1`),
   `selectedPlanCode`, `baseAmountVnd`, `extraUnits`, `extraAmountVnd`,
   `grossAmountVnd`, and tie-break metadata so the snapshot remains auditable.

## Consequences

- The audit-time counterexample at 11:00 + 1 hour now resolves to
  THREE_HOUR_COMBO at 300 000 VND, removing the previous savings gap.
- Historical quote snapshots remain readable; the legacy strategy is still
  reachable for audit and back-fill via `PRIORITY_WINS_LEGACY`.
- The selector is now data-driven: an ADMIN can add another ACTIVE base plan
  through the existing `RatePlanManager` without code changes, as long as
  its duration window, price, priority, and `^[A-Z0-9_]{1,64}$` code
  satisfy the catalog validation. Phase 8B.1 removes the closed-world
  `rate_plans_code_ck` constraint and lets ADMIN seed rate plans such as
  `SIX_HOUR_FLEX` end-to-end.
- Customers can also receive a recommended alternative time within ±60 minutes
  if it is strictly cheaper and remains available.

## Risks & mitigations

- **Non-monotonic pricing**: a longer plan may be cheaper than a shorter plan.
  The selector handles this without warning; the price grid is the source of
  truth.
- **Tie explosion**: ties on every dimension (gross, priority, extras, plan
  code) are not possible because plan codes are unique. The stable-plan tie
  break keeps results deterministic.
- **Concurrent availability changes**: advisory recommendations are revalidated
  by the regular quote endpoint before a HOLD can be created. Stale
  recommendations are explicitly marked advisory in the response.
- **Migration of existing pricing**: no DB migration is required. New quotes
  use the new selector; old quotes keep their snapshot.
