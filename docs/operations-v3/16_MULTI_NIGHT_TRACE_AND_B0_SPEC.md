# Operations V3 — Multi-Night Trace and B0 Specification

Status: B0 local implementation complete and unreleased. The current worktree
has the immutable pricing-policy release schema, generated 0029 migration,
V1-derived draft bootstrap, published policy composer, same-room availability,
quote V2, HOLD/booking/payment/access/lifecycle path, customer/admin UI, whole-
booking cancellation regression, matching provenance, and guarded tests. The
public gate defaults OFF. No production migration, configuration change, data
write, deployment, commit, or push was performed.

## Evidence boundary

The repository evidence below is separated by phase and date/status context.
Historical Phase A evidence initially recorded a database integration block
because `TEST_DATABASE_URL` was missing; that historical fact is retained.
Current B0.1 evidence records the loopback guard PASS, generated
`room_management_test_<uuid>` naming guard PASS, `pnpm db:check` PASS, and
guarded PostgreSQL integration PASS for 3 files / 18 tests. Current B0.2
evidence records migration preflight PASS, fresh 0029 PostgreSQL PASS for 40
schema/invariant plus 5 concurrency scenarios, and 0028 -> 0029 upgrade PASS.
These are local-development gates, not production readiness. The paths below
distinguish current facts from deferred runtime behavior.

## Current B0 capability matrix

| Capability                 | Current local status                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Multi-night pricing        | IMPLEMENTED_LOCAL; published policy, exact component coverage, provenance, deterministic ranking            |
| Continuous availability    | IMPLEMENTED_LOCAL; one eligible physical room must cover the complete half-open interval                    |
| Quote/HOLD/booking/payment | IMPLEMENTED_LOCAL; one quote, one HOLD, one booking, one payment aggregate, one block                       |
| Access/lifecycle           | IMPLEMENTED_LOCAL; one booking-scoped pass, check-in once, final checkout once, one turnover                |
| Whole-booking cancellation | IMPLEMENTED_LOCAL; one release, immutable snapshots, refund review behavior, access revocation, idempotency |
| Public exposure            | IMPLEMENTED_BEHIND_SERVER_GATE; default OFF                                                                 |
| V1 compatibility           | PRESERVED; hourly/overnight readers and old snapshots remain supported                                      |
| Deferred scope             | Partial-night cancellation, amendment, room moves, real lock provider, T-30 orchestration, multi-property   |

## Historical pre-implementation capability matrix

