# Payment architecture

Payment is server-authoritative and adapter-agnostic. The settlement
core (`applyVerifiedPaymentEvent` in
`packages/booking/src/payment/payment-service.ts`) is the only path
that can transition `bookings`, `payments`, `coupon_applications`,
`inventory_blocks`, `audit_events`, and the `outbox`. Provider
adapters (MoMo, VNPAY) own signature verification and event
normalisation only; they never write to those rows directly.

This architecture inherits from:

- `docs/architecture/adr/ADR-0004-payment-adapter.md`
- `docs/architecture/adr/ADR-0006-payment-core-settlement.md`
- `docs/architecture/adr/ADR-0011-payment-settlement-reconciliation.md`
- `docs/security/threat-model.md`
- `docs/domain/payment-state-machine.md`
- `docs/handoffs/phase-7c-payment-core.md`
- `docs/handoffs/phase-7d-momo-sandbox-adapter.md`
- `docs/handoffs/phase-8c-payment-settlement-reconciliation.md`

## Phase 8D correction

Phase 8D deterministic VNPAY evidence verifies VND `amount × 100` exactly once, lexical canonical ordering, secure-hash exclusion, and HMAC-SHA512 verification. This supersedes any older wording that treated VNPAY amount scaling or canonical encoding as an external blocker; only live merchant sandbox/production acceptance remains external.

## High-level topology

```
                      ┌──────────────────────────┐
   browser            │  API (Fastify/Nest)      │
  (return URL only)   │                          │
       │              │  /api/v1/quotes          │
       │              │  /api/v1/availability    │
       ▼              │  /api/v1/webhooks/{prv}  │   /api/v1/admin/operational-reviews
   MoMo/VNPAY ◀──IPN──│  /api/v1/payments/...    │──▶ ADMIN role-gated routes
       │              │                          │
       │              └────────────┬─────────────┘
       │                           │  transactional core
       │                           ▼
       │              ┌──────────────────────────┐
       │              │  PostgreSQL              │
       │              │   payments               │
       │              │   payment_attempts       │
       │              │   payment_provider_      │
       │              │     events (dedup)       │
       │              │   operational_reviews    │
       │              │   audit_events           │
       │              │   outbox                 │
       │              └──────────────────────────┘
       │                           ▲
       │     status-query          │
       │     (database-only         │
       │      until verified)       │
       │                           │
       ▼                           │
   MoMo/VNPAY ◀───status query─────┤
       ▲                           │
       │     lease + bounded       │
       │     policy                │
       │                           │
   ┌──────────────────────────────────────────┐
   │ Worker (continuous mode)                 │
   │  /apps/worker/src/scheduler              │
   │  /apps/worker/src/reconciliation         │
   │   runReconciliationCycle                 │
   │     claimReconciliationAttempts          │
   │     recoverExpiredReconciliationLeases   │
   │     reconcilePaymentAttempt              │
   │       queryProvider(ReconciliationStatusQueryPort)
   └──────────────────────────────────────────┘
```

Browser return URLs are read-only and never settle a payment.
Provider IPNs and reconciliation queries are the only settlement
authority inputs; both feed the same canonical core. Customer checkout
availability is a server-derived non-secret response: adapter configuration,
property enablement, and maintenance state must all permit the provider
before the Web client enables its action.

## Module map

