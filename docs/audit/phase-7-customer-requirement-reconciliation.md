# Phase 7A — Customer Requirement Reconciliation & Anti-Overengineering Audit

**Mode:** Audit & spec reconciliation only. No implementation, no migrations, no
dependencies, no runtime code changes, no runtime diagrams.

**Repository:** `D:\Study\Project\Room Management`
**Branch:** `phase5-booking-hold-guest-access`
**Starting HEAD:** `4a4201a2bc0ca97edb1a6d44c357dcac5e5fa656`
**Schema identity:** `phase-6-coupon-core-v3` (Drizzle migration `0010_phase_6_coupon_core_v3`)
**Recommended next implementation phase:** **7B — Customer pricing-rule closure** (see §15).

---

## 1. Executive verdict

The Phase 6 freeze is internally consistent: a single-property modular monolith,
PostgreSQL as the transactional source of truth, immutable quote, transactional
HOLD allocation, email-OTP guest access, transactional coupon reservation, and
transactional outbox. Coupon core is complete end-to-end on the public surface
including admin coupon management, and the worker correctly releases coupon
quota on stale-HOLD cleanup.

However, the new customer requirements delivered in this phase diverge from the
accepted Phase 6 surface in three material ways:

1. **Pricing rules are runtime-hardcoded** in `apps/api/src/pricing/pricing-engine.ts`
   (time windows, duration thresholds, rule precedence). Amounts are data-driven
   from `ratePlanPrices` / `priceTiers`, but the _conditions_ that decide which
   combo applies are not. The new customer wording demands three concrete
   boundary conditions (`11:00–15:00`, `≥18:00`, `>16h`) that the current
   code expresses through magic numbers, not data.
2. **CUSTOMER identity is not implemented.** The `users`/`accounts` tables exist
   and `@room/auth` ships an admin-session scaffold, but there is no Google
   OIDC integration, no CUSTOMER login, no profile management, no password
   management, and no phone collection/verification. The customer wording makes
   Google a _real login method_ and asks for change-password / forgot-password,
   which contradicts a Google-only sign-in.
3. **Payment is not implemented.** No payment tables, no payment routes, no
   adapter contract, no webhook controller, no MoMo/VNPAY dependency. The
   system has a HOLD-authoritative architecture ready for payment, but the
   payment slice is empty.

Translation is a public web concern with no current implementation and a strict
PII/booking/OTP/payment allowlist must be enforced before any vendor is
selected. SSL is a deployment-edge concern; the application must not own
certificates or private keys.

The Phase 7 roadmap must therefore be sliced into **dependency-ordered vertical
slices**: pricing-rule closure first (so payment charges an already-correct
authoritative amount), then payment core, then MoMo, then VNPAY, then
coupon-on-payment redemption, then Google CUSTOMER identity, then public
translation, then deployment/SSL. Refund and coupon re-enable are explicitly
**not built** without further customer confirmation.

---

## 2. Customer requirement transcription

| #   | Requirement (verbatim intent)                                                                                                                                                                                                                                                   | Domain            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | CB + RP + SSL: install an SSL certificate for the website. CB and RP acronyms are unexplained.                                                                                                                                                                                  | Deployment        |
| 2   | Google translation: automatically translate content between languages (Vietnamese ↔ English). UI localisation vs catalog vs whole-page is ambiguous.                                                                                                                            | UX/i18n           |
| 3   | Booking: user selects room, enters check-in/check-out date+time, enters adults/children, sees available/booked rooms, enters full name/phone/email. Combo rules listed in §3 below.                                                                                             | Booking + Pricing |
| 4   | Coupons: ADMIN creates fixed or percentage coupons; multiple codes may be emailed to the booking email; applied at payment; each usable more than once. Stacking and per-customer quota ambiguous.                                                                              | Coupons + Payment |
| 5   | Source image skips item number 5.                                                                                                                                                                                                                                               | Process           |
| 6   | Google/Gmail login: customer signs in with Google; profile data retrieved (full name, email, phone _when available_); register/login; manage profile; change-password + forgot-password. Google-only vs local password is a contradiction. Phone is not guaranteed from Google. | Identity          |
| 7   | MoMo payment: online payment of booking total through MoMo.                                                                                                                                                                                                                     | Payment           |
| 8   | VNPAY payment: online payment of booking total through VNPAY.                                                                                                                                                                                                                   | Payment           |

The full list above is mirrored verbatim as the section header in the §3
matrix.

---

## 3. Requirement-gap matrix

Each row uses one of the allowed status values only:
`IMPLEMENTED`, `PARTIAL`, `SPEC_ONLY`, `MISSING`, `CONFLICT`, `DEPLOYMENT_ONLY`, `NOT_REQUIRED`.

