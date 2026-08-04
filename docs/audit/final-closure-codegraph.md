# Final closure dependency evidence

`CODEGRAPH_AVAILABLE=NO`

The repository root has no `.codegraph/` directory, so the CodeGraph command
is unavailable for this checkout. The graphs below are the current source
evidence assembled from TypeScript symbols, route metadata, and direct import
references. This file deliberately records the limitation instead of claiming
that CodeGraph ran.

## BOOKING

`BOOKING_CODEGRAPH_NODES=17`

| Node                               | Source location                                                                                                                                                                                        | Edge to next node                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Public home                        | `apps/web/src/app/page.tsx:3,12,28`                                                                                                                                                                    | renders `PublicLanding`                        |
| Booking form                       | `apps/web/src/components/public-landing.tsx:28`; `apps/web/src/components/availability-search-form.tsx:104`                                                                                            | submits `BookingSearchState`                   |
| Query-state parser                 | `apps/web/src/lib/booking-search-state.ts:1,146`                                                                                                                                                       | serializes and restores interval query         |
| Availability client                | `apps/web/src/components/landing-availability-search.tsx:35,54`; `apps/web/src/lib/admin-api.ts:442`                                                                                                   | POSTs public availability                      |
| Public availability controller     | `apps/api/src/pricing/availability.controller.ts:3-8`                                                                                                                                                  | calls `AvailabilityService`                    |
| Availability service               | `apps/api/src/pricing/availability.service.ts:48`                                                                                                                                                      | calls repository and pricing boundary          |
| PostgreSQL availability repository | `apps/api/src/pricing/availability.repository.ts:7`                                                                                                                                                    | returns physical-inventory facts internally    |
| Nearby suggestions                 | `apps/api/src/pricing/nearby-availability.controller.ts:5,11`; `apps/api/src/pricing/nearby-availability.service.ts:147`                                                                               | bounded alternatives only                      |
| Pricing selection                  | `apps/api/src/pricing/cheapest-eligible-pricing.ts:1`; `apps/api/src/pricing/selection-rule-matcher.ts:89`                                                                                             | selects eligible offer                         |
| Quote controller                   | `apps/api/src/pricing/quote.controller.ts:3-12`                                                                                                                                                        | creates and reads server quote                 |
| Quote service                      | `apps/api/src/pricing/quote.service.ts:69`                                                                                                                                                             | persists immutable pricing/interval snapshot   |
| Public room catalog                | `apps/api/src/public-catalog/public-room-catalog.controller.ts:5-11`                                                                                                                                   | returns customer-safe room concepts            |
| Room detail route                  | `apps/web/src/app/rooms/[roomTypeId]/page.tsx`                                                                                                                                                         | presents concept, not physical room            |
| HOLD controller                    | `apps/api/src/booking/booking-hold.controller.ts:14,22`                                                                                                                                                | calls `BookingHoldService`                     |
| HOLD service                       | `apps/api/src/booking/services/booking-hold.service.ts:59`                                                                                                                                             | validates quote and creates booking            |
| Payment controller/services        | `apps/api/src/payment/payment-provider.controller.ts:4`; `apps/api/src/payment/services/momo-payment-initiation.service.ts:38`; `apps/api/src/payment/services/vnpay-payment-initiation.service.ts:17` | creates provider attempt; verified IPN settles |
| Customer booking detail            | `apps/api/src/customer/customer-bookings.controller.ts:27-46`; `apps/web/src/app/account/bookings/[bookingCode]/page.tsx`                                                                              | customer-scoped booking visibility             |
| ADMIN booking detail               | `apps/api/src/booking/admin-booking-operations.controller.ts:36-162`; `apps/web/src/app/admin/(protected)/bookings/[bookingCode]/page.tsx`                                                             | permission-scoped operational detail           |

`BOOKING_CODEGRAPH_DUPLICATE_PATHS=1`: both `AdminSessionService` and
`CustomerSessionService` resolve through the same Better Auth-backed session
reader; this is intentional shared authentication, not a second auth server.

## AUTH

`AUTH_CODEGRAPH_NODES=14`

