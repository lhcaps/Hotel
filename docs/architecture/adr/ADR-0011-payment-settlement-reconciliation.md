# ADR-0011 - Payment settlement reconciliation (Phase 8C)

**Status:** Accepted
**Date:** 2026-07-28
**Decision owners:** Product owner, Solution Architect, On-call lead
**Supersedes:** none
**Superseded by:** none

## Context

Phase 7C introduced the payment aggregate, payment attempts, and a
deduplicated provider-event ledger. Phase 7D added the MoMo sandbox
adapter, and Phase 8A documented that two production-acceptance gates
remain open (VNPAY amount scaling P1 and reconciliation NOT_VERIFIED).
The audit (`docs/audit/phase-8a/payment-gateway-assurance.md`) deferred
the cross-provider race matrix to Phase 8C. Phase 8C closes that
deferred scope.

Provider behaviour that motivates this ADR:

- MoMo and VNPAY both publish a server-to-server status query API
  (`POST /v2/gateway/api/query` for MoMo; `vnp_QueryDr` for VNPAY).
  These are the only authoritative way to recover the canonical outcome
  for an attempt that has neither been confirmed by a verified IPN nor
  explicitly failed. They are non-canonical evidence: the booking core
  may not treat them as `VERIFIED_BY_ADAPTER` settlement.
- A timeout or malformed post-dispatch response leaves the payment
  attempt in `PENDING` and never produces a verified IPN. The attempt
  must be re-queried against the provider until a terminal state is
  observed or the policy gives up.
- A second provider may legitimately attempt to settle the same booking
  (e.g. the customer switched providers between the first attempt and
  the second). The settlement core must pick one authoritative winner
  and downgrade the other to `REVIEW_REQUIRED` without producing a
  double confirmation, double coupon redemption, or duplicate audit
  event.
- A status query is non-canonical. Only the canonical
  `applyVerifiedPaymentEvent` path may transition booking state. The
  reconciliation loop's only output is therefore either (a) a
  `VERIFIED_BY_ADAPTER` event fed back through the settlement core, or
  (b) a database-only annotation on the existing `payment_attempts`
  reconciliation columns (`reconciliation_attempt_count`,
  `next_reconciliation_at`, `last_reconciled_at`, `last_error_code`,
  `lease_owner`, `lease_expires_at`).

## Decision

Phase 8C introduces a server-authoritative **payment reconciliation
service** that drives the canonical settlement core from non-canonical
provider status-query evidence. The boundaries are:

1. **Single settlement authority.** `applyVerifiedPaymentEvent` in
   `packages/booking/src/payment/payment-service.ts` remains the only
   path that can transition a booking from `HOLD` to `CONFIRMED`. No
   new mutation path may be introduced. Status queries may not
   short-circuit settlement.

2. **Reconciliation is database-only until verified.** The worker
   claims a batch of `payment_attempts` rows whose
   `status = 'PENDING'` and whose `next_reconciliation_at <= now()`
   with `FOR UPDATE SKIP LOCKED`. For each claimed attempt it queries
   the provider (MoMo `query` or VNPAY `queryDr`) with a bounded
   timeout. The query result is mapped into the canonical event
   envelope:
   - `SUCCEEDED` with `amountVnd`/`providerTransactionId` matching the
     attempt → feed `applyVerifiedPaymentEvent` with a synthetic
     `VERIFIED_BY_ADAPTER` marker; advance
     `last_reconciled_at`, clear lease, no schedule.
   - `FAILED` / `CANCELLED` / `EXPIRED` matching the attempt's
     merchant/order → record `last_error_code = 'PROVIDER_CONFIRMED_*'`,
     clear lease, no schedule.
   - `NOT_FOUND` after a minimum grace → record
     `last_error_code = 'PROVIDER_NOT_FOUND'`, clear lease, no schedule.
   - `PENDING` or transient network failure → bump
     `reconciliation_attempt_count`, set
     `next_reconciliation_at = now + delayMinutes[i]`, record
     `last_error_code`, keep lease until expiry.
   - Stale failure (provider says `FAILED` but attempt is already
     terminal as `SUCCEEDED` from a later IPN) → record
     `last_error_code = 'STALE_FAILURE_PROTECTED'`, do not retry.
   - Permanent or exhausted transient → set
     `last_error_code = 'PERMANENT_*'` /
     `'TRANSIENT_RETRY_EXHAUSTED'`, do not schedule further retries.

