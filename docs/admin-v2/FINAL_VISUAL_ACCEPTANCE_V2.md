# ADMIN V2 — Final Visual Acceptance V2

Date: 2026-08-06
Acceptance principal: `SUPER_ADMIN` local acceptance account
Baseline before this rebuild: `3ee951f0537123ec57c8189c96f4a513d5713d36`
Evidence root: `output/playwright/admin-v2/acceptance/v2-final/`
Evidence policy: screenshots remain outside Git; this document records only sanitized paths and verdicts.

## Final verdict

PASS for the local ADMIN V2 UI acceptance. The matrix below is the authoritative
route-level record for the current committed implementation. Production deployment
and live acceptance are separate gates and are not claimed by this document.

## Shared implementation fidelity ledger

| Area          | Required behavior                                                                        | Evidence                                                                                      | Verdict |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| Shell         | One compact dark-navy sidebar, Vietnamese navigation, breadcrumb/topbar/profile, no seam | `apps/web/src/app/admin/(protected)/layout.tsx`; `apps/web/src/components/admin/admin-ui.tsx` | PASS    |
| Base UI       | Existing Base UI shadcn primitives, `base-nova`, Lucide, no second UI system             | `apps/web/components.json`; `apps/web/src/components/ui/`                                     | PASS    |
| Tables        | Semantic desktop tables with bounded scrolling and readable mobile cards                 | `apps/web/src/components/admin/admin-ui.tsx`; visual captures below                           | PASS    |
| Forms         | Create/edit actions open Sheet or Dialog; no inline row-edit walls                       | `apps/web/src/components/admin/admin-ui.tsx`; route captures below                            | PASS    |
| Status        | Shared Vietnamese status labels and semantic badge tones                                 | `apps/web/src/lib/admin-i18n.ts`; `apps/web/src/components/admin/admin-ui.tsx`                | PASS    |
| Responsive    | No document-level horizontal overflow at required widths                                 | `tests/e2e/admin-v2-visual-acceptance.spec.ts`; `tests/e2e/admin-v2-responsive.spec.ts`       | PASS    |
| Motion        | No animation added; reduced-motion remains disabled at the product layer                 | `apps/web/src/app/globals.css`                                                                | PASS    |
| Accessibility | Browser accessibility matrix completed without critical findings                         | `tests/e2e/phase2-1-a11y-browser.spec.ts`                                                     | PASS    |
| RBAC          | Viewer has read-only room operations and mutation API returns 403                        | `tests/e2e/room-status-viewer.spec.ts`                                                        | PASS    |

## Per-page visual acceptance matrix

Each row was rendered by the visual acceptance test at every listed viewport.
The evidence path is the exact screenshot naming pattern; `name` is the final
column value. `SUPER_ADMIN` is the local authenticated acceptance principal.

Required viewports: `390x844`, `768x1024`, `1280x800`, `1440x900`, `1920x1080`.

