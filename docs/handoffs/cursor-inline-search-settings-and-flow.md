# Inline availability, settings, and flow reconciliation

## Scope

- Branch: `phase5-booking-hold-guest-access`
- Starting SHA: `12023df1199b1bff53b1359dff696e8fb50b99ad`
- Preserved: Next.js App Router, Tailwind v4, existing shadcn/Base UI primitives, URL-backed booking search state, server-owned quote/HOLD/payment authority, and existing commit history.

This delivery changes the public landing search from navigation-first to inline availability discovery, adds authenticated customer language settings, and reconciles the availability response with a read-only server price projection.

## Public booking flow

1. The landing booking module owns one `bookingMode` value. Its selected tab controls visible fields, validation, interval serialization, and the API payload.
2. Landing submission remains on `/`, shows loading and error states inline, and scrolls/focuses the results heading after a successful request. Reduced-motion preference disables smooth scrolling.
3. The public availability API validates the interval and returns room-type availability, public amenity names, and nullable server-computed offer metadata. It does not return physical room IDs, room numbers, operational state, rate-plan internals, quotes, or HOLD state.
4. The result card renders a deterministic public room image, name, capacity, public amenities, availability count, selected-plan label, and server-provided VND amount. The browser never calculates the amount.
5. Result links preserve the complete search query when continuing to `/rooms/[roomTypeId]`. The secondary link opens `/booking/search` for the dedicated results route.

## Customer settings

- `/account/settings` is a customer-protected page using the same authenticated profile boundary as `/account/profile`.
- The page changes the existing `room_locale` preference through `POST /locale`; it does not create a second settings store.
- Settings is reachable from both the account navigation and authenticated public-header menu.
- The landing e2e flow asserts this authenticated-menu entry is present.

## Request-flow matrix

| Surface | Namespace | Access boundary | Public data exposure |
|---|---|---|---|
| Availability discovery | `POST /api/v1/availability/search` | Anonymous | Aggregate room-type availability, capacity, public amenity labels, nullable authoritative offer summary |
| Public room catalog | `GET /api/v1/public/room-types` | Anonymous | Public room-type descriptions, capacity, amenity names only |
| Quote and hold | `/api/v1/quotes`, `/api/v1/public/quotes/:quoteId/bookings` | Anonymous with opaque quote / contact verification | Server issues immutable quote; client cannot set totals or reserve inventory locally |
| Guest booking access | `/api/v1/public/guest-access/*`, `/api/v1/public/bookings/*` | OTP / booking-code scoped | Booking data only after guest-access verification |
| Customer account | `/api/v1/customer/profile`, `/api/v1/customer/bookings` | Customer session | Session owner's profile and bookings only |
| Administration and operations | `/api/v1/admin/*` | ADMIN role and permissions | Never reachable through public availability/catalog endpoints |
| Payments and callbacks | public booking payment attempts; `/api/v1/webhooks/*`; provider returns | Booking/guest authorization or provider signature | Settlement remains verified server-side; browser returns do not settle payments |

`pnpm check:endpoints` passed with 79 runtime routes, 75 documented routes, and 4 explicit allowlist entries. `pnpm check:openapi` passed with 39 admin operations and 20 public operations.

## Validation ledger

- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm test:unit`: PASS before final public-metadata extension; web `39 files / 147 tests`, API `56 files / 308 tests`.
- Focused final extension: availability API `2/2` and landing web `4/4`: PASS.
- `pnpm --filter @room/web build`: PASS, including `/account/settings`.
- `pnpm check:endpoints`, `pnpm check:openapi`, and `pnpm check:i18n-critical`: PASS.
- `pnpm demo:preflight`: PASS.
- `pnpm demo:lifecycle-test`: PASS `15/15`, including smoke `22/22` and cleanup checks.
- `pnpm demo:smoke`: PASS on retry. The first immediately-following invocation failed while creating its disposable database; preflight/database checks were healthy and the independent retry passed.
- Playwright: first final run PASS `73/73` plus unavailable-API `1/1`; one repeat experienced a non-reproducible ADMIN-login timeout after `72/73`; a subsequent clean repeat PASS `73/73` plus unavailable-API `1/1`.
- `pnpm audit --prod --audit-level=high`: PASS. Remaining findings: one low and two moderate; none high.

## External readiness boundary

- MoMo sandbox requires merchant credentials and registered HTTPS callback endpoints.
- VNPAY production callback readiness remains an external HTTPS deployment task.
- SMTP live acceptance needs an approved sender identity and dedicated test recipient.
- Google OAuth is locally configured; live acceptance is opt-in and was not run.

No browser-side pricing, inventory calculation, quote generation, HOLD creation, or payment settlement was introduced.