3. **Lease semantics.** Each claimed attempt carries a lease
   `(lease_owner, lease_expires_at)`. Default lease TTL is configurable
   between 1 s and 5 min (Phase 8C defaults to 30 s for sandbox
   ergonomics). A reconciliation attempt whose lease has expired is
   reclaimable by the next worker tick. Reconciliation advances
   increment `reconciliation_attempt_count` and use the lease as the
   optimistic-concurrency token. The lease and the
   `reconciliation_attempt_count` are independent DB-level invariants.

4. **Bounded policy.** The default policy is
   `maxAttempts = 8` with `delayMinutes = [1, 5, 15, 60, 240]`.
   The bound is enforced server-side via
   `validateReconciliationPolicy`; values outside the bounds throw
   `RangeError` and reject the worker configuration before any
   database write.

5. **Query port boundary.** The reconciliation service depends only on
   a `ReconciliationStatusQueryPort` interface (`query(input)` with
   `provider`, `providerOrderId`, `signal`). Production binds the
   port to the MoMo `/v2/gateway/api/query` and VNPAY `vnp_QueryDr`
   adapters; tests bind a deterministic in-process oracle. The
   reconciliation core never imports a provider SDK directly.

6. **Cryptographic conformance.** The reconciliation adapter must use
   the same canonical signing as the IPN adapter. MoMo: HMAC-SHA256
   over `accessKey=...&orderId=...&partnerCode=...&requestId=...`.
   VNPAY: HMAC-SHA512 over alphabetically-sorted
   `vnp_*` parameters with `vnp_SecureHash`/`vnp_SecureHashType`
   excluded and empty values excluded. The conformance test
   `apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts`
   runs an independent oracle against the production canonical
   string builders and asserts byte-identical digests and
   `crypto.timingSafeEqual` agreement.

7. **Audit and outbox.** Every settlement-side effect still flows
   through `applyVerifiedPaymentEvent` and therefore the same
   transactional audit and outbox write as IPN. Reconciliation
   database-only writes do not write audit events; they advance
   only the dedicated reconciliation columns on the attempt.

8. **Cross-provider race matrix.** The race-matrix test
   `docs/audit/phase-8c/cross-provider-race-matrix.md` runs the
   following scenarios against the real settlement core on a
   disposable PostgreSQL database:

   - Duplicate MoMo success (two distinct `applyVerifiedPaymentEvent`
     calls with the same `event_key`) → one `SUCCEEDED`, one
     `DUPLICATE`.
   - Duplicate VNPAY success → one `SUCCEEDED`, one `DUPLICATE`.
   - Concurrent MoMo success and VNPAY success for the same booking
     → exactly one `SUCCEEDED`, the other `REVIEW_REQUIRED` with
     `TRANSACTION_CONFLICT` (DB lock order: booking → payment →
     attempt → inventory → coupon).
   - Provider success vs HOLD expiry → `REVIEW_REQUIRED` with
     `BOOKING_EXPIRED`.
   - Provider success vs ADMIN cancellation → `REVIEW_REQUIRED` with
     `CANCELLED_AFTER_CONFIRMATION_GUARD`.
   - Success vs coupon redemption race → coupon redeem at most once.
   - Success vs inventory release → `REVIEW_REQUIRED` if inventory
     was released between HOLD and settlement.
   - Duplicate provider transaction ID on second attempt →
     `TRANSACTION_CONFLICT`.
   - Duplicate provider event ID → `DUPLICATE`.
   - Out-of-order success after failure → state machine guards;
     no downgrade of terminal.
   - Reconciliation status query confirms an attempt whose lease was
     lost mid-cycle → `LEASE_LOST`, retry.

   Each scenario is captured by
   `packages/database/test/integration/phase8c-payment-reconciliation.test.ts`
   and by the audit-only fixture in
   `packages/booking/test/audit-phase8a/audit-payment-settlement.test.ts`.

