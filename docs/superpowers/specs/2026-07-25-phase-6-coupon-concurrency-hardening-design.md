# Phase 6C — Coupon Concurrency Hardening Design Addendum

**Status:** Approved for implementation
**Date:** 2026-07-25
**Addendum to:** [Phase 6C core design](2026-07-25-phase-6-coupon-core-design.md)
**Starting baseline:** `cb29dc0b9439a9f3dd27cf253c01bcf609943f4d`
**Branch:** `phase5-booking-hold-guest-access`

## 1. Purpose

This addendum closes three Coupon Core defects observed during implementation
of the Phase 6C base design and locks the canonical PostgreSQL lock order,
first-reference serialization, and DISABLED terminal-state policy. It does not
re-open any locked decision from the base design.

The three defects are:

1. **First-reference race.** The existing
   `reject_referenced_coupon_scope_mutation` and
   `reject_referenced_coupon_economic_mutation` triggers use `SELECT EXISTS`
   against `quotes` and `booking_coupon_applications`. A concurrent
   first-reference transaction that has not yet committed is invisible to the
   trigger of the would-be mutator. Both transactions can commit, leaving the
   quote snapshot and the application history referencing a different
   economic configuration than the one the mutator just chose to author.
2. **DISABLED → ACTIVE bypass.** The existing schema permits a direct
   `UPDATE coupons SET status = 'ACTIVE'` when an ADMIN bypasses the
   application layer. The `coupons_disabled_at_ck` check rejects that change
   only because `disabled_at` would still be set, but a direct SQL worker can
   clear `disabled_at` to bypass the lifecycle.
3. **Stale-HOLD cleanup does not release coupon quota.** The booking HOLD
   `cleanupStaleHolds` function transitions stale bookings to `EXPIRED` and
   releases their inventory blocks but never invokes coupon application
   release. As a result, quota consumed by a stale HOLD booking remains
   counted until the global worker batch expires it, even when the same
   allocation transaction is authorized to release the holding coupon quota
   immediately.

## 2. Strict scope boundary

This addendum closes:

- first-reference race serialization;
- DISABLED terminal-state policy and re-enable rejection;
- stale-HOLD cleanup ordering before coupon quota counting;
- redemption primitive verification (no route);
- ADMIN coupon API/OpenAPI closure.

It explicitly stops before:

- public coupon Web UI (Stage I);
- payment, MoMo, VNPAY, webhook/IPN, OAuth/profile work;
- coupon email distribution;
- automated refund restoration.

## 3. First-reference serialization

### 3.1 New column

Add `coupons.first_referenced_at` (timestamptz, nullable).

- `NULL` means no committed or in-flight serialized first reference has yet
  established economic immutability.
- The first quote reference or first booking-application reference that wins
  the row lock sets
  `first_referenced_at = COALESCE(first_referenced_at, CURRENT_TIMESTAMP)`.
- The column is monotonic and cannot be cleared or moved backwards.
- ADMIN disable is allowed after `first_referenced_at` is non-null; it does
  not transition the coupon back to mutable.
- Mutation of every economic field, lifecycle timestamp, or scope row is
  rejected when `first_referenced_at` is non-null.

### 3.2 Why the existing `SELECT EXISTS` trigger is insufficient

A `SELECT EXISTS` query in a `BEFORE UPDATE` trigger only sees the result
of transactions that have already committed. If transaction A holds the
first-reference lock and inserts a `booking_coupon_applications` row, that
row is invisible to transaction B until A commits. If B's UPDATE runs
concurrently with A and B's read of the row precedes A's commit, both
transactions observe the same `(id, definition)` set and both can commit.

The fix is to serialize all first reference attempts behind the coupon row
itself:

1. First-reference writer takes `SELECT ... FOR UPDATE` on the coupon row.
2. Inside the trigger or repository code, after acquiring the lock, set
   `first_referenced_at = COALESCE(first_referenced_at, CURRENT_TIMESTAMP)`.
