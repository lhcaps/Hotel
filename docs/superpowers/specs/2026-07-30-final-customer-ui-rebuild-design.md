# Final customer UI rebuild design

## Authority and boundary

This is the approved UI-only rebuild for Room Management. It preserves all
current Next.js routes where practical, API contracts, server-side RBAC,
PostgreSQL authority, availability allocation, quote/HOLD expiry and verified
payment settlement. The supplied workbook is a redacted functional reference,
not an application data source. The starting commit is
`635684acdd3118443c4d8324731e7f8fd47b5d89` on
`phase5-booking-hold-guest-access`.

No feature may calculate availability, price, extra-hour cost, combo/rate-plan
eligibility, physical-room assignment or payment success in the browser.

## Visual system

Use white (`#FFFFFF`) surfaces, ink (`#0F172A`) text, slate secondary text,
`#2563EB` cobalt actions, restrained green/amber/red status colour and a deep
navy admin sidebar. Use the existing font stack, a 4/8px spacing rhythm,
10-14px public radii, 8-10px admin radii, borders before shadows, 44px public
touch targets and reduced-motion-safe transitions. Do not introduce a UI
framework, global client store, glass effect, purple gradients, generated
metrics, a generic CRUD framework or new business fields.

## Customer experience

The public header is a sticky, keyboard-accessible headbar with brand, booking,
rooms/prices, offers, about/contact, locale, session-aware account menu and a
mobile drawer. It has no ADMIN link and does not parse client cookies.

`/` becomes a browsable hospitality landing page with, in order: header;
warm-room hero with booking panel; trust strip; featured room discovery;
hourly/overnight explanation; combo offers; amenity strip; hotel story;
location/contact; footer. Local generated imagery is used because no project
asset exists. Marketing copy and imagery live in one typed presentation-only
content file keyed by stable room-type codes; it owns no transactional value.

The shared booking panel supports keyboard-accessible hourly and overnight
modes. It turns selected date/time inputs into the existing interval request
only. Search results retain the existing server search and quote calls, show
truthful availability without room-number leakage and show prices only when
returned by the authority.

Quote, recommendations, contact, HOLD, provider selection/result, OTP,
customer profile, booking list/detail and print confirmation use one consistent
stepper and price-summary language. Recommendations always request a new quote
and have no booking/HOLD/coupon side effect. Payment status is persisted server
state; return URLs only navigate.

## Operations experience

ADMIN uses a grouped, active-state sidebar, compact topbar, mobile drawer and
contained data regions. Overview prioritises the actual report question:
authoritative revenue, booking and customer totals, one daily time series,
two categorical breakdowns and direct operations links. It does not fabricate
occupancy, outstanding revenue, source, staff or provider-health data.

Room operations becomes a date-first room board using the current operations
and housekeeping endpoints. Every state has icon-plus-text treatment:
booking period, room availability/status, maintenance and CLEAN/DIRTY/CLEANING.
The board does not perform assignment or conflict calculations. Existing CRUD,
booking, payment, rate-plan, maintenance and reporting routes retain their
server-backed actions but inherit consistent headers, filters, status badges,
empty/error/loading states and responsive table containment.

## Route-template map

| Template family                 | Real routes                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Landing                         | `/`                                                                                                         |
| Search results                  | `/booking/search`                                                                                           |
| Quote, recommendations and HOLD | `/booking/quote/[quoteId]`                                                                                  |
| Guest lookup / OTP / payment    | `/booking/manage`, `/booking/manage/[bookingCode]`                                                          |
| Customer authentication         | `/login`                                                                                                    |
| Customer account                | `/account`, `/account/profile`, `/account/bookings`, `/account/bookings/[bookingCode]`                      |
| Admin shell / reporting         | `/admin`, `/admin/operational-reviews*`, `/admin/payments*`                                                 |
| Admin rooms / operations        | `/admin/rooms*`, `/admin/room-types`, `/admin/maintenance`, `/admin/amenities`                              |
| Admin commercial CRUD           | `/admin/property`, `/admin/price-tiers`, `/admin/rate-plans`, `/admin/coupons*`, `/admin/payment-providers` |
| Admin access states             | `/admin/login`, `/admin/forbidden`                                                                          |

No route is left visually orphaned: all 31 current page routes fit one of the
families above.

## Shared components

Only reuse-oriented primitives used by at least two screens may be created in
`apps/web/src/components/ui`: `BrandMark`, `StatusBadge`, `EmptyState`,
`ErrorState`, `LoadingSkeleton`, `AdminPageHeader`, `AdminFilterBar` and
`ResponsiveTableRegion`. Public layout components (`PublicHeadbar`,
`MobileNavigationDrawer`, `BookingModeTabs`, `BookingSearchPanel`,
`RoomTypeCard`, `BookingStepper`, `PriceSummary`) sit with their feature when
their behaviour is not shared by ADMIN.

## Quality contract

At 390x844, 768x1024, 1366x768 and 1440x900: header/navigation works by
keyboard, customer forms do not overflow, CTAs remain reachable, admin filters
stack and tables contain their own overflow. Required changed surfaces have
loading, error and empty states; focus is visible; errors are associated to
fields; critical statuses do not rely on colour; text/image alternatives are
truthful; `AXE_CRITICAL=0` and `AXE_SERIOUS=0`.

The implementation loop captures real browser screenshots of landing desktop
and mobile, search, quote, account, ADMIN overview, rooms, bookings and report,
then compares each directly to the provided visual authorities and resolves
spacing, hierarchy, asset, overflow and control-state defects.
