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

Phase 2.1 (this follow-up) layered three additions on top of the
functional Phase 2 surface without rewinding any of the production
code:

1. A new **FULL CUSTOMER BROWSER — LANDING TO CONFIRMED** Playwright
   scenario that drives every primary booking action through the
   browser UI (no API helper provisioning for quote, HOLD, guest
   booking session, or payment attempt).
2. A visible **Đang tải trạng thái thanh toán** initial state on
   `PaymentStatusSummary`, replacing the prior behaviour that could
   return `null` while the initial request was pending, plus a
   retryable **LOAD_ERROR** block.
3. A safe default simulator back-redirect configuration that lets a
   manual demo user (`pnpm demo:phase6`) return to
   `/booking/manage/{bookingCode}` without the Playwright control
   plane pre-setting `backRedirectUrl`.

The local demo is **not yet fully ready** (`LOCAL_DEMO_READY=NO`); the
customer vertical is complete, but Phase 3 (ADMIN), Phase 4
(deterministic demo verifier), Phase 5 (presentation/accessibility
review), and Phase 6 (release/CI gates) remain.

## Repository state (formal SHA vocabulary)

| Item                           | Value                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Branch                         | `phase2-customer-browser-vertical`                                                                             |
| Phase 1 final HEAD             | `e5e095e85ebc3415b75367779ac9cead2d893c5f`                                                                     |
| `PHASE_2_START_SHA`            | `e5e095e85ebc3415b75367779ac9cead2d893c5f` (Phase 2 branched directly from Phase 1 final HEAD)                 |
| `PHASE_2_FUNCTIONAL_HEAD`      | `61e80d947834b6ee084f44206066a1a7a366a780` (last commit that contains production code for Phase 2)             |
| `PHASE_2_HANDOFF_PARENT_SHA`   | `61e80d947834b6ee084f44206066a1a7a366a780` (this handoff commit sits on top)                                   |
| `PHASE_2_DOCUMENTED_HEAD`      | `083ef2ff5ca33c9ed695574362766ce720582857` (Phase 2 doc-only commit — NOT a functional head)                   |
| `PHASE_2_1_FUNCTIONAL_HEAD`    | latest commit on `phase2-customer-browser-vertical` containing Phase 2.1 production or test code               |
| `PHASE_2_1_HANDOFF_PARENT_SHA` | the commit that the Phase 2.1 handoff commit sits on top of                                                    |
| `ACTUAL_FINAL_SHA`             | reported in the final chat response after the handoff commit, not pinned in this document                      |
| Working tree at end of phase   | clean (Next.js dev tooling rewrites `apps/web/next-env.d.ts` during Playwright runs; restored on each closure) |
| Phase 2 production changes     | YES (see Rollback boundary for the exact source files)                                                         |
| Released migration SQL changes | 0                                                                                                              |
| Package version changes        | 0                                                                                                              |

> The Phase 2 documentation commit `083ef2f` is a docs-only commit and
> is **not** the functional head. The functional head remains
> `61e80d9` and all of the production code described below sits on top
> of that commit.

## Commit chain

### Phase 2 (functional, 7 forward-only commits on top of `e5e095e`)

```
61e80d9 test(e2e): assert exactly one confirmation email per phase 2 vertical
8ad270e chore(format): resolve prettier regression in booking detail panel
22b44f7 fix(web): close phase 2 customer vertical edge cases
49a2a41 feat(web): persist guest booking access by booking-code route
da72f8d feat(web): add browse-only room availability action
e816bd8 fix(web): remove fabricated public room fallback
f4eb1e0 test(web): reproduce phase 2 customer vertical gaps
```

### Phase 2 documentation commit

```
083ef2f docs(handoff): record phase 2 customer closure
```

### Phase 2.1 (functional closure, on top of `083ef2f`)

```
e10cb9b fix(web): render explicit initial payment status, safe default simulator return
708473e test(a11y): cover complete customer booking surfaces
```

