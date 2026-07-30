# Phase 7E Dual-Provider Payment Delivery Implementation Plan

**Goal:** Deliver VNPAY sandbox payment alongside the accepted MoMo adapter, with non-secret provider operations and verified customer payment/status flows.

**Architecture:** Keep settlement in the existing Phase 7C payment core. Add a VNPAY adapter under `apps/api/src/payment/providers/vnpay`, a minimal property-scoped operational settings table, and thin controller/services that mirror the proven MoMo boundary. The Web app consumes safe public/admin API contracts only; it never receives merchant credentials or performs settlement.

**Locked provider contract:** VNPAY hosted Checkout v2.1.0, `GET https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`, accessed 2026-07-26 at `https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html`. Sign all non-empty `vnp_*` parameters (except `vnp_SecureHash`/`vnp_SecureHashType`) sorted by key, URL-encoded, with HMAC-SHA512. `vnp_Amount` is integer VND multiplied by 100; dates are `Asia/Ho_Chi_Minh` `yyyyMMddHHmmss`; success is `vnp_ResponseCode=00` and `vnp_TransactionStatus=00`; IPN response is HTTP 200 JSON `{ RspCode, Message }`.

## Constraints

- Reuse the Phase 7C settlement service; no provider-side booking/coupon/inventory mutations.
- Add one forward migration only for non-secret `payment_provider_settings`; update schema status to `phase-7e-dual-provider-delivery-v1`.
- Provider secrets stay in validated server environment only and must never appear in APIs, logs, OpenAPI, database, migrations, audit, outbox, or Web bundle.
- Provider returns remain read-only. IPNs alone can settle.
- No VNPAY/MoMo production credentials, real-money flow, refund, payment dashboard, Google login, translation, or deployment.

## Execution tasks

1. **Contracts/configuration and migration**
   - Modify `packages/config/src/index.ts` and its tests for validated `VNPAY_*` ownership, environment isolation, and test-only loopback allowance.
   - Add provider-settings contracts in `packages/contracts/src/booking/` and exports/OpenAPI contract tests.
   - Modify `packages/database/src/schema.ts`, `packages/database/src/schema-status.ts`, add `packages/database/drizzle/0013_phase7e_provider_settings.sql` and snapshot metadata. Seed MoMo/VNPAY disabled operational rows using application initialization/repository, never secrets.
   - Write failing configuration/schema/repository tests first, run them red, implement minimally, then run green.

2. **VNPAY provider boundary and initiation**
   - Create `apps/api/src/payment/providers/vnpay/{vnpay.config,vnpay.contracts,vnpay.signature,vnpay.errors,vnpay.adapter}.ts` plus `apps/api/test/payment/vnpay.adapter.test.ts`.
   - Add VNPAY initiation service/controller and problem-details mapping; mirror the existing booking-scoped MoMo route without accepting amount or provider facts from the browser.
   - Write signature/URL/invalid-input tests before adapter code, then deterministic real HTTP initiation tests against a loopback provider server.

3. **Provider availability, operations, and verified ingress**
   - Create focused provider-settings repository/service/controller files under `apps/api/src/payment/`, register them in `PaymentModule`, and add public/admin contracts/routes.
   - Add VNPAY IPN and return controllers. IPN verifies query signature, normalizes into `applyVerifiedPaymentEvent`, and returns the official acknowledgement; return reads no untrusted outcome.
   - Test settings RBAC/enable semantics, VNPAY IPN idempotency/invalid signatures, and disabling after initiation.

4. **Customer and ADMIN delivery**
   - Extend `apps/web/src/lib/booking-api.ts`, `apps/web/src/lib/admin-api.ts`, `apps/web/src/components/booking-detail-panel.tsx`, and add `apps/web/src/components/payment-*` as needed.
   - Add `/app/payments/[bookingCode]/page.tsx` for read-only payment status and `/app/admin/payment-providers/page.tsx`, then add the ADMIN navigation link.
   - Add Web unit tests first for no hard-coded providers, safe initiation/redirect, status polling boundary, and non-secret ADMIN fields.

5. **Cross-provider proof and closure**
   - Extend disposable PostgreSQL integration coverage for MoMo/VNPAY double-success, concurrent events, timeout-then-IPN, amount mismatch, zero-amount bypass, audit/outbox/inventory/coupon invariants.
   - Add one deterministic Playwright vertical using only test-local provider configuration/ingress.
   - Update ADR/threat model/readiness/handoffs, run focused checks, root checks, Playwright, demo suites, audit, migration identity/status, secret scan, and protected-port checks.
   - Commit focused vertical slices only after their tests pass; final tree must be clean.

## Self-review

The plan locks one official hosted-checkout contract, keeps all mutable payment authority in the existing core, uses one bounded settings table rather than secret storage or plugin infrastructure, covers cross-provider races and UI verification, and contains no deferred deterministic requirement.