| Route                          | Principal                                       | Viewport                                         | Evidence path                            | Final verdict |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------ | ---------------------------------------- | ------------- |
| `/admin`                       | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/overview.png`            | PASS          |
| `/admin/profile`               | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/profile.png`             | PASS          |
| `/admin/bookings`              | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/bookings.png`            | PASS          |
| `/admin/bookings/:bookingCode` | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/booking-detail.png`      | PASS          |
| `/admin/scanner`               | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/scanner.png`             | PASS          |
| `/admin/room-operations`       | SUPER_ADMIN; ROOM_STATUS_VIEWER read-only check | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/room-operations.png`     | PASS          |
| `/admin/rooms`                 | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/rooms.png`               | PASS          |
| `/admin/rooms/new`             | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/room-new.png`            | PASS          |
| `/admin/rooms/:roomId`         | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/room-detail.png`         | PASS          |
| `/admin/maintenance`           | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/maintenance.png`         | PASS          |
| `/admin/payments`              | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/payments.png`            | PASS          |
| `/admin/payments/:paymentId`   | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/payment-detail.png`      | PASS          |
| `/admin/operational-reviews`   | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/operational-reviews.png` | PASS          |
| `/admin/room-types`            | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/room-types.png`          | PASS          |
| `/admin/amenities`             | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/amenities.png`           | PASS          |
| `/admin/property`              | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/property.png`            | PASS          |
| `/admin/price-tiers`           | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/price-tiers.png`         | PASS          |
| `/admin/rate-plans`            | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/rate-plans.png`          | PASS          |
| `/admin/coupons`               | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/coupons.png`             | PASS          |
| `/admin/coupons/new`           | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/coupon-new.png`          | PASS          |
| `/admin/coupons/:couponId`     | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/coupon-detail.png`       | PASS          |
| `/admin/payment-providers`     | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/payment-providers.png`   | PASS          |
| `/admin/accounts`              | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/accounts.png`            | PASS          |
| `/admin/customer-accounts`     | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/customer-accounts.png`   | PASS          |
| `/admin/departments`           | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/departments.png`         | PASS          |
| `/admin/audit`                 | SUPER_ADMIN                                     | 390x844; 768x1024; 1280x800; 1440x900; 1920x1080 | `.../<viewport>/audit.png`               | PASS          |

Matrix result: 26 routes × 5 viewports = 130/130 captures, all rendered and
all document widths were within the viewport.

## Responsive route sweep

The stable-route sweep covered 20 routes at `390x844`, `768x1024`, `1024x768`,
`1280x800`, `1440x900`, and `1920x1080`: `/admin`, `/admin/bookings`,
`/admin/scanner`, `/admin/payments`, `/admin/operational-reviews`,
`/admin/room-operations`, `/admin/rooms`, `/admin/maintenance`,
`/admin/room-types`, `/admin/amenities`, `/admin/property`, `/admin/price-tiers`,
`/admin/rate-plans`, `/admin/coupons`, `/admin/payment-providers`,
`/admin/accounts`, `/admin/customer-accounts`, `/admin/departments`,
`/admin/audit`, and `/admin/profile`.

Result: 120/120 checks PASS; document horizontal overflow: 0.

## Functional and permission acceptance

- Booking filter: PASS. `UAT-CONFIRMED-20270711` returns only the matching
  records after applying the filter; the client serializes the contract field
  as `q`.
- Room CRUD: PASS. Create navigation renders the focused form, edit opens a
  Sheet, and archive requires confirmation.
- Catalog CRUD: PASS. Amenities, room types, price tiers, maintenance, coupons,
  property, providers, accounts, and departments retain their supported
  server-backed Sheet/Dialog flows.
- Room viewer: PASS. Read-only room operations are visible; restricted
  navigation and mutation controls are absent; mutation API response is 403.
- Full repository E2E: PASS, 156/156 plus the separate unavailable-API check.
- Accessibility: PASS, 7/7.

## Verification ledger

| Check                                                       | Result                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm format:check`                                         | PASS                                                       |
| `pnpm --filter @room/web typecheck`                         | PASS                                                       |
| `pnpm --filter @room/web lint`                              | PASS                                                       |
| `pnpm --filter @room/web test:unit`                         | PASS — 58 files / 259 tests                                |
| `pnpm verify`                                               | PASS                                                       |
| `pnpm verify:database`                                      | PASS — 23 integration files / 176 tests                    |
| OpenAPI/endpoints/i18n/providers/features/gitleaks fixtures | PASS; external provider callbacks remain environment-gated |
| Visual acceptance                                           | PASS — 130/130                                             |
| Responsive acceptance                                       | PASS — 120/120                                             |
| Full E2E                                                    | PASS — 156/156 + unavailable-API 1/1                       |

## Inventory count reconciliation

```text
ACTIVE_PHYSICAL_ROOM_SQL_COUNT=6
ACTIVE_PHYSICAL_ROOM_API_COUNT=6
ACTIVE_PHYSICAL_ROOM_UI_COUNT=6
INVENTORY_COUNT_EXPLANATION=The local development PostgreSQL database contains six ACTIVE physical-room rows. The authenticated ADMIN rooms API returns the same six records and the default /admin/rooms view renders all six. Production is a separate 25 ACTIVE / 7 INACTIVE dataset and was not modified by local acceptance.
```

## Defects and fixes

| Final review item                                 | Result                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Mixed visible Vietnamese/English operational copy | Fixed in the shared admin translation/status mapping and verified by the route matrix  |
| Raw enum labels and NaN pagination                | No visible occurrences in accepted views                                               |
| Cramped tables and inline row-edit forms          | Fixed with shared DataTable layout, bounded scroll, mobile cards, Sheet/Dialog actions |
| Page-level horizontal overflow                    | 0 failures across visual and responsive matrices                                       |
| Silent booking search filter                      | Fixed by serializing the API contract field `q`; focused unit and browser checks PASS  |
| Permission boundary                               | ROOM_STATUS_VIEWER read-only route and 403 mutation checks PASS                        |

## External boundary

Production deployment/live acceptance is intentionally not claimed here. At the
time of this local evidence capture, no authorized production `SUPER_ADMIN` or
`ROOM_STATUS_VIEWER` login credentials were available. No production symlink,
database, provider configuration, or public UI was changed by these local tests.
