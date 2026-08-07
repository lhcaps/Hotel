# Pricing optimizer and exact coverage

## Current B0 local status

The B0 composer is implemented locally. It reads one published immutable
policy release, uses exact `[checkInAt, checkOutAt)` coverage, persists policy
and component provenance, rejects gaps/overlaps/missing prices, and ranks only
valid candidates by customer convenience first and price last. B0 uses
`STAY_START`; the public gate remains OFF by default and V1 hourly/overnight
pricing remains on its existing selector.

The earlier V1/B0.2 design boundary below is retained as historical context;
the implemented local behavior takes precedence for current status.

## Repository-grounded V1 boundary

The current V1 engine is `apps/api/src/pricing/selection-rule-matcher.ts` and
`cheapest-eligible-pricing.ts`. It accepts one exact interval, selects one
active base `rate_plans` row, and optionally charges the V1 `EXTRA_HOUR` row in
started-hour units. The current hard ceiling is 1,440 pricing minutes. The
current candidate contains one plan code, priority, included minutes, extra
units, base amount, extra amount, and gross amount.

The current catalog source is mutable `rate_plans` plus
`rate_plan_prices`. `rate_plans` has status, code/name, priority,
`is_base_plan`, included duration, local check-in bounds, and min/max duration
selection bounds. `rate_plan_prices` maps a plan to a property-owned price
tier and positive integer VND amount. These structures remain V1-only for
existing hourly/overnight behavior. `NIGHT_COMBO`, `DAY_COMBO`, `EXTRA_HOUR`,
labels, and `isBasePlan` are not multi-night semantics.

The current quote repository still reads rooms and inventory blocks for the
legacy V1 source. The B0 quote path is separate: B0 pricing is independent
from availability, while the B0 availability service proves room-type
continuity and HOLD performs the first physical-room allocation.

## Current B0 pricing/availability architecture

The approved sequence is:

1. The pricing composer reads one immutable, published policy release and
   produces only valid exact-coverage commercial candidates.
2. Availability independently proves existential room-type continuous-room
   availability for the full requested interval.
3. The B0 runtime combines those results without moving physical-room
   selection into pricing.
4. Quote stores no physical room identity.
5. HOLD rechecks the full interval and allocates exactly one physical room
   transactionally.

The composer emits only the commercial/catalog fields above. Downstream
operational state is outside this object and is owned by the later phases.

## Candidate contract

The future internal candidate is a strict, non-public object containing:

- `snapshotSchemaVersion`;
- `policyVersionId` and immutable `policyVersionNumber`;
- `applicabilityBasis` and the authoritative `applicabilityInstant` used for
  policy lookup;
- the selected policy effective interval at lookup;
- property id and the policy timezone snapshot;
- exact requested `[checkIn, checkOut)` instants;
- ordered component lines with component id, code, immutable component
  contents/digest, exact covered interval, coverage model, billing model,
  `occurrenceCount`, `billingUnitQuantity`, unit amount, line amount, and
  restrictions;
- integer-VND total and any commercial discount/tax fields approved later;
- deterministic candidate id and selection rationale/ranking keys.

`displayNightCount` is derived presentation metadata only. Exact policy
duration is the instant difference. Coverage is the exact union of component
intervals. Billing quantity is the catalog-authorized charging calculation.
None of these values may be substituted for another.

Candidate validity requires:

- exact requested interval coverage with no gap, overlap, or double charge;
- all component occurrences within the requested interval;
- published policy/component/price validity under the selected applicability
  instant;
- all directed adjacency and occurrence limits satisfied;
- every required room-class/price-tier amount present and positive;
- deterministic ordering independent of database row order.

The candidate does not claim that a room exists or is free. A missing price,
inactive source, invalid effective period, unsupported condition, DST
conversion ambiguity, graph overflow, or incomplete coverage fails closed as
pricing unavailable.

## Coverage models

B0.2 uses the smallest explicit coverage set needed for the current catalog
and multi-night design. The schema must not overload one `duration_minutes`
field for all models.