| Customer requirement                         | Existing Phase 0 decision                                                                                                               | Current implementation evidence                                                                                                                                                              | Current database support                                                                                                                                             | Current API support                                                              | Current Web support                                                                                         | Current test evidence                                                                                                                       | Status            | Conflict                                                                                                                        | Ambiguity                                                                                                                    | Security concern                                                                              | Dependency                                                                                     | Recommended action                                                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSL / reverse-proxy edge**                 | `ADR-0003` mandates HTTPS at the API boundary; `docs/architecture/system-context.md` and `compose.yaml` place TLS at the reverse proxy. | Application code does not bind TLS, load certs, or renew them. `packages/config/src/index.ts` forbids `localhost` origins in `production`. No certificate files exist.                       | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `DEPLOYMENT_ONLY` | None.                                                                                                                           | CB/RP acronyms undefined.                                                                                                    | Certificate / private key must never be committed; app must not perform renewal.              | Deployment target chosen before implementation.                                                | Treat as `DEPLOYMENT_ONLY`. Add an environment variable for `WEB_ORIGIN` and `AUTH_BASE_URL` (already enforced). Defer until a deployment target is approved.                               |
| **Google translation**                       | `docs/product/product-scope.md` lists "Multi-locale content (vi, en)" as deferred.                                                      | None. No translation vendor, no locale switcher, no allowlist.                                                                                                                               | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | "UI strings", "catalog content", or "whole-page" Google Translate script is ambiguous.                                       | PII (booking, OTP, payment, contact) must never be sent to a translation vendor.              | None.                                                                                          | Build only an explicit admin-curated UI-string dictionary for `vi` and `en`. If whole-page is later requested, gate it on a strict allowlist and a vendor decision.                         |
| **Booking data capture**                     | Phase 0 spec requires full name, phone, email; quote issued before HOLD.                                                                | `packages/contracts/src/booking/hold.ts` `createBookingHoldRequestSchema` requires `fullName`, `email`, `phone` (E.164). `apps/web/src/components/quote-contact-form.tsx` collects the data. | `bookingContacts` table stores full name + masked email + E.164 phone.                                                                                               | `POST /v1/quotes/{id}/bookings` (public) consumes the contact schema.            | Form component submits via `BookingHoldResponse`.                                                           | `apps/web/test/quote-contact-form.test.tsx`, `apps/api/test/integration/public-booking.integration.test.ts`.                                | `IMPLEMENTED`     | None.                                                                                                                           | Adults/children fields are valid only on the _quote_ request today; the contact capture subset is correct.                   | E.164 enforced; lower-case email; masked on detail.                                           | None.                                                                                          | Keep.                                                                                                                                                                                       |
| **Room-type vs physical-room choice**        | Server-side `FOR UPDATE SKIP LOCKED` + GiST exclusion chooses the physical room.                                                        | `packages/booking/src/services/create-booking-hold.ts` selects an allocatable physical room; the client only sends a `roomTypeCode`.                                                         | `roomInventoryBlocks` giST exclusion `tstzrange` enforced.                                                                                                           | Public quote accepts `roomTypeCode`; physical room is opaque.                    | `apps/web/src/components/quote-contact-form.tsx` lets the customer choose a room type, not a physical room. | `packages/database/test/integration/booking-constraints.test.ts`, `packages/booking/test/concurrency/stale-release-before-quota.test.ts`.   | `IMPLEMENTED`     | None.                                                                                                                           | None.                                                                                                                        | Client never names a physical room.                                                           | None.                                                                                          | Keep.                                                                                                                                                                                       |
| **Lunch combo (11:00 → 15:00)**              | `pricing-rules.md` defines the lunch combo with tier prices.                                                                            | `apps/api/src/pricing/pricing-engine.ts:97` hardcodes `localCheckIn >= 11 * 60 && localCheckIn < 15 * 60`. Amounts come from `ratePlanPrices`.                                               | `ratePlans` row `LUNCH_COMBO` (priority + included minutes), `ratePlanPrices` per tier.                                                                              | `RatePlanService` exposes `LUNCH_COMBO` via `GET /v1/admin/rate-plans`.          | `RatePlanManager` UI.                                                                                       | `apps/api/test/pricing-engine.test.ts` covers lunch-boundary cases.                                                                         | `PARTIAL`         | None.                                                                                                                           | Customer says "from 11:00 to 15:00" — is 15:00 itself a lunch check-in or not? The PRD treats 15:00 as boundary (`< 15*60`). | Magic numbers in pricing engine.                                                              | Pricing-rule closure phase.                                                                    | Move the time window to `ratePlanTimeWindows` and/or add a `minStartMinutes`/`maxStartMinutes` column.                                                                                      |
| **3-hour combo**                             | `pricing-rules.md` defines a 3-hour combo with tier prices.                                                                             | `apps/api/src/pricing/pricing-engine.ts:104` chooses `THREE_HOUR_COMBO` when `durationMinutes <= 240` and no lunch window.                                                                   | `ratePlans` row `THREE_HOUR_COMBO`.                                                                                                                                  | Same as above.                                                                   | Same as above.                                                                                              | `pricing-engine.test.ts` covers 3h boundary.                                                                                                | `PARTIAL`         | None.                                                                                                                           | Customer wording "below 4 hours" vs 3-hour combo at exactly 3h vs 4h00 is implicit.                                          | Hardcoded duration.                                                                           | Pricing-rule closure phase.                                                                    | Make max/min duration data-driven.                                                                                                                                                          |
| **3-hour + extra**                           | `pricing-rules.md` defines extra-hour billing.                                                                                          | `pricing-engine.ts` computes `extraHours = ceil((durationMinutes - baseMinutes) / 60)` and adds `EXTRA_HOUR` × per-tier price.                                                               | `ratePlans` row `EXTRA_HOUR`, `includedDurationMinutes` per rate plan.                                                                                               | Reflected in `Quote.breakdown`.                                                  | `QuoteSummary` UI.                                                                                          | `pricing-engine.test.ts` covers extra calculations.                                                                                         | `IMPLEMENTED`     | None.                                                                                                                           | None.                                                                                                                        | Already server-authoritative.                                                                 | Pricing-rule closure phase (small extension).                                                  | Confirm whether "above 3h through 4h" includes 4h00 _exactly_. If yes, this rule is already correct; if not, encode the boundary.                                                           |
| **5-hour + extra**                           | `pricing-rules.md` defines 5-hour combo.                                                                                                | `pricing-engine.ts:106` chooses `FIVE_HOUR_COMBO` when `durationMinutes > 240` and outside lunch window.                                                                                     | `ratePlans` row `FIVE_HOUR_COMBO`.                                                                                                                                   | Same as above.                                                                   | Same as above.                                                                                              | `pricing-engine.test.ts` covers 5h boundary.                                                                                                | `PARTIAL`         | None.                                                                                                                           | Customer says "above 4 hours" — does that include 4h00? Boundary ambiguity (see §5).                                         | Hardcoded duration.                                                                           | Pricing-rule closure phase.                                                                    | Make the 4h00 boundary data-driven.                                                                                                                                                         |
| **Night combo (≥18:00, >5h)**                | `pricing-rules.md` defines night combo.                                                                                                 | `pricing-engine.ts:95` hardcodes `localCheckIn >= 18 * 60 && durationMinutes > 300`.                                                                                                         | `ratePlans` row `NIGHT_COMBO`.                                                                                                                                       | Same as above.                                                                   | Same as above.                                                                                              | `pricing-engine.test.ts` covers 18:00 boundary.                                                                                             | `PARTIAL`         | None.                                                                                                                           | Customer says "from 18:00" — is 18:00 itself eligible? The PRD says yes (`>= 18*60`).                                        | Magic numbers.                                                                                | Pricing-rule closure phase.                                                                    | Move `minStartMinutes`/`maxStartMinutes` to data.                                                                                                                                           |
| **Day combo (>16h)**                         | `pricing-rules.md` defines day combo.                                                                                                   | `pricing-engine.ts:93` hardcodes `durationMinutes > 960` (16h).                                                                                                                              | `ratePlans` row `DAY_COMBO` (`includedDurationMinutes = 1440`).                                                                                                      | Same as above.                                                                   | Same as above.                                                                                              | `pricing-engine.test.ts` covers 16h boundary.                                                                                               | `PARTIAL`         | None.                                                                                                                           | Customer says "above 16 hours" — does 16h00 itself trigger day combo? The PRD says yes (`> 960`).                            | Magic number.                                                                                 | Pricing-rule closure phase.                                                                    | Move the threshold to data.                                                                                                                                                                 |
| **Coupon create**                            | `coupon-rules.md` defines ADMIN coupon creation.                                                                                        | `apps/api/src/coupons/coupon.controller.ts` exposes `POST /v1/admin/coupons`. `apps/web/src/components/coupon-form.tsx` is the admin UI.                                                     | `coupons` table with `code`, `discountType`, `discountValue`, `validFrom`, `validUntil`, `usageLimitGlobal`, `usageLimitPerCustomer`, `status`, `firstReferencedAt`. | `coupons` admin routes under `apps/api/src/coupons`.                             | `apps/web/src/components/coupon-form.tsx`.                                                                  | `apps/api/test/integration/coupon-admin.integration.test.ts`, `tests/e2e/admin-coupon.spec.ts`.                                             | `IMPLEMENTED`     | None.                                                                                                                           | Fixed vs percentage discount value already supported.                                                                        | Email is hashed for per-customer limits.                                                      | None.                                                                                          | Keep. Document Phase 6 freeze acceptance.                                                                                                                                                   |
| **Coupon multi-use**                         | `coupon-rules.md` allows `usageLimitGlobal > 1` and `usageLimitPerCustomer > 1`.                                                        | `coupons.usageLimitGlobal` and `coupons.usageLimitPerCustomer` support >1. `CouponRepository.evaluateForQuote` decrements on RESERVED.                                                       | DB schema supports it.                                                                                                                                               | Coupon summary in hold/detail (`BookingHoldCouponSummary`).                      | `CouponSummary` UI.                                                                                         | `packages/booking/test/coupon/coupon-redemption.test.ts`, `packages/database/test/integration/phase6-coupon-concurrency-hardening.test.ts`. | `IMPLEMENTED`     | None.                                                                                                                           | None.                                                                                                                        | `firstReferencedAt` prevents DISABLED→ACTIVE bypass.                                          | None.                                                                                          | Keep.                                                                                                                                                                                       |
| **Coupon distribution by email**             | `coupon-rules.md` says one or more codes may be issued to the booking email.                                                            | No email distribution feature exists. The only email output is the hold confirmation and OTP challenge via the outbox.                                                                       | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | Are codes per-customer or per-booking? Is the email template shared or customised?                                           | Email must go through the outbox; never expose PII in the sending transport.                  | Coupon email distribution phase.                                                               | Build a deterministic outbox event type `coupon.distribution` honouring the same SMTP transport.                                                                                            |
| **Coupon application at payment**            | `coupon-rules.md` says coupon is applied during the payment step.                                                                       | Coupon is _currently_ applied at quote time and reserved at HOLD. There is no payment step yet.                                                                                              | `bookingCouponApplications` carries status.                                                                                                                          | Public `POST /v1/quotes/{id}/bookings` already accepts a coupon _via the quote_. | `CouponInput` lets the customer paste a code at quote time.                                                 | `apps/web/test/quote-view-coupon.test.tsx`, `apps/api/test/quote.service.test.ts`.                                                          | `PARTIAL`         | Coupon is applied at quote+HOLD, not at payment. The customer wording is "during payment".                                      | The product scope does not currently include a separate payment step.                                                        | None.                                                                                         | Payment-core phase.                                                                            | Re-anchor coupon application to the payment intent creation, keeping the HOLD-time reservation authoritative.                                                                               |
| **Coupon redemption after verified payment** | `coupon-rules.md` says coupon is redeemed only after verified payment.                                                                  | `redeemCouponApplication` is implemented in `packages/booking/src/repository/coupon-reservation.ts` but is **not wired** to a payment-success path because no payment exists.                | `bookingCouponApplications.status = REDEEMED` reachable.                                                                                                             | Internal primitive only.                                                         | None.                                                                                                       | `packages/booking/test/coupon/coupon-redemption.test.ts`.                                                                                   | `SPEC_ONLY`       | None.                                                                                                                           | None.                                                                                                                        | Must occur in the same authoritative DB transaction as payment confirmation.                  | Payment-core phase.                                                                            | Add a payment-confirmation orchestrator that calls `redeemCouponApplication` in the same transaction that flips `payments.status → SUCCEEDED`.                                              |
| **Google CUSTOMER login**                    | `docs/product/user-roles.md` lists Google as profile prefill _only_. Phase 0 docs reject Google as the sole login.                      | `@room/auth` ships `users`/`accounts` schema and `bootstrap-admin` script. `apps/api/src/auth/auth-fastify-bridge.ts` provides admin-session middleware. **No CUSTOMER Google OIDC.**        | `users`, `accounts`, `sessions` tables exist.                                                                                                                        | Only `/v1/admin/auth/*` exists.                                                  | Admin login UI only.                                                                                        | `apps/api/test/auth-fastify-bridge.test.ts`.                                                                                                | `CONFLICT`        | Genuine contradiction: customer wants Google as primary login; Phase 0 says prefill only.                                       | Phone number availability from Google is not guaranteed.                                                                     | Account linking by verified email; do not auto-create a local password for Google-only users. | Google CUSTOMER identity phase.                                                                | Adopt Google OIDC as a real CUSTOMER login for verified email; link by verified email; treat it as the canonical identity, with profile-management UI and a separate phone-collection flow. |
| **Profile management**                       | Phase 0 deferred.                                                                                                                       | None.                                                                                                                                                                                        | `users` table has `fullName`, `phoneE164`, `emailMasked`.                                                                                                            | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | None.                                                                                                                        | PII redaction in public detail responses is already enforced.                                 | Google CUSTOMER identity phase.                                                                | Build `/v1/me` and `/v1/me/profile` with RBAC `customer.profile.read` / `customer.profile.manage`.                                                                                          |
| **Phone acquisition / verification**         | `INV-024` says phone is collected separately.                                                                                           | None. Customers already submit phone at HOLD, but without verification.                                                                                                                      | `users.phoneE164`, `bookingContacts.phoneE164`.                                                                                                                      | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | Customer says "phone when available" — must remain optional on Google login.                                                 | Carrier lookup / OTP verification is a paid vendor; introduce only after a vendor decision.   | Google CUSTOMER identity phase.                                                                | Make phone optional on Google signup; require verification only when used as a contact channel.                                                                                             |
| **Local password**                           | Phase 0 scope includes "email-password login" but no implementation exists.                                                             | None.                                                                                                                                                                                        | `accounts.provider` table supports `LOCAL` provider, but no controller.                                                                                              | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | Customer wording asks for change-password + forgot-password, but does not require a local password if Google is the only login. | If Google is the only login, passwords are not created.                                                                      | Google CUSTOMER identity phase.                                                               | If customer confirms a second sign-in method, implement local password as a separate provider. |
| **Forgot password**                          | Phase 0 deferred.                                                                                                                       | None.                                                                                                                                                                                        | `accounts` has `passwordHash` column, but no controller.                                                                                                             | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | Only applicable if `LOCAL` provider is enabled.                                                                              | Reset token must be single-use, expiring, and rate-limited.                                   | Google CUSTOMER identity phase (or local-password phase if introduced).                        | Build only after customer confirms a local password is required.                                                                                                                            |
| **MoMo**                                     | `ADR-0004` reserves a payment adapter slot.                                                                                             | None. No `payments` table, no `momo` controller, no `@room/payment` package.                                                                                                                 | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | Test sandbox credentials only.                                                                                               | Idempotency, signed webhook, return URL no-mutation.                                          | MoMo phase.                                                                                    | Implement the payment core first, then add MoMo.                                                                                                                                            |
| **VNPAY**                                    | Same as MoMo.                                                                                                                           | None.                                                                                                                                                                                        | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | Same as MoMo.                                                                                                                | Same as MoMo.                                                                                 | VNPAY phase.                                                                                   | Implement after MoMo.                                                                                                                                                                       |
| **Payment webhook / IPN**                    | `ADR-0004` requires signed webhook validation.                                                                                          | None.                                                                                                                                                                                        | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | Signed payload; replay protection.                                                                                           | Webhook must be processed through the same authoritative transaction as HOLD → CONFIRMED.     | Payment-core phase.                                                                            | Implement as `POST /v1/payments/{provider}/webhook` with provider-specific signature verification, idempotency table, and amount/order/provider mismatch rejection.                         |
| **Payment return URL**                       | `INV-012` says browser return URL is untrusted.                                                                                         | None.                                                                                                                                                                                        | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `MISSING`         | None.                                                                                                                           | Customer may hit the return URL without a settled payment.                                                                   | Return URL must never confirm a booking; only the webhook can.                                | Payment-core phase.                                                                            | Make the return URL a soft-redirect that polls the booking status, never a mutation.                                                                                                        |
| **Refund**                                   | Phase 0 explicitly says "no automated refund."                                                                                          | None.                                                                                                                                                                                        | None.                                                                                                                                                                | None.                                                                            | None.                                                                                                       | None.                                                                                                                                       | `NOT_REQUIRED`    | None.                                                                                                                           | Customer wording does not mention refund.                                                                                    | Refund expands payment and audit scope.                                                       | None.                                                                                          | Defer until customer explicitly confirms.                                                                                                                                                   |

