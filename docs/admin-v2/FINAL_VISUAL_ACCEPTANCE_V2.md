# ADMIN V2 — Final Visual Acceptance V2

Date: 2026-08-06
Base commit before this rebuild: `3ee951f0537123ec57c8189c96f4a513d5713d36`

## Verdict

PASS for the local ADMIN V2 UI rebuild. The previous visual acceptance is not used as evidence for this document.

## Shared shadcn system

- Base: Base UI (`@base-ui/react`), configured in `apps/web/components.json`.
- Style: `base-nova`, Tailwind v4, CSS variables, Lucide icons.
- Shared shell: one sidebar, one topbar/profile menu, one semantic `#admin-content` region, shared page headers, filters, tables, badges, form sheets, empty states, alerts, and loading states.
- Component audit: PASS. Protected admin routes use the installed shadcn/Base UI primitives for Sidebar, Table, Field, Input, Select, Sheet, Dialog, AlertDialog, Badge, Pagination, and related controls. No second UI system was added.
- Native multiple-select count: 0.
- Inline row-edit form count: 0. Row actions open a Sheet or confirmation dialog; editable controls do not render inside table rows.

## Visual and responsive evidence

- Full visual route matrix: PASS, 25 routes × 5 widths = 125/125 captures.
- Visual widths: 390, 768, 1280, 1440, and 1920 pixels.
- Responsive route matrix: PASS, 20 stable routes × 6 widths = 120/120 checks.
- Responsive widths: 390, 768, 1024, 1280, 1440, and 1920 pixels.
- Document horizontal overflow: 0 failures across both matrices.
- Desktop tables retain semantic table structure and deliberate horizontal scrolling for wide booking/payment datasets.
- Mobile/tablet layouts use readable stacked cards or bounded table scrolling; filters collapse to a single column on narrow screens.
- Accessibility browser structure: PASS, 7/7.
- ROOM_STATUS_VIEWER RBAC browser acceptance: PASS, including read-only navigation, room-operations read access, and mutation HTTP 403.

## Functional acceptance

- Booking filter: PASS. `UAT-CONFIRMED-20270711` returns one matching row and excludes `UAT-PENDING-20270712` after applying the filter. The client adapter now serializes the contract field as `q`.
- Room CRUD surface: PASS. Create navigation renders the focused room form; edit opens a Sheet with room number/type controls; archive uses AlertDialog confirmation.
- Catalog CRUD surfaces: PASS. Amenities, room types, price tiers, maintenance, coupons, property, providers, accounts, and departments retain their existing server actions and Sheet/Dialog workflows.
- Full repository E2E: PASS, 156/156 tests plus the separate API-unavailable acceptance check.
- Web unit tests: PASS, 58 files / 259 tests.
- Package verification: PASS, format, lint, typecheck, unit, and production build.
- Database verification: PASS, Drizzle check, database package checks, 5 unit files / 19 tests, and 23 integration files / 176 tests.

## Inventory count reconciliation

```text
ACTIVE_PHYSICAL_ROOM_SQL_COUNT=6
ACTIVE_PHYSICAL_ROOM_API_COUNT=6
ACTIVE_PHYSICAL_ROOM_UI_COUNT=6
INVENTORY_COUNT_EXPLANATION=The local development database contains six ACTIVE rows in rooms. The authenticated ADMIN rooms API returns the same six active physical-room records, and the /admin/rooms UI renders all six in the unfiltered view. Production remains a separate 25 ACTIVE / 7 INACTIVE dataset and was not modified by this local acceptance run.
```

## Remaining external boundary

Local acceptance is complete. Production deployment/live acceptance remains an explicitly gated follow-up because no authorized production ADMIN or ROOM_STATUS_VIEWER credentials were available for the required live login and RBAC checks. No production symlink, database, or public UI was changed by this acceptance run.