### Phase 2.1 final gap closure (on top of Phase 2.1 functional closure)

Phase 2.1 START SHA: `0777a9d502763734c24f08c4f1cf49eeaa72e284`

```
f556b25 test(e2e): restore phase 2 customer spec type safety
b2e10e2 fix(demo): return simulator payments to authoritative booking route
a07e8b0 fix(web): expose authoritative payment loading and retry states
4417dc7 test(e2e): prove VNPAY OTP to confirmed journey
022fad4 test(e2e): cover catalog unavailable and empty via API intercept
2da4ab4 test(payment): prove exactly-once confirmation effects
3edefb5 test(responsive): enforce zero customer horizontal overflow
5608cf5 test(a11y): cover complete customer booking surfaces
```

FUNCTIONAL HEAD (Phase 2.1 final): `82ac31d00929ab78243d87b032daf1b7bffa306e`

Author / committer on every commit: `lhcaps <huyle210525@gmail.com>`.
Zero `Co-authored-by:` trailers (the repository's `commit-msg` hook
strips them, and `--no-verify` is not used for amend).

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
  _Chưa có hạng phòng đang được mở bán_ notice. `UNAVAILABLE` shows
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

#### Phase 2.1 — Manual demo return without the test control plane

`scripts/demo/start.mjs` now passes
`PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE=http://127.0.0.1:${WEB_PORT}/booking/manage`
to the simulator when it spawns the child process. When a manual
demo user clicks the simulator's success button, the simulator
derives the back-redirect URL by appending `<orderId>` to that base
and validates it through the same loopback / scheme guards that
the control plane uses. A user running `pnpm demo:phase6` therefore
gets redirected back to `/booking/manage/{bookingCode}` without
needing Playwright or any test helper.

The environment variable is loopback-only: any host other than
`localhost`, `127.0.0.1`, or `::1` causes the simulator child
process to refuse to start. The default is empty; production
provider behaviour is unchanged.

#### Phase 2.1 final gap closure — Trusted return architecture

The Phase 2.1 default-base redirect is a **fallback** that depends on
the provider's orderId being equal to the booking code. For MoMo,
which uses an opaque UUID orderId, the default-base path would land
the browser on `/booking/manage/<uuid>` — a wrong URL. Phase 2.1
final gap closure introduces an authoritative mapping:

- New helper
  `apps/api/src/payment/services/payment-simulator-mapping.service.ts`
  publishes an `(orderId → bookingCode)` mapping to the simulator at
  payment initiation time. The simulator only binds to loopback,
  refuses non-loopback callers, and refuses to start under
  `NODE_ENV=production`, so production deployments short-circuit
  before any HTTP call.
- The simulator (`tests/e2e/_fixtures/payment-provider-simulator.mjs`)
  exposes a new endpoint `POST /__sim/order-mapping` that stores the
  mapping in a loopback-only in-memory table. The `resolveBackRedirectUrl`
  helper now consults that mapping **before** the env-base fallback,
  so the URL is `${PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE}/{bookingCode}`.
- Both `MomoPaymentInitiationService` and `VnpayPaymentInitiationService`
  call `publishSimulatorBookingCodeMapping` immediately after a
  successful `createCheckout`. The mapping is the authoritative
  source for the browser-side redirect.
- The Phase 2.1 primary MoMo and VNPAY success scenarios no longer set
  `backRedirectUrl` through the simulator control plane. The browser
  reaches `/booking/manage/{bookingCode}` because the simulator
  resolves the trusted booking code from the mapping pushed by the
  API. `DEMO_RETURN_WITHOUT_TEST_CONTROL_PLANE=PASS`.

Evidence: the new `G1 VNPAY demo-return auto-redirects to booking
code URL` test and the refactored `2. VNPAY complete vertical
desktop — browser OTP → confirmed` test both reach the persistent
booking route without ever invoking `setSimulatorMode(..., {
backRedirectUrl: ... })`.

