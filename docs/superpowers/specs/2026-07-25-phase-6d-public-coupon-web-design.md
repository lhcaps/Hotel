# Phase 6D — Public Coupon Web Flow — Design

**Status:** Approved for implementation
**Date:** 2026-07-25
**Addendum to:** [Phase 6C core design](2026-07-25-phase-6-coupon-core-design.md) and [Phase 6C concurrency hardening addendum](2026-07-25-phase-6-coupon-concurrency-hardening-design.md)
**Starting baseline:** `phase6-coupon-core-and-concurrency-hardening`
**Branch:** `phase5-booking-hold-guest-access`

## 1. Purpose

Phase 6D ships the public coupon Web flow on top of the Phase 6C server contract.

It adds:

- an optional coupon input on the existing public search/quote flow;
- server-authoritative pricing throughout the public flow;
- explicit transient coupon state (no URL, no Web Storage);
- clear/replace by new quote (no in-place mutation of an existing quote);
- stale-response protection on the public quote component;
- safe Vietnamese mappings for every new label and error message;
- HOLD requote / no fallback when the coupon revalidation fails;
- a safe coupon summary in HOLD and booking-detail responses by closing the
  accepted API contract gaps;
- a real desktop- and mobile-viewport Playwright vertical scenario;
- a real Playwright scenario that disables the coupon before HOLD and
  confirms the public HOLD is rejected with a safe domain error.

It does not add payment, MoMo / VNPAY, webhook/IPN, OAuth/profile work, ADMIN
coupon Web UI, coupon email distribution, automated refund, deployment, or
production SMTP/TLS work.

## 2. Strict scope boundary

Phase 6D closes:

- public request contract: only `couponCode` is sent;
- transient coupon state in component/form state only;
- clear-by-replace-quote (server-authoritative, no client-side price patching);
- stale-response protection via a monotonic load token and an AbortSignal on
  each in-flight public quote request;
- new Vietnamese error messages for the user-facing coupon failure surface;
- a safe snapshot in `BookingHoldResponse` and `BookingDetailResponse`;
- desktop and mobile real Playwright scenarios.

It explicitly stops before:

- ADMIN coupon Web UI (admin coupon APIs remain the only admin surface);
- any payment, gateway, IPN, return-route, or webhook work;
- any migration or Drizzle metadata change (0000–0010 and Drizzle metadata
  are frozen; Phase 6D only adds application and contract code).

## 3. Public contract additions

The accepted API contract now exposes a safe, denormalized coupon summary
object in both `BookingHoldResponse` and `BookingDetailResponse`:

```ts
bookingHoldCouponSummarySchema = {
  code: string, // normalized display code, e.g. "SUMMER-50K"
  discountType: 'FIXED' | 'PERCENTAGE',
  grossAmountVnd: integer,
  discountAmountVnd: integer,
  finalAmountVnd: integer,
};
```

The snapshot never includes:

- coupon UUID,
- email digest,
- phone number,
- application status,
- quota counts,
- raw audit reference.

The existing `couponQuoteSummarySchema` (returned on the public quote
response) is identical to the HOLD snapshot for the public-facing fields.
The public quote response also adds a `revalidationNotice` explaining that
the coupon discount is provisional and revalidated at HOLD.

The HOLD endpoint never accepts a `couponCode` field — the coupon is
attached at quote time and revalidated inside the HOLD transaction. The
public flow must never be able to attach a coupon that the quote never
validated.

## 4. Web flow

The public flow is implemented with the components already introduced in
Phase 4 and Phase 5:

- `AvailabilitySearchForm` — submits the search, performs a quote against
  the server, then navigates the browser to
  `/booking/quote/{quoteId}?roomTypeId=...&checkIn=...&checkOut=...&adults=...&children=...`
  with the search context in the URL only.
- `QuoteView` — receives the search context and the current quote ID. It
  issues the initial GET against `/api/v1/quotes/{quoteId}`, renders the
  `QuoteSummary`, and renders the new `CouponInput` beneath it.
- `QuoteContactForm` — submits the contact form to issue the HOLD.

### 4.1 Optional coupon input

`CouponInput` is a stateless rendering component that:

- shows one text input labelled exactly `Mã giảm giá`;
- shows an `Áp dụng` button when no coupon is applied on the current quote;
- shows a `Bỏ mã` button whenever `appliedCode` is non-null;
- trims the value before calling `onApply`;
- enforces the same `^[A-Za-z0-9-]{4,32}$` regular expression on the
  client only as a UI hint;
- never writes anything to the URL, `localStorage`, or `sessionStorage`;
- surfaces a safe Vietnamese error message in a `role="alert"` element;
- blocks duplicate submits while the request is in flight.

The component never owns the coupon code outside the form state. Once
`Áp dụng` returns, the only authoritative state is the server's quote
response; the input is reset and the component re-renders in the
"applied" view.

### 4.2 Transient coupon state

`CouponInput` state ownership rules:

- the input's `value` is component-local React state;
- the applied coupon code is derived from the server's quote response, not
  from the component's own state;
- `localStorage`, `sessionStorage`, and the URL never carry the coupon code;
- the URL keeps only the search context (room type, dates, occupancy) so
  that issuing a new quote from the quote page can replicate the same
  search without persisting coupon-sensitive data.

