# Phase 5 + Phase 6C/6D Public Route Matrix

This document is the authoritative inventory of every Phase 5 and Phase 6C/6D
public HTTP route shipped by `@room/api`. The route matrix is derived directly
from the controllers under `apps/api/src/booking/` and `apps/api/src/pricing/`.
Every route is mounted under the global `/api` prefix with `@Version('1')`.

Auth legend:

- `none` — no credentials required.
- `cookie` — requires the `rm_guest_session_v1` HttpOnly cookie (and the session
  must be active and scoped to the requested booking).

Cookie column legend:

- `none` — no `Set-Cookie` header is produced.
- `set` — controller emits `Set-Cookie: rm_guest_session_v1=...; HttpOnly;
SameSite=Lax; Path=/; Max-Age=1800`. The `Secure` attribute is added when
  `NODE_ENV === 'production'`.
- `clear` — controller emits `Set-Cookie: rm_guest_session_v1=; Max-Age=0;
Path=/` to drop the cookie.

Idempotency column legend:

- `safe-replay` — a repeated identical HOLD request resolves to the same
  booking. The response carries `idempotent: true` and `bookingCode` is the
  same as the first request.
- `decoy` — repeated OTP requests may return a fresh challenge or a rate-limit
  error; the response shape is intentionally identical to the real path so the
  caller cannot tell them apart.
- `none` — no special idempotency contract.

| Route                                      | Method | Auth                                       | Request schema                   | Response schema                                            | Cookies            | Idempotency   | Possible public errors                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ------ | ------------------------------------------ | -------------------------------- | ---------------------------------------------------------- | ------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/public/quotes/{quoteId}/bookings` | POST   | none                                       | `createBookingHoldRequestSchema` | `bookingHoldResponseSchema` (optional `coupon` snapshot)   | none               | `safe-replay` | `QUOTE_NOT_FOUND` (404), `QUOTE_EXPIRED` (409), `QUOTE_ALREADY_USED` (409), `ROOM_TYPE_UNAVAILABLE` (409), `ALLOCATION_BUSY` (409), `STALE_HOLD_CLEANUP_RETRY` (503), `COUPON_REQUOTE_REQUIRED` (409), `COUPON_HOLD_WINDOW_INCOMPATIBLE` (409), `COUPON_MINIMUM_NOT_MET` (409), `COUPON_LIMIT_REACHED` (409), `COUPON_CUSTOMER_LIMIT_REACHED` (409), `COUPON_EXPIRED` (409), `INTERNAL_ERROR` (500), `VALIDATION_ERROR` (400) |
| `/api/v1/public/guest-access/otp/request`  | POST   | none                                       | `guestAccessOtpRequestSchema`    | `guestAccessOtpRequestResponseSchema`                      | none               | `decoy`       | `OTP_RATE_LIMITED` (429, includes `retryAfterSeconds`), `VALIDATION_ERROR` (400)                                                                                                                                                                                                                                                                                                                                              |
| `/api/v1/public/guest-access/otp/verify`   | POST   | none                                       | `guestAccessOtpVerifySchema`     | `guestAccessOtpVerifyResponseSchema`                       | `set` (on success) | none          | `OTP_INVALID_OR_EXPIRED` (400), `OTP_RATE_LIMITED` (429), `VALIDATION_ERROR` (400)                                                                                                                                                                                                                                                                                                                                            |
| `/api/v1/public/bookings/{bookingCode}`    | GET    | `cookie`                                   | path only                        | `bookingDetailResponseSchema` (optional `coupon` snapshot) | none               | none          | `GUEST_SESSION_REQUIRED` (401), `GUEST_SESSION_INVALID` (401), `BOOKING_NOT_FOUND` (404), `VALIDATION_ERROR` (400)                                                                                                                                                                                                                                                                                                            |
| `/api/v1/public/booking-holds/status`      | POST   | none                                       | `bookingHoldStatusRequestSchema` | `bookingHoldStatusResponseSchema`                          | none               | `decoy`       | `VALIDATION_ERROR` (400) only — service returns `HOLD`/`EXPIRED`/`UNKNOWN` for every known input                                                                                                                                                                                                                                                                                                                              |
| `/api/v1/public/guest-access/logout`       | POST   | none (revokes whatever session is present) | empty                            | `guestLogoutResponseSchema`                                | `clear`            | none          | none — always returns 200                                                                                                                                                                                                                                                                                                                                                                                                     |

## Phase 4 public routes that still ship

These routes pre-date Phase 5 and remain part of the public surface. They will
move to `docs/openapi/public-v1.json` together with the Phase 5 routes.

| Route                         | Method | Auth | Notes                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/availability/search` | POST   | none | Search by interval; returns room-type availability, no physical-room identifiers.                                                                                                                                                                                                                                                                                                        |
| `/api/v1/quotes`              | POST   | none | Server-authoritative, immutable fifteen-minute quote snapshot. Optional `couponCode` field applies the coupon at quote time only. The response carries the optional `coupon` summary object with `code`, `discountType`, `grossAmountVnd`, `discountAmountVnd`, `finalAmountVnd`, and a `revalidationNotice` explaining that the coupon discount is provisional and revalidated at HOLD. |
| `/api/v1/quotes/{id}`         | GET    | none | Quote retrieval; same envelope as create.                                                                                                                                                                                                                                                                                                                                                |

## Cookie specification

| Attribute   | Value                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Cookie name | `rm_guest_session_v1`                                                                                                              |
| Path        | `/`                                                                                                                                |
| `HttpOnly`  | always                                                                                                                             |
| `SameSite`  | `Lax`                                                                                                                              |
| `Secure`    | when `NODE_ENV === 'production'`, otherwise omitted                                                                                |
| `Max-Age`   | bounded by `GUEST_SESSION_TTL_MS` (default 1800 seconds = 30 minutes)                                                              |
| Persistence | only the SHA-256 digest of the raw token is stored in `guest_sessions.token_digest`; the raw token never leaves the user's browser |

## Coupon summary snapshot

Three responses carry the same optional `coupon` snapshot object once a
coupon has been applied. The shape is fixed by
`bookingHoldCouponSummarySchema` in `@room/contracts`:

```json
{
  "code": "SUMMER-50K",
  "discountType": "FIXED",
  "grossAmountVnd": 359000,
  "discountAmountVnd": 50000,
  "finalAmountVnd": 309000
}
```

The snapshot is intentionally denormalized and never includes the coupon
UUID, the application status, the per-customer hash, the audit reference,
or any other internal identifier. Quotes, booking holds, and booking
details all return the same shape; the booking-detail response reads it
through a `booking_coupon_applications` join filtered by
`application_status IN ('ASSOCIATED', 'RESERVED', 'REDEEMED')` so that
released applications never reappear.

The coupon revalidation at HOLD time is the only authority on whether
the discount is still honoured. Any drift between the quote and the
HOLD (changed `validUntil`, coupon disabled, quota exhausted, scope
removed) is surfaced as `COUPON_REQUOTE_REQUIRED` and the public Web
flow must reissue a fresh quote instead of patching the displayed total.

## What is NOT exposed

- `roomId` / `roomNumber` — physical-room identifiers are never returned.
- `quoteId`-bound internal UUIDs of `quoteLineItems` — only aggregate fields.
- Any plain-text `email` / `phone` of the booking contact — `bookingDetailResponseSchema`
  exposes `emailMasked` and `phoneMasked` only.
- The session token itself — `rm_guest_session_v1` is delivered via
  `Set-Cookie` and never appears in a response body.
