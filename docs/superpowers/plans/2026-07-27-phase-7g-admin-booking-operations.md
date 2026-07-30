# Phase 7G plan — Admin booking operations and operational review

**Phase:** phase-7g-admin-booking-operations-v1
**Date:** 2026-07-27
**Mission:** execute the design captured in
`docs/superpowers/specs/2026-07-27-phase-7g-admin-booking-operations-design.md`.

## Goal

Deliver one complete ADMIN booking-operations vertical:

1. ADMIN booking list, filters and pagination.
2. ADMIN booking detail.
3. Cancel HOLD.
4. Cancel CONFIRMED before check-in.
5. Check-in CONFIRMED booking.
6. Check-out CHECKED_IN booking.
7. Mark CONFIRMED booking NO_SHOW at or after expected check-in.
8. Create operational review for paid confirmed cancellation.
9. List, inspect and resolve operational reviews.
10. Append booking lifecycle audit events.
11. Complete ADMIN Web UI.
12. Prove transactions, concurrency, authorization and browser flows.
13. Update demo lifecycle.
14. Run complete regression and close the phase.

## Commit sequence (locked, suggested)

```
docs: design phase 7g admin booking operations
test: define admin booking lifecycle contracts
feat(database): add operational reviews schema (Phase 7G)
feat(booking): add transactional admin lifecycle operations
feat(api): expose admin booking and review operations
feat(auth): add booking lifecycle and review permissions
feat(web): add admin booking operations interface
test(e2e): prove admin booking lifecycle
chore(demo): exercise phase 7g lifecycle
fix: close phase 7g regression findings
docs: close phase 7g validation and handoff
```

This is the suggested sequence, not a hard count.

## Plan

### 1. Spec & design (locked)

- `docs/superpowers/specs/2026-07-27-phase-7g-admin-booking-operations-design.md`
- `docs/superpowers/plans/2026-07-27-phase-7g-admin-booking-operations.md`

Verify in the commit:

```
git show --stat <sha>
git show --name-status <sha>
git show --check <sha>
```

### 2. Permission and contracts (locked)

- `packages/auth/src/permissions.ts`:
  - add `booking.lifecycle.read`, `booking.lifecycle.manage`,
    `booking.review.read`, `booking.review.manage` to `PERMISSIONS`.
- `packages/contracts/src/admin.ts`:
  - add `AdminBookingListQuerySchema`, `AdminBookingSummarySchema`,
    `AdminBookingDetailSchema`, `AdminBookingCancelRequestSchema`,
    `AdminBookingNoShowRequestSchema`, `AdminBookingActionSchema`,
    `AdminOperationalReviewListQuerySchema`,
    `AdminOperationalReviewSummarySchema`,
    `AdminOperationalReviewDetailSchema`,
    `AdminOperationalReviewResolveRequestSchema`.
- `docs/security/AUTH_RBAC_POLICY.md`:
  - extend permission catalogue.

### 3. Database migration (locked)

- `packages/database/drizzle/0015_phase7g_admin_booking_operations.sql`
- update schema version `phase-7g-admin-booking-operations-v1`
- update `_journal.json`, regenerate `0015_snapshot.json`
- update `0001`..`0014` is forbidden.
- Add the new `bookings` columns:
  - `cancelled_at`, `checked_in_at`, `checked_out_at`, `no_show_at`,
    `cancellation_reason`.
- Add new table `operational_reviews` per the design.
- Extend `packages/database/test/integration/historical-migration-identity.test.ts`
  with the `0015` assertion.
- Verify:
  - `pnpm --filter @room/database db:check`
  - `pnpm --filter @room/database db:status`
  - `pnpm --filter @room/database test`

### 4. Repository layer (locked)

`packages/booking/src/repository/booking-repository.ts`:

- expose `lockBookingForUpdate(tx, code)` that returns the booking row +
  current status + timestamps.
