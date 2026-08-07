# Access-control boundary

## Current repository capability

`bookings.access_pass_version` and `bookings.access_pass_revoked_at` were added by `packages/database/drizzle/0022_booking_access_pass.sql`. `BookingAccessPassService.issue/verify` creates an HMAC-SHA256 token containing only `bookingId`, version, and expiry (`apps/api/src/booking/services/booking-access-pass.service.ts:19-83`). Customer and guest detail services issue it only for `CONFIRMED` bookings and set expiry to `booking.checkOut + 60 minutes` (`booking-detail.service.ts:115-137`; `customer-booking.service.ts:455-475`). Admin scan resolves the signed booking reference server-side.

The current B0 release candidate supports one continuous booking-scoped HMAC
entitlement: the expiry spans the complete booking interval and issuance is on
demand. It does not implement a T-30 scheduler or real smart-lock/provider
credentials; those provider capabilities remain deferred and are not claimed
as implemented.

## B0 compatibility boundary

B0 must preserve one booking-scoped continuous access entitlement under the existing mechanism where possible:

1. The booking remains one `CONFIRMED` aggregate with one immutable `checkOut`.
2. Every generated pass uses the same booking id/version and the full booking checkout-plus-grace expiry.
3. Cancellation/revocation and terminal lifecycle states remain server-authoritative.
4. No daily QR, nightly re-check-in, room code, provider secret, or client-controlled expiry is introduced.
5. Add tests proving a two/three-night booking has one entitlement window and that expiry is based on final checkout, not each night.

No B0 migration is required for this compatibility path. If a provider requires a persisted credential or T-30 job, that is `DEFER_REQUIRES_EXTERNAL_PROVIDER` and belongs to the separately approved access phase. A minimal foundation may be proposed only after a real provider contract proves it unavoidable.

## Later provider phase

The later phase must define provider adapter, property/room mapping, pre-arrival offset, grace period, idempotency key, retries/backoff, health/outage state, revocation, audit, and operational exception handling. The worker currently has no access job; adding one is a later change to `WorkerSchedulerJobName`, `worker-runner.ts`, and `main.ts`.
