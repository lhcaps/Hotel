# Repository-specific B0.2 catalog schema correction

Status: B0 local implementation complete. The additive Drizzle schema,
generated 0029 migration, matching snapshot/journal/provenance entry, custom
PostgreSQL guards, V1-derived draft bootstrap, published composer, Admin API,
public multi-night gate, quote/HOLD/booking/payment/access/lifecycle path, and
guarded disposable tests are present. The migration, bootstrap, public gate,
commit, push, and deployment remain local/unreleased actions.

Production must use the prepared rollout runbook in
`13_ROLLOUT_AND_ROLLBACK.md`; it must not depend on a seed script or direct SQL.

## Current B0 release boundary

Migration 0029, its matching snapshot/journal/provenance, V1-derived
development-only DRAFT bootstrap, published policy lookup, composer, Admin API,
same-room availability, quote V2, HOLD/booking/payment/access/lifecycle, and
whole-booking cancellation are implemented locally and verified with guarded
disposable PostgreSQL. The catalog/public gates default OFF; production
migration, bootstrap, configuration, deployment, commit, and push were not
performed. V1 hourly/overnight behavior and old snapshots remain unchanged.

## Existing repository authority

The current Drizzle schema is `packages/database/src/schema.ts`. The migration
journal is `packages/database/drizzle/meta/_journal.json`, currently through
`0028_admin_v2_membership_bootstrap`. Existing custom SQL includes the
`btree_gist` extension, physical-room interval exclusion, append-only audit
events, and immutable booking price/interval facts.

### Current catalog map

| Current object                    | Actual fields/behavior                                                                                                                                                                                       | B0.2 disposition                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `properties`                      | `id`, code/name, `timezone`, minimum/maximum stay, minimum lead time, maximum advance days, default overnight duration, ACTIVE/INACTIVE catalog status                                                       | Reusable property/policy reference. A release snapshots `timezone`; stay-policy values remain the property-policy authority until a separate policy-release decision. |
| `price_tiers`                     | Property-owned `id`, code/name, sort order, ACTIVE/INACTIVE status; unique `(property_id, code)` and `(property_id, id)`                                                                                     | Reusable room-class/price-tier reference. `room_types.price_tier_id` remains the room-class link.                                                                     |
| `rate_plans`                      | Mutable DRAFT/ACTIVE/INACTIVE row with code/name, `included_duration_minutes` 60-1,440 in 15-minute steps, priority, `is_base_plan`, min/max duration, local check-in window, source evidence and timestamps | V1-only source and legacy provenance. It is not a release, has no effective interval, repetition bound, adjacency, or immutable version.                              |
| `rate_plan_prices`                | Property/rate-plan/price-tier composite references, positive `bigint` VND amount, VND currency, unique plan/tier                                                                                             | V1-only price rows. Reusable price-tier ownership pattern; not copied into a component rule.                                                                          |
| `ratePlanStatus`/`catalogStatus`  | Existing enums are `DRAFT/ACTIVE/INACTIVE` and `ACTIVE/INACTIVE`                                                                                                                                             | Existing V1 status enums remain unchanged; the release lifecycle uses a separate `DRAFT/PUBLISHED/RETIRED/CANCELLED` enum.                                            |
| Current Admin pricing API         | `GET/POST /admin/rate-plans`, price and selection-rule PATCH/PUT, activate/inactivate; permissions `pricing.rate_plan.read/manage`; service locks current rate-plan rows and validates the tentative V1 set  | Remains unchanged for V1. A future policy-release admin flow is additive and must not bypass the existing permission/audit boundary.                                  |
| Current pricing repository/engine | `RatePlanRepository` reads/locks mutable plan rows; `QuoteRepository.catalogFor` reads plans/prices and currently also reads rooms/blocks; matcher chooses one base plus optional `EXTRA_HOUR`               | V1 behavior only. B0.2 pricing must read a published release and must not include room/availability facts.                                                            |
| Current snapshots                 | `quotes.pricing_snapshot` JSONB stores legacy `pricing.ruleVersion`, one base/extra line shape and amounts; `bookings.price_snapshot` copies the quote and `bookings.pricing_rule_version` is immutable      | Read legacy snapshots exactly as written. New release provenance is additive and must never reprice old rows.                                                         |
| Existing PostgreSQL invariants    | `btree_gist`; active physical-room `[start,end)` exclusion; append-only `audit_events`; booking price/interval/room facts immutable through triggers                                                         | Reuse the extension and conventions. Migration 0029 adds release exclusion/immutability only on the new catalog tables.                                               |