| Coverage model       | Required fields                                                                       | Forbidden/null fields                               | Exact coverage rule                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIXED_ELAPSED`      | `fixed_duration_minutes`                                                              | local start/end and boundary min/max are null       | End is the exact instant `cursor + fixed_duration_minutes`; no calendar or billing rounding is used.                                                                               |
| `LOCAL_CLOCK_WINDOW` | `local_start_minute_inclusive`, `local_end_minute_exclusive`, `local_end_day_offset`  | fixed duration and boundary min/max are null        | Resolve local boundaries in the policy timezone for the occurrence date; resolved instants are the coverage interval.                                                              |
| `REQUEST_BOUNDARY`   | `boundary_position`, `boundary_min_duration_minutes`, `boundary_max_duration_minutes` | fixed duration and all local window fields are null | `LEADING` starts at request `checkIn` and ends at the next component start. `TRAILING` starts at the prior component end and ends at request `checkOut`. Each occurs at most once. |

`FIXED_ELAPSED` is retained for existing elapsed-duration concepts. A local
window is not converted by assuming that a local date is 24 hours. Boundary
coverage is not priced by pretending that its charged units are its coverage.
The publication validator rejects every other field combination.

For `LOCAL_CLOCK_WINDOW`, local start/end minutes are quarter-hour values,
`local_end_day_offset` is 0 or 1, and the end boundary must be later than the
start boundary after applying the day offset. The occurrence must begin at
the cursor's resolved instant; a component cannot silently move a cursor.
For `REQUEST_BOUNDARY`, `LEADING` has no predecessor and may use one of one or
more explicitly approved successor edges; `TRAILING` has no successor and may
use one of one or more explicitly approved predecessor edges. Each candidate
selects exactly one edge at that boundary. Neither boundary component may occur
in the middle or self-edge, and no edge is inferred from component kind, code,
price, or display label. Catalog alternatives remain bounded by the release
graph limit.

## Billing models

The initial model supports only billing behavior present or directly required
by the current V1 catalog:

| Billing model      | Required fields                                        | Forbidden/null fields                              | Charged quantity                                                                  |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `FIXED_OCCURRENCE` | no billing-unit bounds                                 | `billing_unit_minutes`, min/max billing units null | exactly 1 per component occurrence; aggregate only with explicit occurrence count |
| `STARTED_UNIT`     | `billing_unit_minutes`, optional min/max billing units | exact-unit fields absent                           | `ceil(exact covered elapsed minutes / billing_unit_minutes)`                      |

An exact-unit-only model is deliberately not supported in this first release;
the current `EXTRA_HOUR` behavior is started-unit behavior. If business
approval later requires exact-unit charging, it must be a new rule-schema
version with new validation and tests, not an interpretation of a current
plan row.

Coverage is computed first from exact instants. Component occurrence count is
controlled by `maximum_occurrences_per_candidate` and explicit self-edges.
Billing-unit quantity is a separate derived value controlled by
`billing_unit_minutes` and its optional billing-unit bounds. Amount arithmetic
is integer VND with safe-integer bounds and no rounding of coverage. For a
local window on a DST transition, elapsed minutes come from resolved instants,
so a 23-hour or 25-hour local result is not silently treated as 24 hours.

## Timezone and DST policy

`pricing_policy_versions.timezone_snapshot` captures the property IANA
timezone at release publication. Publication requires it to match the current
property timezone; a later property timezone change requires a new draft
release. The candidate and future quote snapshot carry the same timezone
snapshot.

`applicability_basis` is immutable on the policy release and must be one of
`QUOTE_INSTANT` or `STAY_START`. The initial production choice is
`REQUIRES_BUSINESS_APPROVAL`.

- `QUOTE_INSTANT` selects the one policy whose half-open interval contains the
  authoritative server quote timestamp.
- `STAY_START` selects the one policy whose half-open interval contains the
  exact check-in instant.

The selected basis supplies one explicit `applicabilityInstant`; B0 uses
`STAY_START` and records the observed policy effective interval. The whole
candidate uses that one release. There is no per-component policy switching.
The property establishes one basis across its published policy lineage; a
request client cannot choose it. Preview displays the basis and instant that
would be used. No default is inferred from “current time” or silently chosen
from check-in.

The implementation uses the repository's approved Node timezone
conversion utility built on the runtime IANA tzdata; the current `Intl`
helpers prove local fields but do not by themselves authorize a new pricing
conversion algorithm. A nonexistent or ambiguous local boundary is rejected
closed rather than shifted or guessed. Exact instants are then used for all
coverage, property policy, and billing calculations.

## Deterministic selection

Only candidates that pass policy, component, price, exact-coverage, and graph
validation enter ranking. The lexicographic ranking is:

1. fewer component occurrences/lines (customer convenience);
2. lower summed customer-condition complexity rank;
3. lower summed restriction rank;
4. lowest valid integer-VND total;
5. stable candidate digest.

Ranking uses no downstream operational state. Availability is a separate B0
result. A candidate with a cheaper partial interval, an incomplete allocation,
a missing price, or an invalid graph is not a fallback.

An equivalent one-night V1 input continues through the existing V1 selector
and produces the existing snapshot. The new policy release catalog and public
multi-night routes are local-only and remain dark by default in production.