| Node                        | Source location                                       | Edge to next node                                   |
| --------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Better Auth authority       | `packages/auth/src/auth-factory.ts:36,65`             | one `betterAuth()` factory instance per API module  |
| Fastify bridge              | `apps/api/src/auth/auth-fastify-bridge.ts:32,52,67`   | forwards request and `Set-Cookie` headers           |
| Auth controller             | `apps/api/src/auth/auth.controller.ts:15-16,82,90`    | exposes `/api/auth/*`                               |
| Session reader              | `apps/api/src/auth/auth.providers.ts:14`              | reads Better Auth `getSession`                      |
| Admin session reader        | `apps/api/src/auth/admin-session.service.ts:22-45`    | resolves DB user/status/role                        |
| Customer session reader     | `apps/api/src/auth/customer-session.service.ts:30-38` | reuses admin session resolver and requires CUSTOMER |
| Admin API                   | `apps/api/src/admin/admin.controller.ts:8-11`         | exposes `/admin/me`                                 |
| Web server session resolver | `apps/web/src/lib/admin-session-server.ts:41-123`     | forwards inbound cookie with `cache: no-store`      |
| Admin protected layout      | `apps/web/src/app/admin/(protected)/layout.tsx:27-45` | redirects before protected JSX renders              |
| Admin login state           | `apps/web/src/app/admin/login/page.tsx:22-84`         | distinguishes CUSTOMER session                      |
| Customer login route        | `apps/web/src/app/login/page.tsx:8-14`                | renders customer OAuth presentation                 |
| Web email sign-in proxy     | `apps/web/src/app/api/auth/sign-in/email/route.ts:23` | forwards/re-emits auth cookie                       |
| Web sign-out proxy          | `apps/web/src/app/api/auth/sign-out/route.ts:11`      | clears Better Auth session cookie                   |
| Customer account layout     | `apps/web/src/app/account/layout.tsx`                 | customer-only portal boundary                       |

`AUTH_CLIENT_INSTANCES=1` in source: the browser uses same-origin proxy
routes; no second Better Auth client or second server factory was found.
`SESSION_READERS=2` (admin and customer role wrappers over one reader),
`COOKIE_WRITERS=2` (Fastify bridge and web sign-in proxy),
`COOKIE_CLEARERS=2` (Better Auth handler and web sign-out proxy).

## AUTHORIZATION

`ADMIN_GUARDS=1` in the current implementation:
`apps/api/src/auth/admin-permission.guard.ts:24-50` authenticates via
`AdminSessionService`, checks decorator metadata from
`apps/api/src/auth/permissions.decorator.ts:6`, and attaches the server actor.
Admin controllers apply it at the controller/method boundary; customer
controllers use `CustomerSessionService` (for example
`apps/api/src/customer/customer-profile.controller.ts:24-48`).

`CUSTOMER_GUARDS=1`: `apps/api/src/auth/customer-session.service.ts:30-38`.
`CONFLICTING_GUARDS=0` found in the current decorated controller tree.
`UNGUARDED_PROTECTED_ROUTES=0` for the current admin/customer controllers,
including the account-management routes below; route inventory and OpenAPI
reconciliation cover the new controller surface.

## ACCOUNT MANAGEMENT

`ACCOUNT_MANAGEMENT_NODE=IMPLEMENTED_WITH_FALLBACK_SOURCE_EVIDENCE`

The current route tree now includes the guarded account-management controller
at `apps/api/src/admin/admin-access.controller.ts:8-107` and the service at
`apps/api/src/admin/admin-access.service.ts:105-190`. It covers admin accounts,
customer accounts with masked email/provider data and booking/session counts,
departments, role/status changes, session revocation and audit events. The web
surfaces are `apps/web/src/app/admin/(protected)/accounts/page.tsx`,
`apps/web/src/app/admin/(protected)/customer-accounts/page.tsx`,
`apps/web/src/app/admin/(protected)/departments/page.tsx`, and
`apps/web/src/app/admin/(protected)/audit/page.tsx`.

The shared contracts are in `packages/contracts/src/admin.ts:67-151`, the
role/permission authority is `packages/auth/src/permissions.ts:1-43`, and the
database role/membership tables are in `packages/database/src/schema.ts:55-210`.
Because `.codegraph/` is absent, these are direct source locations rather than
CodeGraph output.

`NO_PRIVILEGE_ESCALATION_TEST=PASS`: `apps/api/test/admin-access.service.test.ts`
proves that a CUSTOMER target is rejected by the admin-account role mutation
endpoint before any write occurs. `NO_ANIMATION=PASS` is enforced by the global
motion policy in `apps/web/src/app/globals.css` and the booking landing route
uses non-smooth scrolling.
