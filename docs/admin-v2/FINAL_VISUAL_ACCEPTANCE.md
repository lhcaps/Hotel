# ADMIN V2 final visual acceptance

Date: 2026-08-05
Scope: local ADMIN V2 visual rebuild and responsive acceptance
Baseline: `7203905d09ab49bfa06a35e99e57510d9fa5b7f2`
Capture command: `pnpm exec playwright test tests/e2e/admin-v2-visual-acceptance.spec.ts` with `ADMIN_V2_CAPTURE_PASS=final`

## Verdict

**PASS — local visual and responsive acceptance.**

All 26 required admin route entries rendered through the authenticated local harness at all five required widths. The final pass contains 130 PNG captures (26 routes × 5 viewports), with no document-width overflow assertion failures.

Artifacts: `output/playwright/admin-v2/acceptance/final/`

Required widths:

- 390 × 844 — mobile
- 768 × 1024 — tablet
- 1280 × 800 — desktop small
- 1440 × 900 — desktop
- 1920 × 1080 — desktop wide

## Route coverage

| Area                   | Route entries covered                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Overview and identity  | `/admin`, `/admin/profile`                                                               |
| Booking operations     | `/admin/bookings`, booking detail, `/admin/scanner`                                      |
| Room operations        | `/admin/room-operations`, `/admin/rooms`, room create, room detail, `/admin/maintenance` |
| Payments and review    | `/admin/payments`, payment detail, `/admin/operational-reviews`                          |
| Catalog                | `/admin/room-types`, `/admin/amenities`, `/admin/price-tiers`, `/admin/rate-plans`       |
| Commercial setup       | `/admin/coupons`, coupon create, coupon detail                                           |
| Property and providers | `/admin/property`, `/admin/payment-providers`                                            |
| Access and audit       | `/admin/accounts`, `/admin/customer-accounts`, `/admin/departments`, `/admin/audit`      |

`/admin/customer-accounts` is intentionally a 307 canonical redirect to `/admin/accounts?tab=customers`; the canonical destination rendered successfully in the same capture pass.

## Per-route evidence manifest

Each entry below was captured as `SUPER_ADMIN` at every required viewport. The
`{viewport}` placeholder expands to `mobile-390`, `tablet-768`,
`desktop-small-1280`, `desktop-1440`, and `desktop-wide-1920`.

| Route                                                         | Principal     | Viewport                 | Evidence path                                                                    | Final verdict |
| ------------------------------------------------------------- | ------------- | ------------------------ | -------------------------------------------------------------------------------- | ------------- |
| `/admin`                                                      | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/overview.png`            | PASS          |
| `/admin/profile`                                              | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/profile.png`             | PASS          |
| `/admin/bookings`                                             | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/bookings.png`            | PASS          |
| `/admin/bookings/PW-UAT-CONFIRMED-20270711`                   | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/booking-detail.png`      | PASS          |
| `/admin/scanner`                                              | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/scanner.png`             | PASS          |
| `/admin/room-operations`                                      | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/room-operations.png`     | PASS          |
| `/admin/rooms`                                                | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/rooms.png`               | PASS          |
| `/admin/rooms/new`                                            | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/room-new.png`            | PASS          |
| `/admin/rooms/10000000-0000-4000-8000-000000000301`           | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/room-detail.png`         | PASS          |
| `/admin/maintenance`                                          | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/maintenance.png`         | PASS          |
| `/admin/payments`                                             | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/payments.png`            | PASS          |
| `/admin/payments/{from-list}`                                 | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/payment-detail.png`      | PASS          |
| `/admin/operational-reviews`                                  | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/operational-reviews.png` | PASS          |
| `/admin/room-types`                                           | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/room-types.png`          | PASS          |
| `/admin/amenities`                                            | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/amenities.png`           | PASS          |
| `/admin/property`                                             | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/property.png`            | PASS          |
| `/admin/price-tiers`                                          | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/price-tiers.png`         | PASS          |
| `/admin/rate-plans`                                           | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/rate-plans.png`          | PASS          |
| `/admin/coupons`                                              | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/coupons.png`             | PASS          |
| `/admin/coupons/new`                                          | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/coupon-new.png`          | PASS          |
| `/admin/coupons/10000000-0000-4000-8000-000000000801`         | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/coupon-detail.png`       | PASS          |
| `/admin/payment-providers`                                    | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/payment-providers.png`   | PASS          |
| `/admin/accounts`                                             | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/accounts.png`            | PASS          |
| `/admin/customer-accounts` -> `/admin/accounts?tab=customers` | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/customer-accounts.png`   | PASS          |
| `/admin/departments`                                          | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/departments.png`         | PASS          |
| `/admin/audit`                                                | `SUPER_ADMIN` | all five required widths | `output/playwright/admin-v2/acceptance/final/{viewport}/audit.png`               | PASS          |

## Corrections accepted

- Rebuilt the shell and responsive navigation around the existing Base UI/Shadcn primitives while retaining the existing auth, route guards, and permission model.
- Replaced the dashboard card wall with a structured operations overview: date/filter controls, five primary metrics, action queues, revenue, status distribution, and explicit loading/error/partial states.
- Kept room operations active-only by default. Maintenance/inactive views opt in to inactive records, while the API remains the source of truth.
- Reworked room operations into grouped operational tables/cards with readable Vietnamese labels and mobile-safe rows.
- Reworked payment list rows into labeled mobile records rather than a clipped horizontal table. Payment detail now consumes the current shared reconciliation contract and masks provider-sensitive identifiers.
- Replaced raw price-tier identifiers with names and translated status values across the touched admin surfaces.
- Reduced room-type edit density with compact field groups and preserved all existing edit actions.
- Removed raw enum presentation from the accepted admin workflow surfaces and added Vietnamese/English labels for operational statuses and actions.
- Preserved explicit empty, unavailable, and review-required states; no `NaN`, silent loading gap, or horizontal overflow was observed by the acceptance assertions.

## Manual spot-checks

Reviewed final captures for:

- `desktop-1440/overview.png`
- `mobile-390/overview.png`
- `desktop-1440/payments.png`
- `mobile-390/payments.png`
- `desktop-1440/rate-plans.png`
- `desktop-1440/room-types.png`
- payment detail captures at mobile and desktop widths

The Next.js development indicator visible in local screenshots is tooling chrome, not an application error. It is excluded from the product acceptance judgment.

## Boundaries

This document proves the local authenticated visual harness only. It does not claim production deployment, live-domain browser acceptance, external provider readiness, or real-money payment execution. Server-side RBAC, PostgreSQL authority, payment behavior, and customer-safe data boundaries remain preserved and require their independent gates below the visual acceptance layer.