---

## 4. Spec conflicts

1. **Google as primary login vs Google as prefill (CI-001).**
   Old spec (`docs/product/user-roles.md`, `docs/domain/business-invariants.md`):
   "Google login chỉ prefill name/email/photo; phone thu thập riêng (`INV-024`),
   không sử dụng Google People API."
   New customer wording: "customer signs into the website with a Google account"
   _and_ asks for change-password / forgot-password. Resolution: Google is
   adopted as a real CUSTOMER login (verified email only); local password is
   _not_ introduced unless the customer later confirms a second sign-in method.
2. **Coupon application at payment vs coupon applied at HOLD (CI-002).**
   `coupon-rules.md` says coupon is applied "during payment," but the runtime
   applies it at quote + HOLD. Resolution: keep the HOLD-time reservation (the
   concurrency-hardened path is correct), but re-anchor the user-visible
   application step to the payment intent creation so the customer wording is
   honoured. The internal primitive `redeemCouponApplication` is already correct.
3. **"Payment & Refund" label in a legacy handoff (CI-003).**
   `docs/handoffs/phase-5-*-design.md` lists "Phase 7 — Payment & Refund." This
   predates the Phase 0 no-automated-refund decision. Refund is explicitly
   excluded from this audit.

---

## 5. Ambiguity register

| ID  | Ambiguity                           | Source                                                     | Customer wording                            | Proposed resolution                                                                                                                           |
| --- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | CB / RP                             | Customer requirement 1                                     | Acronyms in the source image                | Mark as ambiguous; do not invent meanings. Ask for clarification before any onboarding task.                                                  |
| A2  | Translation scope                   | Customer requirement 2                                     | "translate content between languages"       | Default to **admin-curated UI strings** (`vi`/`en`). Reject whole-page remote translation. Catalog translation is a separate decision.        |
| A3  | Lunch combo end-point               | Customer requirement 3.a ("11:00 to 15:00")                | "to 15:00" — inclusive or exclusive?        | Treat 15:00 as **exclusive** (lunch check-in until 14:59). Make `maxStartMinutes` data-driven.                                                |
| A4  | Day combo start                     | Customer requirement 3.g ("above 16 hours")                | "above 16 hours"                            | Treat 16h00 as the day combo trigger (matches PRD). Encode `>16h00` data-driven.                                                              |
| A5  | 3h/4h boundary                      | Customer requirement 3.d ("above 3 hours through 4 hours") | "above 3 through 4" — is 4h00 inclusive?    | Treat 4h00 as 3h-combo + 1 extra hour. Encode data-driven.                                                                                    |
| A6  | 4h/5h boundary                      | Customer requirement 3.e ("above 4 hours")                 | "above 4 hours" — is 4h00 included?         | Treat 4h00 as 3h+extra; 4h01+ as 5h. Encode data-driven.                                                                                      |
| A7  | Night combo start                   | Customer requirement 3.f ("from 18:00")                    | "from 18:00" — is 18:00 itself eligible?    | Treat 18:00 as eligible, matching PRD. Encode data-driven.                                                                                    |
| A8  | Coupon stacking                     | Customer requirement 4                                     | "may be stacked" not stated                 | Default to **one coupon per booking** (matches Phase 0 and current schema). Multi-coupon stacking is a separate decision.                     |
| A9  | Coupon distribution scope           | Customer requirement 4                                     | "to the email belonging to a booking/order" | Default to **per-booking email** at HOLD + payment confirmation. No mass-mailing in MVP.                                                      |
| A10 | Coupon quota global vs per-customer | Customer requirement 4                                     | "global quota versus per-customer quota"    | Both are supported in the schema (`usageLimitGlobal`, `usageLimitPerCustomer`). Use both; per-customer is enforced via `normalizedEmailHash`. |
| A11 | Google phone availability           | Customer requirement 6                                     | "when available"                            | Treat Google phone as **optional**. Never require a phone from Google. Collect a separate verified phone when used as a contact channel.      |
| A12 | MoMo/VNPAY order                    | Customer requirement 7/8                                   | "MoMo" listed before "VNPAY"                | Implement MoMo first (already implicit in the priority table).                                                                                |
| A13 | Refund                              | Implicit in legacy handoff                                 | Not in customer wording                     | Refund is `NOT_REQUIRED`.                                                                                                                     |

---

## 6. Actual-code evidence index

Each capability below cites the _specific_ source, route, contract, schema, test
and doc found. "n/a" means the capability is not implemented.

### 6.1 Pricing and rate plans

- **Source:** `apps/api/src/pricing/pricing-engine.ts` (rules + extra hours),
  `apps/api/src/pricing/rate-plan.service.ts` (admin service),
  `apps/api/src/pricing/rate-plan.repository.ts` (DB access).
- **Routes:** `POST /v1/quotes` (public), `GET /v1/admin/rate-plans`,
  `PATCH /v1/admin/rate-plans/:id/prices/:priceTierId`, `PUT` (same),
  `POST /v1/admin/rate-plans/:id/activate`, `POST /v1/admin/rate-plans/:id/inactivate`.
- **Contract:** `packages/contracts/src/pricing/rate-plan.ts` (`ratePlanSchema`,
  `ratePlanPriceCommandSchema`, `ratePlanActivationSchema`).