3. All scope-mutation triggers and the economic-mutation trigger check
   `first_referenced_at IS NOT NULL` instead of `SELECT EXISTS`.

The mutation triggers now check `first_referenced_at IS NOT NULL` rather
than running a correlated existence query. This makes the decision
dependent on the row state that the mutator's own transaction is about to
overwrite, which is itself guarded by the `FOR UPDATE` lock the mutator
acquired implicitly or explicitly.

### 3.3 First-reference trigger coverage

The first-reference trigger covers, at minimum, the following direct SQL
paths:

- `INSERT INTO booking_coupon_applications` (BEFORE INSERT trigger).
- `INSERT INTO quotes` with non-null `coupon_id` (BEFORE INSERT trigger).
- `UPDATE quotes SET coupon_id = ...` (BEFORE UPDATE trigger; permitted
  only by quote immutability).

The trigger function must:

- `SELECT id FROM coupons WHERE id = NEW.coupon_id FOR UPDATE` to lock the
  parent coupon row.
- Update `first_referenced_at = COALESCE(first_referenced_at, CURRENT_TIMESTAMP)`.
- Return `NEW` unchanged.

The trigger does not validate quote immutability. The existing
quote-immutability trigger must remain authoritative.

### 3.4 Coupon row scope mutation locking

`coupon_room_types` insert/update/delete triggers must lock the parent
coupon row before deciding whether mutation is allowed:

- For `INSERT`/`UPDATE`, lock `coupons` row matching `NEW.coupon_id` with
  `SELECT ... FOR UPDATE`.
- For `UPDATE` that changes `coupon_id`, lock both `OLD.coupon_id` and
  `NEW.coupon_id` rows in deterministic `uuid` order to avoid
  cross-coupon deadlocks.
- For `DELETE`, lock the `OLD.coupon_id` row.
- Reject mutation when `first_referenced_at IS NOT NULL`.

The triggers must not use dynamic SQL built from trigger values.

## 4. Terminal-state policy

### 4.1 DISABLED invariant

- `ACTIVE → DISABLED` is allowed.
- `DISABLED → DISABLED` is idempotent and produces no audit event.
- `DISABLED → ACTIVE` is rejected at the database boundary.
- `disabled_at` cannot be cleared after a coupon has been disabled. A direct
  UPDATE that clears `disabled_at` is rejected.
- An existing `RESERVED`/`ASSOCIATED` application may still be redeemed or
  released according to lifecycle policy.
- New `booking_coupon_applications` inserts for a `DISABLED` coupon are
  rejected by the application-insert trigger.

### 4.2 Trigger replacement

The existing `reject_referenced_coupon_economic_mutation` trigger is
replaced (not layered). The new trigger:

- rejects any update to a protected economic field when
  `first_referenced_at IS NOT NULL`; and
- rejects any direct `DISABLED → ACTIVE` transition; and
- rejects any direct clearing of `disabled_at` once set.

The existing `reject_referenced_coupon_scope_mutation` trigger is
replaced. The new trigger:

- locks the parent coupon row first;
- rejects any insert/update/delete when `first_referenced_at IS NOT NULL`;
- handles `UPDATE` that changes `coupon_id` with deterministic parent
  lock order.

### 4.3 `coupon_room_types` UPDATE that changes parent

For `UPDATE coupon_room_types SET coupon_id = ...`:

- Lock both `OLD.coupon_id` and `NEW.coupon_id` rows.
- Use deterministic order: `ORDER BY id` (or `ORDER BY id::text` if needed
  to enforce a known collation).
- `first_referenced_at IS NOT NULL` on either parent rejects the mutation.

INSERT/DELETE keep using `NEW.coupon_id`/`OLD.coupon_id` lock respectively.

### 4.4 Schema version

The original Phase 6C hardening schema version is `phase-6-coupon-core-v2`
(introduced by migration 0009). Migration 0010 closes the application
insert / ADMIN disable race that the two-trigger design in 0009 still
allowed; it bumps the schema to `phase-6-coupon-core-v3`. A database at
`phase-6-coupon-core-v1` or `v2` reports `ready: false` until 0010 is
applied.