| Capability                    | Status                       | Repository evidence                                                                                                                     | B0 interpretation                                                                                                                                                                                                        |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Offset-aware interval parsing | `PARTIALLY_SUPPORTED`        | `packages/contracts/src/pricing.ts:43-60`, `apps/web/src/lib/booking-search-state.ts:145-168`                                           | The API accepts intervals up to 31 days, but the public UI and overnight validator still encode one-night behavior.                                                                                                      |
| Property stay policy          | `PARTIALLY_SUPPORTED`        | `apps/api/src/pricing/stay-policy.ts:55-92`, `packages/database/src/schema.ts:276-309`                                                  | A policy exists, but overnight mode requires one of two exact windows and pricing still caps a plan at 24 hours.                                                                                                         |
| Maximum-stay authority        | `PARTIALLY_SUPPORTED`        | `publicIntervalSchema`, property `maxStayMinutes`, pricing matcher `MAX_DURATION_MINUTES=1440`                                          | B0 must make the stored property policy the single authority and remove the pricing/UI split.                                                                                                                            |
| Full-interval availability    | `SUPPORTED_ALREADY`          | `apps/api/src/pricing/availability.repository.ts:68-184`, `packages/booking/src/repository/availability.ts:56-89`                       | Availability probes the complete requested interval. B0 must retain this invariant.                                                                                                                                      |
| Same-room continuity          | `SUPPORTED_ALREADY`          | `apps/api/src/pricing/availability.repository.ts:68-184`, `packages/booking/src/services/create-booking-hold.ts:193-299`                | Availability proves existential continuity at room-type level; HOLD later selects one room and one continuous block.                                                                                                     |
| Multi-night pricing           | `NOT_SUPPORTED`              | `apps/api/src/pricing/selection-rule-matcher.ts:271-305`, `apps/api/src/pricing/cheapest-eligible-pricing.ts:165-325`                   | Current pricing has one base plan and extra-hour units with a 1–24 hour rule; B0 needs nightly components and deterministic selection.                                                                                   |
| Quote persistence             | `PARTIALLY_SUPPORTED`        | `apps/api/src/pricing/quote.repository.ts:125-205`, `packages/contracts/src/pricing.ts:279-293`                                         | The full interval is snapshotted and expires, but the quote has no night/component/rationale fields and must never carry a physical room id.                                                                             |
| HOLD                          | `PARTIALLY_SUPPORTED`        | `packages/booking/src/services/create-booking-hold.ts:171-299`                                                                          | One booking and one block are authoritative, but B0 must persist the multi-night component snapshot and same-room proof.                                                                                                 |
| Booking lifecycle             | `SUPPORTED_ALREADY`          | `packages/database/src/schema.ts:762-920`, `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:411-665`                   | The lifecycle is interval-based and stateful. B0 extends facts without repricing existing bookings.                                                                                                                      |
| Inventory block               | `SUPPORTED_ALREADY`          | `roomInventoryBlocks`, `create-booking-hold.ts:266-299`                                                                                 | A single active block spans `checkIn` to `checkOut`; retain half-open interval semantics.                                                                                                                                |
| Payment authority             | `SUPPORTED_ALREADY`          | `packages/database/src/schema.ts:1092-1127`, `apps/api/src/payment/*webhook.controller.ts`                                              | Provider callbacks and the booking payment aggregate are server authoritative; browser returns remain read-only.                                                                                                         |
| Cancellation                  | `PARTIALLY_SUPPORTED`        | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:328-526`, `apps/api/src/customer/customer-booking.service.ts:260-408` | Interval cancellation works, but B0 needs component-aware refund/review inputs without changing historical booking facts.                                                                                                |
| Access                        | `PARTIALLY_SUPPORTED`        | `apps/api/src/booking/services/booking-access-pass.service.ts:1-100`, `booking-detail.service.ts:115-137`                               | One signed pass exists and expires after checkout plus one hour; B0 must define one stay pass, not nightly re-check-in.                                                                                                  |
| Checkout and turnover         | `SUPPORTED_ALREADY`          | `admin-booking-lifecycle.service.ts:564-615`, `packages/database/src/schema.ts:928-981`                                                 | Checkout releases the interval block and creates one turnover task. B0 keeps this at final checkout.                                                                                                                     |
| Housekeeping automation       | `PARTIALLY_SUPPORTED`        | `apps/worker/src/scheduler/worker-scheduler.ts:3-4`, `process-housekeeping-reminders.ts`                                                | Reminder scheduling exists, but daily dirty/reset and final-checkout automation are not a complete V3 workflow.                                                                                                          |
| Customer multi-night UI       | `NOT_SUPPORTED`              | `apps/web/src/components/availability-search-form.tsx:188-278,444-565`, `messages.ts`                                                   | The public form and copy intentionally constrain overnight requests to one night.                                                                                                                                        |
| Admin operations UI           | `PARTIALLY_SUPPORTED`        | `apps/web/src/app/admin/(protected)`, `admin-booking-operations.controller.ts`                                                          | Admin list/detail and lifecycle surfaces exist; V3 room/property/housekeeping views are not implemented.                                                                                                                 |
| Database enforcement          | `SUPPORTED_FOR_B0_2_CATALOG` | `packages/database/src/schema.ts`, `packages/database/drizzle/0029_operations_v3_pricing_policy_release.sql`, guarded integration tests | New policy root/components/prices/edges, exclusion, basis lock, deferred cutover, lifecycle, ownership, shape, and freeze guards are implemented; internal dark lookup exists, while the public reader remains disabled. |
| Worker scheduling             | `PARTIALLY_SUPPORTED`        | `apps/worker/src/scheduler/worker-scheduler.ts:141-202`, `apps/worker/src/main.ts:65-110`                                               | Four job families exist, but no Operations V3 feature gate or T-30 access/arrival workflow exists.                                                                                                                       |

## One-night source chain

The one-night restriction is not a single frontend literal. The current chain
is:

1. `apps/web/src/components/availability-search-form.tsx` defaults the
   overnight mode to `21:00 → 09:00` or `22:00 → 10:00`, and resets checkout to
   the following calendar day.
2. `apps/web/src/lib/booking-search-state.ts` serializes the interval but does
   not add a night-count or component model.
3. `packages/contracts/src/pricing.ts` accepts an offset-aware interval up to
   the structural 31-day ceiling, while `overnight` remains a fixed one-night
   preset and the additive `multi_night` intent is separate.
4. `apps/api/src/pricing/stay-policy.ts` requires exactly one local-day
   difference and one of the two fixed windows for `mode=overnight`.
5. `apps/api/src/pricing/selection-rule-matcher.ts` and
   `apps/api/src/pricing/cheapest-eligible-pricing.ts` reject pricing durations
   over 1,440 minutes.
6. `apps/api/src/errors/problem-details.filter.ts` converts the validation
   message into `OVERNIGHT_ONE_NIGHT`, and the web results component renders
   the one-night Vietnamese/English help copy.

The authoritative restriction for the current public overnight path is the
server-side policy and pricing validation. The UI and copy are projections of
that restriction, not an authority that B0 may bypass. The new `multi_night`
intent is fail-closed whenever its server-owned public or pricing gate is
false; local B0 enables it only explicitly.

## Current B0 pricing boundary

The intended internal candidate, if the catalog gate is approved, must carry
the exact requested interval and timezone, policy/version identity, exact
component intervals, catalog source ids and versions, quantities, integer-VND
amounts, restrictions, total, deterministic id, and deterministic ranking.
Pricing coverage is the exact component interval union. Policy duration is the
exact instant difference used for stay-policy checks. Billing units are the
catalog-defined quantities used for charging. `displayNightCount` is derived
presentation metadata only.

Pricing does not select or reserve a physical room and does not claim room
availability. The current B0 availability service proves existential
full-interval room-type continuity and combines that result with a valid
pricing candidate; HOLD remains the first point that selects one physical
room. The existing `overnight` mode remains fixed one-night; `multi_night` is
publicly available only behind the server gate and is OFF by default.

The candidate uses one PUBLISHED policy release only. The property has one
established basis. With `QUOTE_INSTANT`, the server quote timestamp is the
applicability instant; with `STAY_START`, the exact check-in instant is the
applicability instant. The local B0 basis is `STAY_START`; production
enablement remains release controlled, so no basis may be inferred from
request shape or chosen by the client.
`occurrenceCount` records component occurrences, while `billingUnitQuantity`
records derived started-unit quantity; rounding never changes the covered
interval.

## B0.2 catalog capability gate

The live repository catalog currently has duration bounds, check-in windows,
status, priority, base/non-base shape, and room-type price-tier amounts. It has
no explicit repeatable flag, before/after compatibility relation, effective
start/end period, or immutable rule/version identity. `NIGHT_COMBO` and other
known codes are identifiers, not authoritative component semantics. Therefore
B0 no longer stops at an undefined catalog gap: the corrected schema,
V1-derived DRAFT bootstrap, published lookup, composer, and gated runtime are
implemented locally in `11_MIGRATION_PLAN.md`. It still stops before
production seed/backfill, migration deployment, configuration change, and
public production exposure until the runtime business matrix and release are
approved.

## B0.2 V3 immutable policy-release implementation

The approved design is rooted at `pricing_policy_versions` and has exactly
three child concerns: `pricing_policy_components` for coverage/billing rules,
`pricing_policy_component_prices` for property-owned price-tier amounts, and
`pricing_policy_component_edges` for directed immediate adjacency. The root
uses UUID identity plus immutable monotonic `version_number`,
DRAFT/PUBLISHED/RETIRED/CANCELLED lifecycle, explicit
`QUOTE_INSTANT`/`STAY_START` applicability basis, half-open effective
timestamps, timezone snapshot, schema discriminator, and cancellation
metadata. PUBLISHED/RETIRED commercial rows are frozen by PostgreSQL
protection; corrections create a new DRAFT and abandoned drafts become
CANCELLED.

Coverage is explicitly `FIXED_ELAPSED`, `LOCAL_CLOCK_WINDOW`, or
`REQUEST_BOUNDARY` with independent `LEADING` and `TRAILING` positions. A
leading boundary starts at request check-in and ends at the next component; a
trailing boundary starts at the prior component end and ends at request
check-out. Billing is explicitly `FIXED_OCCURRENCE` or `STARTED_UNIT`; exact
instants determine coverage before any started-unit rounding. Occurrence count
is separate from billing-unit quantity: repetition uses
`maximum_occurrences_per_candidate` and an explicit self-edge, while
`billing_unit_minutes` plus optional min/max billing units govern derived
quantity. Component occurrence limits and a release component-line limit bound
the graph. Only bounded self-edges are allowed; multi-node cycles are rejected.
Leading components may have multiple explicitly approved successor edges and
trailing components may have multiple explicitly approved predecessor edges.
Each candidate selects exactly one boundary edge; no edge is inferred from
component kind, code, price, or display label, and all alternatives remain
bounded by release graph limits.

Price rows use a composite component/policy FK and a denormalized property
integrity key to enforce the existing `(property_id, price_tier_id)` ownership.
The policy release itself has a GiST half-open effective-period exclusion over
PUBLISHED/RETIRED rows keyed by property, reusing the repository's existing
`btree_gist` extension. Touching intervals are allowed; an open-ended PUBLISHED
policy is replaced by a successor only through an atomic, one-way closure at an
explicit cutover while the old policy remains PUBLISHED. Complete-policy
validation, preview, supersession, and publication are implemented locally
behind the Admin API/catalog gate; migration 0029 permits only DRAFT ->
CANCELLED and rejects
PUBLISHED -> CANCELLED. A deferred constraint trigger requires an exact
PUBLISHED successor for any scheduled PUBLISHED closure; there is no
standalone terminal closure. Graph-wide checks remain application validation,
not fragile row triggers. Exact fields, checks, migration/custom SQL, lock
impact, and business approval matrix are in `11_MIGRATION_PLAN.md`.

The cutover state is explicit: the successor remains DRAFT before the
transaction commits and is PUBLISHED after a successful commit. The
server-owned reader excludes the future successor before `effective_from` and
selects it at the exact cutover. The deferred final-state guard requires that
PUBLISHED successor, not a DRAFT placeholder, before accepting the predecessor
closure.

Local-clock publication also fails closed for a property timezone with
seasonal offset changes. B0.2 does not infer an ambiguous or nonexistent wall
clock from an undated component; it requires a future dated DST resolution
policy before such a component can publish.

## Forty-area repository trace

`Classification` uses only the approved values. “Current behavior” is a fact
from the named repository location; “Required B0 change” is a design proposal.

|   # | Layer                    | Classification       | Actual path                                                                                                           | Symbol/function/schema/test                                                              | Current behavior                                                                                                                      | Exact one-night or multi-night assumption                                                                     | Required B0 change                                                                                                | Compatibility risk                                                                      | Required test                                                                                 |
| --: | ------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
|   1 | Public date/time         | `UI_ONLY`            | `apps/web/src/components/availability-search-form.tsx`                                                                | `AvailabilitySearchForm`, `OVERNIGHT_WINDOWS`                                            | Overnight inputs expose two fixed start/end windows and next-day checkout.                                                            | UI assumes overnight means one calendar night.                                                                | Add a multi-night checkout date while retaining hourly and fixed one-night modes.                                 | Existing saved query links and labels must keep parsing.                                | Web form tests for hourly, one-night, multi-night, invalid dates, and hydration.              |
|   2 | Form/client schemas      | `CONTRACT_LIMIT`     | `apps/web/src/lib/booking-search-state.ts`                                                                            | `BookingSearchState`, `BookingMode`                                                      | State contains mode, check-in/out, and guest counts only.                                                                             | No `nightCount`, pricing components, or stay classification exists client-side.                               | Add only derived/display fields if needed; interval remains the input authority.                                  | Duplicated client price or night logic could become authoritative accidentally.         | State round-trip tests with offsets and DST-safe local dates.                                 |
|   3 | Search parameters        | `UI_ONLY`            | `apps/web/src/lib/booking-search-state.ts:134-168`                                                                    | `toBookingSearchQuery`, `readBookingSearchQuery`                                         | Query serializes `mode`, interval, adults, children; browser-local minutes are normalized to `+07:00`.                                | Query can carry an interval but the overnight UI creates only one night.                                      | Preserve query keys and make multi-night checkout an interval value, not a new price source.                      | Breaking old links or losing explicit offsets.                                          | Old query fixtures plus multi-night query serialization.                                      |
|   4 | API clients/adapters     | `CONTRACT_LIMIT`     | `apps/web/src/lib/public-api.ts`, `apps/api/src/pricing/availability.controller.ts`                                   | `publicApi.searchAvailability`, `POST /availability/search`                              | Client sends the interval and receives the current availability response.                                                             | Adapter has no component/rationale projection.                                                                | Extend response types and rendering for server-provided components/rationale.                                     | Type changes can cascade across public and admin consumers.                             | API-client contract test and unavailable-API browser case.                                    |
|   5 | Shared contracts         | `CONTRACT_LIMIT`     | `packages/contracts/src/pricing.ts`                                                                                   | `publicIntervalSchema`, `availabilityResponseSchema`, `quoteSchema`                      | Interval accepts up to 31 days; response/quote expose one pricing breakdown.                                                          | Contract permits multiple days syntactically but does not model nights or components.                         | Add versioned component, night-count, and selection-rationale fields with compatibility defaults.                 | Consumers may assume one `lineItems` base/extra shape.                                  | Contract tests for old one-night payloads and new multi-night payloads.                       |
|   6 | DTO/boundary validation  | `API_VALIDATION`     | `apps/api/src/pricing/availability.service.ts`, `quote.service.ts`, `problem-details.filter.ts`                       | Zod parse and `OVERNIGHT_ONE_NIGHT` mapping                                              | API parses public requests; special overnight validation errors become a stable problem code.                                         | `mode=overnight` is validated as exactly one night.                                                           | Make validation mode-specific: hourly limits, one-night preset, and multi-night stay policy.                      | Existing clients may rely on `OVERNIGHT_ONE_NIGHT`.                                     | Boundary tests for each invalid mode, interval, offset, and guest count.                      |
|   7 | Property policy          | `API_VALIDATION`     | `apps/api/src/pricing/stay-policy.ts`                                                                                 | `isWithinPropertyStayPolicy`, `propertyStayPolicy`                                       | Stored min/max/lead/advance policy is checked; overnight has exact-window logic.                                                      | Property policy does not yet express a first-class multi-night mode rule.                                     | Add explicit supported modes and policy messages; keep one stored timezone.                                       | Policy changes can alter search eligibility for future requests only.                   | Unit matrix for min/max, lead/advance, timezone, modes, and boundary minutes.                 |
|   8 | Minimum/maximum          | `API_VALIDATION`     | `packages/database/src/schema.ts:276-309`, `packages/contracts/src/pricing.ts:43-60`                                  | Property checks and `validInterval`                                                      | Database allows up to 31 days; property max is bounded to 44,640 minutes; pricing separately caps 1,440 minutes.                      | Multiple authorities disagree for a multi-night interval.                                                     | Use effective max = stored property policy and enforce it consistently in contract/API/pricing.                   | Existing properties with max below the proposed product range must remain valid.        | Boundary tests at min, max, max+minute, and 31 days.                                          |
|   9 | Timezone                 | `API_VALIDATION`     | `apps/api/src/pricing/stay-policy.ts`, `apps/api/src/pricing/selection-rule-matcher.ts`                               | `Intl.DateTimeFormat`, `TIMEZONE_ASIA_HO_CHI_MINH`                                       | Stay policy interprets local calendar values; pricing matcher uses Asia/Ho_Chi_Minh.                                                  | One-night exact windows depend on local day; multi-night totals must not use UTC date subtraction.            | Centralize property timezone in the pricing/availability component calculator.                                    | DST or properties outside the current timezone can produce off-by-one nights.           | Timezone fixtures with offset-aware inputs and local midnight boundaries.                     |
|  10 | Availability query       | `AVAILABILITY_LIMIT` | `apps/api/src/pricing/availability.repository.ts:30-184`                                                              | `searchWithState`, `search`                                                              | Loads active property/catalog/rooms/blocks and probes the complete `[checkIn,checkOut)` interval.                                     | Availability already understands a continuous interval, but offers are priced by current one-base-plan logic. | Keep full-interval search and return a continuity proof plus per-night eligible inventory result.                 | A query that only checks each night independently could allow a split-room result.      | Multi-night overlap and no-continuous-room integration tests.                                 |
|  11 | Physical-room continuity | `AVAILABILITY_LIMIT` | `apps/api/src/pricing/availability.repository.ts:68-184`, `packages/booking/src/repository/availability.ts:56-89`     | `search`, `findAllocatableRooms`                                                         | Availability evaluates the complete interval at room-type level; HOLD later locks one allocatable room.                               | Availability proves existence only; quote carries no room identity; HOLD selects one physical room.           | Preserve existential availability and transactional HOLD allocation; reject split allocation.                     | Inventory scarcity may make a cheaper split option look available; it is invalid.       | Multi-night availability plus concurrent HOLD test proving one room and one continuous block. |
|  12 | Maintenance overlap      | `AVAILABILITY_LIMIT` | `packages/booking/src/repository/availability.ts:56-89`, `apps/api/src/pricing/availability.repository.ts:98-124`     | Active `maintenance_blocks` and `room_inventory_blocks` overlap predicates               | Active maintenance is excluded for the requested interval.                                                                            | A room unavailable for any sub-interval cannot satisfy the full stay.                                         | Expose a stable no-continuity reason without leaking internal maintenance details publicly.                       | Public response must not expose maintenance or physical-room identifiers.               | Multi-night maintenance overlap and customer-safe response tests.                             |
|  13 | Pricing eligibility      | `PRICING_LIMIT`      | `apps/api/src/pricing/cheapest-eligible-pricing.ts:165-225`                                                           | `evaluatePricingCandidates`                                                              | Matches one base plan and computes extra-hour units; missing extra pricing drops a candidate.                                         | Pricing assumes one base interval plus extra hours, not nights.                                               | Build nightly base components plus eligible extras, then select only valid complete candidates.                   | A candidate that is cheapest for one night may not be cheapest for the full stay.       | Deterministic multi-plan/multi-night candidate matrix.                                        |
|  14 | Durations over 1,440     | `PRICING_LIMIT`      | `apps/api/src/pricing/selection-rule-matcher.ts:271-305`                                                              | `calculatePricing`                                                                       | Rejects pricing duration over 24 hours with `InvalidPricingIntervalError`.                                                            | Any multi-night request reaches a pricing hard stop even when interval/policy allow it.                       | Replace the single-duration guard with per-night component eligibility and property max guard.                    | Removing the guard without components risks an incorrect total.                         | 24h, 24h+1m, two-night, max-stay, and missing-rate tests.                                     |
|  15 | Overnight validation     | `API_VALIDATION`     | `apps/api/src/pricing/stay-policy.ts:40-75`                                                                           | `isSupportedOvernightWindow`                                                             | Requires exactly one local-day difference and exact `21:00→09:00` or `22:00→10:00`.                                                   | `mode=overnight` is deliberately one-night-only.                                                              | Preserve this mode as a valid one-night mode; introduce a separate multi-night stay mode.                         | Changing overnight semantics would break the stated product contract and copy.          | Regression tests proving overnight multi-night remains rejected.                              |
|  16 | Extra-hour pricing       | `PRICING_LIMIT`      | `apps/api/src/pricing/cheapest-eligible-pricing.ts:228-325`                                                           | `calculateExtraHourUnits`, candidate comparison                                          | Extra time is rounded into 15-minute units and compared after gross price.                                                            | Extra hours are the extension of one base plan, not per-night checkout/extension policy.                      | Define whether extra hours apply only to final checkout and expose the rule in the snapshot.                      | Ambiguous partial final nights can create duplicate charges.                            | Exact-hour, quarter-hour, and final-checkout extension tests.                                 |
|  17 | Quote persistence        | `CONTRACT_LIMIT`     | `apps/api/src/pricing/quote.repository.ts:125-205`                                                                    | `issue`, `get`                                                                           | Stores full interval, guests, pricing snapshot, cancellation snapshot, expiry; returns one breakdown.                                 | Snapshot is immutable but lacks night components and must not contain room identity.                          | Later B0.2 may persist rule version, policy, components, total, and rationale; B0.1 changes no quote persistence. | Quote payload/storage growth and old snapshot decoding.                                 | Quote round-trip and backward-compatible read tests remain future B0.2 gates.                 |
|  18 | Quote expiry             | `API_VALIDATION`     | `apps/api/src/pricing/quote.repository.ts:132-149`                                                                    | `issue`                                                                                  | Quote expiry is set to 15 minutes; `get` reports expired.                                                                             | Expiry protects one interval today; multi-night quote must remain one atomic offer.                           | Keep TTL and make all component data part of the same expiry-bound snapshot.                                      | Long stays may encourage users to retry; no silent repricing inside a quote.            | Expiry race tests with multi-night snapshot and HOLD creation.                                |
|  19 | HOLD allocation          | `AVAILABILITY_LIMIT` | `packages/booking/src/services/create-booking-hold.ts:171-299`                                                        | `createBookingHold`                                                                      | Valid quote is rechecked; one room is locked and one booking/block is inserted.                                                       | HOLD is atomic for one continuous stay, not one HOLD per night.                                               | Revalidate full interval and component snapshot; create exactly one HOLD and one block.                           | Partial writes or per-night holds violate the booking invariant.                        | Transaction rollback and concurrent multi-night HOLD tests.                                   |
|  20 | Booking record           | `DATABASE_LIMIT`     | `packages/database/src/schema.ts:762-920`                                                                             | `bookings` table constraints                                                             | One row stores one `roomId`, interval, amounts, rule version, price/cancellation snapshots, and lifecycle facts.                      | The row can represent an interval but not component metadata as typed columns.                                | Add nullable/versioned component snapshot or child table while preserving one booking row.                        | Historical rows must remain readable and never be repriced.                             | Migration constraint and old/new booking read tests.                                          |
|  21 | Inventory block          | `DATABASE_LIMIT`     | `packages/booking/src/services/create-booking-hold.ts:266-299`                                                        | Booking block insert                                                                     | One active block covers the full quote interval and is released by lifecycle operations.                                              | A stay has one resource reservation from check-in through check-out.                                          | Keep one block; add no daily blocks and no automatic room move.                                                   | Daily blocks create gaps and violate same-room continuity.                              | Block span, release, expiration, cancellation, and checkout tests.                            |
|  22 | PostgreSQL overlap       | `DATABASE_LIMIT`     | `packages/database/drizzle/0001_custom_invariants.sql`                                                                | `room_inventory_blocks_active_overlap_excl`                                              | GiST exclusion prevents active same-room overlapping half-open ranges; immutable booking trigger protects facts.                      | Database already enforces the strongest one-room overlap invariant.                                           | Add only required component/policy constraints and matching journal/snapshot metadata.                            | Editing historical migrations is forbidden; failed metadata repair blocks rollout.      | `TEST_DATABASE_URL` integration test for overlap and immutable facts.                         |
|  23 | Demo payment aggregate   | `DATABASE_LIMIT`     | `packages/database/src/schema.ts:1092-1127`, `apps/worker/src/main.ts`                                                | Payment aggregate and `PAYMENT_DEMO_ENABLED` boundary                                    | One payment aggregate is unique per booking; provider/demo status is server-side.                                                     | Payment is for the atomic booking total, not nightly booking rows.                                            | Keep one booking payment aggregate and snapshot the multi-night total; never trust browser price.                 | Refund/reconciliation semantics need business decision for component detail.            | Payment state transition and aggregate uniqueness tests.                                      |
|  24 | Callback/IPN             | `API_VALIDATION`     | `apps/api/src/payment/momo-webhook.controller.ts`, `vnpay-webhook.controller.ts`                                      | Verified provider event handlers                                                         | HMAC/provider verification and server settlement drive payment state.                                                                 | A callback confirms one booking total, independent of browser navigation.                                     | Keep provider-specific verification; attach component reference only to server snapshot if required.              | Provider payload limits and external credentials are outside local evidence.            | Signed callback unit tests plus external-provider blocked result.                             |
|  25 | Browser return           | `API_VALIDATION`     | `apps/api/src/payment/momo-return.controller.ts`, `vnpay-return.controller.ts`                                        | Read-only return controllers                                                             | Browser return is 204/read-only and cannot mutate payment state.                                                                      | No nightly or multi-night payment state may be inferred from query parameters.                                | Preserve read-only boundary and direct users to server payment status.                                            | A frontend shortcut would reintroduce client-authoritative payment.                     | Return tampering tests and payment status polling test.                                       |
|  26 | Customer list/detail     | `CONTRACT_LIMIT`     | `apps/api/src/customer/customer-booking.service.ts:39-140`, `packages/contracts/src/customer.ts:25-56`                | Customer list/detail schemas and service                                                 | Shows one booking interval, room type, total, payment, and cancellation data.                                                         | It can display dates but has no night count/components/continuity explanation.                                | Extend read contracts with server-derived stay summary; do not expose physical room or pricing internals.         | Customer snapshots must not leak maintenance, room code, or internal candidate data.    | Customer contract, authorization, and multi-night rendering tests.                            |
|  27 | Admin list/detail        | `API_VALIDATION`     | `apps/api/src/booking/admin-booking-operations.controller.ts`, `apps/web/src/app/admin/(protected)/bookings`          | `booking.lifecycle.read`, booking list/detail                                            | Admin can inspect lifecycle details under permission guards.                                                                          | V3 operations need stay components and final-room state without changing existing lifecycle actions.          | Add permission-guarded operational fields and preserve current route authorization.                               | Viewer role must not gain booking-management authority accidentally.                    | Admin route permission inventory and viewer/super-admin UI tests.                             |
|  28 | Cancellation             | `API_VALIDATION`     | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:328-526`                                            | `cancellationPreview`, `cancel`                                                          | HOLD/CONFIRMED future bookings can cancel; inventory is released and audit/outbox records are written.                                | Cancellation is one action on one booking, not per-night cancellation.                                        | Calculate/refund/review from immutable component snapshot and retain one cancellation event.                      | Paid partial refunds require explicit business policy; no silent provider assumption.   | Preview/cancel tests for unpaid, paid, boundary, and multi-night cases.                       |
|  29 | No-show                  | `API_VALIDATION`     | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:618-665`                                            | `markNoShow`                                                                             | CONFIRMED booking becomes NO_SHOW at/after check-in; block releases and future arrival prep is cancelled.                             | No-show is evaluated once for the stay, not nightly.                                                          | Keep single stay transition and define multi-night financial treatment separately.                                | Automatic daily no-show would incorrectly interrupt an active stay.                     | Time-bound no-show tests and multi-night active-stay guard.                                   |
|  30 | Check-in                 | `API_VALIDATION`     | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:529-561,816-850`                                    | `checkIn`, `assertCheckInReadiness`                                                      | Checks payment, time window, room ACTIVE, housekeeping CLEAN, no maintenance, and no other checked-in booking.                        | One check-in starts the stay; later nights do not require re-check-in.                                        | Keep one check-in guard and record the same room for the full interval.                                           | Requiring daily check-in would violate the one-booking invariant.                       | Multi-night check-in readiness and invalid daily-transition tests.                            |
|  31 | Checkout                 | `API_VALIDATION`     | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:564-615`                                            | `checkOut`                                                                               | Only CHECKED_IN can check out; room becomes DIRTY, turnover task is inserted, and block releases.                                     | Checkout happens once at final `checkOut`, not at each midnight.                                              | Keep one final checkout and optionally show remaining-stay context to operators.                                  | Early checkout/refund semantics must not mutate original booking facts.                 | Multi-night final-checkout, early-departure, release, and turnover tests.                     |
|  32 | Inventory release        | `DATABASE_LIMIT`     | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:411-665`, `booking-repository.ts`                   | `RELEASED` block updates on expiry/cancel/no-show/checkout                               | One release covers the complete block.                                                                                                | Release exactly once and preserve audit/outbox idempotency.                                                   | Partial release could make a room falsely available mid-stay.                                                     | Lifecycle idempotency and overlap-after-release integration tests.                      |
|  33 | Turnover/housekeeping    | `WORKER_LIMIT`       | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:564-615`, `packages/database/src/schema.ts:928-981` | `TURNOVER`, `housekeepingTasks`                                                          | Final checkout sets room DIRTY and creates one TURNOVER task with conflict protection.                                                | Multi-night stay has no turnover at nightly boundaries.                                                       | Keep final-turnover semantics; add explicit future-arrival preparation only if approved.                          | Daily turnover would make an occupied room appear available/dirty incorrectly.          | Final checkout task uniqueness and no-midstay-turnover tests.                                 |
|  34 | Access pass              | `API_VALIDATION`     | `apps/api/src/booking/services/booking-access-pass.service.ts:1-100`                                                  | Signed HMAC token and QR SVG                                                             | Pass carries booking id/version/expiry and is generated on demand; no plaintext credential is stored.                                 | One pass authorizes one booking/stay, not a new pass per night.                                               | Define one stay pass with booking-bound version and server revocation checks.                                     | Introducing per-night codes increases revocation and support complexity.                | Token tamper, wrong booking, version revocation, and multi-night validity tests.              |
|  35 | Access expiration        | `API_VALIDATION`     | `apps/api/src/booking/services/booking-detail.service.ts:115-137`                                                     | `getAccessPass`                                                                          | Access expires at `checkOut + 1h` and is null for non-CONFIRMED/revoked bookings.                                                     | Expiry is tied to final checkout, not a nightly boundary.                                                     | Keep server-derived final expiry and make T-30 issuance a separate approved capability.                           | A worker failure must not extend access beyond the stored expiry.                       | Expiry boundary tests and revoked/checkout states.                                            |
|  36 | Workers/scheduling       | `WORKER_LIMIT`       | `apps/worker/src/scheduler/worker-scheduler.ts:3-4,141-202`, `apps/worker/src/main.ts:65-110`                         | `HOLD_EXPIRATION`, `OUTBOX_DELIVERY`, `PAYMENT_RECONCILIATION`, `HOUSEKEEPING_REMINDERS` | Four job families are registered; no V3 T-30 or daily-stay job exists.                                                                | Existing jobs operate on one booking/payment lifecycle; no per-night split is present.                        | Add only approved idempotent jobs after the synchronous booking path is proven.                                   | Worker failure must not invalidate booking, room continuity, payment, or access safety. | Scheduler unit tests plus integration/operational evidence before enabling.                   |
|  37 | Audit/outbox             | `DATABASE_LIMIT`     | `packages/database/src/schema.ts:1471-1498`, lifecycle service                                                        | `auditEvents`, outbox writes                                                             | Lifecycle transitions write append-only audit and outbox events.                                                                      | One booking produces one transition history, not one event chain per night.                                   | Add event version/payload fields only if needed; preserve append-only behavior.                                   | Event payloads can leak internal pricing or room identifiers.                           | Audit immutability, outbox idempotency, and redaction tests.                                  |
|  38 | Feature flags            | `API_VALIDATION`     | `packages/config/src/index.ts`, `apps/api/src/pricing-policy/pricing-policy.gate.ts`                                  | `OPERATIONS_V3_PRICING_CATALOG_RUNTIME`                                                  | A server-owned gate exists and defaults to false; it protects the internal catalog lookup and is not wired to public routes.          | Public multi-night remains disabled while the gate is false.                                                  | Enable only after the approved Admin API/public phases provide complete contracts and rollback evidence.          | A frontend-only flag could create unsupported quotes or holds.                          | Gate-off, guarded internal lookup, and rollback tests.                                        |
|  39 | i18n/Vietnamese copy     | `COPY_ONLY`          | `apps/web/src/lib/i18n/messages.ts:134-135,1155-1157`                                                                 | `search.overnightOneNightTitle/Help`                                                     | Copy says the system currently supports one-night stays; fixed-window labels are localized.                                           | Copy accurately describes the current capability and must not be silently changed before B0.                  | Add separate multi-night copy, policy explanations, and safe error messages after server support.                 | Copy-only changes can misrepresent capability and create unsupported demand.            | Vietnamese/English key completeness and rendered error tests.                                 |
|  40 | Tests                    | `TEST_ONLY`          | `apps/api/test`, `apps/web/test`, `packages/contracts/test`, `apps/worker/test`, `packages/database/test/integration` | Stay-policy, pricing, web search, permissions, worker, DB integration suites             | Tests cover one-night validation, pricing, web copy, permissions, lifecycle, and worker behavior; DB integration requires a test URL. | Existing one-night tests are regression locks; they do not prove multi-night end-to-end behavior.             | Add a layered B0 matrix before enabling the flag; do not weaken one-night tests.                                  | Aggregate/cached green output is not proof of DB or external-provider readiness.        | Run focused unit/contract, API, web, worker, and DB commands separately.                      |

## B0 vertical-slice contract

B0 must prove one complete customer journey for **one stay = one booking = one
room throughout**:

`public interval input → server policy validation → exact pricing eligibility →
complete-interval room-type availability → immutable quote → transactional HOLD
revalidation → exactly one physical room → one booking → one inventory block →
one payment aggregate → lifecycle`.

The selection order is mandatory: (1) valid under property policy and exact
pricing eligibility, (2) complete-interval room-type availability with
existential same-room continuity, (3) cheapest among the remaining eligible
plans. A cheaper split-room or partially priced candidate is invalid, not a
fallback. Quote stores no physical room identity; HOLD is the first physical
room reservation point.

The B0 API must be server-authoritative for interval validity, room continuity,
pricing, quote expiry, HOLD allocation, payment state, cancellation, access
expiry, and lifecycle transitions. The browser may request and display these
facts but may not calculate or mutate authoritative price/payment/room state.

The B0 lifecycle has no daily re-check-in, no daily checkout, no automatic room
move, no per-night booking rows, and no existing-booking repricing. A
multi-night booking is one immutable commercial fact with one room and one
half-open inventory block.

## Ordered B0 checkpoints

These checkpoints refine `14_IMPLEMENTATION_PLAN.md`. B0.1 is the current
authorized contract/policy foundation; later checkpoints remain future work.

| Checkpoint                         | Required files/scope                                                                                                            | Stop condition                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| B0.1 Contract and policy           | `packages/contracts/src/pricing.ts`, `apps/api/src/pricing/stay-policy.ts`, shared error mapping                                | Stop if one-night regression, offset parsing, or effective max-stay authority is not deterministic.                             |
| B0.2 Pricing components            | Implemented `packages/database/src/schema.ts`, `drizzle/0029_operations_v3_pricing_policy_release.sql`, guarded migration tests | Stop runtime rollout if release identity, coverage/billing fields, prices, graph bounds, or immutability are not authoritative. |
| B0.3 Availability continuity       | `apps/api/src/pricing/availability.repository.ts`, booking availability repository                                              | Stop if a result can span different rooms or ignore any sub-interval maintenance/block overlap.                                 |
| B0.4 Quote snapshot                | quote service/repository/contracts and a new versioned snapshot field/table                                                     | Stop if quote reads can reprice or if old quote snapshots cannot be decoded.                                                    |
| B0.5 HOLD/booking                  | `packages/booking/src/services/create-booking-hold.ts`, booking repository, booking contracts                                   | Stop if a multi-night request creates more than one booking or more than one active room block.                                 |
| B0.6 Payment                       | payment aggregate/service/webhook boundary and demo/provider feature gate                                                       | Stop if browser returns can mutate state or payment is not attached to the one booking total.                                   |
| B0.7 Customer/admin read surfaces  | customer contracts/service, admin DTO/UI, permission inventory                                                                  | Stop if physical room/maintenance/pricing internals leak to public customers or viewer permissions expand.                      |
| B0.8 Lifecycle/access/housekeeping | lifecycle service, access pass, turnover task, worker jobs only where approved                                                  | Stop if daily re-check-in, automatic room move, mid-stay turnover, or unsafe access extension is possible.                      |
| B0.9 Test gates                    | contract/API/web/worker/DB integration/Playwright suites                                                                        | Stop if any focused regression fails, DB URL is absent, or only cached/aggregate output is available.                           |
| B0.10 Rollout/rollback             | feature flag, observability, runbook, migration journal/snapshot, rollout docs                                                  | Stop and keep flag off if external provider, test DB, or rollback evidence is missing.                                          |

## Required B0 migration and rollout discipline

The planned migration groups are: (A) additive pricing component/policy
metadata, (B) snapshot/version compatibility, (C) indexes/constraints only
after query evidence, and (D) audit/outbox payload versioning if required.
Every new Drizzle migration must be paired with its metadata snapshot and must
not edit a historical journal entry. Existing booking facts remain immutable.

Rollout is flag-off by default, then internal/admin shadow verification, then a
small customer cohort, followed by an explicit stop/go review. Rollback turns
off new multi-night intake and preserves already-created bookings for normal
lifecycle handling; it does not delete rows, rewrite prices, move rooms, or
split bookings. External provider readiness, test database availability, and
production migration approval are separate gates from local code/test results.

## B0 correction completion boundary

This trace is the governing B0 sequence. The additive catalog schema/migration,
explicit local bootstrap, pricing composition, quote, HOLD, booking, payment,
physical-room allocation, public-gated UI, and lifecycle/cancellation evidence
are implemented locally. It does not authorize production writes, deployment,
commit, or push changes.