- **Database:** `ratePlans`, `ratePlanPrices`, `priceTiers`,
  `ratePlanPrices.priceTierId` FK, `ratePlans.includedDurationMinutes`,
  `ratePlans.priority`.
- **Tests:** `apps/api/test/pricing-engine.test.ts`,
  `apps/api/test/rate-plan.service.test.ts`,
  `apps/api/test/integration/rate-plan.integration.test.ts`,
  `packages/database/test/integration/quote-schema.test.ts`.
- **Docs:** `docs/domain/pricing-rules.md`, `ADR-0004-payment-adapter.md`.

### 6.2 Availability

- **Source:** `apps/api/src/pricing/availability.repository.ts`,
  `packages/booking/src/repository/availability.ts`.
- **Routes:** `POST /v1/availability/search` (public).
- **Contract:** `AvailabilitySearchRequest` in `packages/contracts/src/pricing/availability.ts`.
- **Database:** `roomInventoryBlocks` (GiST exclusion `tstzrange`).
- **Tests:** `apps/api/test/integration/availability.integration.test.ts`,
  `packages/database/test/integration/booking-constraints.test.ts`.
- **Docs:** `docs/domain/pricing-rules.md`, `docs/architecture/adr/ADR-0002-postgresql.md`.

### 6.3 Immutable quote

- **Source:** `apps/api/src/pricing/quote.repository.ts`,
  `apps/api/src/pricing/quote.service.ts`,
  `apps/api/src/pricing/pricing-engine.ts`.
- **Routes:** `POST /v1/quotes`, `GET /v1/quotes/{id}`.
- **Contract:** `Quote` schema in `packages/contracts/src/pricing/quote.ts`.
- **Database:** `quotes` (immutable JSONB `pricingSnapshot`, `couponSnapshot`,
  `quoteRequestId`).
- **Tests:** `apps/api/test/quote.service.test.ts`,
  `packages/contracts/test/quote-booking-price-contract.test.ts`,
  `apps/api/test/integration/quote.integration.test.ts`.
- **Docs:** `docs/domain/pricing-rules.md`, `INV-005`, `INV-006`, `INV-007`.

### 6.4 Booking HOLD

- **Source:** `packages/booking/src/services/create-booking-hold.ts`,
  `apps/api/src/booking/services/booking-hold.service.ts`.
- **Routes:** `POST /v1/quotes/{id}/bookings`,
  `GET /v1/bookings/{id}/status`, `POST /v1/bookings/{id}/confirm-contact`.
- **Contract:** `packages/contracts/src/booking/hold.ts`,
  `packages/contracts/src/booking/booking-detail.ts`.
- **Database:** `bookings`, `bookingContacts`, `bookingCouponApplications`,
  `roomInventoryBlocks`.
- **Tests:** `packages/booking/test/concurrency/stale-release-before-quota.test.ts`,
  `packages/booking/test/concurrency/coupon-quota-race.test.ts`,
  `apps/api/test/booking/booking-hold.service.test.ts`,
  `apps/api/test/integration/public-booking.integration.test.ts`.
- **Docs:** `docs/superpowers/specs/2026-07-22-phase-5-booking-hold-guest-access-design.md`,
  `docs/handoffs/phase-6-demo-release-candidate.md`.

### 6.5 Guest contact

- **Source:** `packages/booking/src/repository/contact-repository.ts`.
- **Schema:** `bookingContacts` (full name, lower-case email, E.164 phone).
- **Privacy:** `emailMasked` and `phoneMasked` in `booking-detail.ts`.

### 6.6 OTP / guest session

- **Source:** `apps/api/src/booking/services/guest-access-otp-request.service.ts`,
  `apps/api/src/booking/services/guest-access-otp-verify.service.ts`,
  `packages/booking/src/services/derive-otp.ts`.
- **Routes:** `POST /v1/bookings/access/otp/request`,
  `POST /v1/bookings/access/otp/verify`.
- **Database:** `guestAccessOtps`, `guestSessions`.
- **Tests:** `apps/api/test/integration/public-booking.integration.test.ts`,
  `apps/web/test/booking-api.test.ts`.

### 6.7 CUSTOMER authentication

- **Source:** `packages/auth/src/auth-factory.ts`,
  `packages/auth/src/database-bootstrap.ts`.
- **Routes:** None for CUSTOMER login. ADMIN-only routes under `apps/api/src/admin`.
- **Database:** `users`, `accounts`, `sessions` schema is present.
- **Status:** `CONFLICT` (see §4). Not implemented.

### 6.8 ADMIN authentication

- **Source:** `apps/api/src/auth/auth-fastify-bridge.ts`,
  `apps/api/src/auth/admin-permission.guard.ts`,
  `apps/api/src/auth/admin-session.service.ts`.
- **Routes:** `POST /v1/admin/auth/login`, `POST /v1/admin/auth/logout`.
- **Database:** `users`, `accounts`, `sessions`.
- **Tests:** `apps/api/test/auth-fastify-bridge.test.ts`,
  `tests/e2e/admin-auth.spec.ts`.

### 6.9 Coupons

- **Source:** `apps/api/src/coupons/coupon.controller.ts`,
  `apps/api/src/coupons/coupon.service.ts`,
  `apps/api/src/coupons/coupon.repository.ts`,
  `packages/booking/src/repository/coupon-reservation.ts`.
- **Routes:** Public `POST /v1/quotes` accepts a coupon through the quote;
  admin `POST /v1/admin/coupons`, `PATCH /v1/admin/coupons/:id`,
  `POST /v1/admin/coupons/:id/disable`.
- **Contract:** `packages/contracts/src/coupon.ts` (`CouponSummary`,
  `BookingHoldCouponSummary`).
- **Database:** `coupons`, `couponRoomTypes`, `bookingCouponApplications`.
- **Tests:** `apps/api/test/integration/coupon-admin.integration.test.ts`,
  `packages/booking/test/coupon/coupon-redemption.test.ts`,
  `packages/database/test/integration/phase6-coupon-*.test.ts`,
  `tests/e2e/admin-coupon.spec.ts`, `tests/e2e/phase6d-public-coupon.spec.ts`.
- **Docs:** `docs/superpowers/specs/2026-07-25-phase-6-coupon-concurrency-hardening-design.md`,
  `docs/superpowers/specs/2026-07-25-phase-6d-public-coupon-web-design.md`.

### 6.10 Outbox / email

- **Source:** `packages/worker/src/outbox/claim-outbox-batch.ts`,
  `packages/worker/src/outbox/finalize-outbox.ts`,
  `apps/worker/src/jobs/process-outbox.ts`,
  `apps/worker/src/email/smtp-transport.ts`.
- **Routes:** None. Internal outbox.
- **Database:** `outboxEvents`, `outboxDeliveries`.
- **Tests:** `apps/worker/test/jobs/process-outbox.test.ts`,
  `apps/worker/test/jobs/process-outbox-otp.test.ts`.

### 6.11 Worker

- **Source:** `apps/worker/src/main.ts`, `apps/worker/src/scheduler.ts`.
- **Jobs:** `expire-stale-holds`, `process-outbox`, `send-booking-emails`.
- **Tests:** `apps/worker/test/jobs/expire-stale-holds-coupon.test.ts`,
  `tests/e2e/worker-oneshot.spec.ts`.

### 6.12 Payment placeholder / spec

- **Source:** None. No `payments` table, no `momo`/`vnpay` controller, no
  `@room/payment` package.
- **Routes:** None.
- **Database:** None.
- **ADR:** `docs/architecture/adr/ADR-0004-payment-adapter.md` (decision only).
- **Status:** `MISSING`.

### 6.13 Localisation

- **Source:** `Intl.DateTimeFormat('vi-VN')` for currency formatting; no locale
  switcher; no translation vendor.
- **Routes:** None.
- **Status:** `MISSING` (see §11).

### 6.14 Deployment / SSL

- **Source:** `compose.yaml`, `.env.example`, `packages/config/src/index.ts`.
- **Routes:** None — TLS is terminated at the reverse proxy.
- **Status:** `DEPLOYMENT_ONLY`.

---

## 7. No-hardcode findings

