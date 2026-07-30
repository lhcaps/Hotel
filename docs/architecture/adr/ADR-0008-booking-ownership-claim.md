# ADR-0008 - Booking ownership and guest-to-account continuity

**Status:** Accepted
**Date:** 2026-07-27

## Decision

Phase 7F makes a `bookings.customer_user_id` column the durable anchor for
CUSTOMER-owned bookings. The column is nullable so that all historical
guest bookings (created before Phase 7F) coexist with newly linked
bookings without backfill.

Booking creation accepts an optional `customerUserId` parameter sourced
exclusively server-side from an active CUSTOMER session. The browser
never sends a `customerUserId`; the API resolves it through
`CustomerSessionService` and writes the row in the same transaction that
inserts the booking.

When a CUSTOMER with an active guest session for a booking wishes to
attach that booking to their account, `ClaimBookingService` performs the
link transactionally:

1. The CUSTOMER session is verified (`status = ACTIVE`, `role = CUSTOMER`).
2. The booking is `SELECT ... FOR UPDATE`.
3. A `guest_sessions` row is verified by its `token_digest` (HMAC of the
   guest session cookie) and must point at the same booking id.
4. If `customer_user_id IS NULL`, it is set to the CUSTOMER user id.
5. If it already equals the current id, the claim is idempotent.
6. If it points to a different CUSTOMER, the call fails with
   `BOOKING_ALREADY_LINKED` and the booking is left untouched.
7. An `audit_events` row of type `BOOKING_CLAIMED` is written. The audit
   payload contains only `bookingCode` and a boolean `supportingMatch`
   flag indicating whether the CUSTOMER email matched the booking
   contact; it never contains phone, address, or the raw email.

Email match is metadata, never authorization. A CUSTOMER whose `users.email`
matches the `booking_contacts.normalized_email` of a booking they have
not been issued a guest session for is refused by step 3. Bulk-claiming
by email is impossible.

`/api/v1/customer/bookings` and `/api/v1/customer/bookings/:bookingCode`
filter exclusively on `customer_user_id = :userId`. ADMINs continue to
read bookings through the existing `/api/v1/admin/*` routes; there is no
overlap.

## Consequences

- Guest bookings (HOLD or CONFIRMED) created before Phase 7F remain valid
  and continue to be reachable through the existing OTP-based guest flow.
- A CUSTOMER claiming a booking that another CUSTOMER already owns
  receives a 409 and the link is not overwritten.
- The audit log is the source of truth for "who claimed what and when";
  the supportingMatch flag is a debugging hint, not a permission signal.
- All existing pricing, coupon, payment, worker and demo flows remain
  unchanged: `customer_user_id` is a write-time stamp and a read-time
  filter, never a calculation input.
