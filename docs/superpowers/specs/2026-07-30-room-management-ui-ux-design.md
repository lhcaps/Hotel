# Room Management UI/UX redesign

## Decision

Redesign the customer booking journey and the ADMIN workspace as one coherent
product while preserving the current Next.js routes, server-authoritative API
contracts, RBAC, availability allocation, quote/hold TTL, and verified-payment
flow. The supplied Excel workbook is a functional reference, not a runtime
data source.

## Visual direction

Use the supplied reference screens as the visual target: a clean white
hospitality product with a dark ink palette, one cobalt-blue interaction
colour, restrained green/amber/red semantic states, generous whitespace and
warm room photography. Public pages use an editorial, image-led composition;
operations pages use compact, grouped information with clear scanning paths.
The UI must work in Vietnamese and English, at desktop and mobile widths, and
must not rely on icon-only critical actions.

## Product surfaces

### Public customer journey

1. Replace the sparse home search with a genuine landing page: top navigation,
   image-led booking hero, explicit by-hour / overnight context, responsive
   availability search, trust points, room-type discovery, amenity strip,
   combo promotion area, and footer.
2. Make `/booking/search` a focused result view sharing the same search model.
   Results show room attributes, availability, a server-issued quote action,
   contextual empty/error/loading states, and retain the current accessible
   form semantics.
3. Carry the visual system into quote, HOLD success, guest lookup, login,
   customer account, booking detail, payment selection and payment status.
   The booking stepper must always reflect the current state without claiming
   that a browser return confirms payment.

### ADMIN operations journey

1. Replace the generic navigation with a resilient responsive application
   shell: branded sidebar, grouped navigation, visible active location,
   compact mobile navigation, top action/status area, and a usable skip link.
2. Turn the overview into an operations home: report KPIs, date filtering,
   revenue/breakdown views, recent bookings, payment attention and direct
   operation links. API-backed totals remain authoritative.
3. Elevate room operations into an Excel-inspired live board: a date-oriented
   room grid, reservation state, maintenance exclusion, housekeeping state and
   clear action paths. It must use the existing operations/housekeeping
   endpoints rather than enable client-side room allocation.
4. Apply the shared table/filter/form patterns to rooms, rate plans, coupons,
   bookings, payment reviews, maintenance, property and account configuration.
   Dense administration remains readable on a narrow viewport through stacked
   controls and horizontally contained data tables.

## Functional mapping from the workbook

| Workbook area      | Product UI outcome                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `Phòng`            | Operations board for booked/free intervals, cleaning state and notes.                                                           |
| `Đặt phòng`        | Searchable booking list/detail with guest, source, stay interval, combo, discount, extra-hour amount, total and payment status. |
| `Báo cáo` / `Dash` | Filterable revenue, booking, customer and category reporting.                                                                   |
| `Gửi khách`        | Booking confirmation and payment/booking-detail communication surfaces; no spreadsheet-driven contact action.                   |
| `Cài đặt`          | Admin configuration of rooms, tiers, combos/rate plans, sources and housekeeping states where existing backend support permits. |

The current product deliberately differs from the workbook in three ways:
physical room assignment is server-only, prices are configured and calculated
server-side, and payment confirmation comes only from a verified webhook/IPN.
The UI must communicate these conditions instead of modelling them in browser
state.

## Component architecture

Create a small `apps/web/src/components/ui` foundation only for primitives used
by two or more screens: logo/brand mark, button variants, status badge, section
heading, information tile, empty state, skeleton, app navigation and responsive
data-table wrapper. Keep page-specific information architecture in page or
feature components. Do not add a component package, a global client store,
new backend endpoints, or a third-party icon/motion dependency solely for the
redesign.

CSS design tokens in `globals.css` define colour, type scale, radius, shadow,
spacing, motion and status surfaces. Styling may be moved into focused CSS
modules only where global selectors would otherwise cross-contaminate a route.
Use CSS transform/opacity transitions, respect `prefers-reduced-motion`, and
do not introduce decorative animation that delays task completion.

## States and accessibility

Every redesigned async surface needs a shape-matched skeleton or clear loading
copy, a recoverable error message, and an intentional empty state. Forms retain
labels, help/error text and disabled/pending behavior. Keyboard focus is
visible, contrast meets WCAG AA, interactive targets remain at least 44px in
the customer flow, and navigation/table structures retain correct landmarks,
headings and table semantics.

## Responsive behaviour

The public hero becomes a single-column composition below the tablet breakpoint
and the booking form becomes a vertical, touch-friendly sequence. Room cards
become a scrolling single-row or one-column list only when their content stays
legible. The admin sidebar collapses to a compact navigation control; filter
forms stack; tables are contained in their own overflow region rather than
forcing page-wide horizontal scrolling.

## Verification

1. Add targeted component tests for changed public and admin critical surfaces
   and retain the existing contract/availability/quote tests.
2. Run web lint, typecheck and unit tests, followed by the project critical
   i18n check.
3. Run focused Playwright coverage for the public booking journey and the
   authenticated admin overview/room operation paths against the verified local
   web/API origin.
4. Inspect desktop and mobile screenshots for the home, search results, quote,
   admin overview, rooms board and booking list. Resolve clipping, overflow,
   unreadable contrast and focus defects before delivery.

## Explicit non-goals

This redesign does not import workbook bookings into PostgreSQL, add
multi-property/multi-tenant behavior, change payment settlement authority,
weaken RBAC, expose physical-room selection to customers, or claim production
provider readiness from local UI checks.