| Pattern                                            | Match                                                                                                                                  | Classification                         | Action       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------ |
| `359000` / `419000` / `489000` VND                 | `packages/database/src/seed-development.ts`                                                                                            | Allowed fixture/seed                   | Keep         |
| `359000` / `419000` / `489000` VND                 | `apps/api/test/pricing-engine.test.ts`                                                                                                 | Test-only                              | Keep         |
| `709000` (DAY_COMBO TIER_1)                        | `packages/database/src/seed-development.ts`                                                                                            | Allowed fixture/seed                   | Keep         |
| `11:00` / `15:00` / `18:00` literals               | `apps/api/src/pricing/pricing-engine.ts:97–95` (`11*60`, `15*60`, `18*60`)                                                             | **Runtime business hardcode**          | Move to data |
| `5 hours` / `16 hours` / `3 hours` thresholds      | `pricing-engine.ts:93,95,103,106` (`300`, `960`, `240`)                                                                                | **Runtime business hardcode**          | Move to data |
| `DEMO-FIXED` / `DEMO-PERCENT` / `DEMO-DISABLED`    | `packages/database/scripts/demo-seed.ts`                                                                                               | Allowed fixture/seed                   | Keep         |
| `33700000-0000-4000-8000-000000000001` (demo UUID) | Demo seed + `tests/e2e/admin-coupon.spec.ts`                                                                                           | Allowed fixture/seed                   | Keep         |
| `localhost` / `127.0.0.1`                          | `packages/config/src/index.ts` (refuses in production), `compose.yaml`, `.env.example`                                                 | Configuration default                  | Keep         |
| `MoMo` / `VNPAY`                                   | Only in `docs/architecture/adr/ADR-0004-payment-adapter.md`                                                                            | Documentation                          | Keep         |
| `clientId` / `clientSecret`                        | None in source                                                                                                                         | Confirmed absent                       | None         |
| `certificate` / `private key`                      | None in source                                                                                                                         | Confirmed absent                       | None         |
| `refund`                                           | None in source                                                                                                                         | Confirmed absent                       | None         |
| `Google translate` / `translate`                   | None in source                                                                                                                         | Confirmed absent                       | None         |
| `roomTypeCode` (not room type UUID)                | Public contract uses `code`; physical room IDs are server-only                                                                         | Data-driven; server-side mapping       | Keep         |
| `momo` / `vnpay` env vars                          | None in `.env.example`                                                                                                                 | Confirmed absent                       | None         |
| `pino` request logger                              | `apps/api/src/observability/pino-logger.ts`                                                                                            | Allowed infra                          | Keep         |
| Coupon discount arithmetic                         | `packages/booking/src/domain/coupon.ts` (`calculateDiscount`) is validated in `packages/booking/test/coupon/coupon-redemption.test.ts` | Domain primitive, no business hardcode | Keep         |
| Duplicate business logic                           | None found across Web / API / packages for pricing/coupon/payment. Coupon is single-sourced in `packages/booking`.                     | Clean                                  | None         |

**Verdict.** The only runtime business hardcodes are the time-window and
duration thresholds inside `pricing-engine.ts`. Everything else is a fixture,
test, demo seed, or configuration default. There is no duplicate business logic
across packages.

---

## 8. Pricing-model fit

The Phase 4 model exposes:

- `ratePlans(code, includedDurationMinutes, priority, status)` with six known
  codes: `THREE_HOUR_COMBO`, `FIVE_HOUR_COMBO`, `LUNCH_COMBO`, `NIGHT_COMBO`,
  `DAY_COMBO`, `EXTRA_HOUR`.
- `ratePlanPrices(priceTierId, amountVnd)` per rate plan.
- `priceTiers(code, ordering, status)` — `TIER_1` / `TIER_2` / `TIER_3`.
- `quotes` with `pricingSnapshot` JSONB.
- `calculatePricing` in `pricing-engine.ts` selects exactly one base plan from
  the combo list and charges extras per hour.

### 8.1 Areas the model can express

| Customer rule                  | Today                                   | After data-driven windows/durations |
| ------------------------------ | --------------------------------------- | ----------------------------------- |
| Amount per tier                | **Expressible now** (data-driven)       | Same                                |
| Extra-hour billing per hour    | **Expressible now**                     | Same                                |
| PRIORITY BETWEEN rules         | **Expressible now** (priority column)   | Same                                |
| `INCLUDED_DURATION_MINUTES`    | **Expressible now**                     | Same                                |
| `STATUS = ACTIVE` / `INACTIVE` | **Expressible now**                     | Same                                |
| Snapshot of pricing on quote   | **Expressible now** (`pricingSnapshot`) | Same                                |

### 8.2 Areas the model cannot express today

| Customer rule                    | Status                    | Reason                                                                  | Smallest change                                                                                                |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Lunch window 11:00–15:00         | **Needs additive schema** | Window is hardcoded as `localCheckIn >= 11*60 && localCheckIn < 15*60`. | Add `ratePlanTimeWindows` (`ratePlanId`, `minStartMinutes`, `maxStartMinutes`, `locale` = `Asia/Ho_Chi_Minh`). |
| Night window ≥18:00              | **Needs additive schema** | Hardcoded as `localCheckIn >= 18*60 && durationMinutes > 300`.          | Same table; engine reads `(minStartMinutes, maxStartMinutes)` per rate plan.                                   |
| Duration ≥16h → day combo        | **Needs additive schema** | Hardcoded as `durationMinutes > 960`.                                   | Add `ratePlanDurationRules` (`ratePlanId`, `minDurationMinutes`, `maxDurationMinutes`).                        |
| Duration >4h → 5h combo          | **Needs additive schema** | Hardcoded as `durationMinutes > 240`.                                   | Same table.                                                                                                    |
| Duration >5h → night combo       | **Needs additive schema** | Hardcoded as `durationMinutes > 300`.                                   | Same table.                                                                                                    |
| Base plan selection among combos | **Needs additive schema** | Hardcoded `if/else` chain.                                              | Engine becomes "find the highest-priority rate plan whose window and duration rule matches."                   |

### 8.3 Recommended minimal schema

```text
ratePlanTimeWindows
  ratePlanId    FK
  minStartMinutes  INT
  maxStartMinutes  INT
  effectiveFrom    TIMESTAMPTZ
  effectiveUntil   TIMESTAMPTZ NULL

ratePlanDurationRules
  ratePlanId       FK
  minDurationMinutes INT
  maxDurationMinutes INT NULL      -- NULL = open-ended
  effectiveFrom    TIMESTAMPTZ
  effectiveUntil   TIMESTAMPTZ NULL
```

`calculatePricing` becomes a **rule matcher**: pick the highest-priority
`ACTIVE` rate plan whose `(minStartMinutes, maxStartMinutes)` window covers the
local check-in _and_ whose `(minDurationMinutes, maxDurationMinutes)` covers the
duration. If no plan matches, the engine fails closed with a `RATE_PLAN_NOT_FOUND`
problem-details response.

### 8.4 Boundary examples (proposed)

Using the proposed rule matcher with the new schema:

| Time  | Duration | Expected plan                     | Notes                                                            |
| ----- | -------- | --------------------------------- | ---------------------------------------------------------------- |
| 10:59 | 3h00     | `THREE_HOUR_COMBO`                | window miss (`< 11:00`)                                          |
| 11:00 | 3h00     | `LUNCH_COMBO`                     | window hit; lunch is the priority rule at 11:00                  |
| 14:59 | 3h00     | `LUNCH_COMBO`                     | window hit                                                       |
| 15:00 | 3h00     | `THREE_HOUR_COMBO`                | window miss (`>= 15:00`)                                         |
| 15:01 | 3h00     | `THREE_HOUR_COMBO`                | window miss                                                      |
| 17:59 | 5h01     | `FIVE_HOUR_COMBO`                 | window miss; night requires `>= 18:00` and `>5h`                 |
| 18:00 | 5h01     | `NIGHT_COMBO`                     | window hit; duration hit                                         |
| 2h59  |          | ambiguous                         | Customer did not define a "below 3h" plan → fail closed          |
| 3h00  |          | `THREE_HOUR_COMBO`                |                                                                  |
| 3h01  |          | `THREE_HOUR_COMBO` + 1 extra hour |                                                                  |
| 4h00  |          | `THREE_HOUR_COMBO` + 1 extra hour | matches A5                                                       |
| 4h01  |          | `FIVE_HOUR_COMBO` + 1 extra hour  | matches A6                                                       |
| 5h00  |          | `FIVE_HOUR_COMBO`                 |                                                                  |
| 5h01  |          | `FIVE_HOUR_COMBO` + 1 extra hour  |                                                                  |
| 16h00 |          | `DAY_COMBO`                       | matches A4                                                       |
| 16h01 |          | `DAY_COMBO`                       |                                                                  |
| 24h00 |          | `DAY_COMBO`                       | 24h exceeds `includedDurationMinutes` (1440); extra hours billed |

**Verdict.** The current model is sufficient _if_ the new windows and duration
rules are encoded as data via the two proposed tables. The legacy `if/else`
chain inside `pricing-engine.ts` must be replaced with a rule matcher that uses
`(priority, window, duration)` to choose the base plan. No DSL is required.

---

## 9. Identity-model fit

### 9.1 Old spec vs new customer requirement

| Aspect           | Old spec                                     | New customer requirement                       |
| ---------------- | -------------------------------------------- | ---------------------------------------------- |
| Sign-in          | Local password (admin) + Google prefill only | Google as primary CUSTOMER login               |
| Password         | Email-password local                         | Change-password + forgot-password              |
| Profile data     | Prefill name/email/photo                     | Full name, email, phone _when available_       |
| Phone            | Collected separately at HOLD (`INV-024`)     | From Google when available, otherwise separate |
| Account linking  | Not in scope                                 | Implicitly part of "real login"                |
| Session / RBAC   | Admin RBAC only                              | CUSTOMER RBAC required                         |
| Account deletion | Not in scope                                 | Implicitly required for "manage profile"       |

### 9.2 Decision record proposal (to be ratified in Phase 7G)

