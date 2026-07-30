# Phase 7G - Admin booking operations handoff

**Phase identifier:** `phase-7g-admin-booking-operations-v1`
**Status:** Complete
**Date:** 2026-07-27

## Scope delivered

Phase 7G closes the ADMIN booking-operations vertical:

1. ADMIN booking list, filters and pagination.
2. ADMIN booking detail.
3. Cancel HOLD (with reason).
4. Cancel CONFIRMED (with reason).
5. Check-in CONFIRMED booking.
6. Check-out CHECKED_IN booking.
7. Mark CONFIRMED booking NO_SHOW (at or after expected check-in).
8. Create OPEN operational review for paid confirmed cancellation.
9. List, inspect and resolve operational reviews.
10. Append booking lifecycle audit events.
11. Complete ADMIN Web UI for the four flows.
12. Prove transactions, concurrency, authorization and browser flows.
13. Update demo lifecycle.
14. Run complete regression and close the phase.

## Out of scope (per Phase 7G spec)

- Automatic refunds.
- Customer cancellation, modification, rescheduling, reassignment.
- Local CUSTOMER passwords.
- Translation / coupon email campaigns.
- MANAGER / RECEPTIONIST roles.
- Deployment / SSL automation / multi-property / microservices / Kafka /
  event sourcing / mobile app.

## Implementation map

| Surface           | File(s)                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| DB migration      | `packages/database/drizzle/0015_phase7g_admin_booking_operations.sql`                                                   |
| Schema            | `packages/database/src/schema.ts` (new enums, new `operational_reviews` table, new booking columns + check constraints) |
| Contracts         | `packages/contracts/src/admin-booking-operations.ts`                                                                    |
| Permissions       | `packages/auth/src/permissions.ts` (added `booking.lifecycle.*`, `booking.review.*`)                                    |
| Repository        | `apps/api/src/booking/repositories/admin-booking.repository.ts`                                                         |
| Service           | `apps/api/src/booking/services/admin-booking-lifecycle.service.ts`                                                      |
| Property context  | `apps/api/src/catalog/property-context.service.ts`                                                                      |
| Errors            | `apps/api/src/booking/admin-booking.errors.ts`                                                                          |
| Controller        | `apps/api/src/booking/admin-booking-operations.controller.ts`                                                           |
| Module wiring     | `apps/api/src/booking/booking.module.ts`                                                                                |
| Problem-details   | `apps/api/src/errors/problem-details.filter.ts`                                                                         |
| Web client        | `apps/web/src/lib/admin-api.ts`                                                                                         |
| Web list          | `apps/web/src/app/admin/bookings/page.tsx`                                                                              |
| Web detail        | `apps/web/src/app/admin/bookings/[bookingCode]/page.tsx`                                                                |
| Web review list   | `apps/web/src/app/admin/operational-reviews/page.tsx`                                                                   |
| Web review detail | `apps/web/src/app/admin/operational-reviews/[reviewId]/page.tsx`                                                        |
| Layout nav        | `apps/web/src/app/admin/layout.tsx`                                                                                     |
| Playwright        | `tests/e2e/phase-7g-admin-booking-operations.spec.ts`                                                                   |
| Demo smoke        | `scripts/demo/smoke.mjs` (+20 records), `scripts/demo/lifecycle-test.mjs` (expects 20/20)                               |
| ADR               | `docs/architecture/adr/ADR-0009-admin-booking-lifecycle.md`                                                             |
| API contract      | `docs/engineering/admin-api-contract.md`                                                                                |
| RBAC              | `docs/security/AUTH_RBAC_POLICY.md` (Phase 7G section appended)                                                         |
| Runbook           | `docs/runbooks/phase-7g-admin-operations-demo.md`                                                                       |
| Validation report | `docs/audit/phase-7g-validation-report.md`                                                                              |
| Verdicts          | `docs/handoffs/phase-7g-verdicts.md`                                                                                    |

## Transactional shape

Every mutation runs inside one PostgreSQL transaction:

1. Authenticated active ADMIN verified against RBAC.
2. Property resolved from actor context.
3. `SELECT ... FOR UPDATE` on `bookings` row.
4. Reload allocation (`room_inventory_blocks`), coupon application,
   payment (`payments`), review state.
5. Validate current state vs the booking transition matrix.
6. Update booking row (timestamps, status, reason).
7. Apply inventory / coupon effects (release, preserve, etc).
8. Append scrubbed `audit_events` row.
9. Append transactional outbox event for downstream listeners.
10. Commit.

## Reuse notes

- Audit appending reuses the existing `audit-events` service.
- Outbox enqueue reuses the existing outbox table.
- Coupon release reuses `booking_coupon_applications`.
- Inventory release reuses `room_inventory_blocks`.
- ProblemDetails filter is reused; only new error types are mapped.
- ADMIN shell, layout, design tokens are reused verbatim.

## Operational review semantics

- One OPEN review per `(booking_id, category)` enforced by partial unique
  index `operational_reviews_booking_open_uq`.
- Resolve requires active ADMIN + non-empty note + book-keeping columns.
- Resolve does not touch booking, payment, coupon, or provider-event
  history.

## Locked decisions

See `ADR-0009-admin-booking-lifecycle.md` and
`docs/superpowers/specs/2026-07-27-phase-7g-admin-booking-operations-design.md`.
