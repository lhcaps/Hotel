# Phase 8G Current UI Audit

Date: 2026-07-29
Branch: `phase5-booking-hold-guest-access`
Baseline: `fd7538bba1c586d0c4bb082950474f3f4ab2b6bd`

## Route and component map

| Surface | URL | Actor | Data source / contract | Current component | Condition and minimal correction | Browser coverage |
|---|---|---|---|---|---|---|
| Public booking entry | `/` | Guest, CUSTOMER | `POST /api/v1/availability/search`, `POST /api/v1/quotes` via `publicApi` | `AvailabilitySearchForm` | Functional authoritative search; sparse styling and result rows lack customer-facing pricing/rate-plan context. Establish hospitality layout, result anatomy, loading skeleton, semantic error/empty states. | `phase-8d3-public-entry.spec.ts` |
| Public header | all public routes | Guest, CUSTOMER | `GET /api/v1/customer/profile/session` | `PublicHeader` | Session probe is authoritative, but customer actions are mixed into primary nav and logout is a direct nav button. Separate public actions from account menu; retain exact names and locale switch. | `public-homepage.test.tsx`, Phase 8D.3 |
| Quote and recommendation | `/booking/quote/[quoteId]` | Guest, CUSTOMER | `GET /api/v1/quotes/:id`, `POST /api/v1/recommendations/stay-times` | `QuoteView`, `QuoteSummary`, `StayTimeRecommendations` | Correct authoritative re-quote flow; quote is a one-column stack, raw pricing plan codes and line codes are visible. Use customer plan dictionary, a desktop split layout, explicit stepper, sticky summary, advisory status and retry treatment. | recommendation unit/e2e coverage |
| Contact and HOLD | quote route | Guest, CUSTOMER | `POST /api/v1/public/quotes/:quoteId/bookings`; hold status endpoint | `QuoteContactForm`, `HoldSuccessPanel` | Validation, timer cleanup and server status recheck exist. Present as step 2/3 form and clear hold continuation; do not change allocation authority. | `quote-contact-form.test.tsx`, `hold-success-panel.test.tsx` |
| Payment selection/status | `/booking/manage/[bookingCode]` | OTP verified guest / CUSTOMER linked booking | `GET /public/payment-providers`, payment initiation/status contracts | `PaymentProviderSelector`, `PaymentStatusSummary` | Mixed readiness is truthful but controls are compact, ungrouped buttons. Create selectable provider treatment, sandbox/unavailable states and preserve persisted-status polling. | payment E2E specs |
| Customer profile | `/account/profile` | CUSTOMER | server `GET/PATCH /customer/profile` | `CustomerProfileClient` | Server fetch and form action work but page uses browser-default structure and local response casts. Add account layout, grouped contact/address form, protected email visual treatment, safe status states. | customer identity/browser tests |
| Customer bookings | `/account/bookings`, `/account/bookings/[bookingCode]` | CUSTOMER | server `GET /customer/bookings*` | route pages | Server-owned data and ownership checks exist; items are raw list/DL without room type from the account-list contract. Apply list/detail layout only without inventing absent data. | customer identity/browser tests |
| Guest booking management | `/booking/manage*` | Guest | OTP and booking detail endpoints | OTP components, `BookingDetailPanel` | Existing robust guest flow. Share updated public surface styles; retain OTP boundary and payment controls. | public vertical flow |
| ADMIN shell | `/admin/**` | ADMIN | `AdminAccessGuard`, server authority | `admin/layout.tsx` | Sidebar is present but makes a dense mobile link grid. Refine fixed desktop sidebar, compact top bar and scrollable workspace using existing routes. | admin auth/e2e specs |
| ADMIN catalog CRUD | catalog routes | ADMIN | `adminApi`, shared contract types | managers and `CatalogTable` | CRUD behaviors already supported; tables/forms lack consistent surface, status and filter presentation. Apply shared CSS classes only where actual consumers exist. | catalog e2e specs |
| ADMIN bookings/payments/reviews | operation routes | ADMIN | `adminApi` | route pages | Real filters/pagination/actions exist; form and table elements are mostly unstyled. Add table wrapper/filter/status conventions without changing API behavior. | Phase 7G/payment E2E specs |

## Architecture findings

- The public availability, quote, recommendation, HOLD, payment, customer, and ADMIN routes are already real flows backed by existing APIs.
- `apps/web/src/lib/booking-api.ts` validates payment provider boundary responses. `apps/web/src/lib/admin-api.ts` does not consistently validate `unknown` response bodies; this phase will not create a second client or change unrelated domain behavior.
- Tailwind v4 is installed, but global CSS is the established design mechanism. There is no `components.json`, no shadcn setup, and no icon dependency. No UI library will be added.
- The shared contracts intentionally do not expose public room descriptions, amenities, room imagery, or search prices. Phase 8G cannot truthfully show those fields without an API change; the smallest correction is a polished capacity/availability result that uses only existing data.
- Customer booking list/detail contracts omit room type/contact snapshot/lifecycle-event data. The UI will not fabricate them.
- Payment settlement status remains persisted-server-authoritative; browser query parameters never set success.

## Navigation and state coverage gaps

- Anonymous public navigation has `Đặt phòng`, booking lookup, locale, and login. CUSTOMER navigation needs a distinct booking action and a compact account menu.
- Existing tests exercise initial/loading/empty/error paths for critical booking flows, but current browser evidence must be refreshed after presentation changes.
- ADMIN table routes need a shared responsive table wrapper and consistent visible status treatment, not a generic schema-driven CRUD framework.

## Minimal Phase 8G correction

1. Establish semantic hospitality tokens and global component classes in `globals.css`.
2. Restructure the existing header, public search/results, quote/contact/hold, payment, customer-account and admin shell markup around those classes.
3. Add focused unit coverage for header state, labels, plan labeling and presentation states before behavior-affecting changes.
4. Extend existing deterministic Playwright journeys for exact navigation names, responsive surfaces, and current UI states.
5. Do not modify migrations, pricing, allocation, settlement, provider integrations, or role authority.
