# Phase 8D Client Requirement Acceptance Design

## Purpose

Close the deterministic, repository-owned parts of the nine client requirements while retaining an explicit external boundary for live provider, public-domain, certificate, and Google Cloud credentials.

## Confirmed starting state

- HEAD `35b924de6d09ebaf269b29ebd90fc461eafa8294` on `phase5-booking-hold-guest-access`.
- PostgreSQL schema identity is `phase-8c-payment-reconciliation-v1`; released migrations `0000` through `0018` are clean and must not be rewritten.
- Booking, configurable cheapest-eligible pricing, coupons, deterministic Google OAuth, MoMo/VNPAY adapters, verified IPN settlement, QueryDr/status reconciliation, and browser-provider simulators already exist.
- The audit found no coupon-email delivery vertical and no application i18n runtime. `TRUSTED_PROXY_CIDRS` is validated but is not applied by the Fastify bootstrap.

## Design decisions

### Coupon delivery

Add a narrow ADMIN-only command at `POST /api/v1/admin/bookings/:bookingCode/send-coupons`. It accepts only a bounded `couponCodes` array and requires a bounded `Idempotency-Key` request header. The recipient is always loaded from the immutable booking-contact snapshot; browser input cannot choose an address.

The transaction verifies the booking/property, selected active coupons, and idempotency key; records an immutable delivery request and coupon-code snapshot; writes a safe audit event; and adds an outbox event with only the delivery request identifier. It never reserves, redeems, or mutates coupon quota. A unique `(property_id, idempotency_key)` constraint returns the original result on replay.

The worker resolves the immutable request and sends one rendered mail through the existing SMTP/outbox lease path. Mail logs contain only event and delivery identifiers; no recipient, coupon body, or raw body is logged. The stable outbox message id makes retries safe for SMTP providers.

### Vietnamese and English UI

Use a local typed dictionary, selected by a `room_locale` cookie. Do not add a generic browser translation service or a third-party i18n dependency. The server reads the cookie for HTML language and critical-page content; client components receive locale-specific labels through a small provider. Locale controls are visible and keyboard-accessible.

Only critical public booking/payment/customer pages and ADMIN navigation/operations are translated in this phase. Codes, VND amounts, provider names, and status identities remain canonical. Validation and safe error strings use the selected locale. This is a product localization pass, not a redesign.

Add a server-only, disabled-by-default Google dynamic-description adapter. It accepts only approved public description input, has a bounded payload and timeout, hashes source text for cache keys, and falls back to the Vietnamese source. It rejects fields classified as PII, booking/contact/payment data, codes, prices, and statuses. The core UI must remain fully localized with the flag and credentials absent.

### HTTPS and callback readiness

Apply `TRUSTED_PROXY_CIDRS` to Fastify's trusted-proxy setting, preserving direct-loopback development. Keep production callback validation fail-closed: non-loopback public OAuth/MoMo/VNPAY URLs must be HTTPS and the Google redirect shares the configured web-origin host. Document reverse-proxy headers, secure-cookie ownership, HSTS boundary, and provider callback setup. Local checks prove configuration behavior only; a public domain/certificate remains external.

### Payments and OpenAPI

Do not change settlement authority. `applyVerifiedPaymentEvent` remains the only confirmed-payment mutation path. Re-run deterministic MoMo/VNPAY tests, including VNPAY `amountVnd * 100`, canonical parameter ordering, verified QueryDr responses, and simulator IPN paths. Generate an endpoint inventory from live controllers and OpenAPI, then fail the phase if a relevant runtime mutation is undocumented or a documented relevant operation has no route.

### UI quality

Keep existing component tokens and familiar product controls. Apply only behavior-preserving adjustments necessary for localization and coupon delivery: clear primary action, subordinate cancellation, labelled controls, errors/loading/success states, responsive 390x844 and 1366x768 layouts, visible focus, no horizontal overflow, and non-colour-only statuses. Motion is limited to state feedback and honours reduced motion; no Rive or decorative animation is introduced because it would not explain a task state.

## Safety boundaries

- Never contact real provider endpoints, charge money, push, create a PR, deploy, delete Docker volumes, or change the process on port 3001.
- Use disposable PostgreSQL and loopback provider/email simulators for deterministic evidence.
- No migration `0000` through `0018` changes; a forward `0019` is allowed only if the coupon-delivery state cannot be represented safely by existing immutable rows.
- Real MoMo/VNPAY sandbox, Google OAuth, Google Cloud Translation, public DNS/SSL, and merchant/provider portal checks are `EXTERNAL_BLOCKED` until credentials and public HTTPS are supplied.

## Acceptance evidence

Each new behavior follows red-green TDD. Focused unit and PostgreSQL integration tests prove validation, authorization, idempotency, immutable recipient selection, no coupon lifecycle mutation, outbox delivery, locale persistence, no PII translation, proxy/callback validation, and OpenAPI consistency. Browser tests run with one worker, zero retries, and cover coupon delivery, locale switching, English booking, payment review, and affected mobile/desktop pages. Final reports record exact command, HEAD, exit code, counts, duration, and external blockers.
