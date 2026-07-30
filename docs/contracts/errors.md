# Public Error Catalog (Phase 5 + Phase 6C/6D)

This document is the authoritative public error catalog for every
Phase 5 and Phase 6C/6D route in `apps/api/src/booking/` and
`apps/api/src/pricing/`. Each error is delivered as an
RFC 7807 `application/problem+json` envelope by
`apps/api/src/errors/problem-details.filter.ts`. The HTTP status, public
`type` prefix, and stable `code` field are part of the contract.

Every documented error below corresponds to a code that is mapped in
`ProblemDetailsFilter`. Only codes that have a real mapping are listed;
no internal database or stack-trace information is published.

## Error envelope

Every public error response has the following shape:

```json
{
  "type": "<stable kebab-case namespace>",
  "title": "<short human title>",
  "status": 400,
  "code": "<STABLE_UPPER_SNAKE_CASE>",
  "detail": "<safe public description>",
  "requestId": "<correlation id>",
  "errors": [{ "field": "...", "message": "..." }]
}
```

The `requestId` field is non-PII (it is the API correlation id, not the
internal booking or quote UUID).

## Catalog

| Code                              | HTTP status | Public `type`                                  | Public meaning                                                                                       | Retryable                       | Information intentionally hidden       | UI handling guidance                                                       |
| --------------------------------- | ----------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `QUOTE_NOT_FOUND`                 | 404         | `quote-unavailable`                            | Quote id does not exist (or was consumed).                                                           | no (re-quote)                   | internal quote UUID, lookup trace      | Show "quote unavailable" + button to start a new search.                   |
| `QUOTE_EXPIRED`                   | 409         | `quote-expired`                                | Quote is past `expiresAt` (15-minute window).                                                        | no (re-quote)                   | clock drift between client and server  | Prompt the user to re-search availability; do not retry the same quote.    |
| `ROOM_TYPE_UNAVAILABLE`           | 409         | `booking-hold-room-type-unavailable`           | No structurally allocatable rooms for the requested interval.                                        | no (re-quote)                   | existence-probe detail, lock counters  | Prompt to try a different room type or interval.                           |
| `ALLOCATION_BUSY`                 | 409         | `booking-hold-allocation-busy`                 | All eligible rooms are currently locked by concurrent transactions.                                  | yes (small backoff)             | lock holder identity, retry counters   | Show retry button with 1–2 second backoff.                                 |
| `STALE_HOLD_CLEANUP_RETRY`        | 503         | `booking-hold-stale-hold-cleanup-retry`        | Targeted stale-HOLD cleanup hit its safety bound; the request should be retried after a short delay. | yes (later)                     | cleanup batch size, internal counters  | Show "system busy" + retry after 30 seconds.                               |
| `QUOTE_ALREADY_USED`              | 409         | `booking-hold-quote-already-used`              | Quote was consumed by a different contact.                                                           | no                              | winning booking id, contact hash       | Prompt the user to start a new search with a fresh quote.                  |
| `CONTACT_VALIDATION_FAILED`       | 400         | `validation-error`                             | One or more fields in the contact object failed validation (per-issue list).                         | no                              | raw validator output, library trace    | Highlight offending fields from the `errors` array.                        |
| `OTP_INVALID_OR_EXPIRED`          | 400         | `otp-invalid-or-expired`                       | The provided OTP is wrong, expired, replaced, or referenced an unknown challenge.                    | no (request new challenge)      | which constraint failed, digest labels | Show a generic "code invalid" message; do not reveal which rule failed.    |
| `OTP_RATE_LIMITED`                | 429         | `otp-rate-limited`                             | Per-booking+email request window, per-IP window, or resend cooldown hit.                             | yes (`retryAfterSeconds` field) | counters, window bounds                | Show a countdown driven by `retryAfterSeconds`.                            |
| `GUEST_SESSION_REQUIRED`          | 401         | `guest-session-required`                       | The booking-detail endpoint received no `rm_guest_session_v1` cookie.                                | no (re-verify)                  | why the cookie was missing             | Route the user to the OTP verify flow.                                     |
| `GUEST_SESSION_INVALID`           | 401         | `guest-session-invalid`                        | The cookie token failed scope, digest, or expiry checks (or was revoked by logout).                  | no (re-verify)                  | mismatch detail, digests               | Route the user to the OTP verify flow.                                     |
| `COUPON_NOT_APPLICABLE`           | 409         | `booking-hold-coupon-not-applicable`           | The coupon is not valid for the requested room type or rate plan. Surfaced on `POST /api/v1/quotes`. | no (re-quote)                   | mapping rules, room-type union         | "Mã giảm giá không hợp lệ hoặc không áp dụng cho hạng phòng này."          |
| `COUPON_EXPIRED`                  | 409         | `booking-hold-coupon-expired`                  | The coupon is outside its validity window (`validFrom` > now or `validUntil` <= now).                | no (re-quote)                   | clock drift, exact timestamps          | "Mã giảm giá đã hết hạn."                                                  |
| `COUPON_MINIMUM_NOT_MET`          | 409         | `booking-hold-coupon-minimum-not-met`          | The quote total is below the coupon's `minimumOrderAmountVnd`.                                       | no (re-quote)                   | minimum amount, actual gross           | "Đơn đặt phòng chưa đạt giá trị tối thiểu của mã giảm giá."                |
| `COUPON_HOLD_WINDOW_INCOMPATIBLE` | 409         | `booking-hold-coupon-hold-window-incompatible` | `validUntil` is before the HOLD expiry the server would issue.                                       | no (re-quote)                   | computed hold expiry, validUntil       | "Mã giảm giá không áp dụng cho khung giờ này."                             |
| `COUPON_REQUOTE_REQUIRED`         | 409         | `booking-hold-coupon-requote-required`         | The coupon identity drifted from the quote (definition changed, disabled, or no longer resolvable).  | no (re-quote)                   | snapshot identity, audit reference     | "Điều kiện mã giảm giá đã thay đổi. Vui lòng tạo báo giá mới để tiếp tục." |
| `COUPON_LIMIT_REACHED`            | 409         | `booking-hold-coupon-limit-reached`            | The coupon's `totalUsageLimit` has been consumed.                                                    | no (re-quote)                   | remaining quota, count details         | "Mã giảm giá đã hết lượt sử dụng."                                         |
| `COUPON_CUSTOMER_LIMIT_REACHED`   | 409         | `booking-hold-coupon-customer-limit-reached`   | The coupon's `perCustomerLimit` has been consumed for this contact.                                  | no (re-quote)                   | historical usage, contact hash         | "Mã giảm giá đã đạt giới hạn sử dụng cho khách này."                       |

## Validation errors

`VALIDATION_ERROR` (HTTP 400, type `validation-error`) is produced for any
schema rejection. The `errors` array carries per-field issues:

```json
{
  "type": "validation-error",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "contact.email", "message": "Invalid email" }]
}
```

The `field` paths are limited to the public request body and never include
internal state. `contact.*` paths are the only paths that ever surface in a
public booking error.

## What is NOT in the catalog

- SQLSTATE codes, Postgres constraint names, raw exception messages — these
  are never returned in the `detail` field.
- Internal UUIDs for bookings, quotes, audit events, outbox events.
- The OTP itself, the session token, or the challenge secret.
- Decoy-path discrimination: the OTP request endpoint returns the same
  envelope shape for real and decoy paths so a passive observer cannot tell
  them apart. There is no error code that signals "unknown booking".