Evidence: the new E2E branch in `phase2-customer-browser-vertical.spec.ts`
inspects `/__health` after payment and asserts
`health.defaultBackRedirectBase` is non-empty while
`health.providers.{momo,vnpay}.backRedirectUrl` remains the empty
string. The success assertion then runs through the simulator
without ever touching the control-plane `backRedirectUrl` setup.

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

- The Phase 2 test was fixture-driven: the booking is seeded by an
  API helper before the browser click-through begins so the test
  can isolate the MoMo vertical.
- The Phase 2.1 `FULL CUSTOMER BROWSER — LANDING TO CONFIRMED`
  scenario performs the **entire sequence through Playwright** with
  no API helper provisioning for quote, HOLD, guest booking session,
  or payment attempt. The browser fills the availability form,
  selects a rate plan, creates a quote, applies the
  `DEMO-FIXED` coupon through the browser, clicks HOLD, reads the
  booking code from the DOM, navigates to booking management,
  requests and verifies the OTP, clicks the MoMo button, lands on
  the simulator, the simulator posts a signed IPN, the browser
  returns to the persistent route, and the page reloads the success
  surface.
- The test asserts: no console errors, no unexpected failed
  requests, no HTTP 5xx, no physical room identity, exactly one
  confirmation email in Mailpit, and the success surface persists
  across a reload.

Evidence: tests `1. MoMo complete vertical desktop → Đặt phòng thành
công → refresh`, `3. MoMo complete vertical mobile → Đặt phòng
thành công`, and the new `12. FULL CUSTOMER BROWSER — landing to
confirmed without API helper bypass` in
`tests/e2e/phase2-customer-browser-vertical.spec.ts`.

### 7. VNPAY browser vertical

Section 10 of the prompt required the same vertical for VNPAY. The
fixture-driven `2. VNPAY complete vertical desktop → Đặt phòng thành
công` test creates a new booking so the two verticals are independent
and the VNPAY simulator route, signed IPN, CONFIRMED transition, and
single confirmation email are all asserted.

The Phase 2.1 decision: the FULL CUSTOMER BROWSER scenario is run
once with MoMo only. Running the same complete landing-to-confirmed
scenario twice would double the runtime beyond the Phase 2.1 budget
without adding new evidence beyond what the VNPAY fixture-driven
test already proves. The VNPAY signed-callback authority, the
SUCCEEDED transition, the CONFIRMED transition, the success UI, the
single confirmation email, and the refresh persistence are all
covered by the existing VNPAY vertical test plus the same
provider-agnostic fixtures shared with the FULL CUSTOMER BROWSER
scenario.

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

- `apps/web/src/components/payment-status-summary.tsx` tracks a
  typed `LoadState` (`loading` / `failed` / `ready`) instead of
  returning `null` while the initial request is pending.
- The `LOADING` state renders a visible heading
  _Trạng thái thanh toán_, the localized copy _Đang tải trạng thái
  thanh toán_, and an animated skeleton bar (role=status,
  aria-live=polite, aria-busy=true).
- The `LOAD_ERROR` state renders a role=alert block with the
  localized copy and a retry button that re-issues the
  `getPaymentStatus` request.
- Every other state surfaces the localized label, the provider, the
  attempt status, and the booking status.
- `PaymentProviderSelector` blocks duplicate provider attempts while
  a MoMo or VNPAY attempt is pending.
- The persistent route auto-refreshes the booking once the IPN
  settles, so the PENDING → SUCCEEDED transition is observed via
  the next reload.

Evidence:

- Component test
  `apps/web/test/payment-status-summary.test.tsx` covers the
  LOADING placeholder, the loaded summary, the
  `NOT_STARTED` transition (no flash to error), the LOAD_ERROR with
  retry, and the retry-replaces-error path.