| Concern               | Module                                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settlement core       | `packages/booking/src/payment/payment-service.ts` (`applyVerifiedPaymentEvent`, `createPaymentAttempt`, `confirmNoChargeBooking`)                                                                                                                                 |
| Adapter port          | `packages/booking/src/payment/adapter.ts`                                                                                                                                                                                                                         |
| Adapter types         | `packages/booking/src/payment/types.ts`                                                                                                                                                                                                                           |
| Adapter errors        | `packages/booking/src/payment/errors.ts`                                                                                                                                                                                                                          |
| Reconciliation module | `packages/booking/src/payment/reconciliation.ts` (Phase 8C)                                                                                                                                                                                                       |
| Worker tick           | `apps/worker/src/scheduler/worker-runner.ts`, `apps/worker/src/scheduler/worker-scheduler.ts`                                                                                                                                                                     |
| Worker reconciliation | `apps/worker/src/reconciliation/claim-reconciliation-batch.ts`, `apps/worker/src/jobs/process-reconciliation.ts`                                                                                                                                                  |
| MoMo adapter          | `apps/api/src/payment/providers/momo/momo.adapter.ts`                                                                                                                                                                                                             |
| MoMo signature        | `apps/api/src/payment/providers/momo/momo.signature.ts` (`buildMomoInitiationCanonicalString`, `buildMomoResponseCanonicalString`, `buildMomoIpnCanonicalString`, `buildMomoQueryCanonicalString` (Phase 8C), `signMomoCanonicalString`, `hasValidMomoSignature`) |
| MoMo contracts        | `apps/api/src/payment/providers/momo/momo.contracts.ts` (`momoCreateResponseSchema`, `momoIpnSchema`, `momoQueryResponseSchema` (Phase 8C))                                                                                                                       |
| MoMo errors           | `apps/api/src/payment/providers/momo/momo.errors.ts` (`MomoAdapterError`, `MomoQueryNetworkError`, `MomoQueryConfigError`, `MomoQueryAdapterError` (Phase 8C))                                                                                                    |
| VNPAY adapter         | `apps/api/src/payment/providers/vnpay/vnpay.adapter.ts`                                                                                                                                                                                                           |
| VNPAY signature       | `apps/api/src/payment/providers/vnpay/vnpay.signature.ts`                                                                                                                                                                                                         |
| VNPAY contracts       | `apps/api/src/payment/providers/vnpay/vnpay.contracts.ts`                                                                                                                                                                                                         |
| VNPAY errors          | `apps/api/src/payment/providers/vnpay/vnpay.errors.ts`                                                                                                                                                                                                            |
| Configuration         | `packages/config` (`MOMO_*`, `VNPAY_*`, `WORKER_RECONCILIATION_*`)                                                                                                                                                                                                |

## Settlement authority boundary

```
POST /api/v1/webhooks/momo        ─┐
                                   │  verify signature,
POST /api/v1/webhooks/vnpay       ─┤  normalize event,
                                   │  mark
reconcilePaymentAttempt(provider) ─┘  VERIFIED_BY_ADAPTER
                                   │
                                   ▼
                  applyVerifiedPaymentEvent(...)
                                   │
                                   ▼
                  DB transaction (single settlement):
                    bookings: HOLD -> CONFIRMED (state machine STM-002)
                    payments: PENDING -> SUCCEEDED
                    booking_coupon_applications: RESERVED -> REDEEMED
                    inventory_blocks: maintained
                    audit_events: append-only
                    outbox: append-only
                    payment_provider_events: append-only (event_key UNIQUE)
```

## Reconciliation layer (Phase 8C)

The reconciliation layer is **database-only until verified**. The
worker tick claims a batch of `payment_attempts` rows whose
`status = 'PENDING'` and whose `next_reconciliation_at <= now()`
with `FOR UPDATE SKIP LOCKED`, using a bounded lease
(`lease_owner`, `lease_expires_at`). For each claimed attempt it
queries the provider (MoMo `/v2/gateway/api/query` or VNPAY
`vnp_QueryDr`) with a bounded `AbortSignal`.

The outcome is one of:

- `PROCESSED` (canonical mapping succeeds) — feed
  `applyVerifiedPaymentEvent` with a synthetic verified marker;
  advance `last_reconciled_at`, clear lease.
- `TERMINAL_NOT_FOUND` (provider reports `NOT_FOUND` after grace) —
  record `PROVIDER_NOT_FOUND`, clear lease.
- `TERMINAL_REVIEW_REQUIRED` (provider says `FAILED`/`CANCELLED`/
  `EXPIRED` matching) — record `PROVIDER_CONFIRMED_*`, clear lease.
- `STALE_FAILURE_PROTECTED` (provider `FAILED` but attempt already
  settled) — record `STALE_FAILURE_PROTECTED`, do not retry.
- `TRANSIENT_RETRY_SCHEDULED` (provider `PENDING` or transient
  network failure) — bump `reconciliation_attempt_count`, schedule
  `next_reconciliation_at`, keep lease.
- `PERMANENT_REVIEW_REQUIRED` (permanent failure such as
  signature/merchant/order/amount mismatch) — record
  `PROVIDER_*_INVALID` etc., clear lease, open operational review.
- `PERMANENT_RETRY_EXHAUSTED` (transient but exhausted) — open
  operational review `RECONCILIATION_EXHAUSTED`.
- `LEASE_LOST` — bump attempt count, schedule next attempt.

No settlement mutation is introduced by the reconciliation layer.
The reconciliation layer logs `last_error_code` and
operational-review opening only; it never writes `audit_events`,
never mutates `bookings`/`payments`/`coupon_applications`/
`inventory_blocks`, and never inserts into `payment_provider_events`
unless through the canonical `applyVerifiedPaymentEvent` path.

## Cryptographic conformance

Both providers reuse the same canonical signing for initiation, IPN,
and status query:

- MoMo: HMAC-SHA256 over a canonical string built from the
  documented fields in the documented order; constant-time
  comparison with `crypto.timingSafeEqual` over fixed-length
  Buffers.
- VNPAY: HMAC-SHA512 over alphabetically-sorted `vnp_*` canonical
  with `vnp_SecureHash` / `vnp_SecureHashType` excluded and empty
  values excluded; URL-encoded `k=v`; constant-time comparison.

The Gate B.1 cryptographic-conformance test
(`apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts`)
runs an independent oracle against the production canonical
builders and asserts byte-identical digests and
`crypto.timingSafeEqual` agreement. See
`docs/audit/phase-8c/cryptographic-vectors.md` for the catalogue.

## Audit, outbox, log redaction

Every settlement-side effect flows through `applyVerifiedPaymentEvent`
and therefore the same transactional audit and outbox write as IPN.
The reconciliation cycle is database-only and does not write audit
events directly.

Log redaction is enforced by `@room/observability`'s Pino `redact`
paths. Phase 8C additionally does not log:

- Raw query responses, raw query URLs, or signatures.
- `accessKey`, `secretKey`, `partnerCode`, `tmnCode`, `hashSecret`
  values.
- Raw webhook bodies.

## Migration and schema

Migration `0017_optimal_freak.sql` adds:

- `payment_attempts.reconciliation_attempt_count` (integer NOT NULL
  DEFAULT 0).
- `payment_attempts.next_reconciliation_at` (timestamptz NULL).
- `payment_attempts.last_reconciled_at` (timestamptz NULL).
- `payment_attempts.last_error_code` (text NULL).
- `payment_attempts.lease_owner` (text NULL).
- `payment_attempts.lease_expires_at` (timestamptz NULL).
- Three CHECK constraints
  (`payment_attempts_reconciliation_attempt_count_ck`,
  `payment_attempts_reconciliation_lease_ck`,
  `payment_attempts_reconciliation_error_ck`).
- `payments_property_booking_uq` UNIQUE index on
  `(property_id, booking_id)`.
- Re-declaration of `operational_reviews_payment_fk` against the
  new unique index.
- Three lookup indexes (`payment_attempts_reconciliation_eligible_idx`,
  `payment_provider_events_provider_received_idx`,
  `payments_property_status_updated_idx`,
  `operational_reviews_payment_review_idx`).

`packages/database/src/schema-status.ts` exposes
`EXPECTED_SCHEMA_VERSION = 'phase-8d-client-acceptance-v1'`.

## External blockers (honest)

- `MOMO_SANDBOX_ACCEPTANCE` — `EXTERNAL_BLOCKED`. No MoMo sandbox
  credentials in workspace; per Phase 8A safety boundary, the audit
  does not contact MoMo.
- `VNPAY_SANDBOX_ACCEPTANCE` — `EXTERNAL_BLOCKED`. Same.
- `MOMO_PRODUCTION_ACCEPTANCE` — `EXTERNAL_BLOCKED`. No merchant
  credentials, no registered public HTTPS callback URL, no
  provider-side configuration.
- `VNPAY_PRODUCTION_ACCEPTANCE` — `EXTERNAL_BLOCKED`. Same.
- VNPAY amount scaling ×100 vs ×1 — `EXTERNAL_BLOCKED`.
- VNPAY space encoding `+` vs `%20` — `EXTERNAL_BLOCKED`.

The reconciliation cycle is sandbox-independent; it runs against the
deterministic settlement core on a disposable database.

## Related documents

- `docs/architecture/adr/ADR-0004-payment-adapter.md`
- `docs/architecture/adr/ADR-0006-payment-core-settlement.md`
- `docs/architecture/adr/ADR-0011-payment-settlement-reconciliation.md`
- `docs/domain/payment-state-machine.md`
- `docs/domain/business-invariants.md` (`INV-031..INV-040`)
- `docs/product/user-journeys.md` (`JRN-001..JRN-014`)
- `docs/security/threat-model.md` (`THR-005..THR-007`, `THR-019`,
  `THR-023..THR-026`)
- `docs/audit/phase-8a/payment-gateway-assurance.md`
- `docs/audit/phase-8a/payment-provider-spec-traceability.md`
- `docs/audit/phase-8c/payment-provider-spec-traceability.md`
- `docs/audit/phase-8c/cryptographic-vectors.md`
- `docs/audit/phase-8c/cross-provider-race-matrix.md`
- `docs/runbooks/phase-8c-payment-reconciliation.md`
- `docs/handoffs/phase-7c-payment-core.md`
- `docs/handoffs/phase-7d-momo-sandbox-adapter.md`
- `docs/handoffs/phase-8c-payment-settlement-reconciliation.md`