## 5. Canonical lock order

Quote issuance, booking HOLD, expiration worker, ADMIN disable, ADMIN
mutation, and coupon redemption all share the same resource universe. The
canonical lock order below is the only order permitted.

### 5.1 HOLD canonical order

1. `SELECT CURRENT_TIMESTAMP` (database time, no locks).
2. `SELECT ... FROM quotes WHERE id = :id FOR UPDATE` (quote lock).
3. `SELECT FROM bookings WHERE quote_id = :id` (existing-booking check).
4. If existing booking, compare immutable contact and return idempotent
   result or `QUOTE_ALREADY_USED` **before** any current coupon state
   revalidation.
5. Validate quote expiry, immutability, currency, and snapshot.
6. `SELECT FROM rooms WHERE id IN (...) FOR UPDATE SKIP LOCKED` (find
   structurally eligible candidate rooms).
7. Targeted stale-HOLD cleanup:
   - `SELECT FROM bookings WHERE status = 'HOLD' AND hold_expires_at <=
CURRENT_TIMESTAMP AND room_type_id = ... FOR UPDATE OF bookings
SKIP LOCKED`;
   - transition stale bookings to `EXPIRED`;
   - release inventory blocks;
   - **release coupon applications** via
     `UPDATE booking_coupon_applications SET application_status =
'RELEASED', quota_reserved = false, released_at = CURRENT_TIMESTAMP
WHERE booking_id IN (...) AND application_status IN ('ASSOCIATED',
'RESERVED')`;
   - write `HOLD_EXPIRED` and `COUPON_RELEASED` audit events.
8. Probe `findRemainingTargetedStaleHold`; if a relevant stale row is still
   locked, return `STALE_HOLD_CLEANUP_RETRY` and commit no other writes.
9. Lock the coupon definition row `SELECT ... FOR UPDATE`.
10. Revalidate coupon status, validity, scope, hold-window compatibility.
11. Count `RESERVED` + `REDEEMED` applications under the coupon row lock.
12. Enforce total and per-customer quota.
13. Recalculate coupon result from authoritative gross amount.
14. Compare against immutable quote coupon snapshot; drift raises
    `COUPON_REQUOTE_REQUIRED`.
15. Lock/select physical room (`FOR UPDATE SKIP LOCKED`).
16. Insert booking.
17. Insert booking contact.
18. Insert room inventory block.
19. Insert coupon application.
20. Insert audit events.
21. Insert outbox event.
22. Commit.

The design must explain why quota counting occurs only after stale release:
the stale release step releases the quota held by expired coupon
applications for the same coupon whose quota is being counted. Counting
before the release would report a stale `RESERVED` row as still consuming
quota even though the same transaction has the authority to release it.
This produces a false `COUPON_LIMIT_REACHED` response when the only
consuming application belongs to a stale HOLD that this allocation
transaction is authorized to release.

### 5.2 Lock graph

| Operation         | Resource                      | Lock mode                                    | Canonical order       |
| ----------------- | ----------------------------- | -------------------------------------------- | --------------------- |
| Quote issuance    | `coupons`                     | `FOR UPDATE` (only when coupon code present) | n/a (no booking lock) |
| Booking HOLD      | `quotes`                      | `FOR UPDATE`                                 | 2                     |
| Booking HOLD      | `bookings`                    | `SELECT` (existing)                          | 3                     |
| Booking HOLD      | `rooms`                       | `FOR UPDATE SKIP LOCKED`                     | 6, 15                 |
| Booking HOLD      | `bookings` (stale)            | `FOR UPDATE OF bookings SKIP LOCKED`         | 7                     |
| Booking HOLD      | `booking_coupon_applications` | `UPDATE WHERE booking_id`                    | 7                     |
| Booking HOLD      | `coupons`                     | `FOR UPDATE`                                 | 9                     |
| Booking HOLD      | `booking_coupon_applications` | `INSERT` (new)                               | 19                    |
| Expiration worker | `bookings` (stale)            | `FOR UPDATE OF bookings SKIP LOCKED`         | 1                     |
| Expiration worker | `booking_coupon_applications` | `UPDATE WHERE booking_id`                    | 2                     |
| ADMIN disable     | `coupons`                     | `FOR UPDATE`                                 | 1                     |
| ADMIN mutation    | `coupons`                     | `FOR UPDATE`                                 | 1                     |
| ADMIN mutation    | `coupon_room_types` (parent)  | `FOR UPDATE` (single or both)                | 2                     |
| Coupon redemption | `booking_coupon_applications` | `FOR UPDATE`                                 | 1                     |
| Coupon redemption | `coupons`                     | none (status read only)                      | n/a                   |

