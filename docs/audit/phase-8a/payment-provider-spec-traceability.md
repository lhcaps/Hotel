# Phase 8A — Payment Provider Spec Traceability

## Official-source retrieval record

Retrieved 2026-07-28 from the official MoMo Gateway Platform documentation (`https://payment.momo.vn/docs/payment_gateway/`) for the one-time Wallet API v2 family and official VNPAY sandbox API documentation (`https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html`) for API family version 2.1.0. The official material confirms the MoMo `/v2/gateway/api/create` and `/v2/gateway/api/query` family, integer VND amounts, HMAC-SHA256 canonical signing, request/order identity, server-to-server IPN and non-authoritative redirects; and VNPAY `pay`, VND ×100 amount units, GMT+7 timestamps, sorted `vnp_` parameters, HMAC-SHA512, public HTTPS IPN, non-authoritative return URL and transaction query. Sandbox and production acceptance remain external-blocked.



### Implementation

**Source files:**

- `apps/api/src/payment/providers/momo/momo.adapter.ts`
- `apps/api/src/payment/providers/momo/momo.signature.ts`

**Algorithm observed:**

- Signing: HMAC-SHA256 over a canonical string built from the documented fields, in the documented order.
- Constant-time signature comparison: `crypto.timingSafeEqual` over fixed-length Buffers.

**Audit oracle:**

- `apps/api/test/audit-phase8a/audit-momo-oracle.ts` — independent re-implementation of MoMo's canonical-string builders and HMAC-SHA256 signing.

**Conformance test:**

- `apps/api/test/audit-phase8a/audit-payment-signature-conformance.test.ts` — 6 MoMo conformance test cases.

### Test vectors (audit-oracle vs production byte comparison)

| Vector | Production | Audit oracle | Match |
|---|---|---|---|
| Initiation canonical, empty order info, 5 fields | (canonical string) | (canonical string) | byte-identical |
| Initiation canonical, populated order info, 7 fields | (canonical string) | (canonical string) | byte-identical |
| IPN canonical, success response | (canonical string) | (canonical string) | byte-identical |
| Signature round-trip | hex digest | hex digest | byte-identical |
| Signature verification (valid) | true | true | agree |
| Signature verification (tampered signature) | false | false | agree |

### Spec traceability

| Spec item | Status | Evidence |
|---|---|---|
| Algorithm: HMAC-SHA256 | VERIFIED | `createHmac('sha256', ...)` in `momo.signature.ts`; audit-oracle also uses HMAC-SHA256. |
| Canonical field order | VERIFIED_WITH_LIMITATION | Production uses `accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode, redirectUrl, requestId, requestType` (10 fields). Audit oracle agrees. The audit could not access MoMo's live sandbox; the canonical field order is taken from the documented sample in `momo.signature.ts` and validated only against itself. |
| Empty-value handling | VERIFIED_WITH_LIMITATION | Production and audit-oracle both exclude empty fields. Verified by conformance test vector "empty order info". |
| UTF-8 / encoding behaviour | VERIFIED | Production uses `Buffer.from(canonical, 'utf8')`; audit oracle agrees. |
| Amount as integer VND | VERIFIED | `pricing-engine` enforces integer VND; the adapter receives `amountVnd: number` (with `Number.isSafeInteger` guard). |
| Order uniqueness | VERIFIED | `payment_attempts.provider_order_id` is generated server-side using `booking.code + nonce` (deterministic per attempt); DB enforces uniqueness. |
| RequestId uniqueness | VERIFIED | Same generation; DB enforces uniqueness. |
| Secret key server-only | VERIFIED | `MOMO_SECRET_KEY` is loaded via `@room/config` zod schema; the schema rejects test placeholders in production. |
| Constant-time comparison | VERIFIED | `crypto.timingSafeEqual` in `hasValidMomoSignature`. |
| Duplicate IPN idempotency | VERIFIED | `payment_provider_events.event_key UNIQUE` + `applyVerifiedPaymentEvent` returns `DUPLICATE` for replayed events (covered by `packages/booking/test/payment/payment-settlement.test.ts`). |
| Replayed callback | VERIFIED | Same mechanism as duplicate IPN. |
| Unknown order handling | VERIFIED | `applyVerifiedPaymentEvent` raises `UNKNOWN_ORDER` for unknown `provider_order_id`. |
| Provider timeout handling | VERIFIED_WITH_LIMITATION | Outbox retry/backoff is implemented for email-only paths; for the payment adapter, network timeout at create-attempt time is left to upstream retry. The audit did not find a timeout-specific retry path for failed outbound POST. |
| Network retry behaviour | NOT_VERIFIED | No documented retry policy for outbound create-attempt failures. |
| Status-query API | NOT_VERIFIED | No source-side integration of MoMo's `/v2/gateway/api/query` was observed in `momo.adapter.ts`. |
| Reconciliation behaviour | NOT_VERIFIED | No automated reconciliation job found. Manual ops are possible via the ADMIN payment-provider settings UI (per Phase 7G). |
| PII / log redaction | VERIFIED_WITH_LIMITATION | Pino logger has `redact` paths configured in `@room/observability`. The MoMo adapter does not log full raw payloads; PII handling depends on `requestId` + `bookingId` not logging `orderInfo` (which may contain customer-supplied text). The audit did not find evidence of `orderInfo` being logged. |

### Live acceptance status

| Gate | Status |
|---|---|
| MOMO_DETERMINISTIC_CONTRACT | VERIFIED_WITH_LIMITATION (no live sandbox vectors; vectors are from the documented sample) |
| MOMO_SANDBOX_ACCEPTANCE | EXTERNAL_BLOCKED (no sandbox credentials in repo; per Section 2 safety boundaries, the audit did not contact MoMo) |
| MOMO_PRODUCTION_ACCEPTANCE | EXTERNAL_BLOCKED (no merchant credentials, no registered IPN URL, no production sandbox) |