- expose `releaseInventoryBlock(tx, bookingId, releasedBy)` (single source
  of truth).
- expose `markCouponApplicationReleased(tx, bookingId, releasedAt)` for
  the HOLD-cancel path.
- expose `insertOperationalReview(tx, ...)` (idempotent for the
  `(bookingId, category='PAID_CANCELLATION', status='OPEN')` triple).
- expose `resolveOperationalReview(tx, reviewId, resolverId, note)` with
  row-level lock and 409 on already-resolved.

`apps/api/src/booking/repositories/admin-booking.repository.ts` (new):

- server-side filtered list query, paginated, stable ordering.
- detail read joining `bookings`, `properties`, `room_types`, `rooms`,
  `payments`, `coupon_applications`, `coupons`, `operational_reviews`.
- audit timeline read filtered to `aggregateType='BOOKING'`.

`apps/api/src/booking/services/admin-booking-lifecycle.service.ts` (new):

- `cancel(actor, code, reason)` — STM-004 / STM-005.
- `checkIn(actor, code)` — STM-006.
- `checkOut(actor, code)` — STM-008.
- `markNoShow(actor, code, reason)` — STM-007.
- `list`, `detail`.
- All return safe DTOs.
- All throw `BookingNotFoundError`, `BookingTransitionError`,
  `NoShowBeforeCheckInError`.

`apps/api/src/booking/services/operational-review.service.ts` (new):

- `list`, `detail`, `resolve(actor, id, note)`.

### 5. Controller + module wiring (locked)

- `apps/api/src/admin/admin.controller.ts`:
  - new `@Get('bookings')`, `@Get('bookings/:bookingCode')`,
    `@Post('bookings/:bookingCode/cancel')`, `check-in`, `check-out`,
    `no-show`.
  - new `@Get('operational-reviews')`,
    `@Get('operational-reviews/:reviewId')`,
    `@Post('operational-reviews/:reviewId/resolve')`.
  - Use `AdminPermissionGuard` with new permissions.
- `apps/api/src/admin/admin.module.ts`: register new services and
  repositories.
- `apps/api/src/errors/problem-details.filter.ts`: register the new
  errors.
- `apps/api/src/booking/booking.module.ts`: export the new service.

### 6. TDD — real PostgreSQL integration tests (locked)

`apps/api/test/integration/admin-booking-lifecycle.test.ts`:

- cases 1..22 from the design matrix.
- uses `packages/database/src/testing.ts` (`createIsolatedDatabase`).
- race tests use **two separate `pg.Client` connections** from
  `getPool()`.

`apps/api/test/integration/admin-booking-operations-api.test.ts`:

- 401 unauthenticated, 403 CUSTOMER, 401 guest, 403 DISABLED ADMIN,
  403 missing permission, 200 ADMIN with permission.
- list filters, stable pagination, safe detail, 409 illegal transition,
  400 reason validation, no SQL detail, provider-data redaction,
  review-resolution authorization.

### 7. Web vertical (locked)

- `apps/web/src/lib/admin-api.ts`: extend `adminApi` with
  `listBookings`, `getBooking`, `cancelBooking`, `checkInBooking`,
  `checkOutBooking`, `markNoShow`,
  `listOperationalReviews`, `getOperationalReview`,
  `resolveOperationalReview`.
- `apps/web/src/components/booking-list.tsx`,
  `booking-detail.tsx`, `booking-actions.tsx`,
  `operational-review-list.tsx`,
  `operational-review-detail.tsx`.
- `apps/web/src/app/admin/bookings/page.tsx`,
  `[bookingCode]/page.tsx`,
  `apps/web/src/app/admin/operational-reviews/page.tsx`,
  `[reviewId]/page.tsx`.
- Update `apps/web/src/app/admin/layout.tsx` sidebar.

### 8. Playwright (locked)

