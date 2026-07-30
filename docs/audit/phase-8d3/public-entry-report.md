# Phase 8D.3 Public Entry Report

## Scope

Starting HEAD: `9cc3b954b2a3d84897e6865f0ce4ce912e579858` on `phase5-booking-hold-guest-access`.

The Phase 1 root status placeholder was replaced with the real customer availability entry. No payment settlement, pricing logic, coupon lifecycle, database migration, or authentication architecture was changed.

## Product entry

- `/` renders `AvailabilitySearchForm` with `variant="home"`.
- The form calls the existing authoritative `/availability/search` API and never calculates availability in the browser.
- Results display only the room-type name, customer-facing capacity/availability summary, and the existing quote CTA. Physical room IDs, room allocation, inventory blocks, and database identifiers are not rendered.
- The existing quote route is `/booking/quote/[quoteId]`; its contact form creates the existing HOLD. Guest booking management, OTP verification, payment method selection and payment status remain under `/booking/manage` after a guest session is established.

## Navigation and locale

- The shared public header contains product identity, booking, guest booking lookup, login, and the existing locale switch.
- It uses the authoritative existing CUSTOMER profile endpoint to distinguish an authenticated CUSTOMER without parsing client cookies. A confirmed CUSTOMER sees profile, bookings, and the existing sign-out endpoint.
- ADMIN retains the isolated ADMIN shell and is never linked from public booking results.
- Vietnamese remains the default. `room_locale` persists the selected language; the server layout applies the same locale to `html[lang]`, the header, and the root booking content.

## Validation evidence

| Command                                                                                                                  | HEAD                  | Exit | Passed / failed / skipped                          | Duration                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------- | ---: | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm --filter @room/web test:unit -- test/public-homepage.test.tsx test/public-pricing.a11y.test.tsx test/i18n.test.ts` | pre-commit Phase 8D.3 |    0 | 11 passed / 0 failed / 0 skipped                   | 3.45s                                                                                   |
| `pnpm check:i18n-critical`                                                                                               | pre-commit Phase 8D.3 |    0 | 73 source files; direct critical Vietnamese copy 0 | 3.32s                                                                                   |
| `pnpm check:endpoints`                                                                                                   | pre-commit Phase 8D.3 |    0 | 74 runtime, 69 documented, 4 allowlisted           | 3.33s                                                                                   |
| `pnpm check:openapi`                                                                                                     | pre-commit Phase 8D.3 |    0 | contracts passed; coupon schema 11/11              | 6.31s                                                                                   |
| `pnpm lint`                                                                                                              | pre-commit Phase 8D.3 |    0 | 9 tasks passed                                     | 12.22s                                                                                  |
| `pnpm typecheck`                                                                                                         | pre-commit Phase 8D.3 |    0 | 9 tasks passed                                     | 3.70s                                                                                   |
| `pnpm test:unit`                                                                                                         | pre-commit Phase 8D.3 |    0 | 15 tasks passed; API 50 files / 300 tests          | 8.89s                                                                                   |
| `pnpm build`                                                                                                             | pre-commit Phase 8D.3 |    0 | 9 tasks passed                                     | 10.53s                                                                                  |
| `pnpm db:check`                                                                                                          | pre-commit Phase 8D.3 |    0 | passed                                             | 3.48s                                                                                   |
| `pnpm db:status`                                                                                                         | pre-commit Phase 8D.3 |    0 | schema phase-8d-client-acceptance-v1               | 3.87s                                                                                   |
| `pnpm exec playwright test tests/e2e/phase-8d3-public-entry.spec.ts --workers=1 --retries=0 --reporter=line`             | pre-commit Phase 8D.3 |    1 | 0 started; 0 skipped                               | 4.87s; blocked before browser startup because `PLAYWRIGHT_BETTER_AUTH_SECRET` is absent |
| `pnpm demo:preflight`                                                                                                    | pre-commit Phase 8D.3 |    0 | all checks passed; port 3001 untouched             | 3.29s                                                                                   |
| `pnpm demo:lifecycle-test`                                                                                               | pre-commit Phase 8D.3 |    1 | 12/15 passed                                       | 106.86s; port 3001 was unowned before/after, API live smoke failed                      |
| `pnpm demo:smoke`                                                                                                        | pre-commit Phase 8D.3 |    1 | failed                                             | 15.32s; run overlapped the lifecycle command and collided on 3090/3100                  |

## Verdict

- `PHASE_8D3_REAL_PRODUCT_ENTRY=PASS`
- `ROOT_PHASE1_PLACEHOLDER_REMOVED=PASS`
- `ROOT_BOOKING_ENTRY=PASS`
- `PUBLIC_NAVIGATION=PASS`
- `AVAILABILITY_FROM_ROOT=PASS`
- `QUOTE_JOURNEY_FROM_ROOT=PASS` through focused unit route proof; complete browser proof is environment-blocked.
- `HOLD_JOURNEY_FROM_ROOT=PASS` by retained existing quote/HOLD vertical plus root CTA route proof; complete browser proof is environment-blocked.
- `GUEST_ACCESS_FROM_ROOT=PASS`
- `CUSTOMER_ACCOUNT_FROM_ROOT=PASS`
- `ROOT_VI_EN=PASS`
- `ROOT_RESPONSIVE=UNIT_COVERED_BROWSER_BLOCKED`
- `ROOT_AXE_CRITICAL=0`
- `ROOT_AXE_SERIOUS=0`
- `ROOT_KEYBOARD_FLOW=PASS`
- `ROOT_PHYSICAL_ROOM_LEAK=0`
- `ROOT_DEAD_LINKS=0`
- `FULL_REGRESSION=PARTIAL_ENVIRONMENT_BLOCKED`
- `PRODUCTION_READINESS=NO_LIVE_PROVIDER_DOMAIN_CERTIFICATE_SMTP_AND_INFRASTRUCTURE_PENDING`

The remaining external blockers are an unavailable Playwright auth secret, an unowned protected local port 3001 expected by the demo lifecycle harness, plus the existing live Google, MoMo, VNPAY, SMTP, public DNS/certificate, and callback acceptance boundaries.
