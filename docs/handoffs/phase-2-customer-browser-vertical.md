# Phase 2 Handoff: Customer Browser Vertical Closure

## Summary

Phase 2 closed the customer browser vertical end-to-end through the real
Chromium stack. A customer can search the truthful rendering of the
production room catalog, obtain a quote on a real DB room type, hold
the booking, verify the OTP delivered to Mailpit, complete the payment
through either MoMo or VNPAY via the loopback simulator, and reach the
**Đặt phòng thành công** surface. The booking remains reachable across
refresh and direct URL reopen through the persistent
`/booking/manage/{bookingCode}` route, which depends only on the
HttpOnly guest session cookie.

The local demo is **not yet fully ready** (`LOCAL_DEMO_READY=NO`); the
customer vertical is complete, but Phase 3 (ADMIN), Phase 4
(deterministic demo verifier), Phase 5 (presentation/accessibility
review), and Phase 6 (release/CI gates) remain.

## Repository state

| Item                             | Value                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Branch                           | `phase2-customer-browser-vertical`                                                                              |
| Phase 1 final HEAD               | `e5e095e85ebc3415b75367779ac9cead2d893c5f`                                                                     |
| Phase 2 start SHA                | `f4eb1e0` (first Phase 2 commit, on top of `e5e095e`)                                                           |
| Functional HEAD (last code)      | `61e80d947834b6ee084f44206066a1a7a366a780` (see Commit chain)                                                  |
| Phase 2 handoff parent SHA       | `61e80d947834b6ee084f44206066a1a7a366a780` (this handoff commit will sit on top)                                |
| Working tree at end of phase     | clean (Next.js dev tooling rewrites `apps/web/next-env.d.ts` during Playwright runs; restored on each closure) |
| Phase 2 production changes       | YES (see Rollback boundary for the exact source files)                                                         |
| Released migration SQL changes   | 0                                                                                                              |
| Package version changes          | 0                                                                                                              |

## Commit chain (7 forward-only commits on top of `e5e095e`)

```
61e80d9 test(e2e): assert exactly one confirmation email per phase 2 vertical
8ad270e chore(format): resolve prettier regression in booking detail panel
22b44f7 fix(web): close phase 2 customer vertical edge cases
49a2a41 feat(web): persist guest booking access by booking-code route
da72f8d feat(web): add browse-only room availability action
e816bd8 fix(web): remove fabricated public room fallback
f4eb1e0 test(web): reproduce phase 2 customer vertical gaps
```

Author / committer on every commit: `lhcaps <huyle210525@gmail.com>`.
Zero `Co-authored-by:` trailers.

## Implementation evidence

### 1. Truthful public catalog implementation

Section A of the Phase 2 prompt required that the public catalog never
fabricate room entities. Implementation:

- New module `apps/web/src/lib/public-catalog-state.ts` defines the
  typed `PublicCatalogState = ready | empty | unavailable` model.
- `apps/web/src/app/rooms/page.tsx` and the featured-rooms section of
  `apps/web/src/components/public-landing.tsx` now render only the
  data returned by `loadPublicRoomCatalog()`. No static
  `fallbackRooms` array is constructed anywhere.
- `READY` shows the DB room cards with the existing deterministic
  static image fallback. `EMPTY` shows the localized
  *Chưa có hạng phòng đang được mở bán* notice. `UNAVAILABLE` shows
  the localized temporary error with a retry link.
- New web unit tests
  `apps/web/test/public-catalog-state.test.ts` and an updated
  `public-homepage.test.tsx` lock the contract.

Evidence: tests `A. public catalog unavailable shows truthful error,
not fallback rooms` and `B. browse-only room detail renders in-page
availability CTA` in `tests/e2e/phase2-customer-browser-vertical.spec.ts`.

### 2. Browse-only room detail CTA

Section 3 of the prompt required a `/rooms/{roomTypeId}` page that
shows the DB room type and prompts the customer to choose an interval
before any availability claim is made.

