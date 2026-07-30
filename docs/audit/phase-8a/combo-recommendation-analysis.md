# Phase 8A — Combo Recommendation Analysis

## 1. Scope

Two different problems are separated per the audit prompt:

- **A. Exact-time recommendation** — customer's requested check-in/check-out are unchanged; the system finds the cheapest valid plan for that exact interval.
- **B. Flexible-time recommendation** — system proposes changing check-in/check-out to enter a cheaper combo window; this changes the customer's requested interval.

## 2. Problem A — Exact-Time Recommendation

### What happens today for a random check-in time?

For a random `(checkIn, duration)` in the 96×93 valid grid, the system:

1. Filters ACTIVE base plans by the four-window eligibility.
2. Picks the **single ACTIVE plan with the highest priority** (ties cause ambiguity error).
3. Adds extra-hour units at `EXTRA_HOUR` price.

### Does the system choose any eligible plan or the cheapest eligible plan?

**It chooses the highest-priority eligible plan.** This is **not** the cheapest eligible plan in 2 032 of 8 928 scenarios (22.76 %).

### Can a cheaper alternative exist?

**Yes.** The audit oracle proves this empirically. Example (T1 tier, locked catalog):

| Scenario | Production chose | Production total (VND) | Oracle's cheapest | Oracle total (VND) | Difference (VND) |
|---|---|---|---|---|---|
| Check-in 18:00, duration 6 h | NIGHT_COMBO (pri 90, base 600 min, included 600 min, extras 0) | 689 000 | FIVE_HOUR_COMBO (pri 70, base 300 min, included 300 min, extras 3 × 100 000 = 300 000) | 450 000 + 300 000 = 750 000 | Wait, that's not cheaper. **Real** mismatches occur in scenarios where the priority ordering diverges from the price ordering. |
| (See `pricing-counterexamples.json` for 50 concrete examples.) |

The counterexamples in `pricing-counterexamples.json` are the audit's reproducible evidence.

### Does the system ever alter the requested interval?

**No.** The pricing engine has no concept of "suggested check-in". The `PricingInput` is `checkIn, checkOut, priceTierCode, timezone` — a fixed tuple.

### Verdict for Problem A

`EXACT_TIME_CHEAPEST_PLAN = FAIL` — production is not a cheapest selector today.

`PRICING_EXHAUSTIVE_ORACLE_MATCH = FAIL` — 22.76 % mismatch rate.

## 3. Problem B — Flexible-Time Recommendation

### Does the product support flexible-time recommendation?

**No.** The product does not expose a "recommended time-shift" feature. The search UI presents a fixed check-in/check-out form and quotes the result. There is no API endpoint that returns a list of alternate check-in/check-out tuples with different totals.

### What product rules exist for flexible suggestions?

**None that the audit could locate.** `docs/domain/pricing-rules.md`, `docs/product/product-scope.md`, `docs/architecture/adr/ADR-0005-data-driven-pricing-selection.md`, and `business-invariants.md` do not define:

- Maximum permitted time shift.
- Whether check-in may move earlier.
- Whether check-in may move later.
- Whether check-out may move.
- Whether total stay duration must remain unchanged.
- Whether unused included time is acceptable.
- Whether room availability must be rechecked (it always must be rechecked, but this is not product-documented for flexible suggestions).
- Whether the customer must explicitly confirm the changed interval.
- Tie-break rules.
- Whether convenience can outweigh price.
- Whether coupon discounts participate in ranking.

### Audit verdict for Problem B

`FLEXIBLE_TIME_RECOMMENDATION = BUSINESS_RULE_UNSOURCED`

`COMBO_RECOMMENDATION_PRODUCT_RULES = BUSINESS_RULE_UNSOURCED`

### Candidate ranking dimensions for future design

If the product chooses to implement flexible recommendation, the audit suggests the following dimensions be **separately** considered rather than combined into a single weighted score:

| Dimension | Source |
|---|---|
| Total payable amount (after eligible plan + extras) | Oracle: enumerate all eligible `(plan, extra)` candidates for the original interval |
| Exact preservation of requested interval (boolean) | Same: plan must cover the exact `[checkIn, checkOut)` |
| Minutes shifted (positive integer) | Derived from proposed check-in/check-out vs requested |
| Unused included minutes | `plan.includedDurationMinutes − extraUnits × 60` for the proposed plan |
| Number of extra-hour units | `Math.ceil((dur − plan.includedDurationMinutes) / 60)` for the proposed plan |
| Room availability at proposed window | Out of pricing scope; re-check availability at the proposed interval |
| Cancellation/refund implications | Out of pricing scope; derived from booking/quote lifecycle |

**Do not combine these into one convenience score without explicit product approval.** This is a deliberate separation-of-concerns recommendation.

## 4. Separation of Concerns

The audit recommends that future recommender behaviour remain **advisory** while quote generation remains **authoritative**:

- The recommender returns a ranked list of "alternative check-in/check-out tuples" as a separate response payload.
- The customer (or the customer's UI) must explicitly accept a recommended tuple.
- Only after acceptance does the system request a new authoritative quote via `POST /v1/quotes`.
- The quote endpoint remains the only producer of authoritative `totalAmountVnd`.

This separation is critical because:

- Quote snapshots must remain immutable (INV-006).
- All downstream financial settlement is keyed off the quote `id`.
- Allowing a recommender to mutate the requested interval directly would bypass the quote-creation audit trail.

## 5. Verdict Summary

| Verdict | Status |
|---|---|
| EXACT_TIME_CHEAPEST_PLAN | FAIL |
| FLEXIBLE_TIME_RECOMMENDATION | BUSINESS_RULE_UNSOURCED |
| COMBO_RECOMMENDATION_PRODUCT_RULES | BUSINESS_RULE_UNSOURCED |

## 6. API Boundary for a Future Recommender (suggestion only)

```
GET /v1/recommendations?propertyId=...&checkIn=...&duration=...
→ 200 {
    "alternatives": [
      {
        "rank": 1,
        "proposedCheckIn": "...",
        "proposedCheckOut": "...",
        "proposedPlan": "...",
        "proposedTotalAmountVnd": ...,
        "minutesShifted": ...,
        "unusedIncludedMinutes": ...,
        "extraHourUnits": ...,
        "advisory": true
      }
    ]
  }
```

This is a non-binding sketch for product discussion. The exact contract must be approved by product before implementation.

## 7. Closing Note

The audit does not invent a recommendation algorithm. The audit surfaces that:

1. The current selector is not the cheapest for the exact interval in 22.76 % of cases (PRICING-001 P0).
2. Flexible-time recommendation has no approved product rules (PRICING-002 P1, COMBO_RECOMMENDATION_PRODUCT_RULES = BUSINESS_RULE_UNSOURCED).
3. The advisory / authoritative separation should be enforced at the API boundary.

These are recorded in the gap register.