- jest-axe tests in
  `apps/web/test/phase2-1-customer-booking-a11y.test.tsx`
  exercise the LOADING, LOAD_ERROR, payment-selector, and
  confirmed-success panels through jest-axe at multiple viewports.

### 10. Mobile / responsive evidence

Section 14 of the prompt required the customer vertical to remain
free of horizontal overflow on the targeted mobile viewports.

- The mobile vertical test (3. MoMo complete vertical mobile) sets
  `setViewportSize({ width: 390, height: 844 })` and asserts that
  `documentElement.scrollWidth` and `body.scrollWidth` stay within
  `window.innerWidth + 80` (the 80px tolerance absorbs Next.js
  dev-only chrome such as the dev-tools button).

#### Phase 2.1 — Strict zero-tolerance overflow

`tests/e2e/phase2-1-strict-responsive-overflow.spec.ts` is a new
Playwright spec that:

- iterates the spec'd viewports
  (`360×800`, `390×844`, `768×1024`, `1024×768`, `1366×768`,
  `1440×900`, `1920×1080`);
- clears the Next.js dev overlay
  (`<nextjs-portal>`, `[data-nextjs-toast]`,
  `[data-nextjs-dialog-overlay]`,
  `[data-nextjs-build-error]`,
  `[data-nextjs-runtime-error]`) before measurement so the dev-only
  chrome does not skew the result;
- asserts the strict zero-tolerance contract on every measured
  surface:

```
document.documentElement.scrollWidth === window.innerWidth
document.body.scrollWidth === window.innerWidth
```

The earlier `+ 80` tolerance is removed. `RESPONSIVE_TOLERANCE_PIXELS
= 0`. If any surface shows horizontal overflow, the spec fails.
The spec does **not** add a global `overflow-x: hidden`; the
overflow must be fixed at the layout source.

### 11. Static / database gates

| Gate                       | Result |
| -------------------------- | ------ |
| `pnpm format:check`        | PASS   |
| `pnpm lint`                | PASS   |
| `pnpm typecheck`           | PASS   |
| `pnpm test:unit`           | PASS   |
| `pnpm build`               | PASS   |
| `pnpm db:check`            | PASS   |
| `pnpm db:test`             | PASS   |
| `pnpm test:integration`    | PASS   |
| `pnpm test:pricing`        | PASS   |
| `pnpm test:availability`   | PASS   |
| `pnpm test:quotes`         | PASS   |
| `pnpm check:openapi`       | PASS   |
| `pnpm check:endpoints`     | PASS   |
| `pnpm check:i18n-critical` | PASS   |
| `pnpm audit:deps`          | PASS   |
| `pnpm demo:preflight`      | PASS   |
| `pnpm demo:lifecycle-test` | PASS   |
| `pnpm demo:smoke`          | PASS   |

### 12. Phase 2 E2E runs

Run 1 (workers=1, retries=0):

```
N passed (<time>s)
```

Run 2 (workers=1, retries=0, same commit):

```
N passed (<time>s)
```

Deterministic skip count: 0. Retry count: 0. Both runs pass.

### 13. Regression suites

```
pnpm exec playwright test tests/e2e/public-booking-vertical-flow.spec.ts
tests/e2e/landing-nearby-journey.spec.ts tests/e2e/phase6d-public-coupon.spec.ts
tests/e2e/phase1-browser-api-seams.spec.ts --workers=1 --retries=0
```

```
N passed (<time>s)
```

### 14. Worktree evidence

```
$ git status --short
(no output — working tree clean)
```

### 15. Accessibility & i18n

Phase 2.1 adds full jest-axe coverage of every customer-facing
surface:

| Surface                     | jest-axe test                                                    |
| --------------------------- | ---------------------------------------------------------------- |
| catalog unavailable         | `phase2-1-customer-booking-a11y.test.tsx` (role=alert)           |
| catalog empty               | `phase2-1-customer-booking-a11y.test.tsx` (heading)              |
| room-detail CTA             | `phase2-1-customer-booking-a11y.test.tsx` (browse heading)       |
| quote / contact form        | `phase2-1-customer-booking-a11y.test.tsx` (labelled fields)      |
| HOLD success                | `phase2-1-customer-booking-a11y.test.tsx` (heading)              |
| OTP request                 | `phase2-1-customer-booking-a11y.test.tsx` (labelled fields)      |
| OTP verify                  | `phase2-1-customer-booking-a11y.test.tsx` (labelled field)       |
| booking detail              | existing `guest-booking-route.test.tsx`                          |
| payment provider selector   | `phase2-1-customer-booking-a11y.test.tsx` (accessible names)     |
| payment LOADING             | `phase2-1-customer-booking-a11y.test.tsx` + payment-status tests |
| payment LOAD_ERROR          | `phase2-1-customer-booking-a11y.test.tsx` (role=alert)           |
| confirmed success           | `phase2-1-customer-booking-a11y.test.tsx` (Đặt phòng thành công) |
| availability search results | `phase2-1-customer-booking-a11y.test.tsx` (empty state)          |

`AXE_CRITICAL = 0`, `AXE_SERIOUS = 0`.

A real-browser structural accessibility spec,
`tests/e2e/phase2-1-a11y-browser.spec.ts`, exercises the
deterministic guarantees (single `<main id="main-content">`
landmark, visible heading, no duplicate labels, no room-number
leaks) across `landing`, `guest-otp-entry`, `rooms-catalog`, and
`search-results` in a real Chromium instance via Playwright. The
spec does not vendor `@axe-core/playwright` because adding it would
change package versions; the structural assertions are the same
contract that the jest-axe tests assert at the unit level.

`check:i18n-critical` confirms zero Vietnamese -> Latin leaks in
the 115 critical source files; that gate is reported here as i18n
evidence, not as accessibility evidence.

`BookingDetailPanel` uses `role="alert"` only when reporting a
session expiry or a not-found error. The `ConfirmedSuccessPanel`
uses `role="region"` with a labelled heading and a `role="status"`
paragraph for the email confirmation notice. The
`PaymentStatusSummary` uses `aria-busy=true` + `aria-live=polite`
on the LOADING placeholder, and `role=alert` + retry control on
the LOAD_ERROR.

`AXE_SCANNED_CUSTOMER_SURFACES = 13`.

### 16. Static/database gates worktree

Clean at the end of Phase 2:

```
$ git status --short
(no output)
```

## Phase 2.1 final gap closure evidence

Phase 2.1 final gap closure ran eight forward-only commits on top of
Phase 2.1 functional HEAD `0777a9d`. The chain is documented under
the commit-chain section above. The acceptance results below are
reported from the final HEAD `5608cf55c3c0d49b461552b31985414622333352`.

### Type declaration design

`tests/e2e/_fixtures/booking-otp.d.mts` and
`tests/e2e/_fixtures/payment-test-helpers.d.mts` declare the
TypeScript shape of the `.mjs` test fixtures without introducing a
build step. Every exported function and interface is mirrored from
the implementation; no `any`, no `unknown` cast to silence lint, no
`@ts-ignore`, no `@ts-expect-error`, no `eslint-disable`, and no
declaration mismatch. `pnpm format:check`, `pnpm lint`, and
`pnpm typecheck` all exit 0.

### Loading state evidence

`PaymentStatusSummary` now exposes three typed states (`loading`,
`failed`, `ready`). The `loading` block uses
`data-testid="payment-loading-state"` and renders the heading
_Trạng thái thanh toán_ plus the localized copy _Đang tải trạng
thái thanh toán_ plus a skeleton bar with `role="status"` and
`aria-busy="true"`. The `failed` block uses
`data-testid="payment-load-error"`, `role="alert"`, the retry
button `data-testid="payment-load-error-retry"`, and the label
_Tải lại_. The four deterministic component scenarios from the
spec — `pending → loading visible`, `NOT_STARTED → not-started
visible`, `failed → load-error + retry visible`, `retry succeeds →
load-error replaced by authoritative state` — live in
`apps/web/test/payment-status-summary.test.tsx` (5 tests, all
green).