- `tests/e2e/admin-booking-operations.spec.ts` — focused Phase 7G
  suite (18 steps, run with `workers=1`, `retries=0`, `reporter=line`).
- After passing, run:
  - `tests/e2e/customer-identity-browser.spec.ts` (Phase 7F
    regression);
  - `tests/e2e/admin-coupon.spec.ts`,
    `tests/e2e/payment-provider-operations.spec.ts`,
    `tests/e2e/public-booking-vertical-flow.spec.ts`;
  - full wrapper `node scripts/run-playwright.mjs`.

### 9. Demo lifecycle (locked)

- Extend `scripts/demo/lifecycle-test.mjs` with ADMIN check-in and
  ADMIN check-out using seeded ADMIN session.
- Add a separate `scripts/demo/phase-7g-cancel-and-review.mjs` that
  exercises: cancel HOLD, cancel CONFIRMED paid → review,
  resolve review (preserves payment), confirms room availability.
- Update `docs/runbooks/phase-7g-admin-operations-demo.md`.

### 10. Validation (locked)

Run, capture exit + counts:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm check:openapi`
- `pnpm db:check`
- `pnpm db:status`
- `pnpm --filter @room/database test`
- `pnpm --filter @room/booking test:unit`
- `pnpm --filter @room/api test:unit`
- `pnpm --filter @room/api test:integration`
- `pnpm --filter @room/web test:unit`
- `pnpm demo:preflight`
- `pnpm demo:lifecycle-test`
- `pnpm demo:smoke`
- focused Playwright suites
- full Playwright wrapper

### 11. Documentation (locked)

- `docs/architecture/adr/ADR-0009-admin-booking-lifecycle.md`
- `docs/handoffs/phase-7g-admin-booking-operations.md`
- `docs/handoffs/phase-7g-verdicts.md`
- `docs/audit/phase-7g-validation-report.md`
- `docs/runbooks/phase-7g-admin-operations-demo.md`
- `docs/security/AUTH_RBAC_POLICY.md` (extend)
- `docs/engineering/admin-api-contract.md` (extend)
- regenerated OpenAPI artifacts

### 12. Git verification (locked)

For every commit:

```
git show --stat <sha>
git show --name-status <sha>
git show --check <sha>
```

Final:

```
git diff --check
git show --check HEAD
git status --short
```

Worktree must be clean.

## Acceptance gates (target verdict)

Only issued when fresh evidence supports it:

```
PHASE_7F_RELEASE_CLOSURE=PASS_WITH_LIVE_GOOGLE_BLOCKED
PHASE_7G_ADMIN_BOOKING_OPERATIONS=PASS
ADMIN_BOOKING_SEARCH_AND_DETAIL=PASS
ADMIN_CANCEL_HOLD=PASS
ADMIN_CANCEL_CONFIRMED=PASS
ADMIN_CHECK_IN=PASS
ADMIN_CHECK_OUT=PASS
ADMIN_NO_SHOW=PASS
PAID_CANCELLATION_OPERATIONAL_REVIEW=PASS
TRANSACTIONAL_AUDIT=PASS
CONCURRENCY_AND_IDEMPOTENCY=PASS
ADMIN_WEB_VERTICAL=PASS
FULL_PLAYWRIGHT=PASS_WITH_1_DOCUMENTED_PREEXISTING_SKIP
DEMO_LIFECYCLE=PASS
OPENAPI_AND_DATABASE_GATES=PASS
LIVE_GOOGLE_OAUTH=BLOCKED_NO_CREDENTIALS_AND_REDIRECT
LIVE_MOMO_ACCEPTANCE=BLOCKED_NO_MERCHANT_INFRASTRUCTURE
LIVE_VNPAY_ACCEPTANCE=BLOCKED_NO_MERCHANT_INFRASTRUCTURE
PRODUCTION_READINESS=NO
```

If a deterministic gate fails after remediation, the verdict becomes
`PARTIAL` with exact evidence (no `all green` wording without counts).