- `apps/web/src/app/rooms/[roomTypeId]/page.tsx` reads
  `readBookingSearchQuery(search)` and conditionally renders either
  the in-page **Kiểm tra tình trạng phòng** card (uses the existing
  `AvailabilitySearchForm` in `search` variant) or the existing
  `RoomDetailQuoteAction` when the interval is already in the URL.
- No timetable is implied when the interval is missing.

Evidence: same `B. browse-only room detail renders in-page
availability CTA` test as above.

### 3. Guest booking route

Section 4 of the prompt required a persistent, cookie-authenticated
booking route. Implementation:

- `apps/web/src/app/booking/manage/[bookingCode]/page.tsx` is a
  server component that renders `GuestBookingRouteClient`.
- `GuestBookingRouteClient` validates the booking code against the
  public `BOOKING_CODE_PATTERN`, calls
  `bookingApi.getGuestBooking(bookingCode)` (which uses the HttpOnly
  guest cookie), and conditionally renders
  `ConfirmedSuccessPanel` + `BookingDetailPanel` +
  `PaymentStatusSummary`.
- 401/404 responses are handled in the client (no email, OTP,
  challengeRef, or token in the URL).
- The legacy `/booking/manage` OTP entry route now calls
  `router.replace('/booking/manage/${bookingCode}')` after a
  successful OTP verify, so the persistent route is reached in the
  same browser session.

Evidence: test `C. guest session refresh keeps /booking/manage/{code}
authoritative` and unit tests in
`apps/web/test/guest-booking-route.test.tsx`.

### 4. Session persistence through provider return

Section 5 of the prompt required that the provider return navigate
back to the persistent route without leaking any secret in the URL.
Implementation:

- The payment provider simulator
  (`tests/e2e/_fixtures/payment-provider-simulator.mjs`) accepts a
  control-plane `backRedirectUrl`. The URL must be loopback
  (`localhost`, `127.0.0.1`, or `::1`) and must use `http` or
  `https`; the simulator rejects every other host or scheme.
- The two primary vertical tests set `backRedirectUrl` to the
  loopback booking-manage URL before they click the MoMo / VNPAY
  button. The simulator renders the existing checkout page and
  emits a `setTimeout` that redirects the browser back after the IPN
  has settled.
- Query parameters on the return URL are display/navigation hints
  only. The server `payment-status` endpoint is authoritative for
  booking confirmation.

Evidence: tests `1. MoMo complete vertical desktop`, `2. VNPAY
complete vertical desktop`, and `3. MoMo complete vertical mobile`.

### 5. Confirmed success surface

Section 7 of the prompt required a terminal success surface that
renders only when `paymentStatus === SUCCEEDED` and `bookingStatus
=== CONFIRMED`. Implementation:

- `apps/web/src/components/confirmed-success-panel.tsx` renders the
  typed `Đặt phòng thành công` heading, the booking code, room type,
  localized interval, amount, payment provider, the email
  confirmation notice, and the print / manage / home actions.
- The component never embeds the physical room number, the internal
  booking UUID, the payment attempt ID, the provider signature, or
  the raw webhook payload.
- The `BookingDetailPanel` lives next to the success surface so the
  customer can see the rest of the booking detail; if the page is
  reloaded, the success surface re-renders from the authoritative
  server state.

Evidence: tests `1. MoMo complete vertical desktop`, `2. VNPAY
complete vertical desktop`, and `3. MoMo complete vertical mobile`
all assert the heading text and the `confirmed-success-surface`
region. Unit tests in
`apps/web/test/confirmed-success-panel.test.tsx` cover the
accessibility and data-hygiene rules.

### 6. MoMo browser vertical

Section 9 of the prompt required the full MoMo vertical in the real
browser. Implementation:

- The test performs the entire sequence through Playwright with the
  booking created only via the public API helper (used to seed the
  pre-condition). The browser then clicks the **Thanh toán qua MoMo**
  button, lands on the simulator, the simulator posts a signed IPN,
  the browser returns to the persistent route, and the page reloads
  the success surface.
- The test asserts: no console errors, no unexpected failed
  requests, no HTTP 5xx, no physical room identity, exactly one
  confirmation email in Mailpit, and the success surface persists
  across a reload.

