# Final product-flow and shadcn rebuild

## Route ownership

| Intent                | Routes                                                  | Behavior                                                              |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Browse room types     | `/`, `/rooms`, `/rooms/[roomTypeId]`                    | Public catalog and detail without unqualified availability claims.    |
| Check a stay interval | `/#booking`, `/booking/search`                          | One URL-backed mode and an authoritative availability result surface. |
| Continue booking      | `/booking/quote/[quoteId]`, HOLD/payment/account routes | Server-issued quote remains the only pricing and HOLD authority.      |
| Operate the property  | `/admin/**`                                             | Operational data stays separate from public discovery.                |

The rebuild removed the old mixing of hero, result rows, and quote errors. Search state is serialized by `booking-search-state`; the landing page submits to `/booking/search`; browsing actions lead to `/rooms`.

## Root causes and reconciliation

- Quote mismatch: availability selected the current property deterministically while quote lookup used an unordered `findFirst`. Quote lookup now uses the same deterministic ordering.
- Booking modes: one `bookingMode` controls selected tab, visible fields, validation, request payload, URL state, and restoration. No parallel boolean state remains.
- Public catalog: `GET /api/v1/public/room-types` is a dedicated customer-safe projection of active room types, descriptions, capacities, and assigned active amenities. It never returns physical rooms, housekeeping, maintenance, property identifiers, or pricing internals.
- Detail pages consume that projection. Images are presentation assets only; room name, description, capacity, and amenities come from the catalog API. `/rooms` remains browse-only, while interval-dependent availability remains in `/booking/search`.

## shadcn context

`apps/web/components.json` is initialized for Next.js App Router, RSC, Tailwind v4, `src/app/globals.css`, `@/` aliases, Base UI primitives, and Lucide. Official shadcn components are used only; no shared UI package or global state store was introduced.

## Final verification ledger

- `pnpm lint` and `pnpm typecheck`: PASS.
- `pnpm test:unit`: PASS. API: 56 files / 308 tests; contracts: 16 / 263; worker: 21 / 150. The new catalog service and web loader have focused regressions.
- `pnpm build`: PASS. `pnpm db:check` and `pnpm db:status`: PASS at `phase-8d-client-acceptance-v1`.
- `pnpm check:openapi`, `pnpm check:endpoints`, and `pnpm check:i18n-critical`: PASS. Endpoint reconciliation: 79 runtime, 75 documented, 4 explicit allowlist entries. Critical i18n: 108 source files, 0 direct Vietnamese literals.
- `pnpm audit --prod --audit-level=high`: PASS; npm reports 1 low and 2 moderate findings, no high findings.
- Playwright final run (`workers=1`, `retries=0`): PASS, 73/73 main scenarios and 1/1 unavailable-API scenario. The new browser regression proves persisted catalog facts render and physical-room/operational details remain absent.
- The availability form blocks input only until client hydration completes, so a fast first interaction cannot lose a controlled date value; its native GET query is also normalized to the API instant format.
- Visual evidence includes `output/playwright/phase-8i/14-public-room-catalog.png` in addition to the existing Phase 8I desktop/mobile set.

## Delivery notes

- Route sequence: search -> room detail -> authoritative quote -> existing HOLD/payment flow. No browser-calculated total or physical-room ID is exposed.
- Public/account mobile navigation uses shadcn Sheet, DropdownMenu, and Avatar; administration uses shadcn Sidebar with one semantic main landmark.
- External readiness is unchanged: public VNPAY callbacks need deployed HTTPS, MoMo sandbox needs merchant credentials, and live SMTP acceptance was not run.
