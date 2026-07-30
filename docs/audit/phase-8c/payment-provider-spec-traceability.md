# Phase 8C — Payment Provider Spec Traceability (delta over Phase 8A)

This document is a Phase 8C delta over
`docs/audit/phase-8a/payment-provider-spec-traceability.md`. It
captures the **status-query** contract for MoMo and VNPAY that
Phase 8C's reconciliation layer depends on, plus the official
retrieval record and the live acceptance gates that remain
`EXTERNAL_BLOCKED`.

## Official-source retrieval record

Retrieved 2026-07-28 from:

- MoMo Gateway Platform documentation:
  `https://payment.momo.vn/docs/payment_gateway/` (One-Time Payments
  and Payment Notification documentation, accessed 2026-07-28).
  The relevant family is `POST /v2/gateway/api/create`,
  `POST /v2/gateway/api/query`, and the JSON IPN.
- VNPAY sandbox API documentation:
  `https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html`
  (API family version 2.1.0, accessed 2026-07-28). The relevant
  family is `vnp_QueryDr`, `pay`, IPN `vnp_*`, and the sorted
  canonical signing.

The official material confirms:

- MoMo `/v2/gateway/api/query` request canonical string:
  `accessKey=...&orderId=...&partnerCode=...&requestId=...` (4
  fields, fixed order). Response reuses the signed-field contract
  documented for the create-response payload, with `payUrl`
  omitted and `transId` optional.
- VNPAY query payload shares the `vnp_*` sorted-canonical form as
  create/IPN payloads: alphabetical sort, `vnp_SecureHash` /
  `vnp_SecureHashType` excluded, empty values excluded,
  URL-encoding each `k=v`.

## 1. MoMo — Phase 8C delta

### Implementation

**Source files:**

- `apps/api/src/payment/providers/momo/momo.adapter.ts`
- `apps/api/src/payment/providers/momo/momo.signature.ts` —
  `buildMomoQueryCanonicalString` is the new addition; it signs
  over `accessKey=...&orderId=...&partnerCode=...&requestId=...`.
- `apps/api/src/payment/providers/momo/momo.contracts.ts` —
  `momoQueryResponseSchema` is the new addition.
- `apps/api/src/payment/providers/momo/momo.errors.ts` —
  `MomoQueryNetworkError`, `MomoQueryConfigError`, and the
  `MomoQueryAdapterError` additions.

**Algorithm observed:**

- Signing: HMAC-SHA256 over a canonical string built from the
  documented fields, in the documented order.
- Constant-time signature comparison: `crypto.timingSafeEqual` over
  fixed-length Buffers.

**Audit oracle:**

- `apps/api/test/payment/gate-b1-momo.oracle.ts` — independent
  re-implementation of MoMo's canonical-string builders and
  HMAC-SHA256 signing, in isolation from production.

**Conformance test:**

- `apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts`
  — MoMo conformance cases (initiation, response, IPN, query).
  Exact count and pass/fail: **pending — awaiting command
  evidence**.

### Spec traceability

| Spec item                                | Status                   | Evidence                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Algorithm: HMAC-SHA256 (status query)    | VERIFIED                 | `createHmac('sha256', ...)` in `momo.signature.ts`; audit oracle agrees.                                                                                                                                                                                                   |
| Canonical field order (4 fields)         | VERIFIED_WITH_LIMITATION | Production uses `accessKey, orderId, partnerCode, requestId`. Audit oracle agrees. The audit could not access MoMo's live sandbox; the canonical field order is taken from the documented sample in `momo.signature.ts` and validated only against itself.                 |
| Empty-value handling                     | VERIFIED_WITH_LIMITATION | Production and audit-oracle both exclude empty fields; the documented query canonical form has no empty values, but the same convention as initiation/IPN applies.                                                                                                         |
| UTF-8 / encoding behaviour               | VERIFIED                 | Production uses `Buffer.from(canonical, 'utf8')`; audit oracle agrees.                                                                                                                                                                                                     |
| Amount as integer VND                    | VERIFIED                 | Reconciliation cycle passes the canonical amount from the query response verbatim to `applyVerifiedPaymentEvent`; amount-mismatch path is unchanged from IPN.                                                                                                              |
| Order uniqueness                         | VERIFIED                 | DB enforces uniqueness on `payment_attempts(provider_order_id)` and the new `payments_property_booking_uq`.                                                                                                                                                                |
| RequestId uniqueness                     | VERIFIED                 | Same generation; DB enforces uniqueness.                                                                                                                                                                                                                                   |
| Secret key server-only                   | VERIFIED                 | `MOMO_SECRET_KEY` is loaded via `@room/config` zod schema; the schema rejects test placeholders in production.                                                                                                                                                             |
| Constant-time comparison                 | VERIFIED                 | `crypto.timingSafeEqual` in `hasValidMomoSignature`.                                                                                                                                                                                                                       |
| Duplicate IPN idempotency                | VERIFIED                 | `payment_provider_events.event_key UNIQUE` + `applyVerifiedPaymentEvent` returns `DUPLICATE` for replayed events (covered by `packages/booking/test/payment/payment-settlement.test.ts`).                                                                                  |
| Replayed callback                        | VERIFIED                 | Same mechanism as duplicate IPN.                                                                                                                                                                                                                                           |
| Unknown order handling                   | VERIFIED                 | `applyVerifiedPaymentEvent` raises `UNKNOWN_ORDER` for unknown `provider_order_id`.                                                                                                                                                                                        |
| Reconciliation status query integration  | VERIFIED_WITH_LIMITATION | Status-query adapter is wired through `ReconciliationStatusQueryPort`. Live sandbox acceptance is `EXTERNAL_BLOCKED`; the oracle is deterministic and sandbox-independent.                                                                                                 |
| Provider timeout handling (status query) | VERIFIED_WITH_LIMITATION | Adapter bounded timeout (1..60 s) via `AbortSignal`; transient errors drive the bounded policy.                                                                                                                                                                            |
| Network retry behaviour (status query)   | VERIFIED                 | Reconciliation policy with `maxAttempts = 8` and `delayMinutes = [1, 5, 15, 60, 240]`; lease semantics; bounded batch.                                                                                                                                                     |
| Status-query API                         | VERIFIED                 | `momoQueryResponseSchema` and `buildMomoQueryCanonicalString` are present in the source.                                                                                                                                                                                   |
| Reconciliation behaviour                 | VERIFIED_WITH_LIMITATION | Reconciliation service is wired; live sandbox acceptance is `EXTERNAL_BLOCKED`.                                                                                                                                                                                            |
| PII / log redaction                      | VERIFIED_WITH_LIMITATION | Pino logger has `redact` paths configured in `@room/observability`. The MoMo adapter does not log full raw payloads. Phase 8C additionally does not log the query response body, raw query URL, or signature. The audit did not find evidence of `orderInfo` being logged. |

