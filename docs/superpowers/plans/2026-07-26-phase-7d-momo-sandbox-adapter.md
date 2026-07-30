# Phase 7D MoMo sandbox adapter plan

**Baseline:** `794155dbdf60cc83845c5db1dd5996283bdefb55`, schema `phase-7c-payment-core-v1`  
**Scope:** one concrete MoMo sandbox `captureWallet` adapter over the Phase 7C payment core. No VNPAY, provider UI, ADMIN secret UI, or migration unless implementation proves a Phase 7C schema defect.

## Locked provider contract

Accessed 2026-07-26 from MoMo's official [One-Time Payments](https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/) and [Payment Notification](https://developers.momo.vn/v3/docs/payment/api/result-handling/notification/) documentation.

- API: `POST https://test-payment.momo.vn/v2/gateway/api/create`; `requestType=captureWallet`.
- Initiation request fields: `partnerCode`, `requestId`, `amount`, `orderId`, `orderInfo`, `redirectUrl`, `ipnUrl`, `requestType`, `extraData`, `signature` (the selected narrow contract uses no optional item/user fields).
- Initiation canonical string: `accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType`.
- Initiation response success is `resultCode=0` with matching partner/order/request/amount and an HTTPS `payUrl`; response signature canonicalization is `accessKey=$accessKey&amount=$amount&message=$message&orderId=$orderId&partnerCode=$partnerCode&payUrl=$payUrl&requestId=$requestId&responseTime=$responseTime&resultCode=$resultCode`.
- IPN is JSON POST. Its canonical string is `accessKey=$accessKey&amount=$amount&extraData=$extraData&message=$message&orderId=$orderId&orderInfo=$orderInfo&orderType=$orderType&partnerCode=$partnerCode&payType=$payType&requestId=$requestId&responseTime=$responseTime&resultCode=$resultCode&transId=$transId`; acknowledgement is HTTP 204 within 15 seconds.
- HMAC-SHA256 is used for every signature; `requestId` is max 50 characters and stable/idempotent (MoMo retains the identity for at least 31 days); `orderId` is max 200 and follows `^[0-9a-zA-Z]([-_.]*[0-9a-zA-Z]+)*$`; amount is integer VND 1,000–50,000,000. The official page says at least 30 seconds timeout; Phase 7D allows 30,000 ms only, satisfying both the repository cap and the provider minimum.
- Result codes: `0` is success, `9000` is authorization-only and is rejected for this auto-capture flow; other documented nonzero outcomes are normalized as failed, except unknown/contradictory values which are rejected.

## Tasks and TDD evidence

1. Add API-only MoMo environment validation in `packages/config/src/index.ts` and red tests in `packages/config/test/environment.test.ts`; validate disabled, incomplete, safe sandbox/test loopback, and production rejection paths. Commit: `feat(config): add validated momo sandbox configuration`.
2. Add `apps/api/src/payment/providers/momo/{momo.config,momo.contracts,momo.errors,momo.signature,momo.adapter}.ts` with failing contract fixtures first. Implement strict Zod validation, HMAC SHA-256, timing-safe comparison, SHA-256 body digest, response/notification validation, and no raw data persistence. Commit: `feat(payment): add momo checkout adapter`.
3. Add only the required booking-scoped initiation controller/service/repository and provider IPN/return controller. Reuse `createPaymentAttempt` and `applyVerifiedPaymentEvent`, call the provider outside the local attempt transaction, and never settle through return. Add contracts/OpenAPI and integration tests using a local HTTP server plus disposable PostgreSQL. Commit: `feat(api): add secure momo initiation and ipn ingress`.
4. Add two-pool initiation/IPN concurrency coverage and regression proof. Commit: `test(payment): verify momo signatures and settlement integration`.
5. Update ADR-0004, create ADR-0006 (settlement ownership), update threat/readiness/7C handoff, and create the Phase 7D handoff including the live sandbox blocker. Commit: `docs: close phase 7d momo sandbox adapter`.

## Self-review checklist

- No guessed field order: every canonical field above comes from the cited official pages.
- Secrets remain validated server configuration only; no logs, responses, migrations, audit payloads, or Web imports.
- No provider code confirms bookings, redeems coupons, writes inventory, or decides late/mismatch/transaction conflicts.
- A timeout retains the existing order identity and returns a stable unknown-outcome error; it never creates a new provider order.
- There is no generic adapter framework, no test provider, no VNPAY, and no database migration by default.
- A live transaction is conditional on preconfigured sandbox credentials plus an approved public callback. It will be reported as blocked when unavailable.
