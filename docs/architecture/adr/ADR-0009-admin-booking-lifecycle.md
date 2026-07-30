# ADR-0009 - Admin booking lifecycle and operational review

**Status:** Accepted
**Date:** 2026-07-27

## Decision

Phase 7G closes the ADMIN booking-operations vertical. The work adds the
booking state transitions that are NOT auto-driven by the public booking
flow:

- HOLD → CANCELLED (with reason)
- CONFIRMED → CANCELLED (with reason)
- CONFIRMED → CHECKED_IN
- CONFIRMED → NO_SHOW (with reason, at or after expected check-in)
- CHECKED_IN → CHECKED_OUT

Each transition is implemented as a single PostgreSQL transaction with
row-level locking (`SELECT ... FOR UPDATE`) on the booking row, a fresh
reload of allocation, coupon, payment, and review state, exactly one
state mutation, inventory / coupon effects, a scrubbed audit event, and
where established, a transactional outbox event.

The full lifecycle is exposed through `GET/POST /api/v1/admin/bookings/:bookingCode/{cancel,check-in,check-out,no-show}`.

### Allowed transitions

- HOLD → CANCELLED
- CONFIRMED → CANCELLED
- CONFIRMED → CHECKED_IN
- CONFIRMED → NO_SHOW
- CHECKED_IN → CHECKED_OUT

All other transitions are rejected with `409 Conflict` (booking transition
error). The browser never submits an authoritative target state; the API
command determines the transition server-side.

### Inventory and coupon effects

- Cancel HOLD: room allocation released, RESERVED coupon reservation
  released, audit appended, no payment-related side effects.
- Cancel CONFIRMED: room allocation released, SUCCEEDED payment preserved
  untouched, redeemed coupon preserved untouched, exactly one OPEN
  operational review opened when a SUCCEEDED payment is linked, audit
  appended.
- Check-in: room inventory blocking preserved (guest is still in the
  room), audit appended.
- Check-out: room inventory blocking released, audit appended.
- NO_SHOW: room inventory blocking released, payment truth preserved,
  audit appended.

No automatic refund. No payment re-attempt. No coupon restoration.
The provider-event history is never rewritten.

### Operational review model

`operational_reviews` is a property-scoped record that opens automatically
for every paid CONFIRMED cancellation. The table has:

- `booking_id` and `payment_id` foreign keys
- `category` (only `PAID_CANCELLATION` for now)
- `status` (`OPEN` / `RESOLVED`)
- `opened_at`, `opened_reason`
- `resolved_at`, `resolver_id`, `resolved_note`
- A partial unique index that guarantees at most one OPEN review per
  `(booking_id, category)`

Resolving an OPEN review requires an active authorised ADMIN, a non-empty
note, and writes the resolver id and timestamp. The booking, payment,
coupon, and provider-event history are left untouched.

The browser never sees provider secrets, raw provider payloads, session
tokens, OTP digests, guest-session digests, stack traces, or SQL details.
The API returns safe structured problem-details on every error path.

### Database impact

Forward migration `0015_phase7g_admin_booking_operations` adds:

- `bookings.cancelled_at`, `checked_in_at`, `checked_out_at`, `no_show_at`,
  `cancellation_reason` plus per-field check constraints that link each
  timestamp to its status.
- `operational_reviews` table with categories `PAID_CANCELLATION` and
  statuses `OPEN` / `RESOLVED`, FKs to properties, bookings, payments,
  users, plus integrity constraints on the resolved timestamp, resolver,
  note, and payment linkage.
- Indexes for the ADMIN list and review list filters.

Migrations 0001-0014 are untouched. The schema-version marker advances to
`phase-7g-admin-booking-operations-v1`. The historical-migration-identity
test confirms the migration file remains byte-identical with its
original commit.

## Consequences

- ADMIN booking list, detail, and lifecycle actions are reachable
  through `AdminPermissionGuard` and the new permissions
  `booking.lifecycle.read`, `booking.lifecycle.manage`,
  `booking.review.read`, `booking.review.manage`. Missing or disabled
  ADMIN sessions are rejected.
- The CUSTOMER ownership column from Phase 7F is the read-time filter for
  `/api/v1/customer/bookings`; Phase 7G does not modify CUSTOMER
  access. CUSTOMER cannot reach any `/api/v1/admin/*` route.
- The transactional outbox pattern established in earlier phases is
  reused; each lifecycle mutation appends `booking.cancelled`,
  `booking.checked_in`, `booking.checked_out`, or `booking.no_show`
  events.
- The audit log becomes the single source of truth for every booking
  transition. No out-of-band state changes are possible.
- A late verified payment callback cannot confirm a cancelled booking:
  the reconciliation logic uses the same `SELECT ... FOR UPDATE` + state
  guard that the lifecycle mutations use.
