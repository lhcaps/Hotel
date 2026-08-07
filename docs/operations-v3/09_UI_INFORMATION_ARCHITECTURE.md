# Customer and admin information architecture

## Current B0 local status

The local B0 customer flow now exposes a gated `multi_night` interval with
server-authored offers, component summary, night count, quote review, one-step
contact/payment, and one booking-management timeline. The public gate defaults
OFF; hourly and fixed overnight behavior remains unchanged when it is OFF.
The admin pricing-policy view uses structured fields, human labels, timestamps,
and confirmation dialogs; it has no raw JSON editor. Physical room identity is
still withheld from public/customer contracts and appears only in authorized
admin operational detail.

## Customer path

`/rooms` is browse-only. `/booking/search` (`apps/web/src/app/booking/search/page.tsx`) owns interval input and exact availability. `AvailabilitySearchForm` currently offers hourly and overnight modes, fixed 21:00-09:00/22:00-10:00 presets, and separate check-in/check-out date/time fields (`apps/web/src/components/availability-search-form.tsx:23-28,444-565`). `AvailabilitySearchResults` owns exact/nearby states and error mapping. Quote pages and `publicApi.issueQuote` own immutable quote review; `POST /api/v1/public/quotes/:quoteId/bookings` owns HOLD.

`overnight` remains the existing fixed one-night mode, including its URL/request
semantics and server validation. `multi_night` is a separate explicitly gated
mode with exact check-in/check-out date/time. Calendar night count is derived
presentation metadata; the exact interval and property timezone remain visible.

## Customer representation

`/account/bookings`, `/account/bookings/:bookingCode`, and `/booking/manage/:bookingCode` represent one booking timeline. The UI must show one quote/booking code/room type/total/payment/access/cancellation snapshot, not a nightly list. Physical room identity remains hidden from customer/public contracts.

## Admin navigation and views

Current routes under `apps/web/src/app/admin/(protected)` include accounts, amenities, audit, bookings, coupons, customer accounts, departments, maintenance, operational reviews, payment providers, payments, price tiers, property, rate plans, room operations, rooms, room types, and scanner. B0 adds duration/night-count/component/rationale to booking list/detail without turning the UI into a row-action collection. Housekeeping assignment, cleaner activity, and advanced operations workspaces remain later phases.

## B0 public boundary

The public form, search state, availability response, quote flow, and booking
flow is implemented locally behind the server-owned public gate. When the gate
is OFF, multi-night requests fail closed. When enabled only in the local B0
test environment, pricing remains server-authoritative, availability proves
existential room-type continuity for the full interval, and HOLD selects and
reserves exactly one physical room. The customer sees neither a room id/code
nor a promise based on split-room availability.

## Error and accessibility contract

Keep distinct invalid interval, no continuous same-room availability, pricing unavailable, catalog unavailable, API unavailable, expired quote, payment review, and access pending states. Remove `OVERNIGHT_ONE_NIGHT` copy only after server/API changes stop emitting it. Date/time fields have labels, timezone context, field errors, keyboard support, retry/loading/empty states, and responsive layouts.