- **DR-001:** Google OIDC is adopted as a real CUSTOMER login, gated on the
  `openid` scope. The `email` scope is mandatory; the `profile` scope is
  optional. Phone is **never** required from Google (`INV-024`).
- **DR-002:** Account linking is by verified `email`. A Google user whose
  verified email matches a previous guest booking links that booking to the
  new `users.id` so they can view it after sign-in.
- **DR-003:** Verified email is the canonical identity. The `accounts` row
  records `provider = 'GOOGLE'`, `providerSubject = google_sub`,
  `emailVerifiedAt = now()`.
- **DR-004:** Avatar and name are prefill-only and may be edited by the user
  in the profile UI.
- **DR-005:** Phone is collected separately and is **optional** at Google
  sign-in. A user who already has a phone on a prior booking keeps it.
- **DR-006:** Guest booking continuity is preserved. The
  `guestAccessOtps`/`guestSessions` flow remains for users who never sign in.
- **DR-007:** RBAC scopes: `customer.profile.read`, `customer.profile.manage`,
  `customer.booking.read`. ADMIN scopes are unchanged.
- **DR-008:** Account deletion is a soft delete (`users.deletedAt`,
  `accounts.disabledAt`) — preserves audit history and prior booking links.
- **DR-009:** Google-only users do **not** receive a local password at
  creation. Password reset only applies to accounts with `provider = 'LOCAL'`.
- **DR-010:** Minimum viable identity is **Google OIDC only**. Local password
  is **not** introduced in Phase 7G. The conflict in customer wording is
  resolved by clarifying that change-password / forgot-password are
  _not_ required when Google is the only sign-in method.

**Verdict.** Adopt Google OIDC as the sole CUSTOMER login. Reject local
password in the immediate phase. Resolve the customer wording by confirming
that local password is not required when the only sign-in is Google.

---

## 10. Payment-model fit

### 10.1 Architectural readiness check

| Principle                                       | Today                                                                       | Verdict         |
| ----------------------------------------------- | --------------------------------------------------------------------------- | --------------- |
| Booking and payment state machines separate     | `booking-state-machine.md` defines separate states.                         | OK              |
| Integer VND                                     | `amountVnd` is `bigint`/`number`; `INV-028` enforces.                       | OK              |
| Payment attempt idempotency                     | Not implemented (no payments).                                              | MISSING         |
| Provider transaction reference uniqueness       | Not implemented.                                                            | MISSING         |
| Signed webhook validation                       | Not implemented.                                                            | MISSING         |
| Duplicate event handling                        | Outbox uses `(providerMessageId, processedAt)` pattern but only for emails. | MISSING         |
| Amount/order/provider mismatch                  | Outbox relay does not exist for payments.                                   | MISSING         |
| Return URL has no mutation authority            | `INV-012` says so; no code yet.                                             | OK in spec only |
| HOLD → CONFIRMED after verified payment         | Schema is ready; `bookings.status` already supports `CONFIRMED`.            | OK              |
| Coupon redeem in same authoritative transaction | `redeemCouponApplication` is a package primitive.                           | OK              |
| Outbox / audit integration                      | Outbox exists for emails. Payment confirmation must enqueue audit events.   | MISSING         |
| Sandbox credentials only in local development   | `.env.example` does not yet define them.                                    | PARTIAL         |
| Provider abstraction does not leak into booking | Booking has no provider imports today.                                      | OK              |

### 10.2 Phase 7 payment scope

Recommended scope for Phase 7C (payment core):

1. New `payments` table (id, bookingId, provider, amountVnd, status,
   providerReference, idempotencyKey, requestedAt, confirmedAt, failureReason).
2. New `paymentAttempts` table (id, paymentId, providerMethod, requestPayload,
   responsePayload, status, createdAt).
3. New `paymentWebhookEvents` table (provider, eventId, signature, payload,
   processedAt) with unique `(provider, eventId)`.
4. New `packages/payment` package containing the adapter contract.
5. New `POST /v1/payments` (public, behind rate limit) and
   `POST /v1/payments/{provider}/webhook` (public, signature-checked).
6. New `APayment` orchestrator that performs state transitions inside a single
   PostgreSQL transaction, calls `redeemCouponApplication`, and writes an
   outbox event for the confirmation email.
7. Reject `D` (payment + refund + coupon edit) as over-scoped.
8. Reject `refund` and `coupon re-enable/edit` until customer confirms.
9. Implement MoMo first (Phase 7D), then VNPAY (Phase 7E).

**Verdict.** The architectural principles are already encoded in the spec.
Phase 7C implements the framework; Phase 7D/7E add providers sequentially.

---

## 11. Translation & SSL fit

### 11.1 Translation

- **Current state:** No translation vendor, no locale switcher, no `i18n` keys.
  Formatting uses `Intl` with `vi-VN` for currency and dates.
- **Eligible content (allowlist):**
  - Static UI strings (component copy).
  - Public catalog content the ADMIN publishes in the admin UI.
- **Prohibited content (denylist):**
  - PII (full name, email, phone, address).
  - Booking data (booking code, status, dates, amounts).
  - OTP codes (the OTP is generated server-side and never sent to a translator).
  - Session identifiers, cookies, tokens.
  - Payment data (provider, amount, transaction reference).
- **Cache ownership:** Application cache. No PII in the cache.
- **Storage ownership:** Static UI strings in `apps/web/src/i18n/{vi,en}.json`.
  Catalog content remains in the database with admin-managed
  `roomType.name_i18n`, `roomType.description_i18n`.
- **Resolution:** Default to **admin-curated UI strings**. Whole-page remote
  translation is rejected. Vendor is not selected in this audit.

### 11.2 SSL

- **Classification:** `DEPLOYMENT_ONLY`.
- **Intended edge:** Reverse proxy (nginx, Caddy, or a managed load balancer).
  The application must not bind TLS.
- **Required environment:** `WEB_ORIGIN`, `AUTH_BASE_URL`, `API_BASE_URL`,
  `PAYMENT_RETURN_URL` (per-provider), `PAYMENT_WEBHOOK_URL` (per-provider).
  `packages/config/src/index.ts` already rejects `localhost` in production.
- **Prohibited:** Committing certificates, private keys, or `*.pem` files.
  Application-level certificate renewal is forbidden.
- **CB / RP ambiguity:** Recorded (§5 A1). Customer must clarify.

---

## 12. Over-engineering verdict

| Item                                                         | Classification | Reason                                                                                       |
| ------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| Modular monolith                                             | `JUSTIFIED`    | ADR-0001 rejects microservices. Transactional simplicity.                                    |
| `FOR UPDATE SKIP LOCKED` + GiST exclusion                    | `JUSTIFIED`    | ADR-0002 requires PostgreSQL transactional authority. Inventory overlap is a hard invariant. |
| Immutable quote                                              | `JUSTIFIED`    | `INV-006` and `INV-007` require server-authoritative pricing snapshots.                      |
| HOLD expiry worker                                           | `JUSTIFIED`    | Stale HOLDs must release inventory and coupon quota.                                         |
| OTP / session security                                       | `JUSTIFIED`    | Guest access without a password must be rate-limited and time-bounded.                       |
| Webhook idempotency (when implemented)                       | `JUSTIFIED`    | `INV-012` requires server-side payment confirmation.                                         |
| Coupon concurrency hardening (FOR UPDATE, firstReferencedAt) | `JUSTIFIED`    | Phase 6 evidence shows the race existed.                                                     |
| Booking / payment separation                                 | `JUSTIFIED`    | ADR-0004 keeps payment adapter isolated from booking.                                        |
| Transactional outbox                                         | `JUSTIFIED`    | Email delivery must be reliable and idempotent.                                              |
| `@room/booking` / `@room/coupon` shared packages             | `JUSTIFIED`    | Each owns a clear domain with concurrency and crypto primitives.                             |
| `@room/contracts` shared package                             | `JUSTIFIED`    | Zod schemas are shared by API, Web, and worker.                                              |
| `@room/auth` (admin scaffold only)                           | `JUSTIFIED`    | Admin login is implemented; CUSTOMER login is deferred.                                      |
| `pricing-engine.ts` if/else chain                            | `SIMPLIFY`     | Replace with data-driven rule matcher (§8).                                                  |
| `ratePlanPrices` JSONB snapshot                              | `JUSTIFIED`    | Aligns with `INV-006`.                                                                       |
| Refund system                                                | `DO_NOT_BUILD` | No customer requirement. Phase 0 rejected.                                                   |
| Coupon re-enable / edit UI                                   | `DO_NOT_BUILD` | No customer requirement. Phase 6 only supports `DISABLE`.                                    |
| Local password alongside Google                              | `DO_NOT_BUILD` | Customer wording is ambiguous; default to Google-only.                                       |
| Whole-page Google Translate script                           | `DO_NOT_BUILD` | PII risk; UI strings are sufficient.                                                         |
| App-managed SSL                                              | `DO_NOT_BUILD` | Deployment-edge concern.                                                                     |
| Generic pricing DSL                                          | `DO_NOT_BUILD` | Two relational tables are sufficient.                                                        |
| Event bus / Kafka                                            | `DO_NOT_BUILD` | Outbox + worker is sufficient.                                                               |
| Microservices                                                | `DO_NOT_BUILD` | ADR-0001.                                                                                    |
| Multi-property abstraction                                   | `DO_NOT_BUILD` | Single-property MVP.                                                                         |
| Multi-coupon stacking                                        | `REMOVE_LATER` | Schema supports it; default to one per booking.                                              |
| Provider-neutral abstraction beyond MoMo/VNPAY               | `DO_NOT_BUILD` | Only two providers required.                                                                 |
| Mass coupon emailing                                         | `REMOVE_LATER` | Build a per-booking distribution flow first; defer mass mailing.                             |
| Phone verification vendor                                    | `REMOVE_LATER` | Optional; defer until a vendor is approved.                                                  |
| Refund / partial refund                                      | `DO_NOT_BUILD` | Defer until customer confirms.                                                               |