The development seed shows `STANDARD`, `DELUXE`, and `SIGNATURE` price tiers,
and legacy `NIGHT_COMBO`, `DAY_COMBO`, and `EXTRA_HOUR` prices. Those values are
evidence of V1 fixtures, not authorization to infer B0.2 component semantics.
No automatic transformation of codes, labels, or `is_base_plan` is allowed.

## Root aggregate: `pricing_policy_versions`

Every new catalog is one immutable release aggregate rooted at
`pricing_policy_versions`:

| Column                    | Type/constraint                                                                        | Rule                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                      | `uuid` primary key                                                                     | Stable release identity used in provenance.                                                                                                      |
| `property_id`             | `uuid` not null, FK `properties(id)`                                                   | Property scope; also unique with `id` for composite child FKs.                                                                                   |
| `version_number`          | positive `bigint` not null                                                             | Monotonic per property, unique `(property_id, version_number)`, never edited or reused by application flows. Allocate under a property row lock. |
| `internal_name`           | non-empty text                                                                         | Admin-only release name; not pricing authority.                                                                                                  |
| `status`                  | new enum `pricing_policy_version_status`: `DRAFT`, `PUBLISHED`, `RETIRED`, `CANCELLED` | `PUBLISHED` means commercially immutable and potentially current, future, or ended; `CANCELLED` is excluded from lookup and exclusion.           |
| `applicability_basis`     | constrained text: `QUOTE_INSTANT` or `STAY_START`                                      | The server uses exactly one explicit basis for the complete candidate; no unspecified timestamp fallback.                                        |
| `effective_from`          | `timestamptz` not null                                                                 | Inclusive release validity start.                                                                                                                |
| `effective_until`         | `timestamptz` nullable                                                                 | Exclusive validity end; null is open-ended.                                                                                                      |
| `timezone_snapshot`       | non-empty text not null                                                                | IANA timezone captured from `properties.timezone` at publication.                                                                                |
| `rule_schema_version`     | constrained text not null                                                              | Schema discriminator, e.g. `operations-v3-b0.2-policy-v1`; not the release identity and not a free-form policy version string.                   |
| `created_by`              | `uuid` not null, FK `users(id)`                                                        | Draft author.                                                                                                                                    |
| `created_at`              | `timestamptz` not null                                                                 | Creation audit fact.                                                                                                                             |
| `updated_at`              | `timestamptz` not null                                                                 | Mutable only while DRAFT; freeze trigger protects it after publication.                                                                          |
| `published_by`            | nullable `uuid`, FK `users(id)`                                                        | Set only on DRAFT to PUBLISHED transition.                                                                                                       |
| `published_at`            | nullable `timestamptz`                                                                 | Set only on publication.                                                                                                                         |
| `retired_at`              | nullable `timestamptz`                                                                 | Set only on PUBLISHED to RETIRED transition.                                                                                                     |
| `retired_by`              | nullable `uuid`, FK `users(id)`                                                        | Set only on PUBLISHED to RETIRED transition.                                                                                                     |
| `cancelled_by`            | nullable `uuid`, FK `users(id)`                                                        | Set only on DRAFT to CANCELLED in migration 0029; scheduled PUBLISHED cancellation is deferred to a future migration/app phase.                  |
| `cancelled_at`            | nullable `timestamptz`                                                                 | Cancellation audit fact; cancellation never deletes or rewrites a release.                                                                       |
| `cancellation_reason`     | nullable bounded text                                                                  | Required for cancellation and immutable after cancellation.                                                                                      |
| `change_note`             | nullable text, bounded                                                                 | Human change reason; immutable after publication.                                                                                                |
| `legacy_provenance`       | nullable strict `jsonb` object                                                         | Optional source references/evidence; never semantic inference.                                                                                   |
| `maximum_component_lines` | positive integer, default 64, max 64                                                   | Global candidate graph safety bound.                                                                                                             |

The release identity is the referenced `(id, version_number)` pair. It is not
an unreferenced mutable string. `rule_schema_version` is a controlled schema
token only.

The root has checks for `effective_until > effective_from` when present,
positive version/line bounds, non-empty text, and lifecycle metadata:

- DRAFT has no publication, retirement, or cancellation timestamps/users;
- PUBLISHED has publication metadata and no retirement or cancellation metadata;
- RETIRED has publication and retirement metadata, with retirement not earlier
  than publication;
- CANCELLED has cancellation metadata, has never been used for pricing lookup
  or produced an accepted snapshot, and is immutable; DRAFT cancellation is
  the normal abandonment path; migration 0029 does not support
  PUBLISHED -> CANCELLED;
- `timezone_snapshot` is a valid IANA timezone and must equal the current
  property timezone during publication.