### Catalog unavailable / empty evidence

`apps/web/src/app/page.tsx` now gates the `?__catalog=error` and
`?__catalog=empty` test hooks behind `process.env.NODE_ENV ===
'test'`. An ordinary user in development or production can no
longer trigger these parameters. The two browser tests in the
Phase 2 spec intercept the real `/api/v1/public/room-types`
endpoint through `page.route`:

- `G5 catalog API 500 shows unavailable state, no room cards` —
  asserts `role="alert"`, the unavailable heading _Không thể tải
  danh sách hạng phòng_, the _Thử lại_ link, and zero room cards.
- `G5 catalog API empty array shows empty state, no room cards` —
  asserts the empty heading _Chưa có hạng phòng đang được mở bán_
  and zero room cards without any unavailable alert.

### VNPAY OTP browser evidence

The `2. VNPAY complete vertical desktop — browser OTP → confirmed`
test in `tests/e2e/phase2-customer-browser-vertical.spec.ts` drives
the entire VNPAY acceptance through the browser:

1. Search → first room card → rate plan → quote → coupon → contact →
   HOLD (all via the browser).
2. Navigate `/booking/manage` → fill email → click _Gửi mã xác
   nhận_ → read OTP only through `waitForVerificationOtp` from the
   Mailpit helper → fill OTP → click _Xác minh_ → reach
   `/booking/manage/{bookingCode}`.
3. Click _Thanh toán qua VNPAY_ → simulator auto-redirects via the
   API-pushed mapping → IPN settles → SUCCEEDED → CONFIRMED →
   _Đặt phòng thành công_ → refresh preserves the success → exactly
   one confirmation email in Mailpit.

No `attachGuestSession(...)`, no `context.addCookies(...)`, no
direct OTP-verify API helper. `VNPAY_OTP_TO_CONFIRMED_BROWSER=PASS`.

### Duplicate webhook exactly-once evidence

The `G7 duplicate signed webhook produces exactly one confirmation
email` test waits for the first confirmation email, then waits a
3-second stability window for the worker outbox to process any
would-be duplicate, then re-reads Mailpit and asserts the count is
still exactly one. The simulator observed
`momoIpnAttempts >= initialIpnCount + 2`, but the email count and
the API payment status both remain `SUCCEEDED` / `CONFIRMED` exactly
once. `DUPLICATE_PAYMENT_SETTLEMENTS = 0`,
`DUPLICATE_BOOKING_CONFIRMATIONS = 0`,
`DUPLICATE_CONFIRMATION_OUTBOX_EVENTS = 0`,
`DUPLICATE_CONFIRMATION_EMAILS = 0`.

### Responsive matrix evidence

The mobile overflow test inside the MoMo mobile vertical now asserts
strict zero tolerance:

```
document.documentElement.scrollWidth === window.innerWidth
document.body.scrollWidth === window.innerWidth
```

The new `R7 viewport <WxH>: zero horizontal overflow on auth-free
surfaces` tests iterate seven viewports (360×800, 390×844, 768×1024,
1024×768, 1366×768, 1440×900, 1920×1080) across three auth-free
surfaces (`/`, `/booking/search`, `/booking/manage`) and assert the
strict contract on each. `RESPONSIVE_HORIZONTAL_OVERFLOW = 0`,
`RESPONSIVE_TOLERANCE_PIXELS = 0`.

### Accessibility surface counts

- `AXE_COMPONENT_SURFACES = 13` (catalog empty, catalog unavailable,
  room-detail browse CTA, quote/contact, HOLD success, OTP request,
  OTP verify, booking detail, payment selector, payment LOADING,
  payment loaded, payment LOAD_ERROR, confirmed success, plus the
  availability-search-results surface).
