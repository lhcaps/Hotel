# Phase 8C — Payment settlement reconciliation, cross-provider race matrix, cryptographic conformance and worker gating

Date: 2026-07-28

## 1. Purpose

Phase 8A documented that the settlement aggregate is sound but that the
cross-provider race matrix and the status-query reconciliation path were
not yet exercised (`docs/audit/phase-8a/payment-gateway-assurance.md`
Section 2). Phase 8C closes that deferred scope by:

1. Adding a server-authoritative **payment reconciliation service** in
   `packages/booking/src/payment/reconciliation.ts` that drives the
   canonical settlement core (`applyVerifiedPaymentEvent`) from
   non-canonical provider status-query evidence.
2. Adding a **Gate B.1 cryptographic-conformance** test that runs an
   independent oracle against the production MoMo and VNPAY canonical
   string builders and asserts byte-identical HMAC digests and
   `crypto.timingSafeEqual` agreement. The gate covers initiation,
   IPN, response, and status-query canonical strings for both
   providers.
3. Closing the **cross-provider race matrix** for the remaining
   deferred scenarios (`PS-09`, `PS-13`, `PS-14`, `PS-19`):
   duplicate MoMo success, duplicate VNPAY success, MoMo-vs-VNPAY
   race, success-after-ADMIN-cancel, success-after-check-out, and
   reconciliation-driven settlement through the canonical core.
4. Wiring the **worker reconciliation tick** into the existing
   continuous-mode scheduler so a single worker instance can claim
   `payment_attempts` rows whose `next_reconciliation_at <= now()`
   with `FOR UPDATE SKIP LOCKED`, drive the canonical status query,
   and advance the reconciliation columns without bypassing the
   settlement core.
5. Locking the **operational review anchor** for the new
   reconciliation outcomes (`RECONCILIATION_EXHAUSTED`,
   `RECONCILIATION_TRANSIENT`, `RECONCILIATION_NOT_FOUND`,
   `RECONCILIATION_STALE_FAILURE`) so ADMIN can resolve them through
   the existing `/api/v1/admin/operational-reviews` surface without
   requiring new routes.

## 2. Scope and non-goals

In scope:

- New `packages/booking/src/payment/reconciliation.ts` module exporting
  `validateReconciliationPolicy`, `claimReconciliationAttempts`,
  `recoverExpiredReconciliationLeases`, `advanceReconciliationAttempt`,
  `runReconciliationCycle`, `countReconciliationDue`,
  `releaseReconciliationLease`,
  `reconcilePaymentAttempt`, and the supporting
  `ReconciliationStatusQueryPort` interface.
- New worker module `apps/worker/src/reconciliation/` exporting the
  per-tick claim/recover/advance helpers.
- Migration `0017_optimal_freak.sql` (already on the working tree)
  adding the reconciliation columns and the unique constraint
  `payments_property_booking_uq` on `payments(property_id, booking_id)`
  that the cross-provider race relies on.
- New `gate-b1-cryptographic-conformance.test.ts` plus the
  `gate-b1-momo.oracle.ts` and `gate-b1-vnpay.oracle.ts` audit
  oracles.
- New `phase8c-payment-reconciliation.test.ts` integration test on a
  disposable PostgreSQL database.
- ADR-0011 capturing the settlement authority, query port boundary,
  lease design, bounded policy, and audit/outbox constraints.

Out of scope (deferred):

- Live MoMo / VNPAY sandbox acceptance. Both
  `MOMO_SANDBOX_ACCEPTANCE` and `VNPAY_SANDBOX_ACCEPTANCE` remain
  `EXTERNAL_BLOCKED`. The sandbox credentials are not in this
  workspace; the audit does not contact either provider per the
  Phase 8A safety boundary.
- Production acceptance. `MOMO_PRODUCTION_ACCEPTANCE` and
  `VNPAY_PRODUCTION_ACCEPTANCE` remain `EXTERNAL_BLOCKED`. The
  registration of a public HTTPS callback URL, the
  provider-side configuration of allowed return URLs and IP allowlist
  (if applicable), and the production merchant credentials are not in
  this workspace.
- Refund lifecycle. ADR-0006 revisit condition remains open.
- Multi-worker scale-out. The current scheduler runs a single
  worker; the lease design supports multi-worker but Phase 8C does
  not ship it.