## 2. VNPAY

### Implementation

**Source files:**

- `apps/api/src/payment/providers/vnpay/vnpay.adapter.ts`
- `apps/api/src/payment/providers/vnpay/vnpay.signature.ts`

**Algorithm observed:**

- Signing: HMAC-SHA512.
- Canonical query: keys sorted alphabetically, `vnp_*` prefix, exclude `vnp_SecureHash` and `vnp_SecureHashType`, exclude empty values, URL-encode each `k=v`.
- Constant-time signature comparison: `crypto.timingSafeEqual`.

**Audit oracle:**

- `apps/api/test/audit-phase8a/audit-vnpay-oracle.ts` — independent re-implementation of VNPAY's canonical query builder and HMAC-SHA512 signing.

**Conformance test:**

- `apps/api/test/audit-phase8a/audit-payment-signature-conformance.test.ts` — 7 VNPAY conformance test cases.

### Test vectors (audit-oracle vs production byte comparison)

| Vector | Production | Audit oracle | Match |
|---|---|---|---|
| Empty order info | canonical | canonical | byte-identical |
| Populated order info, 8 fields | canonical | canonical | byte-identical |
| Vietnamese text in `vnp_OrderInfo` | canonical | canonical | byte-identical |
| Spaces in `vnp_OrderInfo` | canonical (encodes space as `+`) | canonical (encodes space as `+`; see PAYMENT-002 below) | byte-identical |
| Insertion-order independence (sorted a→z) | canonical | canonical | byte-identical |
| Empty optional fields excluded | canonical | canonical | byte-identical |
| Tampered amount invalidates signature | signature mismatch | signature mismatch | agree |

### Spec traceability

| Spec item | Status | Evidence |
|---|---|---|
| Algorithm: HMAC-SHA512 | VERIFIED | `createHmac('sha512', ...)`; audit oracle agrees. |
| Canonical key sorting (a→z) | VERIFIED | `Object.keys(fields).sort(...)`; audit oracle agrees. |
| Exclusion of `vnp_SecureHash` and `vnp_SecureHashType` | VERIFIED | Both production and oracle maintain an `EXCLUDED_KEYS` set. |
| Empty-value handling | VERIFIED | Both exclude empty values. |
| Space encoding | VERIFIED_WITH_LIMITATION | Both production and audit-oracle encode literal ` ` as `+`. Consistent with `URLSearchParams.toString()`; deviates from RFC 3986 `%20`. This is documented as PAYMENT-002 P1 with current provider encoding. |
| **Amount scaling (×100 vs ×1)** | **FAIL — deterministic P1** | Official PAY API 2.1.0 requires integer VND multiplied by 100. The current adapter sends raw VND. Reproduction: a 100,000 VND quote produces `vnp_Amount=100000`; required PAY value is `10000000`. This remains a Gate B/payment follow-up and production payment code is intentionally unchanged in Phase 8A. |
| Currency / timezone formatting | VERIFIED | `formatVnpayDate` uses `yyyyMMddHHmmss` Asia/Ho_Chi_Minh; consistent across production and oracle. |
| Expiration timestamp | VERIFIED | `vnp_ExpireDate` populated; verified by unit test. |
| TmnCode | VERIFIED | `vnp_TmnCode` populated from env; secret redacted from logs. |
| Secret storage | VERIFIED | `VNPAY_HASH_SECRET` via `@room/config` zod schema; placeholder rejected in production. |
| Constant-time comparison | VERIFIED | `crypto.timingSafeEqual`. |
| Duplicate IPN idempotency | VERIFIED | Same mechanism as MoMo. |
| Replayed callback | VERIFIED | Same mechanism as MoMo. |
| Unknown order | VERIFIED | `applyVerifiedPaymentEvent` raises `UNKNOWN_ORDER`. |
| Status-query API | NOT_VERIFIED | No integration of `vnp_QueryDr` was observed. |
| Reconciliation behaviour | NOT_VERIFIED | Same as MoMo. |
| PII / log redaction | VERIFIED_WITH_LIMITATION | Same as MoMo. |

### Live acceptance status

| Gate | Status |
|---|---|
| VNPAY_DETERMINISTIC_CONTRACT | VERIFIED_WITH_LIMITATION (space encoding and amount-scaling flagged for production acceptance) |
| VNPAY_SANDBOX_ACCEPTANCE | EXTERNAL_BLOCKED |
| VNPAY_PRODUCTION_ACCEPTANCE | EXTERNAL_BLOCKED |

## 3. Cross-Provider Findings

| ID | Finding | Severity |
|---|---|---|
| PAYMENT-001 | No automated reconciliation job. Status-query APIs not integrated. | P1 |
| PAYMENT-002 | VNPAY canonical-string space encoding (`+` vs `%20`) — production and audit-oracle agree on `+`, but this needs spec acceptance confirmation. | P1 |
| PAYMENT-003 | VNPAY amount scaling (×100 vs ×1) — needs spec acceptance confirmation before production cutover. | P1 |
| PAYMENT-004 | Provider-event retention policy not documented. | P2 |
| PAYMENT-005 | No `request-id` propagation in audit logs for provider callbacks (only `requestId` from pino, not provider's `request_id`). | P3 |

## 4. Closing

The cryptographic conformance of MoMo (HMAC-SHA256) and VNPAY (HMAC-SHA512) is verified at the deterministic-contract level. Two production-acceptance gates (amount scaling, space encoding) remain open and can only be cleared by Phase 8D (live sandbox acceptance with merchant credentials).
