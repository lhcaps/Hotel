# Phase 7D MoMo sandbox adapter handoff

## Delivered

The server-side MoMo `captureWallet` sandbox adapter lives in `apps/api/src/payment/providers/momo/`. It validates environment ownership, creates signed checkout requests, verifies signed responses and IPN with constant-time HMAC-SHA256 comparison, computes a SHA-256 raw-body digest, and normalizes only verified IPN into the Phase 7C settlement core.

`POST /api/v1/public/bookings/{bookingCode}/payments/momo/attempts` requires a booking-scoped guest session and `Idempotency-Key`; all money and provider identity comes from the core. `POST /api/v1/webhooks/momo` acknowledges safely with 204 and is IPN-only settlement. `GET /api/v1/payments/providers/momo/return` is intentionally read-only.

## Locked contract and safety boundary

Source: MoMo One-Time Payments and Payment Notification documentation, accessed 2026-07-26. Contract: `captureWallet`, sandbox `https://test-payment.momo.vn/v2/gateway/api/create`, HMAC-SHA256 logical-field signatures, JSON IPN and 204 acknowledgement. No credentials, signatures or raw payloads are stored or emitted. A post-dispatch timeout or malformed response preserves the same order identity and records `MOMO_INITIATION_OUTCOME_UNKNOWN`; a later verified IPN can settle it.

## Deterministic closure evidence

On 2026-07-26, the disposable PostgreSQL Fastify/Nest integration suite added six real-route scenarios. It verifies booking-scoped initiation, server-authoritative outbound amount and signature, safe checkout response, sequential/concurrent idempotency, signed settlement, duplicate IPN, malformed/missing signature rejection, amount mismatch review, second-success review, timeout followed by signed IPN, late-success review, unknown-order safety, and browser-return non-authority. Valid and signature-rejected IPN requests receive 204; syntactically malformed JSON is rejected by Fastify before controller dispatch with 400 and cannot enter settlement.

Focused evidence: adapter conformance 12 tests; checkout/IPN HTTP integration 6 tests; Phase 7C PostgreSQL settlement/race suites continue to cover duplicate event and lock behavior. OpenAPI, database status/check, root lint/typecheck/unit/build, Playwright, demo lifecycle, and production dependency audit were run in the closure validation. No Phase 7D migration was introduced.

## Live gate and next phase

No merchant sandbox credentials or approved public HTTPS callback were configured in this workspace, so a real sandbox transaction/IPN is not claimed. Production readiness remains **NO**. The next phase is **7E VNPAY adapter**; do not add VNPAY or payment UI in this handoff.
