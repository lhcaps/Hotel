# ADMIN Final Closure Matrix

**Scope:** protected ADMIN routes only. Public catalogue, customer booking, customer account, authentication, OTP, cancellation, and payment UX are intentionally outside this closure.

**Rendered denominator:** 29 filesystem page routes. `/admin/customer-accounts` is an intentional `307` compatibility route to `/admin/accounts?view=customers` and is counted as a redirect contract rather than a second screen.

| Route                                   | Family         | Rendered contract         | Shared composition                                                   | Local QA / remediation                                                |
| --------------------------------------- | -------------- | ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/admin`                                | overview       | report dashboard          | shell, filters, metrics, queues                                      | Empty revenue chart contracts to content height when no points exist. |
| `/admin/profile`                        | identity       | profile settings          | shell, Field, feedback                                               | Rendered in authenticated route sweep.                                |
| `/admin/bookings`                       | operations     | booking queue             | shell, filter toolbar, dense table                                   | Dense operational table retained; rendered at 1920/1440/1024.         |
| `/admin/bookings/[bookingCode]`         | detail         | booking lifecycle         | header, detail sections, actions                                     | Fixture `PW-UAT-CONFIRMED-20270711` rendered.                         |
| `/admin/scanner`                        | operations     | access scanner            | shell, field, feedback                                               | Rendered in authenticated route sweep.                                |
| `/admin/room-operations`                | operations     | room-status board         | shell, status tabs, filters, dense table                             | Keyboard tab/search interaction covered.                              |
| `/admin/housekeeping`                   | operations     | workboard                 | shell, dense task board                                              | Rendered at closure viewport.                                         |
| `/admin/rooms`                          | inventory      | physical-room list        | AdminDataTable, row menu, confirm dialog                             | Rendered at all desktop QA viewports.                                 |
| `/admin/rooms/new`                      | inventory      | create room               | AdminFormSheet, FieldGroup                                           | Rendered at all desktop QA viewports.                                 |
| `/admin/rooms/[id]`                     | detail         | physical-room record      | detail sections, feedback                                            | Fixture room rendered.                                                |
| `/admin/maintenance`                    | operations     | maintenance work          | filter toolbar, dense table, confirm dialog                          | Rendered at closure viewport.                                         |
| `/admin/payments`                       | finance        | reconciliation list       | filter toolbar, dense table                                          | Fixture payment detail is discovered from this list.                  |
| `/admin/payments/[paymentId]`           | detail         | payment evidence          | detail / audit chronology                                            | Fixture payment `...733` rendered.                                    |
| `/admin/operational-reviews`            | operations     | paid-cancellation queue   | AdminTabs, SelectGroup, Table anatomy, row menu, Sheet               | Deterministic OPEN review fixture; menu regression covered.           |
| `/admin/operational-reviews/[reviewId]` | detail         | review resolution         | detail facts, Field, feedback                                        | Deterministic review `...741` rendered.                               |
| `/admin/room-types`                     | catalogue      | room-type management      | Table anatomy, SelectGroup, row menu, archive dialog, FormSheet      | Codes no longer collapse into single-character lines.                 |
| `/admin/amenities`                      | catalogue      | amenity management        | Table anatomy, row menu, archive dialog, FormSheet                   | Archive requires explicit confirmation.                               |
| `/admin/property`                       | configuration  | property policy           | semantic FormSections, FieldError, Alert                             | Invalid min/max stay range is blocked before save.                    |
| `/admin/price-tiers`                    | configuration  | price-tier management     | Table anatomy, row menu, archive dialog, FormSheet                   | Archive-menu / confirmation regression covered.                       |
| `/admin/rate-plans`                     | pricing        | rate-plan management      | AdminTabs, Table anatomy, SelectGroup, row menu, FormSheet           | Retains pricing API and validation authority.                         |
| `/admin/pricing-policies`               | pricing        | policy release management | Table anatomy, row menu, setup FormSheets, editor Sheet, SelectGroup | Long visible create/bootstrap forms moved out of main surface.        |
| `/admin/coupons`                        | pricing        | coupon list               | filter toolbar, list/detail conventions                              | Rendered at closure viewport.                                         |
| `/admin/coupons/new`                    | pricing        | coupon create             | FieldGroup, validation feedback                                      | Rendered at closure viewport.                                         |
| `/admin/coupons/[couponId]`             | detail         | coupon record             | detail / form conventions                                            | Fixture coupon rendered.                                              |
| `/admin/payment-providers`              | configuration  | provider setup            | field / status conventions                                           | Rendered at closure viewport.                                         |
| `/admin/accounts`                       | administration | staff/customer tabs       | AdminTabs, Table, confirmation dialog                                | Indicator stays within its tab list.                                  |
| `/admin/customer-accounts`              | compatibility  | redirect                  | redirect to Accounts customer view                                   | `307` to `/admin/accounts?view=customers` verified.                   |
| `/admin/departments`                    | administration | department manager        | management table / form conventions                                  | Rendered at closure viewport.                                         |
| `/admin/audit`                          | administration | audit trail               | filters, dense audit table                                           | Rendered at closure viewport.                                         |

## Primitive audit

| Area / occurrence group                                                                            | Classification                  | Decision                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui` Button, Field, Table, Tabs, Select, Sheet, AlertDialog, Alert, Empty, DropdownMenu | CORRECT                         | Canonical generic primitives; Admin-only composition remains outside this folder.                                                                                                            |
| `components/admin/admin-ui.tsx`                                                                    | CORRECT                         | Owns ADMIN shell, tabs indicator, loading/empty/error states, row menus, FormSheet and destructive dialog composition.                                                                       |
| Price tiers, amenities, room types, rate plans, pricing policies, operational-review list          | MIGRATED                        | Raw table anatomy, ungrouped Select items, duplicate direct actions, visible long setup forms, and missing confirmations were replaced with canonical composition.                           |
| Dashboard revenue SVG fallback table                                                               | CUSTOM_JUSTIFIED                | Screen-reader data table backs an SVG chart; it is not a management-grid duplicate. Empty state is compact.                                                                                  |
| Booking, room, payment, and maintenance operational grids                                          | CUSTOM_JUSTIFIED                | Existing dense operational semantics, fixed-width behavior, lifecycle actions, and mobile `data-label` contracts remain intentionally intact; no duplicate generic primitive was introduced. |
| `catalog-table.tsx` and customer-facing controls                                                   | CUSTOM_JUSTIFIED / out of scope | Shared or customer composition was not restyled for this ADMIN-only phase.                                                                                                                   |

`ADMIN_SHADCN_AUDIT`: **0 unaddressed `MIGRATE` or `DUPLICATE` findings**. The remaining raw semantic table markup above is documented custom behavior, not an unowned substitute for a generic primitive.

## Evidence index

- Route-wide authenticated screenshots: `output/playwright/admin-v3/routes/*-1440.png`
- Primary desktop screenshots: `output/playwright/admin-v3/primary/*`
- Browser regression specification: `tests/e2e/admin-v3-authenticated-qa.spec.ts`
- Deterministic operational-review fixture: `apps/api/test/playwright-global-setup.ts`