The migration-0029 lifecycle is exactly `DRAFT -> PUBLISHED`,
`DRAFT -> CANCELLED`, and `PUBLISHED -> RETIRED`. `PUBLISHED -> CANCELLED`,
including scheduled cancellation before `effective_from`, is deferred to a
future migration/app phase with typed snapshot usage, no-gap, and
reconciliation safeguards. No other transition is allowed. Draft creation and editing occur only through
an authorized application flow. Publication validates the complete aggregate
in one transaction. Commercial content is immutable after publication. A
correction creates a new DRAFT with a new monotonic version; it never edits a
published release. Retirement is allowed only after the interval has ended and
does not change the effective interval.

## Effective-period constraint

Use explicit columns, not a generated range column, because the existing schema
uses `timestamptz` columns and nullable half-open validity patterns. The exact
future PostgreSQL constraint is:

```sql
CONSTRAINT pricing_policy_versions_published_no_overlap
EXCLUDE USING gist (
  property_id WITH =,
  tstzrange(
    effective_from,
    COALESCE(effective_until, 'infinity'::timestamptz),
    '[)'
  ) WITH &&
)
WHERE (status IN ('PUBLISHED', 'RETIRED'))
```

`btree_gist` already exists in `0001_custom_invariants.sql`. The constraint is
deliberately keyed by property because one property has exactly one published
applicability basis. Published and historical intervals for a property cannot
overlap, while DRAFT and CANCELLED intervals are excluded. New pricing lookup
requires `status = PUBLISHED`, the property-authoritative basis, and the
explicit authoritative instant inside the half-open interval; RETIRED remains
historical explainability rather than new lookup authority. Half-open touching
intervals `[a,b)` and `[b,c)` are valid. The basis field remains explicit
provenance and lookup configuration, but is not an exclusion key.

Therefore a future PUBLISHED successor is not selectable before its
`effective_from`; the old PUBLISHED policy remains selectable before cutover;
the successor is selectable at cutover; and the old policy is not selectable
at or after its closed `effective_until`. A failed cutover leaves the old
PUBLISHED interval and lookup behavior unchanged.

An open-ended PUBLISHED policy is not a permanent exclusion deadlock. The
authorized cutover transaction first closes the old policy at an explicit
cutover while keeping it PUBLISHED, then publishes the successor at that same
instant. The closure is allowed only as a one-way move from null/later
`effective_until` to an earlier future or immediate cutover `T` with
`T >= effective_from` and `T >= transaction_time`. Extension of a published
interval is forbidden. The final exclusion check validates the closed old
interval and successor interval together.

The successor lifecycle is explicit: before the cutover transaction commits,
the successor is `DRAFT`; after a successful commit, it is `PUBLISHED`. The
server-owned reader excludes that future PUBLISHED successor before its
`effective_from`, selects it at the exact cutover, and never substitutes a
DRAFT row. The deferred final-state closure check therefore requires the
matching same-property/basis successor to be PUBLISHED, not merely present as
a DRAFT.

### One applicability basis per property

Schema version 1 supports both `QUOTE_INSTANT` and `STAY_START`, but a property
may have only one basis across its PUBLISHED and RETIRED lineage. The preferred
implementation is a PostgreSQL publication trigger backed by the property-row
lock already required by publication:

- the first PUBLISHED policy establishes the property's basis;
- any later PUBLISHED or RETIRED policy must match that established basis;
- a DRAFT may preview either basis, but publication fails if it differs;
- concurrent publication attempts serialize on the property row, so only one
  first basis can win and a second basis cannot bypass the rule through SQL;
- the basis is immutable after publication;
- changing basis requires a separately approved property-level conversion after
  old schedules and accepted snapshots are assessed.

The request client never chooses the basis. The pricing service does not query
both bases or choose whichever produces a result. The trigger and publication
transaction jointly enforce the property invariant; the exclusion constraint
then uses property plus interval across all PUBLISHED and RETIRED rows.

## Child table: `pricing_policy_components`

Each component belongs to exactly one release. Ownership is inherited through
`policy_version_id`; this table contains no `property_id`, `price_tier_id`,
`amount_vnd`, physical-room identity, availability fact, mutable policy-version
string, or mutable rule-version string.