### 4.3 Clear / replace by new quote

Clicking `Bỏ mã` does not mutate the existing quote. It calls
`onApply('')` with an empty string, which triggers `reissueQuote('')` in
`QuoteView`. `reissueQuote('')` issues a new POST `/api/v1/quotes` without
`couponCode`, then navigates the browser to the new quote URL. The new
quote ID becomes the source of truth.

Clicking `Áp dụng` with a non-empty code follows the same path with
`couponCode` attached. The server is the only price authority.

### 4.4 Stale-response protection

`QuoteView` uses a `loadTokenRef` (a `useRef(0)` counter) to discard stale
public quote responses. On every new request — the initial load, an
`apply`, a `clear`, or a route change — the token is incremented. The
response handler compares the captured token against the current one and
discards any response whose token no longer matches. This protects the
component from out-of-order replies that would otherwise overwrite a
newer successful response with a slower earlier one.

The component also returns a React cleanup function that sets a local
`cancelled` flag to prevent setState after unmount.

### 4.5 Safe Vietnamese mappings

| API / domain code                 | Vietnamese message                                                       |
| --------------------------------- | ------------------------------------------------------------------------ |
| `COUPON_NOT_APPLICABLE`           | Mã giảm giá không hợp lệ hoặc không áp dụng cho hạng phòng này.          |
| `COUPON_NOT_FOUND_OR_UNAVAILABLE` | Mã giảm giá không hợp lệ hoặc không áp dụng cho hạng phòng này.          |
| `COUPON_EXPIRED`                  | Mã giảm giá đã hết hạn.                                                  |
| `COUPON_MINIMUM_NOT_MET`          | Đơn đặt phòng chưa đạt giá trị tối thiểu của mã giảm giá.                |
| `COUPON_HOLD_WINDOW_INCOMPATIBLE` | Mã giảm giá không áp dụng cho khung giờ này.                             |
| `COUPON_REQUOTE_REQUIRED`         | Điều kiện mã giảm giá đã thay đổi. Vui lòng tạo báo giá mới để tiếp tục. |
| `COUPON_LIMIT_REACHED`            | Mã giảm giá đã hết lượt sử dụng.                                         |
| `COUPON_CUSTOMER_LIMIT_REACHED`   | Mã giảm giá đã đạt giới hạn sử dụng cho khách này.                       |

The error mapping covers both `BookingApiError` (holds) and `AdminApiError`
(quotes) so the public quote component can render the same Vietnamese
message regardless of which endpoint surfaces the failure.

## 5. HOLD requote / no fallback

When the HOLD endpoint rejects a coupon-attached quote with one of the
coupon-revalidation codes, the Web flow must not retry with a different
client-side discount. The Phase 6C transaction is the only authority, and
the safe envelope is the only thing the client must look at. The flow:

1. The user submits the contact form.
2. The server returns a 4xx with a problem-details body containing one of
   the safe coupon codes from the table above.
3. The contact form surfaces the safe Vietnamese message in a `role="alert"`
   element.
4. The user must click back into the quote page and either reissue the
   quote without the coupon, drop the coupon entirely, or apply a
   different code.

The Web flow does not retry the HOLD. It does not patch the displayed
total. It does not write a fresh quote under the hood. The only path
forward is a new quote, which is what the user's high-level intent is
after the conditions changed.

## 6. Safe coupon summary in HOLD / detail

The accepted API contract gap is closed by:

- adding `bookingHoldCouponSummarySchema` to `@room/contracts`;
- extending `BookingHoldResponse` and `BookingDetailResponse` with an
  optional `coupon` field of that type;
- reading the snapshot from `booking_coupon_applications` joined to
  `bookings` in the booking-detail repository;
- parsing the snapshot through the contract schema at the controller
  boundary so every outgoing response is contract-validated.

The repository SQL filters by `application_status IN ('ASSOCIATED',
'RESERVED', 'REDEEMED')` so that released applications never reappear in
the booking detail. The hold-response snapshot is computed in the
`BookingHoldService` from the in-memory `BookingHoldResult.coupon` and
re-parsed through the contract schema.

## 7. Acceptance evidence

Phase 6D is accepted when:

1. The unit tests added under `apps/web/test/coupon-*.test.tsx`,
   `apps/web/test/quote-summary.test.tsx`,
   `apps/web/test/hold-coupon-summary.test.tsx`,
   `apps/web/test/booking-detail-coupon-summary.test.tsx`, and
   `apps/web/test/quote-view-coupon.test.tsx` pass.
2. The API tests added under `apps/api/test/booking/booking-hold.service.test.ts`
   and `apps/api/test/booking/booking-detail.service.test.ts` pass.
3. The Playwright spec `tests/e2e/phase6d-public-coupon.spec.ts` runs
   green against the live stack and includes:
   - a desktop vertical flow that applies, clears, re-applies, and completes
     the HOLD with the coupon summary;
   - a mobile-viewport variant of the same flow;
   - an admin-disable-before-HOLD scenario that confirms the HOLD is
     rejected with `COUPON_REQUOTE_REQUIRED`.
4. The OpenAPI docs are regenerated and the snapshot diff is limited to
   the new `coupon` field on the public HOLD and booking-detail responses.
5. No migration files 0000 through 0010 and no Drizzle metadata files are
   modified.