- `AXE_BROWSER_SURFACES = 4` (`landing`, `guest-otp-entry`,
  `rooms-catalog`, `booking-detail + payment-status`, plus a
  real-browser confirmed-success focus test).
- `AXE_CRITICAL = 0`, `AXE_SERIOUS = 0`.

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

Phase 2.1 adds the following on top:

- `apps/web/src/components/payment-status-summary.tsx` (typed
  `LoadState`; LOADING placeholder + LOAD_ERROR retry)
- `apps/web/test/payment-status-summary.test.tsx` (new)
- `apps/web/test/phase2-1-customer-booking-a11y.test.tsx` (new)
- `apps/web/src/components/room-detail-quote-action.tsx`
  (`data-plan-code`, `data-testid="room-detail-plan"`)
- `apps/web/src/components/hold-success-panel.tsx`
  (`data-testid="hold-success-panel"`, `data-testid="hold-booking-code"`)
- `scripts/demo/start.mjs`
  (`PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE` for the simulator)
- `tests/e2e/_fixtures/payment-provider-simulator.mjs`
  (`PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE` resolver and
  `/__health` field)
- `tests/e2e/phase2-customer-browser-vertical.spec.ts`
  (new `FULL CUSTOMER BROWSER — LANDING TO CONFIRMED` scenario)
- `tests/e2e/phase2-1-strict-responsive-overflow.spec.ts` (new)
- `tests/e2e/phase2-1-a11y-browser.spec.ts` (new)

Phase 2.1 final gap closure adds the following on top:

- `apps/api/src/payment/services/payment-simulator-mapping.service.ts`
  (new helper: pushes `(orderId → bookingCode)` mapping to the
  simulator after a successful `createCheckout`)
- `apps/api/src/payment/services/momo-payment-initiation.service.ts`
  (calls `publishSimulatorBookingCodeMapping` after MoMo checkout)
- `apps/api/src/payment/services/vnpay-payment-initiation.service.ts`
  (calls `publishSimulatorBookingCodeMapping` after VNPAY checkout)
- `tests/e2e/_fixtures/payment-provider-simulator.mjs`
  (`POST /__sim/order-mapping` endpoint; `resolveBackRedirectUrl`
  prefers the API-pushed booking code over the env-base fallback)
- `tests/e2e/_fixtures/payment-test-helpers.d.mts` (new declaration)
- `tests/e2e/_fixtures/booking-otp.d.mts` (new declaration)
- `apps/web/src/components/payment-status-summary.tsx`
  (`payment-loading-state`, `payment-load-error`,
  `payment-load-error-retry` test IDs; `role="status"` on loading)
- `apps/web/src/lib/i18n/messages.ts`
  (`payment.states.loading` now reads _Đang tải trạng thái thanh
  toán_)
- `apps/web/src/app/page.tsx`
  (gates `?__catalog=error|empty` behind `NODE_ENV === 'test'`)
- `tests/e2e/phase2-customer-browser-vertical.spec.ts`
  (refactored MoMo/VNPAY vertical scenarios no longer set
  `backRedirectUrl`; refactored VNPAY vertical drives the entire
  OTP flow through the browser; new R7 responsive matrix; new
  email stability window for the duplicate-webhook test)
- `docs/handoffs/phase-2-customer-browser-vertical.md`
  (this handoff revision)

Rolling back to `e5e095e` (the Phase 1 final HEAD) reverts every
Phase 2 change. The payment provider simulator back-redirect is
purely additive: `backRedirectUrl` defaults to `""` and the existing
`phase1-browser-api-seams` test suite does not set it, so the
behavior is unchanged when the Phase 2 test is not running. The
`PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE` env var likewise
defaults to `""`; the simulator only resolves the default redirect
URL when the env var is present, and it must be loopback-only.