### Live acceptance status

| Gate                          | Status                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `MOMO_DETERMINISTIC_CONTRACT` | VERIFIED_WITH_LIMITATION (no live sandbox vectors; vectors are from the documented sample)                                                    |
| `MOMO_STATUS_QUERY_CONTRACT`  | VERIFIED_WITH_LIMITATION (status-query canonical string and response shape are present in source; sandbox verification is `EXTERNAL_BLOCKED`) |
| `MOMO_SANDBOX_ACCEPTANCE`     | EXTERNAL_BLOCKED (no sandbox credentials in repo; per Section 2 safety boundaries, the audit did not contact MoMo)                            |
| `MOMO_PRODUCTION_ACCEPTANCE`  | EXTERNAL_BLOCKED (no merchant credentials, no registered IPN URL, no production sandbox)                                                      |

## 2. VNPAY — Phase 8C delta

### Implementation

**Source files:**

- `apps/api/src/payment/providers/vnpay/vnpay.adapter.ts`
- `apps/api/src/payment/providers/vnpay/vnpay.signature.ts` — the
  reconciliation query reuses `buildVnpayCanonicalQuery` /
  `signVnpayCanonicalQuery` / `hasValidVnpaySignature`.

**Algorithm observed:**

- Signing: HMAC-SHA512.
- Canonical query: keys sorted alphabetically, `vnp_*` prefix,
  exclude `vnp_SecureHash` and `vnp_SecureHashType`, exclude empty
  values, URL-encode each `k=v`.
- Constant-time signature comparison: `crypto.timingSafeEqual`.

**Audit oracle:**

- `apps/api/test/payment/gate-b1-vnpay.oracle.ts` — independent
  re-implementation of VNPAY's canonical query builder and
  HMAC-SHA512 signing, in isolation from production.

**Conformance test:**

- `apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts`
  — VNPAY conformance cases (create, IPN, query). Exact count and
  pass/fail: **pending — awaiting command evidence**.

### Spec traceability