| Column                              | Type/constraint                                                             | Rule                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`                                | `uuid` primary key                                                          | Immutable component source id.                                                           |
| `policy_version_id`                 | `uuid` not null, FK `pricing_policy_versions(id)`                           | Release owner; also part of a unique `(policy_version_id, id)` key.                      |
| `component_code`                    | uppercase bounded text                                                      | Unique inside one release; stable source code, not a legacy-code inference.              |
| `component_kind`                    | constrained text: `BASE_STAY` or `EXTENSION`                                | Small B0 vocabulary; publication rejects other kinds.                                    |
| `coverage_model`                    | constrained text: `FIXED_ELAPSED`, `LOCAL_CLOCK_WINDOW`, `REQUEST_BOUNDARY` | Selects exactly one coverage field shape.                                                |
| `billing_model`                     | constrained text: `FIXED_OCCURRENCE` or `STARTED_UNIT`                      | Exact first-release billing vocabulary; exact-unit billing is not supported yet.         |
| `fixed_duration_minutes`            | nullable integer                                                            | Required only for `FIXED_ELAPSED`, positive and 15-minute aligned.                       |
| `local_start_minute_inclusive`      | nullable integer                                                            | Required only for `LOCAL_CLOCK_WINDOW`, 0-1,425 and 15-minute aligned.                   |
| `local_end_minute_exclusive`        | nullable integer                                                            | Required only for `LOCAL_CLOCK_WINDOW`, 15-1,440 and 15-minute aligned.                  |
| `local_end_day_offset`              | nullable small integer                                                      | Required only for `LOCAL_CLOCK_WINDOW`, exactly 0 or 1.                                  |
| `boundary_position`                 | nullable text: `LEADING` or `TRAILING`                                      | Required only for `REQUEST_BOUNDARY`; one leading and one trailing boundary at most.     |
| `boundary_min_duration_minutes`     | nullable integer                                                            | Required for a boundary, positive and 15-minute aligned.                                 |
| `boundary_max_duration_minutes`     | nullable integer                                                            | Required for a boundary, aligned and >= minimum.                                         |
| `billing_unit_minutes`              | nullable integer                                                            | Required only for `STARTED_UNIT`, positive 15-minute aligned; null for fixed occurrence. |
| `minimum_billing_units`             | nullable positive integer                                                   | Optional lower bound on derived started-unit billing quantity; not occurrence count.     |
| `maximum_billing_units`             | nullable positive integer                                                   | Optional upper bound on derived started-unit billing quantity; not occurrence count.     |
| `maximum_occurrences_per_candidate` | positive integer <= 64                                                      | `1` means non-repeatable; bounded repetition is explicit.                                |
| `condition_complexity_rank`         | integer 0-1,000                                                             | Stable ranking input after price and validity.                                           |
| `tie_break_rank`                    | integer 0-1,000,000                                                         | Explicit catalog tie-break, not display order.                                           |
| `restriction_metadata`              | strict non-empty-or-empty `jsonb` object                                    | Versioned condition schema; no room/availability fields.                                 |
| `display_metadata`                  | strict `jsonb` object                                                       | Explanation label/template metadata only; never pricing authority.                       |
| `legacy_provenance`                 | nullable strict `jsonb` object                                              | Optional V1 source id/code/evidence; no automatic semantic conversion.                   |
| `created_at`, `updated_at`          | `timestamptz`                                                               | Draft audit only; frozen after publication.                                              |

For B0.2, a `LOCAL_CLOCK_WINDOW` is validated against the server-authoritative
IANA timezone. If that timezone has seasonal offset changes, publication fails
closed with `DST_UNRESOLVED_LOCAL_CLOCK_WINDOW`; B0.2 does not guess whether a
wall-clock minute is ambiguous or nonexistent without a dated resolution
policy. Fixed-offset property timezones remain eligible. This is a validation
guard only and does not read availability, room, or booking data.

The strict display shape is limited to keys such as `labelKey`,
`explanationKey`, and `sortOrder`. The strict restriction shape is approved
separately and must not duplicate room capacity or physical-room data.

Coverage and billing field validation is described in
`08_PRICING_OPTIMIZER_SPEC.md`. `maximum_occurrences_per_candidate` is the
sole occurrence authority and repetition requires an explicit self-edge.
`billing_unit_minutes` plus the optional minimum/maximum billing units govern
STARTED_UNIT quantity. Charged duration and `displayNightCount` are never
coverage authority.

`REQUEST_BOUNDARY` is deliberately two-sided: `LEADING` starts at the exact
request check-in and ends at the next component start; `TRAILING` starts at the
prior component end and ends at the exact request check-out. Each boundary
position is allowed at most once, requires the corresponding explicit edge,
and is forbidden in the middle of a candidate. Leading and trailing approval,
price, and restrictions are independent; one side is never inferred from the
other.

## Price table: `pricing_policy_component_prices`

Do not duplicate a component for Standard, Deluxe, and Signature. Store one
component rule and one price row per allowed tier:

| Column                     | Type/constraint    | Rule                                                                                                                             |
| -------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | `uuid` primary key | Price source id.                                                                                                                 |
| `policy_version_id`        | `uuid` not null    | Composite FK with `component_id` to the same release.                                                                            |
| `component_id`             | `uuid` not null    | Component owner.                                                                                                                 |
| `property_id`              | `uuid` not null    | Denormalized integrity key only; must equal the policy property and price-tier property. It is not a second ownership authority. |
| `price_tier_id`            | `uuid` not null    | Existing property-owned price tier.                                                                                              |
| `amount_vnd`               | positive `bigint`  | Safe integer VND amount; no currency column because the repository is VND-only.                                                  |
| `created_at`, `updated_at` | `timestamptz`      | Draft audit only; frozen after publication.                                                                                      |

Required constraints:

- unique `(policy_version_id, component_id, price_tier_id)`;
- composite FK `(policy_version_id, component_id)` to
  `pricing_policy_components(policy_version_id, id)`;
- composite FK `(policy_version_id, property_id)` to
  `pricing_policy_versions(id, property_id)`;
- composite FK `(property_id, price_tier_id)` to
  `price_tiers(property_id, id)`;
- `amount_vnd > 0` and within the repository safe bigint/JS conversion limit;
- no fallback price and no cross-tier inheritance;
- publication requires one price for each tier the approved matrix marks as
  eligible.

The current `price_tiers` composite ownership is sufficient when repeated in
this price row as an integrity key. A single `price_tier_id` FK would permit a
cross-property substitution and is not acceptable.

## Directed edge table: `pricing_policy_component_edges`

An edge authorizes one component to immediately follow another inside the same
release. The minimum model needs only directed adjacency, so no transition-kind
enum, per-edge effective interval, or per-edge tie-break is added.

| Column                     | Type/constraint                | Rule                                                              |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `id`                       | `uuid` primary key             | Edge source id.                                                   |
| `policy_version_id`        | `uuid` not null                | Release owner.                                                    |
| `predecessor_component_id` | `uuid` not null                | Immediately prior component.                                      |
| `successor_component_id`   | `uuid` not null                | Immediately following component.                                  |
| `restriction_metadata`     | nullable strict `jsonb` object | Omitted unless a future approved adjacency restriction is needed. |
| `created_at`, `updated_at` | `timestamptz`                  | Draft audit only; frozen after publication.                       |

Required constraints:

- unique `(policy_version_id, predecessor_component_id, successor_component_id)`;
- composite FKs for both endpoints to
  `pricing_policy_components(policy_version_id, id)`;
- no cross-property edge because the policy owns both endpoints;
- self-edge is permitted only when the component's
  `maximum_occurrences_per_candidate > 1`; repetition is never inferred from a
  billing unit or from a legacy code;
- all non-self cycles are rejected by application publication validation;
- self-repeat is bounded by the component occurrence limit and the release's
  `maximum_component_lines`;
- a `LEADING` boundary has no predecessor and may have one or more explicitly
  approved successor edges;
- a `TRAILING` boundary may have one or more explicitly approved predecessor
  edges and has no successor edge;
- a boundary component cannot self-edge, appear in the middle, or be duplicated
  at the same boundary position;
- each candidate follows exactly one selected boundary edge; catalog alternatives
  remain bounded by the release graph limit and are never inferred from code,
  price, kind, or display label;
- no edge has an effective interval independent of its immutable release.

The publication validator performs a directed-cycle check. A cycle involving
two or more component ids is invalid. A self-edge is the only allowed cycle
and is safe only with an explicit occurrence limit; boundary components are
never self-repeating. The composer carries occurrence counts and derived
billing quantities in its state, stops at the release line bound, and never
performs unbounded graph traversal.

## Publication validation

### PostgreSQL constraints

PostgreSQL owns scalar and ownership invariants: effective interval ordering,
published interval exclusion, lifecycle metadata shape, enum/check vocabularies,
non-empty codes, unique component codes, positive/aligned numeric values,
field-nullability combinations, composite ownership FKs, unique prices, unique
directed edges, and positive integer VND amounts.

### Application transaction validation

The authorized publication service locks the property row, the target DRAFT,
all its components/prices/edges, and all same-property published policies that
could conflict, in one transaction. It then proves:

- the complete release is present and structurally valid;
- timezone is valid and matches the property at publication;
- `applicability_basis` is explicit and is one of `QUOTE_INSTANT` or
  `STAY_START`; the candidate uses one server-authoritative instant and one
  policy release only;
- the policy basis matches the property's established PUBLISHED/RETIRED
  lineage, or establishes the basis when this is the first publication;
- every required eligible tier has exactly one positive price;
- every edge belongs to the release and graph cycles are rejected/bounded;
- no intended-use component is unreachable and no edge leads to an impossible
  component;
- the release line bound prevents candidate explosion;
- restriction and display objects match the approved strict schemas;
- no catalog row contains room id/code, maintenance, inventory, lock, or
  availability data;
- deterministic tie-break keys are unique enough for stable ordering;
- effective interval does not overlap any PUBLISHED or RETIRED release.

For a future supersession, the same transaction chooses an explicit cutover,
closes a previous open-ended or later-ending PUBLISHED policy under the
one-way closure rule while retaining PUBLISHED status, publishes the successor
at the cutover, validates half-open adjacency, writes
an audit/outbox record containing policy ids, basis, cutover, and actor, and
commits atomically. It never rewrites an accepted snapshot. PostgreSQL
exclusion is the last defense against concurrent schedule overlap. Preview runs
the same validation against an unpublished DRAFT without publishing or changing
customer pricing.

Graph-wide validation is not placed in fragile row triggers. Trigger checks
protect immutability, scalar ownership, and one-basis publication; the
application transaction owns complete-policy, tier, reachability, and graph
validation.

## Immutability mechanism

The future custom SQL adds a freeze trigger to the root and each child table:

- root DELETE is rejected for every status;
- DRAFT root updates are allowed only for draft fields and preserve id,
  property, version number, creator, and creation time;
- DRAFT -> PUBLISHED permits only status plus publication metadata;
- DRAFT -> CANCELLED permits only status plus cancellation metadata and a
  bounded reason;
- PUBLISHED -> RETIRED permits only status plus retirement metadata after the
  finite interval has ended;
- PUBLISHED -> CANCELLED is rejected by migration 0029; scheduled cancellation
  is deferred to a future migration/app phase;
- PUBLISHED/RETIRED content, `effective_from`, timezone, rule schema, and
  `updated_at` are rejected; arbitrary interval extension is always rejected;
- PUBLISHED schedule closure keeps status PUBLISHED and may change only
  `effective_until` through the authorized supersession transaction;
- component, price, and edge INSERT/UPDATE/DELETE is allowed only while the
  parent release is DRAFT;
- child mutations after publication raise a PostgreSQL exception even when SQL
  bypasses the application.

The closure trigger permits a PUBLISHED `effective_until` change only when the
value moves from null/later to an earlier future or immediate cutover `T` with
`T >= effective_from` and `T >= transaction_time`, the authorized supersession
transaction is active, and a matching same-property/established-basis DRAFT
successor starts at that cutover. There is no standalone terminal closure
operation in migration 0029. It never changes status during closure and never permits extension. A separate
retirement trigger permits only PUBLISHED -> RETIRED when the interval is
finite and `effective_until <= transaction_time`; it cannot edit the interval.
The application enforces actor permissions and writes append-only
`audit_events` for draft creation, draft edit, preview validation, publication,
supersession, cancellation, retirement, and rejected publication. Corrections
always create a new DRAFT release. No unrestricted `updated_at` mutation
remains on published rows.

## Snapshot provenance

The future internal candidate and quote snapshot contain:

```json
{
  "snapshotSchemaVersion": "operations-v3-pricing-snapshot-v2",
  "policy": {
    "id": "uuid",
    "versionNumber": 7,
    "ruleSchemaVersion": "operations-v3-b0.2-policy-v1",
    "applicabilityBasis": "STAY_START",
    "applicabilityInstant": "instant",
    "observedEffectiveInterval": { "from": "instant", "until": "instant|null" }
  },
  "propertyId": "uuid",
  "timezone": "Asia/Ho_Chi_Minh",
  "requestedInterval": { "checkIn": "instant", "checkOut": "instant" },
  "components": [
    {
      "sourceId": "uuid",
      "code": "approved-code",
      "contentDigest": "sha256",
      "coverageModel": "LOCAL_CLOCK_WINDOW",
      "billingModel": "FIXED_OCCURRENCE",
      "interval": { "checkIn": "instant", "checkOut": "instant" },
      "boundaryPosition": null,
      "occurrenceCount": 1,
      "billingUnitQuantity": 1,
      "unitAmountVnd": 1000000,
      "lineAmountVnd": 1000000,
      "restrictions": {}
    }
  ],
  "durationMinutes": 2880,
  "displayNightCount": 2,
  "totalAmountVnd": 1000000,
  "candidateId": "stable digest",
  "selectionRationale": { "ranking": "..." }
}
```

It contains no physical room id/code, room selection, availability claim,
client amount, or mutable display-only authority. `applicabilityBasis` and
`applicabilityInstant` identify why the one release was selected, while the
observed effective interval records what the server saw at quote time.
`policy.id` and
`versionNumber` are the referenced release identity; the component row id,
code, full approved content digest, and ordered lines preserve provenance
after later releases change the catalog.

The existing V1 quote and booking snapshots remain readable by the current
legacy parser. No V1 snapshot is backfilled or repriced. The new reader is
version-aware: it accepts legacy `pricing.ruleVersion` and the future v2
object, and HOLD continues to copy the immutable quote snapshot rather than
recalculating it.

## V1 compatibility and business catalog approval

Legacy `rate_plans` and `rate_plan_prices` remain authoritative only for
existing V1 hourly/overnight behavior. The local B0 bootstrap reads actual
technical V1 rows only as explicit provenance for a DRAFT; it never publishes
automatically, and is development/loopback/explicit-opt-in only. No backfill
may infer component kind, repetition, adjacency, effective period, billing,
or restrictions from `NIGHT_COMBO`, `DAY_COMBO`, `EXTRA_HOUR`, labels, or
`isBasePlan`.

The following is an approval matrix, not seed data. Every unresolved cell is
explicitly `REQUIRES_BUSINESS_APPROVAL`.

| Proposed component code          | Customer-visible name               | Legacy source candidate                 | Coverage / boundary position                                                   | Billing / billing unit                                                | Min/max billing units | Max occurrences                               | Allowed predecessors                                 | Allowed successors                                 | Applicability basis                                | Local window / duration                       | Allowed price tiers           | Restrictions                            | Unresolved decisions                                                                                                         |
| -------------------------------- | ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------- | --------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | --------------------------------------------- | ----------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `MN_LOCAL_WINDOW_BASE`           | Multi-night local-window stay       | `NIGHT_COMBO` provenance candidate only | `LOCAL_CLOCK_WINDOW`; exact local times `REQUIRES_BUSINESS_APPROVAL`           | `FIXED_OCCURRENCE`; no billing unit                                   | null / null           | 31 candidate occurrences, subject to approval | None                                                 | Reviewed self-edge/continuation set                | `QUOTE_INSTANT` or `STAY_START` pending approval   | Window choice `REQUIRES_BUSINESS_APPROVAL`    | Active tiers only if approved | Strict restrictions only; no room facts | Window, basis, eligible edges, tier eligibility, price, occurrence bound, and labels: `REQUIRES_BUSINESS_APPROVAL`           |
| `MN_FIXED_ELAPSED_BASE`          | Multi-night elapsed-duration stay   | `DAY_COMBO` provenance candidate only   | `FIXED_ELAPSED`; exact duration `REQUIRES_BUSINESS_APPROVAL`                   | `FIXED_OCCURRENCE`; no billing unit                                   | null / null           | Release line/occurrence bound                 | None                                                 | Reviewed self-edge/continuation set                | `QUOTE_INSTANT` or `STAY_START` pending approval   | Duration `REQUIRES_BUSINESS_APPROVAL`         | Active tiers only if approved | Strict restrictions only                | Duration, basis, eligible edges, tier eligibility, price, repetition, and display: `REQUIRES_BUSINESS_APPROVAL`              |
| `MN_LEADING_BOUNDARY_EXTENSION`  | Leading request-boundary extension  | `EXTRA_HOUR` provenance candidate only  | `REQUEST_BOUNDARY`; `LEADING`; exact request check-in to next component        | `STARTED_UNIT`; `billing_unit_minutes` and rounding approval required | Optional / optional   | 1                                             | None                                                 | Reviewed successor set, one selected per candidate | Same explicit basis as candidate, pending approval | Boundary min/max `REQUIRES_BUSINESS_APPROVAL` | Active tiers only if approved | No availability or room facts           | Whether leading extension, successor set, bounds, unit, price, and restrictions are allowed: `REQUIRES_BUSINESS_APPROVAL`    |
| `MN_TRAILING_BOUNDARY_EXTENSION` | Trailing request-boundary extension | `EXTRA_HOUR` provenance candidate only  | `REQUEST_BOUNDARY`; `TRAILING`; prior component end to exact request check-out | `STARTED_UNIT`; `billing_unit_minutes` and rounding approval required | Optional / optional   | 1                                             | Reviewed predecessor set, one selected per candidate | None                                               | Same explicit basis as candidate, pending approval | Boundary min/max `REQUIRES_BUSINESS_APPROVAL` | Active tiers only if approved | No availability or room facts           | Whether trailing extension, predecessor set, bounds, unit, price, and restrictions are allowed: `REQUIRES_BUSINESS_APPROVAL` |

No row is seeded until the matrix is explicitly approved. Existing demo price
amounts are not copied into the matrix as production prices.

## Proposed migration plan after approval

### Drizzle and SQL files implemented locally

The local implementation adds the four tables, release enums, explicit basis,
lifecycle metadata, boundary fields, and separated occurrence/billing fields
to `packages/database/src/schema.ts`. It generated
`packages/database/drizzle/0029_operations_v3_pricing_policy_release.sql`,
`packages/database/drizzle/meta/0029_snapshot.json`, and one journal entry;
`packages/database/drizzle/migration-provenance.json` records the new SQL
hash. The new tables are included in the database schema export. No catalog
rows are created.

### Implemented custom SQL

The custom portion reuses `btree_gist` without recreating it and adds:

1. the published-policy exclusion constraint keyed by property and half-open
   interval, covering `PUBLISHED` and `RETIRED` while excluding `DRAFT` and
   `CANCELLED`;
2. lifecycle checks for `DRAFT/PUBLISHED/RETIRED/CANCELLED`, cancellation fields,
   basis values, boundary fields, and separated billing fields;
3. a root publication/basis/controlled-closure/retirement trigger and child
   freeze triggers for policy/components, prices, and edges;
4. indexes for property/status/effective-interval lookup, basis consistency,
   and successor cutover validation;
5. guarded SQL validation queries used only by disposable PostgreSQL tests.

The closure guard is a deferred constraint trigger: a PUBLISHED closure must
have a matching PUBLISHED successor with the exact cutover in the final
transaction state. Migration 0029 has no standalone terminal closure and does
not support `PUBLISHED -> CANCELLED`; scheduled cancellation is deferred to a
future typed-snapshot/no-gap/reconciliation phase.

No trigger performs graph-wide publication graph validation. No direct
production SQL workflow bypasses the future application publication service.

### Keys, indexes, and lock impact

Required indexes are:

- unique `(property_id, version_number)` and unique `(id, property_id)` on the
  root;
- `(property_id, status, effective_from)` for schedule lookup;
- `(property_id, applicability_basis)` for one-basis consistency validation;
- unique `(policy_version_id, component_code)` and unique
  `(policy_version_id, id)` on components;
- unique `(policy_version_id, component_id, price_tier_id)` and
  `(property_id, price_tier_id)` on prices;
- unique `(policy_version_id, predecessor_component_id,
successor_component_id)` plus predecessor/successor lookup indexes on edges for
  cutover and boundary-path validation.

The migration creates empty tables and indexes, so it has no existing booking,
quote, room, inventory, or payment table rewrite. DDL still takes normal
catalog/table creation locks and must run in a maintenance-safe deployment
window. Activation and supersession lock only the property/release/catalog
rows; they do not lock physical rooms, inventory, quotes, or bookings. B0.3/HOLD
locks remain separate. The closure and successor publication occur in one
transaction so an open-ended old policy cannot remain an exclusion deadlock.

### Backfill, deployment, and feature gate

Backfill is `NONE`. Do not seed release rows, convert legacy plan rows, or
rewrite snapshots. The local rollout order is:

1. approve the business matrix and schema;
2. run migration preflight and disposable PostgreSQL checks;
3. keep production reads disabled while local disposable gates are tested;
4. use the development-only V1-derived bootstrap for DRAFT creation only, or
   create a reviewed DRAFT through the authorized Admin API;
5. preview and publish a release only after complete validation;
6. verify public interval, offer, quote, HOLD, booking, payment, access,
   lifecycle, cancellation, and UI locally behind explicit server gates;
7. keep production multi-night disabled until the complete local evidence is
   reviewed and the explicit release approval is granted.

The repository has server-owned fail-closed catalog, internal multi-night,
public multi-night, and bootstrap gates. They default to false; no
`NEXT_PUBLIC_*` flag is authoritative and a client environment variable is not
sufficient.

### Validation queries and forward fix

Disposable PostgreSQL validation must prove: no same-property published
interval overlap; one applicability basis across PUBLISHED/RETIRED lineage;
touching intervals are accepted; no open-ended supersession deadlock; closure
is one-way and never an extension; no premature retirement; no lifecycle
metadata contradiction; monotonic/unique versions per property; no component
code duplicate; no nullability/model contradiction; all composite ownership
FKs; no missing eligible tier price; positive safe VND; no cross-property
price/edge; no illegal cycles/self-edge or boundary edge; no inactive source in
a published release; and no catalog column/payload containing room or
availability data. Tests must also prove `CANCELLED` releases are not lookup
or exclusion candidates and cancellation does not rewrite snapshots.

If a defect is found after deployment, disable new release reads, preserve all
published rows and snapshots, and ship a new forward migration/application fix
after preflight. Never edit a released migration, journal entry, snapshot, or
active release.

### Rollback limitations

Before any public quote, rollback disables the policy-release reader and leaves
V1 behavior active. After internal or future customer snapshots exist,
rollback cannot delete or rewrite those snapshots, reverse an external
booking, or mutate a PUBLISHED/RETIRED release. The legacy reader must continue
serving V1 rows, and any published release correction requires a new release
or a forward reconciliation plan.