Competing paths acquire rows in the same canonical order: `quotes` →
`coupons` → `bookings` → `booking_coupon_applications`. Any deviation
creates a deadlock risk.

### 5.3 Deadlock prevention

- All paths that touch both `coupons` and `booking_coupon_applications`
  acquire the coupon row first.
- All paths that touch both `coupons` and `coupon_room_types` acquire the
  coupon row first.
- ADMIN `coupon_room_types` UPDATE that changes parent acquires both
  parent rows in deterministic UUID order.
- The expiration worker never holds a long-lived transaction. It
  processes batches under `SKIP LOCKED` and never waits on a row.

## 6. Backfill

Migration 0009 backfills `first_referenced_at` for already-referenced
coupons:

- `NULL` when no quote or application references exist.
- For referenced coupons, set `first_referenced_at = MIN(quote.created_at,
application.created_at)` derived from the minimum committed timestamp
  available. When application timestamps are not yet authoritative
  (pre-0009), use `CURRENT_TIMESTAMP` and document the approximation in
  the migration header comments.
- Never rewrite historical discount/quote snapshots.

## 7. Trigger inventory

Before 0009:

- `coupons_scope_consistency` (CONSTRAINT TRIGGER, AFTER INSERT/UPDATE).
- `coupon_room_types_scope_consistency` (CONSTRAINT TRIGGER,
  AFTER INSERT/UPDATE/DELETE).
- `coupons_reject_referenced_economic_mutation` (BEFORE UPDATE).
- `coupon_room_types_reject_referenced_mutation` (BEFORE INSERT/UPDATE/DELETE).
- `booking_coupon_applications_validate_insert` (BEFORE INSERT).
- `booking_coupon_applications_protect_update` (BEFORE UPDATE).

After 0009:

- `coupons_scope_consistency` (unchanged behavior).
- `coupon_room_types_scope_consistency` (unchanged behavior).
- `coupons_reject_referenced_economic_mutation` (replaced; now also
  rejects DISABLED → ACTIVE and clears of `disabled_at`).
- `coupon_room_types_reject_referenced_mutation` (replaced; now locks
  parent and uses `first_referenced_at`).
- `mark_coupon_first_referenced_on_quote_insert` (BEFORE INSERT ON
  quotes, when `coupon_id IS NOT NULL`).
- `mark_coupon_first_referenced_on_application_insert` (BEFORE INSERT ON
  booking_coupon_applications).
- `booking_coupon_applications_validate_insert` (extended: rejects inserts
  when coupon is `DISABLED`).
- `booking_coupon_applications_protect_update` (unchanged).

The migration MUST NOT leave two contradictory scope-mutation triggers
active. The replacement uses `DROP TRIGGER IF EXISTS ... ;
CREATE TRIGGER ...` to ensure the old trigger is removed.

## 8. Schema readiness

`EXPECTED_SCHEMA_VERSION = 'phase-6-coupon-core-v3'` (post migration
0010). A database at `phase-6-coupon-core-v1` or `v2` is not ready.
The migration bumps `schema_metadata.schema_version` to ensure
forward-only progression.

## 9. Stage boundaries

This addendum ends at the ADMIN coupon API/OpenAPI commit. It does not
implement the public coupon Web UI, payment, email distribution, or
refund restoration. The redemption primitive is not exposed through HTTP.