Evidence: tests `1. MoMo complete vertical desktop → Đặt phòng thành
công → refresh` and `3. MoMo complete vertical mobile → Đặt phòng
thành công`.

### 7. VNPAY browser vertical

Section 10 of the prompt required the same vertical for VNPAY. The
fixture-driven `2. VNPAY complete vertical desktop → Đặt phòng thành
công` test creates a new booking so the two verticals are independent
and the VNPAY simulator route, signed IPN, CONFIRMED transition, and
single confirmation email are all asserted.

### 8. Signed settlement and forged return evidence

Section 11 of the prompt required negative payment authority tests.
Implementation:

- `F. provider return is non-authoritative: forged URL does not
  confirm` opens a return URL with success-looking query parameters
  but no IPN; the booking stays HOLD and the success surface is not
  rendered.
- `11.A. forged return URL does not confirm a MoMo HOLD` extends the
  check to the API: payment status does not become SUCCEEDED.
- `11.B. invalid-signature MoMo IPN is rejected` sets the simulator
  to `tamper` mode; the API logs `MOMO_IPN_REJECTED` and the payment
  does not become SUCCEEDED.
- `11.C. duplicate valid MoMo IPN settles exactly once` sets
  `duplicateIpns: true` on the simulator; the API logs
  `momo.ipn.settled` twice with the second event tagged
  `DUPLICATE`. The booking is CONFIRMED exactly once and exactly one
  confirmation email is delivered.
- `11.D. duplicate valid VNPAY IPN settles exactly once` mirrors the
  MoMo duplicate guard for VNPAY.

Evidence: integrated test suite
`tests/e2e/phase2-customer-browser-vertical.spec.ts`.

### 9. Payment-state model

Section 6 of the prompt required explicit state rendering in the
customer payment UI. Implementation:

- `apps/web/src/components/payment-status-summary.tsx` returns
  `null` only when the load is still pending and the cached
  `status` is empty; every other state surfaces the localized
  label, the provider, the attempt status, and the booking status.
- `PaymentProviderSelector` blocks duplicate provider attempts while
  a MoMo or VNPAY attempt is pending.
- The persistent route auto-refreshes the booking once the IPN
  settles, so the PENDING → SUCCEEDED transition is observed via
  the next reload.

### 10. Mobile / responsive evidence

Section 14 of the prompt required the customer vertical to remain
free of horizontal overflow on the targeted mobile viewports.

- The mobile vertical test (3. MoMo complete vertical mobile) sets
  `setViewportSize({ width: 390, height: 844 })` and asserts that
  `documentElement.scrollWidth` and `body.scrollWidth` stay within
  `window.innerWidth + 80` (the 80px tolerance absorbs Next.js
  dev-only chrome such as the dev-tools button).
- The test still passes after the Phase 2 work introduced the public
  catalog truthfulness, the confirmed-success surface, and the
  persistent booking route.

### 11. Static / database gates

| Gate                              | Result |
| --------------------------------- | ------ |
| `pnpm format:check`               | PASS   |
| `pnpm lint`                       | PASS   |
| `pnpm typecheck`                  | PASS   |
| `pnpm test:unit`                  | PASS (314 tests across 15 packages) |
| `pnpm build`                      | PASS   |
| `pnpm db:check`                   | PASS   |
| `pnpm db:test`                    | PASS (164 tests across 22 files) |
| `pnpm test:integration`           | PASS (132 tests across 24 files) |
| `pnpm test:pricing`               | PASS (29 tests)  |
| `pnpm test:availability`          | PASS (5 tests)   |
| `pnpm test:quotes`                | PASS (3 tests)   |
| `pnpm check:openapi`              | PASS   |
| `pnpm check:endpoints`            | PASS (85 runtime routes, 81 documented, 4 explicitly allowlisted) |
| `pnpm check:i18n-critical`        | PASS (0 Vietnamese -> Latin leaks in 115 critical source files) |
| `pnpm audit:deps`                 | PASS (0 high / 0 critical vulnerabilities) |
| `pnpm demo:preflight`             | PASS (15/15 checks) |
| `pnpm demo:lifecycle-test`        | PASS (15/15 checks) |
| `pnpm demo:smoke`                 | PASS (22/22) |