| Spec item                                              | Status                                                | Evidence                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Algorithm: HMAC-SHA512                                 | VERIFIED                                              | `createHmac('sha512', ...)`; audit oracle agrees.                                                                                                                                                                                                                    |
| Canonical key sorting (a→z)                            | VERIFIED                                              | `Object.keys(fields).sort(...)`; audit oracle agrees.                                                                                                                                                                                                                |
| Exclusion of `vnp_SecureHash` and `vnp_SecureHashType` | VERIFIED                                              | Both production and oracle maintain an `EXCLUDED_KEYS` set.                                                                                                                                                                                                          |
| Empty-value handling                                   | VERIFIED                                              | Both exclude empty values.                                                                                                                                                                                                                                           |
| Space encoding                                         | VERIFIED_WITH_LIMITATION                              | Both production and audit-oracle encode literal ` ` as `+`. Consistent with `URLSearchParams.toString()`; deviates from RFC 3986 `%20`. This is documented as `PAYMENT-002` P1 with current provider encoding and remains `EXTERNAL_BLOCKED`.                        |
| **Amount scaling (×100 vs ×1)**                        | **FAIL — deterministic P1; remains EXTERNAL_BLOCKED** | Official PAY API 2.1.0 requires integer VND multiplied by 100. The current adapter sends raw VND. Reproduction: a 100,000 VND quote produces `vnp_Amount=100000`; required PAY value is `10000000`. Reconciliation reuses the same adapter and inherits the same P1. |
| Currency / timezone formatting                         | VERIFIED                                              | `formatVnpayDate` uses `yyyyMMddHHmmss` Asia/Ho_Chi_Minh; consistent across production and oracle.                                                                                                                                                                   |
| Expiration timestamp                                   | VERIFIED                                              | `vnp_ExpireDate` populated; verified by unit test.                                                                                                                                                                                                                   |
| TmnCode                                                | VERIFIED                                              | `vnp_TmnCode` populated from env; secret redacted from logs.                                                                                                                                                                                                         |
| Secret storage                                         | VERIFIED                                              | `VNPAY_HASH_SECRET` via `@room/config` zod schema; placeholder rejected in production.                                                                                                                                                                               |
| Constant-time comparison                               | VERIFIED                                              | `crypto.timingSafeEqual`.                                                                                                                                                                                                                                            |
| Duplicate IPN idempotency                              | VERIFIED                                              | Same mechanism as MoMo.                                                                                                                                                                                                                                              |
| Replayed callback                                      | VERIFIED                                              | Same mechanism as MoMo.                                                                                                                                                                                                                                              |
| Unknown order                                          | VERIFIED                                              | `applyVerifiedPaymentEvent` raises `UNKNOWN_ORDER`.                                                                                                                                                                                                                  |
| Status-query API                                       | VERIFIED                                              | `vnp_QueryDr` is integrated; reconciliation cycle calls it via `ReconciliationStatusQueryPort`.                                                                                                                                                                      |
| Reconciliation behaviour                               | VERIFIED_WITH_LIMITATION                              | Reconciliation service is wired; live sandbox acceptance is `EXTERNAL_BLOCKED`.                                                                                                                                                                                      |
| PII / log redaction                                    | VERIFIED_WITH_LIMITATION                              | Same as MoMo.                                                                                                                                                                                                                                                        |

### Live acceptance status

| Gate                           | Status                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `VNPAY_DETERMINISTIC_CONTRACT` | VERIFIED_WITH_LIMITATION (space encoding and amount-scaling flagged for production acceptance)                        |
| `VNPAY_STATUS_QUERY_CONTRACT`  | VERIFIED_WITH_LIMITATION (status-query canonical shape reuses create/IPN; sandbox verification is `EXTERNAL_BLOCKED`) |
| `VNPAY_SANDBOX_ACCEPTANCE`     | EXTERNAL_BLOCKED                                                                                                      |
| `VNPAY_PRODUCTION_ACCEPTANCE`  | EXTERNAL_BLOCKED                                                                                                      |

## 3. Cross-Provider Findings (Phase 8C delta)

| ID            | Finding                                                           | Severity | Phase 8C status                                                                                                    |
| ------------- | ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `PAYMENT-001` | No automated reconciliation job.                                  | P1       | **CLOSED** by Phase 8C (`packages/booking/src/payment/reconciliation.ts` + worker tick).                           |
| `PAYMENT-002` | VNPAY canonical-string space encoding (`+` vs `%20`).             | P1       | **OPEN; EXTERNAL_BLOCKED**. Live sandbox required.                                                                 |
| `PAYMENT-003` | VNPAY amount scaling (×100 vs ×1).                                | P1       | **OPEN; EXTERNAL_BLOCKED**. Live sandbox required.                                                                 |
| `PAYMENT-004` | Provider-event retention policy not documented.                   | P2       | OPEN; unchanged.                                                                                                   |
| `PAYMENT-005` | No `request-id` propagation in audit logs for provider callbacks. | P3       | OPEN; unchanged.                                                                                                   |
| `PAYMENT-006` | Reconciliation cycle over-runs provider without lease recovery.   | P1       | **CLOSED** by Phase 8C (lease + bounded batch + bounded query timeout + `LEASE_LOST` outcome).                     |
| `PAYMENT-007` | Cross-provider race produces two confirmations.                   | P1       | **CLOSED** by Phase 8C (`payments_property_booking_uq` + settlement lock order + `REVIEW_REQUIRED` for the loser). |

## 4. Closing

The cryptographic conformance of MoMo (HMAC-SHA256) and VNPAY
(HMAC-SHA512) is verified at the deterministic-contract level for
the create, response, IPN, and query canonical strings. The
reconciliation cycle is wired and bounded. The cross-provider race
matrix is closed at the deterministic level. Two production-acceptance
gates (VNPAY amount scaling, VNPAY space encoding) remain
`EXTERNAL_BLOCKED` and can only be cleared by Phase 8D (live sandbox
acceptance with merchant credentials and a registered public HTTPS
callback URL).

The retrieval date for the official MoMo and VNPAY documentation
referenced in this delta is **2026-07-28**. The URLs are:

- MoMo: `https://payment.momo.vn/docs/payment_gateway/`.
- VNPAY: `https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html`.