### 12.1 Anti-overengineering rules for the roadmap

1. Keep modular monolith.
2. No microservices.
3. No Kafka / event bus.
4. No generic pricing DSL.
5. No new shared package unless ownership/security boundaries justify it.
6. No provider-neutral abstraction beyond the methods MoMo and VNPAY require.
7. No refund until customer confirms.
8. No coupon re-enable/edit until customer confirms.
9. No local password unless customer confirms a second sign-in method.
10. No production SSL implementation before a deployment target exists.
11. No runtime hardcoded price/time/provider values.
12. One vertical slice per implementation phase.

---

## 13. Keep / simplify / do-not-build table

| Category     | Item                                                             | Verdict                                               |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Keep         | Modular monolith                                                 | Keep                                                  |
| Keep         | PostgreSQL transactional authority                               | Keep                                                  |
| Keep         | Immutable quote + JSONB pricing snapshot                         | Keep                                                  |
| Keep         | HOLD expiry worker                                               | Keep                                                  |
| Keep         | Transactional outbox                                             | Keep                                                  |
| Keep         | Coupon concurrency hardening                                     | Keep                                                  |
| Keep         | `@room/booking`, `@room/coupon`, `@room/contracts`, `@room/auth` | Keep                                                  |
| Keep         | Admin login + RBAC                                               | Keep                                                  |
| Keep         | Admin coupon management                                          | Keep                                                  |
| Keep         | `Intl.DateTimeFormat('vi-VN')` formatting                        | Keep                                                  |
| Simplify     | `pricing-engine.ts` if/else chain                                | Replace with data-driven rule matcher                 |
| Simplify     | Demo UUIDs present in source                                     | Already isolated to demo seed; keep but document      |
| Do-not-build | Refund subsystem                                                 | No customer requirement                               |
| Do-not-build | Coupon re-enable / edit UI                                       | No customer requirement                               |
| Do-not-build | Local password authentication                                    | Customer wording is ambiguous; default to Google-only |
| Do-not-build | Phone verification vendor                                        | Optional; defer                                       |
| Do-not-build | Whole-page Google Translate script                               | PII risk                                              |
| Do-not-build | App-managed SSL renewal                                          | Deployment-edge concern                               |
| Do-not-build | Event bus / Kafka                                                | Outbox is sufficient                                  |
| Do-not-build | Multi-coupon stacking                                            | Default to one per booking                            |
| Do-not-build | Generic pricing DSL                                              | Two tables suffice                                    |
| Do-not-build | Multi-property abstraction                                       | Single-property MVP                                   |

---

## 14. Prioritised roadmap

The roadmap is dependency-ordered. Each phase is a single vertical slice.

### 7B — Customer pricing-rule closure

- **Requirement covered:** lunch combo, 3h combo, 3h+extra, 5h+extra, night
  combo, day combo, plus all boundary ambiguities (A3–A7).
- **Scope:**
  - Add `ratePlanTimeWindows` and `ratePlanDurationRules` tables (Drizzle
    migration).
  - Refactor `calculatePricing` to a rule matcher using
    `(priority, window, duration)`.
  - Backfill the new tables with the data currently encoded in `if/else`.
  - Decision record `DR-Pricing-001` ratifies the boundary choices.
- **Exclusions:** no payment, no coupon, no identity, no localisation.
- **Schema impact:** two new tables, two migration files.
- **API impact:** new `GET /v1/admin/rate-plans/:id/windows` and
  `GET /v1/admin/rate-plans/:id/duration-rules` (read-only).
- **Web impact:** `RatePlanManager` UI shows the new windows and duration rules.
- **Worker impact:** none.
- **Test strategy:** unit tests for `calculatePricing` covering every boundary
  case (10:59, 11:00, 14:59, 15:00, 15:01, 17:59, 18:00, 2h59, 3h00, 3h01,
  4h00, 4h01, 5h00, 5h01, 16h00, 16h01, 24h00). Integration tests for the
  new admin endpoints.
- **Complexity:** **M**.
- **Dependency:** none (first in the order).
- **Rollback boundary:** the new tables, the rule matcher, and the boundary
  decisions. Revert the migration and the `pricing-engine.ts` refactor.
- **Over-engineering guard:** no DSL; just two tables.

### 7C — Payment core

- **Requirement covered:** payment placeholder; sets up MoMo and VNPAY.
- **Scope:** see §10.2.
- **Exclusions:** no concrete provider, no refund, no coupon re-enable.
- **Schema impact:** `payments`, `paymentAttempts`, `paymentWebhookEvents`.
- **API impact:** `POST /v1/payments`, `GET /v1/payments/{id}`,
  `POST /v1/payments/{provider}/webhook`.
- **Web impact:** "Pay now" button on the hold success panel that calls
  `POST /v1/payments` and redirects to the provider's URL.
- **Worker impact:** outbox event for payment confirmation email.
- **Test strategy:** contract tests, idempotency tests, signature failure tests,
  amount/order mismatch tests, replay tests.
- **Complexity:** **L**.
- **Dependency:** 7B (correct amount must be charged).
- **Rollback boundary:** drop the new tables, revert the orchestrator, disable
  the new routes.
- **Over-engineering guard:** no provider abstraction beyond what MoMo requires.

### 7D — MoMo sandbox adapter

- **Requirement covered:** MoMo payment.
- **Scope:** MoMo adapter implementing the contract; sandbox credentials in
  `.env.example`; admin can publish a MoMo payment link.
- **Exclusions:** no VNPAY, no refund, no mass coupon email.
- **Schema impact:** none.
- **API impact:** `provider = 'MOMO'` in `POST /v1/payments`.
- **Web impact:** MoMo logo on the payment choice.
- **Worker impact:** none.
- **Test strategy:** MoMo sandbox end-to-end; mocked-signature tests.
- **Complexity:** **M**.
- **Dependency:** 7C.
- **Rollback boundary:** feature flag `payments.momo.enabled`.
- **Over-engineering guard:** keep the adapter interface minimal.

### 7E — VNPAY sandbox adapter

- **Requirement covered:** VNPAY payment.
- **Scope:** VNPAY adapter implementing the same contract; sandbox credentials.
- **Schema:** none.
- **Complexity:** **M**.
- **Dependency:** 7C.
- **Rollback boundary:** feature flag `payments.vnpay.enabled`.

### 7F — Coupon email distribution and payment redemption

- **Requirement covered:** coupon distribution by email; coupon application at
  payment; coupon redemption after verified payment.
- **Scope:**
  - New outbox event `coupon.distribution` triggered on `payments.status = SUCCEEDED`.
  - Wire `redeemCouponApplication` into the payment confirmation transaction.
  - Re-anchor the public coupon application step to the payment intent creation.
- **Complexity:** **M**.
- **Dependency:** 7C.
- **Rollback boundary:** disable the new outbox event type and the redemption
  call.

### 7G — Google CUSTOMER identity

- **Requirement covered:** Google login, profile management, phone
  acquisition (optional).
- **Scope:** per §9.2 decision record.
- **Exclusions:** local password, phone verification vendor.
- **Schema impact:** `users.phoneE164`, `users.emailVerifiedAt`,
  `accounts.lastSignInAt`.
- **API impact:** `GET /v1/oauth/google/start`, `GET /v1/oauth/google/callback`,
  `GET /v1/me`, `PATCH /v1/me`, `DELETE /v1/me`.
- **Web impact:** "Sign in with Google" button on the booking and account
  pages; profile management page.
- **Worker impact:** none.
- **Test strategy:** OAuth round-trip test against a stubbed OIDC provider;
  account linking tests; RBAC tests for `customer.*`.
- **Complexity:** **L**.
- **Dependency:** none (orthogonal to pricing/payment).
- **Rollback boundary:** feature flag `auth.google.enabled`.

### 7H — Public translation

- **Requirement covered:** UI strings in `vi`/`en`.
- **Scope:** static UI dictionary; allowlist enforcement; no vendor.
- **Exclusions:** whole-page translation, catalog translation.
- **Complexity:** **S**.
- **Dependency:** 7G (customer-facing UI).
- **Rollback boundary:** remove the dictionary; revert the locale switcher.

### 7I — Deployment edge / SSL

- **Requirement covered:** SSL at the deployment edge.
- **Scope:** deployment documentation (reverse proxy + ACME); environment
  variable contract.
