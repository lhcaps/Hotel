# ADMIN booking date filter contract

The booking-list `checkInFrom` and `checkInTo` query parameters are calendar
dates in `YYYY-MM-DD` format. The browser sends the native date-input value
without locale formatting or JavaScript `Date` parsing.

The API resolves those dates in the active property's timezone. `checkInFrom`
becomes the local start of day, inclusive. `checkInTo` becomes the local start
of the following day, exclusive. For the current property timezone,
`Asia/Ho_Chi_Minh`, `2026-08-06` resolves to the UTC interval
`[2026-08-05T17:00:00.000Z, 2026-08-06T17:00:00.000Z)`.

The filter is by booking check-in instant, not stay-overlap. A booking whose
check-in is exactly at the local start of the selected day is included; one at
the next local midnight is excluded. A reversed range is rejected with HTTP
400 and the Vietnamese UI validation message. Empty or omitted dates remain
supported.

Submitting a filter resets pagination to page 1 and writes the applied filters
to the URL. Hard refresh and Back/Forward restore the URL state. API failure
renders one error state with retry and hides empty-state and pagination UI.