### 12. Phase 2 E2E runs

Run 1 (workers=1, retries=0):

```
11 passed (24.2s)
```

Run 2 (workers=1, retries=0, same commit):

```
11 passed (24.0s)
```

Deterministic skip count: 0. Retry count: 0. Both runs pass.

### 13. Regression suites

`pnpm exec playwright test tests/e2e/public-booking-vertical-flow.spec.ts
tests/e2e/landing-nearby-journey.spec.ts tests/e2e/phase6d-public-coupon.spec.ts
tests/e2e/phase1-browser-api-seams.spec.ts --workers=1 --retries=0`

```
13 passed (31.5s)
```

### 14. Worktree evidence

```
$ git status --short
(no output — working tree clean)
```

### 15. Accessibility & i18n

- `public-catalog-state.test.ts` covers the ready / empty / unavailable
  states for the public catalog.
- `confirmed-success-panel.test.tsx` includes a `jest-axe`
  a11y check for the terminal success surface.
- `guest-booking-route.test.tsx` covers the persistent route
  contract, including data hygiene (no OTP / email / cookie in URL or
  storage).
- `check:i18n-critical` confirms zero Vietnamese->Latin leaks in the
  115 critical source files.
- `BookingDetailPanel` uses `role="alert"` only when reporting a
  session expiry or a not-found error. The `ConfirmedSuccessPanel`
  uses `role="region"` with a labelled heading and a `role="status"`
  paragraph for the email confirmation notice.

### 16. Static/database gates worktree

Clean at the end of Phase 2:
```
$ git status --short
(no output)
```

## Remaining Phase 3+ blockers

1. **Phase 3 ADMIN vertical**: manage booking lifecycle, payment
   reconciliation, refund, and review operations are not in scope for
   Phase 2 and must not be claimed as closed.
2. **Phase 4 deterministic demo verifier**: a single-command verifier
   that spins up the demo, runs the customer vertical, and tears
   everything down is still pending.
3. **Phase 5 final presentation / accessibility review**: a
   second-pass accessibility sweep across the entire customer
   surface (not just the terminal states) is still pending.
4. **Phase 6 release / CI gates**: tag, release notes, CI packaging,
   and version promotion are still pending.

## Rollback boundary

The Phase 2 changes are scoped to the customer browser vertical. The
following source files are touched by Phase 2:

- `apps/web/src/app/booking/manage/[bookingCode]/page.tsx` (new)
- `apps/web/src/app/booking/manage/[bookingCode]/guest-route-client.tsx` (new)
- `apps/web/src/app/booking/manage/page.tsx` (one-line redirect)
- `apps/web/src/app/rooms/page.tsx` (truthful catalog state)
- `apps/web/src/app/rooms/[roomTypeId]/page.tsx` (browse-only CTA)
- `apps/web/src/app/globals.css` (mobile header + breakpoint fixes)
- `apps/web/src/components/public-landing.tsx` (truthful catalog state)
- `apps/web/src/components/booking-detail-panel.tsx` (mobile layout + masked-email fallback)
- `apps/web/src/components/confirmed-success-panel.tsx` (new)
- `apps/web/src/lib/public-catalog-state.ts` (new)
- `apps/web/src/lib/i18n/messages.ts` (new i18n keys)
- `apps/web/test/public-catalog-state.test.ts` (new)
- `apps/web/test/confirmed-success-panel.test.tsx` (new)
- `apps/web/test/guest-booking-route.test.tsx` (new)
- `tests/e2e/_fixtures/payment-provider-simulator.mjs` (back-redirect)
- `tests/e2e/_fixtures/payment-test-helpers.mjs` (contactEmail field)
- `tests/e2e/phase2-customer-browser-vertical.spec.ts` (new)

Rolling back to `e5e095e` (the Phase 1 final HEAD) reverts every
Phase 2 change. The payment provider simulator back-redirect is
purely additive: `backRedirectUrl` defaults to `""` and the existing
`phase1-browser-api-seams` test suite does not set it, so the
behavior is unchanged when the Phase 2 test is not running.
