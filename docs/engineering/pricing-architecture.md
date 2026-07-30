# Pricing architecture

Pricing is server-authoritative. `calculatePricing` is a pure function using UTC instants and `Asia/Ho_Chi_Minh` only for rule selection. It accepts active tier prices, returns integer-VND line items, and has no fallback when a required plan or tier price is missing.

Phase 8B replaces priority-wins for **new quotes** with
`CHEAPEST_ELIGIBLE_THEN_PRIORITY`:

- Every ACTIVE base plan whose duration window and check-in window admit
  the request becomes a candidate.
- Each candidate's gross = `base_amount + extra_units * extra_unit_price`,
  computed with strict integer VND math.
- The candidate with the lowest gross is selected; ties resolve via
  priority → extra-unit count → stable plan code.
- `calculatePricingWithStrategy(input, catalog, strategy)` is the explicit
  selection-strategy boundary.

Historical quote snapshots remain readable and keep their original
`ruleVersion` (e.g. `phase-7b-data-driven-pricing-v1`).
`PRIORITY_WINS_LEGACY` is reachable for back-fill and audit scenarios.

Activation checks ensure every tier used by an active room type has a
positive integer price, no inverted duration ranges, and writes an ADMIN
audit event in the same transaction. Existing quote snapshots never change
after price updates.

`POST /api/v1/recommendations/stay-times` exposes an advisory search that
walks `±60 minute` offsets in `15-minute` increments, re-evaluates pricing
via the same authoritative domain, revalidates real public availability,
and returns up to three Pareto recommendations. The service is purely
advisory: it never reserves coupons, allocates physical rooms, or creates
HOLDs / persistent quotes.
