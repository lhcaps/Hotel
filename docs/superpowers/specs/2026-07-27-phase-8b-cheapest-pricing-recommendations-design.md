# Phase 8B — Cheapest Exact-Time Pricing and Advisory Time Recommendations

## Goals

1. Replace the priority-wins selection for **new quotes** with
   cheapest-eligible-then-priority.
2. Expose advisory flexible-time recommendations that suggest cheaper
   check-in windows within ±60 minutes.

## Non-goals

- Migration of historical quote snapshots.
- Payment hardening, deployment, observability.
- Web/e2e UI changes in this phase (covered by follow-up).

## Locked product policy

### Exact-time selection (A)

- For the requested check-in and check-out, evaluate **every** ACTIVE base
  plan whose duration window and check-in window admit the request.
- Compute `base_amount = catalog[plan].prices[tier]` and
  `extra_units = max(0, ceil((duration - included_minutes) / 60))`.
- Compute `gross_amount = base_amount + extra_units * extra_unit_price`.
- Select the candidate with the **lowest** gross amount.
- Tie-break: lower gross → higher priority → fewer extra units → stable plan
  code ordering.

Identifier: `CHEAPEST_ELIGIBLE_THEN_PRIORITY`.

### Flexible-time recommendation (B)

Advisory only:

- Search `±60 minute` offsets in `15-minute` increments.
- Preserve stay duration exactly.
- Recheck real public availability per candidate.
- Exclude unavailable candidates.
- Compute price through the same authoritative pricing domain.
- Only return candidates **strictly cheaper** than the exact-time result.
- Use non-reserving coupon preview to rank final payable amount.
- Return up to three distinct Pareto recommendations:
  - `CLOSEST_CHEAPER`: minimum absolute shift among strictly cheaper candidates.
  - `CHEAPEST_NEARBY`: minimum final payable amount in the search range.
  - `PARETO_ALTERNATIVE`: another non-dominated candidate.
- Deduplicate when two categories select the same interval.
- Stable ordering: final payable amount ascending → absolute shift ascending →
  earlier check-in timestamp → stable plan code.
- The customer must explicitly select an alternative; selecting then enters
  the normal quote endpoint, which revalidates pricing, availability and
  coupons.

## Architecture

```
+-------------------------------+
|  pricing-engine.ts            |
|  calculatePricingWithStrategy |
+-------------------------------+
            |
            v
+-------------------------------+
|  cheapest-eligible-pricing.ts |
|  - evaluatePricingCandidates  |
|  - selectCheapestEligible      |
|  - ruleSetValidationFromCatalog
+-------------------------------+
            |
            v
+----------------------------------+
|  recommendation.service.ts       |
|  - searchRecommendations         |
|  - Probes: availability + coupon |
+----------------------------------+
            |
            v
+----------------------------------+
|  recommendation.controller.ts    |
|  POST /api/v1/recommendations/   |
|       stay-times                 |
+----------------------------------+
```

### Boundaries

- **Eligibility**: `matchesWindow(entry, localCheckIn, durationMinutes)`.
- **Candidate costing**: `PricingCandidate { ratePlanCode, priority, includedDurationMinutes, extraUnits, baseAmountVnd, extraAmountVnd, grossAmountVnd }`.
- **Selection strategy**: `compareCandidates(a, b) -> { winner, reason }`.
- **Recommendation search**: pure module, no I/O, takes probes.
- **Quote persistence**: unchanged. Persisted snapshots include the new
  `ruleVersion` and tie-break metadata.
- **Historical compatibility**: `calculatePricingWithStrategy(...,
'PRIORITY_WINS_LEGACY')` still works for audit and back-fill scenarios.

## Public API

`POST /api/v1/recommendations/stay-times` accepts the same public booking
inputs as `POST /api/v1/quotes` plus an optional `couponCode`. Response shape:

```
{
  "exactResult": { "pricing": ..., "finalAmountVnd": ..., "discountAmountVnd": ... },
  "recommendations": [
    {
      "checkIn": ...,
      "checkOut": ...,
      "shiftMinutes": ...,
      "selectedPlanCode": ...,
      "grossAmountVnd": ...,
      "discountAmountVnd": ...,
      "finalAmountVnd": ...,
      "savingsVnd": ...,
      "availabilityStatus": "AVAILABLE" | "UNKNOWN",
      "category": "CLOSEST_CHEAPER" | "CHEAPEST_NEARBY" | "PARETO_ALTERNATIVE"
    }
  ],
  "generatedAt": ...,
  "advisoryExpiresAt": ...
}
```

The response explicitly excludes physical room identity, internal inventory
block, provider secrets, mutable authoritative amounts, and reservation
guarantees.

## Admin and extensibility

- The selector does **not** hard-code plan names.
- Adding a new ACTIVE base plan via ADMIN works as long as it satisfies
  `ruleSetValidationFromCatalog`.
- Tie-break resolution uses plan code as the final identity tie-break, so
  equal-price / equal-priority cases resolve deterministically.
- No new "flexible pricing engine" or generic rule engine is introduced.

## TDD coverage

### Exact-time cases (`apps/api/test/pricing-cheapest.test.ts`)

The 18 required cases are covered:

1. 11:00 + 1h, THREE over LUNCH.
2. 11:00 + 4h, every eligible plan compared.
3. 11:00 + 4h15, LUNCH + extras vs FIVE.
4. Non-monotonic prices, longest plan cheapest.
5. Equal total, priority wins.
6. Equal total + priority, fewer extra units wins.
7. Complete equality, stable plan code wins.
8. Missing base-plan price rejects that candidate.
9. All candidates invalid → fail closed.
10. Inactive plan never selected.
11. Cross-midnight check-in.
12. Month/year boundary.
13. Leap day.
14. Exactly 1 hour.
15. Exactly 24 hours.
16. Above 24 hours rejected.
17. Quote snapshot unchanged after catalog edit (audit trail).
18. Historical priority-wins snapshot remains readable.

### Exhaustive verification (`apps/api/test/audit-phase8b/audit-exhaustive-cheapest.test.ts`)

- 96 local-minute slots × 93 valid 15-minute durations × 3 dates
  (22, 31, 31).
- Independent oracle re-derives the cheapest total from first principles.
- Compared against `CHEAPEST_ELIGIBLE_THEN_PRIORITY`.
- Zero mismatches across standard, non-monotonic, and equal-price
  configurations.

### Property-based verification (`apps/api/test/audit-phase8b/audit-property-cheapest.test.ts`)

- Mulberry32 seeded with `20260728`.
- 10 000 generated cases.
- Compared production against independent oracle.
- Zero mismatches.
- Generated/executed/rejected/compared counts recorded separately.

### Recommendation cases (`apps/api/test/recommendation-engine.test.ts`)

The 15 required cases are covered:

1. Exact interval cheapest → no recommendations.
2. Nearest cheaper interval found.
3. Globally cheapest nearby interval found.
4. Duration preserved exactly.
5. ±60 boundaries searched.
6. Outside ±60 excluded.
7. Unavailable interval excluded.
8. No physical-room identity leakage.
9. Coupon preview affects ranking without reservation.
10. Advisory expires after 5 minutes (`advisoryExpiresAt`).
11. Ties deterministic.
12. No dominated duplicates.
13. Maximum 3 recommendations.
14. No strictly cheaper candidates → empty list.
15. Concurrent availability change → fresh recommendation reflects the change;
    the customer must revalidate by re-running the regular quote endpoint.

## Regression coverage

- `pnpm lint` — clean across all workspaces.
- `pnpm typecheck` — clean across all workspaces.
- `pnpm build` — clean across all workspaces.
- `pnpm exec vitest run` — all pricing, recommendation, audit-phase8a and
  audit-phase8b unit tests pass (107 tests).

## Out of scope (Phase 8B)

- Web UI for recommendations (next phase).
- End-to-end browser coverage.
- Demo lifecycle smoke.