9. **Provider spec retrieval.** The cryptographic conformance and
   request shape for both adapters are validated against the
   official MoMo and VNPAY documentation captured in
   `docs/audit/phase-8c/payment-provider-spec-traceability.md`. The
   retrieval record declares the access date and the official URLs:

   - MoMo Gateway Platform documentation, accessed 2026-07-28:
     `https://payment.momo.vn/docs/payment_gateway/`.
   - VNPAY sandbox API documentation, accessed 2026-07-28:
     `https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html`.

   The retrieval record also records two open gaps from Phase 8A:
   the VNPAY amount-scaling (×100) gate, and the space-encoding
   `+` vs `%20` gate. Both are still **EXTERNAL_BLOCKED** in Phase
   8C: no sandbox credentials and no production merchant
   infrastructure are present in this workspace.

10. **No new secret material.** Phase 8C introduces no new
    secret-bearing configuration. `MOMO_*` and `VNPAY_*` continue to
    be supplied only through environment variables via `@room/config`;
    no secret is persisted in the database, no audit payload carries
    a raw webhook body or signature, and no log line carries an
    `accessKey`, `secretKey`, `partnerCode`, `tmnCode`, or
    `hashSecret` value. The `.env.example` blocks Phase 8C
    configuration are placeholders only.

## Decision drivers

- Single settlement authority preserved (per Phase 7C ADR-0006 and
  INV-031..INV-033).
- Provider-agnostic reconciliation (no SDK coupling).
- Bounded resource usage (lease + max attempts + delay ladder).
- Cross-provider race safety.
- No new secret material.

## Considered alternatives

- **Provider-attached reconciliation in the adapter.** Rejected.
  Couples the adapter to a worker tick and makes the settlement
  authority provider-specific. Phase 7D's MoMo adapter and Phase 8A's
  audit both deferred this; the audit-phase-8A row
  `PS-09 / PS-19` documents the requirement for an adapter-agnostic
  race matrix.
- **Manual reconciliation dashboard only.** Rejected. Phase 8A
  finding PAYMENT-001 requires an automated reconciliation job for
  the production-acceptance gate; the audit records that the manual
  ADMIN path is insufficient because the post-dispatch timeout
  outcome `MOMO_INITIATION_OUTCOME_UNKNOWN` cannot be cleared without
  a query.
- **Treat status-query evidence as canonical.** Rejected. Status
  queries are signed with a different canonical string than IPN and
  may not be replayed through the canonical settlement path without
  their own verification marker. Treating them as canonical would
  re-introduce the Phase 7C threat of `THR-005` (forged callback).

## Consequences

### Positive consequences

- The settlement core remains the single authority (ADR-0006,
  INV-031..033). No new mutation path is introduced.
- A timeout or malformed post-dispatch response is recoverable: the
  reconciliation worker re-queries the provider and either settles,
  marks the attempt failed, or schedules the next attempt.
- A second provider that races with the first cannot produce two
  confirmations: the settlement lock order and DB constraints resolve
  to one winner and one `REVIEW_REQUIRED`.
- Cryptographic conformance is asserted by an independent oracle
  (`gate-b1-cryptographic-conformance.test.ts`) and is not coupled
  to the IPN adapter.
- The cross-provider race matrix is closed against the live
  PostgreSQL settlement core, not just the in-memory model.

### Negative consequences

- Two external sandbox-acceptance gates remain: VNPAY amount scaling
  ×100 vs ×1, and VNPAY space encoding `+` vs `%20`. Neither is
  settled by Phase 8C because neither is reachable without real
  merchant credentials and a registered public HTTPS callback.
- The reconciliation worker adds a fixed-delay tick to the worker
  process. The default 5 s tick is configurable; tightening it
  increases provider traffic.

## Risks