- **Exclusions:** app-managed certificates, app-managed renewal.
- **Complexity:** **S** (mostly documentation).
- **Dependency:** 7G (production sign-in requires HTTPS).
- **Rollback boundary:** documentation revert.

---

## 15. Exact next implementation phase

**Phase 7B — Customer pricing-rule closure.**

**Why this phase, not payment core:**

1. Payment must charge an already-correct authoritative amount. If pricing is
   still hardcoded, Phase 7C will lock in the wrong business rules.
2. The refactor is **M** complexity, isolated to two new tables and the pricing
   engine. It is the smallest preparation that prevents compounding error.
3. The boundary decisions (A3–A7) need a customer confirmation. Settling the
   pricing model first creates a stable reference for the rest of the roadmap.

### 15.1 Acceptance criteria for 7B (corrected post-implementation)

> **Stage B factual corrections** are folded in below. The original draft
> accepted `10:59`, `14:59`, `15:01`, `17:59`, `2h59`, `3h01`, `4h01`,
> `5h01`, `16h01` as valid end-to-end pricing inputs. The Phase 7B
> public contract accepts **15-minute increments only**. The
> following inputs are rejected: `10:59`, `14:59`, `15:01`, `17:59`,
> `2h59`, `3h01`, `4h01`, `5h01`, `16h01`. The reachable runtime
> boundaries are `10:45`, `11:00`, `14:45`, `15:00`, `15:15`, `17:45`,
> `18:00` for check-in and `1h00`, `2h45`, `3h00`, `3h15`, `4h00`,
> `4h15`, `5h00`, `5h15`, `16h00`, `16h15`, `24h00` for duration.
> "14:59" is a human description of "before 15:00"; it is not a valid
> public timestamp under the 15-minute contract.
>
> Phase 7B ships with the corrected boundary matrix; the previous
> proposal's boundary cases have been superseded.

1. **Schema** — `rate_plans` carries selection-rule fields
   (`is_base_plan`, `min_check_in_minute_inclusive`,
   `max_check_in_minute_exclusive`, `min_duration_minutes_inclusive`,
   `max_duration_minutes_inclusive`). The Drizzle migration
   `0011_phase7b_data_driven_pricing` adds the columns, the
   invariants, and the backfill. No new rule tables exist.
2. **Engine** — `calculatePricing` no longer contains any literal
   `11*60`, `15*60`, `18*60`, `>240`, `>300`, or `>960`. The function
   reads `(priority, window, duration)` and returns the
   highest-priority matching rate plan; re-exporting
   `phase-4-pricing-availability-v1` literals is acceptable only for
   historical snapshot compatibility.
3. **Boundary tests** — `pricing-engine.test.ts` covers the reachable
   boundary cases listed above (10:45, 11:00, 14:45, 15:00, 15:15,
   17:45, 18:00 for check-in; 1h00, 2h45, 3h00, 3h15, 4h00, 4h15,
   5h00, 5h15, 16h00, 16h15, 24h00 for duration) and asserts
   `InvalidPricingIntervalError` for the rejected set.
4. **Admin API** — `PATCH /api/v1/admin/rate-plans/:id/selection-rule`
   updates the selection metadata and returns the complete normalised
   rate-plan resource. The existing `GET /admin/rate-plans`,
   `PATCH .../prices/:priceTierId`, `POST .../activate`, and
   `POST .../inactivate` endpoints remain operational.
5. **Web UI** — `RatePlanManager` displays the new windows and
   duration rules and binds an explicit Save action.
6. **Decision record** — `docs/architecture/adr/ADR-0005-data-driven-pricing-selection.md`
   records the boundary choices and the migration identity.
7. **No hardcodes** — `git grep -n -E "11\s*\*\s*60|15\s*\*\s*60|18\s*\*\s*60|durationMinutes\s*>\s*240|durationMinutes\s*>\s*300|durationMinutes\s*>\s*960"`
   against `apps/api/src/pricing` returns nothing in runtime code.
8. **No regressions** — every existing pricing-related test continues
   to pass without modification to its assertions.
9. **Documentation** — `docs/domain/pricing-rules.md` is updated to
   reference PostgreSQL-owned selection metadata and to enumerate the
   reachable boundary interpretation.
10. **Migration** — `0011_phase7b_data_driven_pricing` is additive and
    forward-only. Migrations `0000`–`0010` remain byte-identical. No
    destructive down migration is shipped. The schema version after
    fresh migration is `phase-7b-data-driven-pricing-v1`.

---

## 16. Questions requiring customer confirmation

| #   | Question                                                                                                        | Why this matters                                                                |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Q1  | What do **CB** and **RP** stand for?                                                                            | Cannot complete §1 deployment work without this.                                |
| Q2  | Should translation be **UI strings only**, **catalog content**, or **whole-page**?                              | §2 ambiguity. Locks the vendor decision.                                        |
| Q3  | Is the lunch combo window **inclusive of 15:00** or **exclusive of 15:00**?                                     | §3.a, §5 A3.                                                                    |
| Q4  | Is the day combo trigger **above 16h00** (i.e., 16h00 itself triggers it) or **strictly above 16h00**?          | §3.g, §5 A4.                                                                    |
| Q5  | Is the 3h-combo + extra boundary **inclusive of 4h00** or **exclusive of 4h00**?                                | §3.d, §5 A5.                                                                    |
| Q6  | Is the 5h-combo trigger **above 4h00** (i.e., 4h00 itself is 3h+extra) or **strictly above 4h00**?              | §3.e, §5 A6.                                                                    |
| Q7  | Is the night combo trigger **inclusive of 18:00** or **exclusive of 18:00**?                                    | §3.f, §5 A7.                                                                    |
| Q8  | Can multiple coupons be **stacked on a single booking**, or is the default **one per booking**?                 | §4, §5 A8.                                                                      |
| Q9  | Does the customer require **mass coupon emailing** in MVP, or only per-booking distribution?                    | §4, §5 A9.                                                                      |
| Q10 | Does the customer require a **local password** option, or is Google the only sign-in method?                    | §6, §9.                                                                         |
| Q11 | Does the customer require an **admin coupon re-enable/edit** UI, or is `DISABLE` sufficient?                    | §4, §13.                                                                        |
| Q12 | Does the customer require a **refund** flow in MVP?                                                             | §4, §13.                                                                        |
| Q13 | Which deployment target is approved (hosted, on-prem, container platform)? Without this, SSL is deferred.       | §11.2.                                                                          |
| Q14 | Are the coupon codes **fixed** (admin chooses) or **auto-generated** per booking?                               | §3, §6.                                                                         |
| Q15 | Should the day combo accept **exactly 24h** as a normal booking, or is there a hard ceiling (`DAY_COMBO` only)? | Phase 0 says 24h is day combo; the customer wording allows generic "above 16h". |

---

## 17. Risks and assumptions

### 17.1 Risks

1. **Pricing-rule boundary risk.** If the customer interpretation of A3–A7
   differs from the proposed default, the engine must be re-tuned. The
   proposed defaults match the existing `if/else` and the Phase 0 PRD.
2. **Payment-return fraud.** Return URL is untrusted; only the webhook
   confirms the payment. Any web change that re-confirms via return URL is a
   security regression.
3. **Coupon email spam.** If mass distribution is built without per-customer
   opt-in, it becomes a spam vector.
4. **Google OIDC secret management.** Google client secret must be in
   environment configuration, never in source.
5. **Demo seed contamination.** Demo UUIDs and credentials must remain in
   `seeds/demo-*` and never reach production import paths.

### 17.2 Assumptions

1. The schema identity `phase-6-coupon-core-v3` is the latest accepted migration.
2. The customer wording is taken literally; later corrections may narrow scope.
3. The decision record proposals in §9 and §10 are _proposals_; they are not
   accepted until a design phase.
4. The deployment edge is a reverse proxy; no application-level TLS.
5. No refund, no coupon re-enable, no local password, no multi-coupon stacking
   unless customer confirms.

---

## 18. References

- `docs/product/product-scope.md`, `docs/product/user-roles.md`,
  `docs/product/user-journeys.md`.
- `docs/domain/glossary.md`, `docs/domain/booking-state-machine.md`,
  `docs/domain/pricing-rules.md`, `docs/domain/coupon-rules.md`,
  `docs/domain/business-invariants.md`.
- `docs/architecture/system-context.md`, `docs/architecture/container-diagram.md`.
- `docs/architecture/adr/ADR-0001-modular-monolith.md`,
  `docs/architecture/adr/ADR-0002-postgresql.md`,
  `docs/architecture/adr/ADR-0003-rest-openapi.md`,
  `docs/architecture/adr/ADR-0004-payment-adapter.md`.
- `docs/security/threat-model.md`.
- `docs/superpowers/specs/2026-07-22-phase-5-booking-hold-guest-access-design.md`.
- `docs/superpowers/specs/2026-07-25-phase-6-coupon-concurrency-hardening-design.md`.
- `docs/superpowers/specs/2026-07-25-phase-6d-public-coupon-web-design.md`.
- `docs/handoffs/phase-6-demo-release-candidate.md`,
  `docs/runbooks/phase-6-local-demo.md`,
  `docs/audit/phase-5-final-audit.md`.