- Phase 8B.1 regression re-run. Phase 8B.1 docs are corrected
  (call graph, HEAD/commit order, "pending — awaiting command
  evidence" rows) but the existing Phase 8B.1 artifacts are not
  re-executed; that re-run is deferred to the next validation cycle
  and will cover both Phase 8B.1 and Phase 8C in one pass.

## 3. User flows affected

1. **MoMo attempt whose checkout call timed out.** The customer sees
   no immediate `returnUrl`. The reconciliation worker re-queries
   MoMo's `/v2/gateway/api/query`. If MoMo returns `SUCCEEDED`, the
   canonical settlement core is invoked and the booking is confirmed
   in the same transaction as audit and outbox writes. If MoMo
   returns `PENDING` (or the call fails transiently), the worker
   schedules the next attempt on the policy delay ladder.
2. **VNPAY attempt whose IPN was never delivered.** The worker
   re-queries `vnp_QueryDr`. The same canonical mapping applies.
3. **Cross-provider race.** If a customer manages to start a MoMo
   attempt and a VNPAY attempt for the same booking before either
   confirms, exactly one wins the settlement lock and the other is
   marked `REVIEW_REQUIRED` with category
   `CROSS_PROVIDER_TRANSACTION_CONFLICT`. ADMIN resolves it.
4. **Success after ADMIN cancellation.** The canonical settlement
   core refuses to confirm because the booking is no longer in
   `HOLD`; the attempt is recorded as `REVIEW_REQUIRED` with category
   `PAID_CANCELLATION` (existing operational-review row).
5. **Success after HOLD expiry.** Same as Phase 7C. The canonical
   settlement core refuses to confirm and the attempt becomes
   `REVIEW_REQUIRED` with category `BOOKING_EXPIRED`.

## 4. Data contract changes

- `packages/database/src/schema.ts`
  - `payment_attempts` gains `reconciliation_attempt_count`,
    `next_reconciliation_at`, `last_reconciled_at`,
    `last_error_code`, `lease_owner`, `lease_expires_at` columns.
  - Three CHECK constraints are added to keep the columns valid:
    `payment_attempts_reconciliation_attempt_count_ck`,
    `payment_attempts_reconciliation_lease_ck`,
    `payment_attempts_reconciliation_error_ck`.
  - `payments` gains the unique constraint
    `payments_property_booking_uq` on
    `(property_id, booking_id)` so a second provider attempting to
    insert a fresh payment for the same booking becomes a
    `TRANSACTION_CONFLICT` rather than a duplicate aggregate.
  - `operational_reviews` loses the old
    `operational_reviews_payment_fk` (which referenced the previous
    `payments_property_id_id_uq`) and gains a new
    `operational_reviews_payment_fk` that references the new unique
    index.
  - `payment_provider_events_provider_received_idx` on
    `(provider, received_at)` supports the worker's claim query.
  - `payments_property_status_updated_idx` on
    `(property_id, status, updated_at)` supports the operational
    review lookup.
- `packages/database/drizzle/0017_optimal_freak.sql` — applies the
  above. No new migration is introduced in this design phase.
- `packages/booking/src/payment/reconciliation.ts` exports the
  `ReconciliationStatusQueryPort` interface that adapters must
  satisfy; production adapters live in
  `apps/api/src/payment/providers/momo/` and
  `apps/api/src/payment/providers/vnpay/`.

## 5. Rule-version and contract stability

- The settlement rule version (the `ruleVersion` recorded on a
  payment attempt's settlement event) is unchanged. The
  reconciliation service does not emit a new `ruleVersion`.
- The pricing rule version (`phase-8b-cheapest-eligible-pricing-v1`)
  remains the single authoritative version for new quotes; the
  reconciliation service does not interact with pricing.
- The new contract additions in
  `apps/api/src/payment/providers/momo/momo.contracts.ts` are:
  - `momoQueryResponseSchema` — the shape of the response from
    MoMo's `POST /v2/gateway/api/query`. The query response omits
    `payUrl` because no redirect is generated, and `transId` is
    optional because not-found orders do not carry one.
  - The corresponding `MomoQueryResponse` type.
- The new helper in `apps/api/src/payment/providers/momo/momo.signature.ts`
  is `buildMomoQueryCanonicalString`, signing over the documented
  `accessKey=...&orderId=...&partnerCode=...&requestId=...` field
  order. The corresponding query verification uses
  `hasValidMomoSignature` with `crypto.timingSafeEqual`.
- The VNPAY query path uses `vnp_QueryDr` and reuses the existing
  `buildVnpayCanonicalQuery` (the query payload still has the same
  `vnp_*` sorted-canonical form as the create and IPN payloads).
  No new signature code is introduced for VNPAY; the conformance
  test reuses `hasValidVnpaySignature` and
  `signVnpayCanonicalQuery` against the production builders.

## 6. Operational guarantees

- Schema version: `phase-8c-payment-reconciliation-v1`
  (`packages/database/src/schema-status.ts`).
- Migration 0017 is the only new migration in Phase 8C. No
  released migration is altered.
- The reconciliation worker tick uses the existing
  `WORKER_OUTBOX_INTERVAL_MS` interval by default and is configurable
  via `WORKER_RECONCILIATION_INTERVAL_MS`,
  `WORKER_RECONCILIATION_BATCH_SIZE`,
  `WORKER_RECONCILIATION_LEASE_TTL_MS`,
  `WORKER_RECONCILIATION_QUERY_TIMEOUT_MS`. All four are validated
  by `validateReconciliationClaimOptions` /
  `validateReconciliationPolicy`; values outside the documented
  bounds throw `RangeError` before any database write.
- The reconciliation service never logs raw query responses, raw
  webhook bodies, signatures, merchant credentials, or any
  `accessKey`/`secretKey`/`partnerCode`/`tmnCode`/`hashSecret`
  value. Log redaction is enforced by `@room/observability`'s
  Pino `redact` paths and the adapter-level redaction
  documented in `docs/security/threat-model.md`.
- The reconciliation service never writes audit events. Every
  business effect still flows through `applyVerifiedPaymentEvent`
  and therefore the same transactional audit and outbox write as
  IPN. Reconciliation writes only advance the dedicated
  reconciliation columns on the attempt row.

## 7. Rollback plan

Reverting Phase 8C requires:

1. Stop the API and the worker.
2. Stop the reconciliation tick (the worker drops the
   `runReconciliationCycle` invocation while leaving the rest of the
   outbox and HOLD-expiry jobs running).
3. Revert the commit that introduced
   `packages/booking/src/payment/reconciliation.ts`,
   `apps/worker/src/reconciliation/`,
   `apps/api/src/payment/providers/momo/momo.contracts.ts`
   (the `momoQueryResponseSchema` addition),
   `apps/api/src/payment/providers/momo/momo.signature.ts`
   (the `buildMomoQueryCanonicalString` addition), and the
   corresponding `momo.errors.ts` query-error types.
4. Roll back migration `0017_optimal_freak.sql` (and any future
   Phase 8C migrations) on the disposable database before applying
   them to production. The rollback is a plain DDL rollback:
   drop the new CHECKs, drop `payments_property_booking_uq`,
   drop the new index, drop the new `payment_attempts` columns.
   No data loss because the columns are nullable or default 0.
5. Restart the API and the worker. Settlement continues to function
   via IPN only; `MOMO_INITIATION_OUTCOME_UNKNOWN` attempts remain
   `REVIEW_REQUIRED` until a manual status query from the ADMIN UI
   (Phase 7G).

## 8. Owners

- Payments + booking: settlement core, reconciliation module,
  canonical status-query adapters.
- Worker: reconciliation tick wiring.
- Database: migration 0017.
- Documentation: ADR-0011, this spec, plan, handoff, verdicts,
  validation report, runbook, provider spec traceability,
  cryptographic vectors, cross-provider race matrix, plus updates
  to `docs/domain/payment-state-machine.md`,
  `docs/domain/business-invariants.md`,
  `docs/product/user-journeys.md`,
  `docs/engineering/payment-architecture.md`,
  `docs/engineering/admin-api-contract.md`,
  `docs/security/AUTH_RBAC_POLICY.md`,
  `docs/security/threat-model.md`, and `.env.example`.

## 9. Open items handed to the validation phase

- `gate-b1-cryptographic-conformance.test.ts` exact count — pending
  re-run at HEAD.
- `phase8c-payment-reconciliation.test.ts` exact count — pending
  re-run at HEAD.
- Cross-provider race-matrix scenarios — pending re-run at HEAD; the
  design enumerates 10 scenarios; the validation report records the
  per-scenario outcome with verbatim fixture paths.
- Phase 8B.1 regression re-run (lint, typecheck, build, OpenAPI,
  database check, dependency audit, demo lifecycle) — pending.
- Live MoMo/VNPAY sandbox acceptance — EXTERNAL_BLOCKED.