| Risk | Mitigation |
| --- | --- |
| Provider outage delays reconciliation | Bounded policy: 8 attempts at 1, 5, 15, 60, 240 minutes; terminal `REVIEW_REQUIRED` after exhaustion. |
| Lease lost mid-cycle | Reconciliation cycle checks lease before commit; lost lease → `LEASE_LOST`, retry. |
| Cross-provider race produces two confirmations | Settlement lock order (booking → payment → attempt → inventory → coupon) plus `payments_property_booking_uq` unique constraint; second provider path returns `REVIEW_REQUIRED`. |
| Status-query response is unsigned / mis-signed | Status-query adapter reuses the same canonical signing as IPN; cryptographic conformance test (`gate-b1-cryptographic-conformance.test.ts`) asserts byte-identical digest agreement. |
| Status-query returns a different amount than the attempt | `applyVerifiedPaymentEvent` already rejects amount mismatch as `REVIEW_REQUIRED`; the reconciliation cycle passes the query amount verbatim. |
| Reconciliation scheduler over-runs the provider | Lease + bounded batch + bounded query timeout; worker tick interval configurable. |

## Constraints

- No Phase 8C code may introduce a new settlement mutation path.
- No Phase 8C code may persist a raw webhook body, raw query
  response body, or signature.
- No Phase 8C code may log a merchant secret or
  `accessKey`/`secretKey`/`partnerCode`/`tmnCode`/`hashSecret`
  value.
- Reconciliation query timeout is bounded between 1 s and 60 s; the
  provider call must use an `AbortSignal`.
- Reconciliation batch size is bounded between 1 and 200.
- Reconciliation lease TTL is bounded between 1 s and 5 minutes.
- Reconciliation policy is bounded between 1 and 32 attempts and
  per-delay 1..1440 minutes.

## Rollback

Reverting Phase 8C requires:

1. Stop the worker.
2. Roll back the worker-config, the worker reconciliation module, the
   `reconciliation` package export, and the `payment_attempts`
   reconciliation columns introduced in migration `0017_optimal_freak.sql`.
3. Restart the worker. Settlement continues to function via IPN only;
   `MOMO_INITIATION_OUTCOME_UNKNOWN` attempts remain `REVIEW_REQUIRED`
   until a manual status query from the ADMIN UI.

## Revisit conditions

- A provider exposes a canonical, replayable status-query API that
  is signed identically to the IPN canonical string. The current MoMo
  and VNPAY query APIs share the field shape but use a different
  canonical string than their IPN; revisit if a provider closes that
  gap.
- A second worker process or horizontal worker scale-out is required.
  The lease design supports multi-worker but the current scheduler
  runs a single worker.
- A refund lifecycle is added (Phase 7C ADR-0006 revisit condition).

## Related documents

- ADR-0004 — Payment Adapter cho MoMo va VNPAY
- ADR-0006 — Payment-core settlement authority
- ADR-0009 — Admin booking lifecycle (operational review anchor)
- ADR-0010 — Cheapest-eligible pricing (out of scope here; superseded
  the previous pricing ADR but does not interact with payment)
- `docs/domain/payment-state-machine.md` — settlement lifecycle states
- `docs/engineering/payment-architecture.md` — architecture overview
- `docs/security/threat-model.md` — STRIDE rows THR-005/006/007/009
- `docs/security/AUTH_RBAC_POLICY.md` — admin role scoping
- `docs/audit/phase-8a/payment-gateway-assurance.md` — Phase 8A
  baseline; race-matrix rows `PS-09`/`PS-19`
- `docs/audit/phase-8a/payment-provider-spec-traceability.md` —
  Phase 8A cryptographic baseline; this ADR's cryptographic
  conformance inherits from it
- `docs/audit/phase-8c/payment-provider-spec-traceability.md` — Phase
  8C delta
- `docs/audit/phase-8c/cryptographic-vectors.md` — vector catalogue
- `docs/audit/phase-8c/cross-provider-race-matrix.md` — race evidence
- `docs/runbooks/phase-8c-payment-reconciliation.md` — operational
  procedure
- `docs/handoffs/phase-8c-payment-settlement-reconciliation.md` —
  handoff
- `docs/handoffs/phase-8c-verdicts.md` — verdicts
- `docs/audit/phase-8c-validation-report.md` — validation