# Phase 7G - Admin booking operations runbook

**Audience:** SRE / on-call admin
**Scope:** Operating the ADMIN booking-operations vertical in the
disposable demo environment (`scripts/demo/start.mjs`).

## What Phase 7G adds

- ADMIN can list bookings with bounded pagination and stable ordering.
- ADMIN can inspect booking detail with safe fields only.
- ADMIN can cancel a HOLD booking with a reason.
- ADMIN can cancel a CONFIRMED booking with a reason. A paid
  cancellation opens an OPEN `operational_reviews` row.
- ADMIN can check in a CONFIRMED booking.
- ADMIN can check in / check out a CONFIRMED / CHECKED_IN booking.
- ADMIN can mark a CONFIRMED booking NO_SHOW at or after expected check-in.
- ADMIN can list / inspect / resolve OPEN operational reviews.

## Pre-flight

1. `pnpm install` (workspace).
2. `pnpm --filter @room/database db:migrate`.
3. `pnpm --filter @room/database db:seed:development` (dev-only data).
4. `pnpm demo:start` (boots disposable DB + API + Web + Worker on
   3100 / 3101).
5. `pnpm demo:preflight`.

## Smoke

`pnpm demo:smoke` exercises the public booking hold + the ADMIN coupon
and ADMIN booking/review list endpoints. Expect 20/20 PASS.

## Manual admin booking lifecycle (demo)

1. Open `http://127.0.0.1:3100/admin/bookings` as ADMIN.
2. Pick a CONFIRMED booking, open the detail page.
3. Click **Check in**, observe status flip to `CHECKED_IN` and
   `checked_in_at` populated.
4. Click **Check out**, observe status flip to `CHECKED_OUT` and
   `checked_out_at` populated.
5. On a second CONFIRMED booking, click **Mark no-show**, supply a
   reason; observe status flip to `NO_SHOW` only when server time is at
   or after expected check-in.
6. Cancel a paid CONFIRMED booking with a reason; observe the booking
   becomes `CANCELLED`, payment remains `SUCCEEDED`, and an OPEN review
   appears in `/admin/operational-reviews`.
7. Resolve the review with a note; observe status flips to `RESOLVED`,
   resolver id and resolved_at persisted, payment untouched.

## Common failure modes

- **No-show rejected**: server time is before expected check-in. Wait
  until the booking's check-in moment or use a booking whose check-in
  has already passed.
- **Illegal transition**: state was changed by another admin/worker
  between detail load and form submit. Reload the detail page; the
  authoritative state is what the API returns, not the cached UI.
- **Review already resolved**: another admin resolved the same review.
  Reload the list to pick an OPEN review.
- **Permission denied**: the actor lacks the required permission. They
  are redirected to a safe error.

## Audit expectations

Every transition writes an `audit_events` row whose payload contains
only safe fields (no provider secrets, no raw provider payloads, no
session tokens, no OTP digests). The booking detail page exposes this
timeline.

## Outbox expectations

Each successful transition enqueues an outbox event:
`booking.cancelled`, `booking.checked_in`, `booking.checked_out`, or
`booking.no_show`. Workers consume these asynchronously.

## Playwright evidence

`pnpm --filter @room/e2e test:e2e -- tests/e2e/phase-7g-admin-booking-operations.spec.ts`
runs the focused browser spec and reports counts.