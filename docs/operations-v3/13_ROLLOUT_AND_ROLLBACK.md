# Rollout, rollback, and reconciliation

## Current B0 local status

B0 is implemented and verified only on guarded disposable PostgreSQL and local
test servers. The public multi-night gate remains OFF by default; current V1
hourly/overnight requests continue using their existing selector. Local B0
verification covers public interval, offer, quote, HOLD, booking, payment,
access, check-in, final checkout, cancellation, and one turnover.

No production migration, configuration change, catalog bootstrap, data write,
deployment, commit, or push was performed.

The additive policy-release Admin API is implemented locally. It remains
server-authorized, audited, transaction-backed, and dark unless the server
catalog gate is enabled. Direct SQL and client-only flags cannot create or
publish a release.

## Runtime expand sequence after separate approval

1. Approve the runtime catalog matrix and the already-verified four-table
   policy-release schema.
2. Re-run migration preflight against disposable PostgreSQL, including current
   migration provenance, lock estimates, and cross-property ownership checks.
3. The local implementation already contains one additive 0029 migration with
   the release enum, tables, composite keys, explicit applicability basis,
   effective-period exclusion, deferred exact-successor closure, DRAFT
   cancellation, and immutability triggers. Keep production reads disabled;
   local disposable verification may enable the server gates explicitly.
4. Deploy draft, preview, validation, publication, supersession, retirement,
   audit, and clone-from-published application flows behind a server-owned
   fail-closed gate. Scheduled PUBLISHED cancellation remains deferred to a
   future typed-snapshot/no-gap/reconciliation phase.
5. Create only manually reviewed DRAFT releases through the authorized Admin
   flow. Do not seed or infer rows from legacy plan names.
6. Preview and atomically publish a scheduled release in an internal/admin
   environment. Verify immutable rows, policy interval selection, exact
   coverage, prices, graph bounds, and snapshot provenance.
7. Keep public multi-night dark in production until the complete local B0
   evidence is reviewed and the explicit release approval is granted. The
   local path already proves room-type continuity, quote/HOLD/booking/payment,
   and UI behavior behind server-owned gates.

The existing V1 selector and snapshots remain the compatibility fallback. A
server-owned dark release reader must select exactly one PUBLISHED policy by property,
the property's explicit `applicability_basis` (`QUOTE_INSTANT` or `STAY_START`),
and the corresponding server-authoritative instant. It must never select by
mutable label, current row update time, or an implicit timestamp. Before its
`effective_from`, a future scheduled policy is not selectable; before a future
cutover, the old PUBLISHED policy remains selectable. A multi-night candidate
never mixes policies or bases.

## V3 release lifecycle and cutover

The four-table model remains unchanged. A release is created as `DRAFT` and
may be edited or abandoned as `CANCELLED`. Publication is one transaction that
locks the property, target draft, children, and same-property PUBLISHED/RETIRED
policies that could conflict. It validates the complete catalog graph, the
property basis, prices, interval, boundaries, and quantity semantics before
publishing.

Supersession uses an explicit cutover. The old policy remains `PUBLISHED` while
its `effective_until` is closed to `T`; the successor becomes `PUBLISHED` with
`effective_from = T` in the same transaction. The closure moves only from
null/later to an earlier future or immediate cutover and never extends the
interval. Before `T`, lookup selects the old policy; at and after `T`, lookup
selects the successor. The old policy may become `RETIRED` only later, when its
finite interval has ended and retirement changes status/metadata only. Half-open
touching intervals are valid. `CANCELLED` rows are neither lookup nor exclusion
candidates. Migration 0029 rejects a standalone PUBLISHED closure and requires
an exact PUBLISHED successor in the final transaction state through a deferred
constraint trigger. It does not support `PUBLISHED -> CANCELLED`.

The successor is `DRAFT` before the cutover transaction commits and becomes
`PUBLISHED` only after that transaction commits successfully. A future
PUBLISHED successor is not selectable before `effective_from`; the deferred
closure check evaluates the final transaction state and rejects a DRAFT
successor as sufficient closure evidence.

Leading and trailing request-boundary extensions are independent catalog
components. A leading component covers request check-in to the next component;
a trailing component covers the prior component end to request check-out. Each
boundary may have multiple explicitly approved catalog edges, but each
candidate selects exactly one edge at that boundary. No boundary appears in
the middle or uses a self-edge. No terminal-only remainder semantics remain.

Occurrence count and billing-unit quantity are separate: repetition uses
`maximum_occurrences_per_candidate` plus an explicit self-edge, while
`STARTED_UNIT` derives `billingUnitQuantity` from exact elapsed coverage and
`billing_unit_minutes`. Rounding never enlarges coverage.

## Lock and table-rewrite risk

The proposed migration creates empty policy, component, price, and edge tables;
it does not rewrite `properties`, `price_tiers`, `rate_plans`,
`rate_plan_prices`, quotes, bookings, rooms, or inventory. Creation of the new
enum, tables, foreign keys, indexes, exclusion constraint, and triggers still
takes normal PostgreSQL catalog/table locks and requires a controlled
deployment window.

Policy publication and supersession lock the property row, target draft, child
rows, and same-property published/historical releases until commit. They do not lock physical
rooms, inventory blocks, quotes, bookings, payments, or HOLD allocation. The
existing room GiST exclusion remains the later availability/HOLD authority.

## Rollback before public exposure

If validation, preview, or publication fails, the transaction rolls back all
release changes. If the new reader is defective, disable the server gate and
continue V1 pricing. Do not delete release rows, edit migrations, or mutate
existing V1 snapshots.

Because published commercial content is immutable, a correction is a new DRAFT
with a new monotonic version. A schedule cutover is the sole controlled
published-interval closure exception; it cannot extend an interval or alter
accepted snapshots. If the defect is in the schema or migration, use a new
forward migration after preflight; do not edit the historical journal or
snapshot.

## Rollback after internal or future snapshots

Once a release has produced an accepted internal or customer snapshot, disable
new offers but keep the versioned reader able to explain existing snapshots.
Never reprice, delete, or rewrite them. Existing bookings must retain one
booking, one physical room, one full interval, one inventory block, and one
payment aggregate.

Reconcile explicitly:

- catalog: release id/number, component source/digest, price tier, and policy
  interval against the stored snapshot;
- inventory: only at the later booking/HOLD boundary, compare one room block
  with `bookings.room_id/check_in/check_out`;
- payments: compare the one booking aggregate and provider events; browser
  returns never mutate state;
- access and turnover: keep final-checkout expiry and one final turnover;
- audit/outbox: preserve append-only events and retry idempotently.

Rollback cannot erase an external booking, reverse a payment provider result,
or mutate a PUBLISHED/RETIRED release. Those cases require forward
reconciliation and a separately approved operational runbook.

## Observability and release gates

Before enabling any future public policy reader, monitor draft validation failures,
publication conflicts, effective-period conflicts, basis conflicts, missing tier prices,
coverage gaps/overlaps, graph-bound rejections, DST conversion failures,
candidate determinism, and snapshot provenance failures. Public metrics for
room availability, quote-to-HOLD conversion, payment, access, and turnover
remain owned by their later phases.

Required go/no-go gates are separate: catalog/business approval, disposable
PostgreSQL PASS, application validation PASS, B0.3 full-interval continuity
PASS, quote/HOLD compatibility PASS, external-provider status, human review,
and the explicit release approval token. Local design evidence is not
production readiness.
