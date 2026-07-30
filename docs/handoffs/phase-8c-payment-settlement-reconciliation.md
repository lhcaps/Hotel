# Phase 8C Handoff — Payment settlement reconciliation, cross-provider race matrix, cryptographic conformance and worker gating

Audience: project lead, ops, on-call.

## What landed (documentation phase)

- **ADR-0011** (`docs/architecture/adr/ADR-0011-payment-settlement-reconciliation.md`)
  approved. Captures: single settlement authority,
  query port boundary, lease design, bounded policy, cryptographic
  conformance gate, audit/outbox constraint, rollback, revisit.
- **Phase 8C design spec** at
  `docs/superpowers/specs/2026-07-28-phase-8c-payment-settlement-reconciliation-design.md`.
- **Phase 8C plan** at
  `docs/superpowers/plans/2026-07-28-phase-8c-payment-settlement-reconciliation.md`.
- **Phase 8C verdicts** at `docs/handoffs/phase-8c-verdicts.md`.
- **Phase 8C validation report** at
  `docs/audit/phase-8c-validation-report.md`.
- **Phase 8C provider spec traceability** at
  `docs/audit/phase-8c/payment-provider-spec-traceability.md` (delta
  over Phase 8A).
- **Phase 8C cryptographic vectors** at
  `docs/audit/phase-8c/cryptographic-vectors.md`.
- **Phase 8C cross-provider race matrix** at
  `docs/audit/phase-8c/cross-provider-race-matrix.md`.
- **Phase 8C runbook** at
  `docs/runbooks/phase-8c-payment-reconciliation.md`.
- **Phase 8B.1 corrections**:
  - `docs/handoffs/phase-8b1-final-verdict.md` — HEAD is now
    `7d2ac0d docs(phase-8b1): publish 38-field final verdict`; the
    earlier draft's claim of `9a934b4` as the latest commit is
    flagged as incorrect at the time of writing; the commit list is
    sorted with `7d2ac0d` at the top.
  - `docs/handoffs/phase-8b1-verdicts.md` — rows for `pnpm lint`,
    `pnpm typecheck`, `pnpm test:unit`, `pnpm build`,
    `pnpm check:openapi`, `pnpm db:check`, `pnpm audit`, the demo
    lifecycle, and `apps/web/test/stay-time-recommendations.test.tsx`
    are marked `pending — awaiting command evidence` because the
    exact counts in the prior report were not re-verified at HEAD
    `7d2ac0d` during this documentation phase.
  - `docs/audit/phase-8b1-validation-report.md` — phantom
    `QuoteService.priceQuote` reference replaced with the actual
    `QuoteService.issue()` → `calculatePricing()` →
    `evaluatePricingCandidates()` chain; the `recommendation.routes.ts`
    chain is documented verbatim from source; the same
    `pending — awaiting command evidence` rows are propagated.
- **Cross-cutting docs**:
  - `docs/domain/payment-state-machine.md` — new reconciliation
    states (`RECONCILIATION_PENDING`,
    `RECONCILIATION_EXHAUSTED`,
    `RECONCILIATION_TRANSIENT`,
    `RECONCILIATION_NOT_FOUND`,
    `RECONCILIATION_STALE_FAILURE`) and transitions.
  - `docs/domain/business-invariants.md` — new invariants
    `INV-036..INV-040`.
  - `docs/product/user-journeys.md` — new journeys
    `JRN-011..JRN-014`.
  - `docs/engineering/payment-architecture.md` — new architecture
    doc enumerating the modules and the canonical settlement path.
  - `docs/engineering/admin-api-contract.md` — new operational
    review surface for the new reconciliation categories.
  - `docs/security/AUTH_RBAC_POLICY.md` — explicit
    `booking.review.manage` permission coverage for the new
    reconciliation categories.
  - `docs/security/threat-model.md` — new threat rows `THR-025`
    (reconciliation cycle forgery) and `THR-026` (lease exhaustion).
  - `.env.example` — new `WORKER_RECONCILIATION_*` placeholders
    (no secret material).

## What did not change

- Phase 8A booking/payment contracts are untouched in source.
- Phase 8B.1 admin catalog extensibility is untouched in source.
- Phase 7D MoMo sandbox adapter is unchanged (the new
  `buildMomoQueryCanonicalString` is additive only).
- No settlement-mutation path is added. `applyVerifiedPaymentEvent`
  remains the only state-change authority for `payments` /
  `bookings` / `coupon` / `inventory` / `audit` / `outbox`.
- Released migrations are untouched.

## Live acceptance gates (honest)

| Gate | Status | Reason |
| --- | --- | --- |
| `MOMO_SANDBOX_ACCEPTANCE` | EXTERNAL_BLOCKED | No MoMo sandbox credentials in workspace; per Phase 8A safety boundary, the audit does not contact MoMo. |
| `VNPAY_SANDBOX_ACCEPTANCE` | EXTERNAL_BLOCKED | No VNPAY sandbox credentials in workspace. |
| `MOMO_PRODUCTION_ACCEPTANCE` | EXTERNAL_BLOCKED | No merchant credentials, no registered public HTTPS callback URL, no provider-side configuration. |
| `VNPAY_PRODUCTION_ACCEPTANCE` | EXTERNAL_BLOCKED | Same as MoMo. |
| VNPAY amount scaling ×100 vs ×1 | EXTERNAL_BLOCKED | Cannot be settled without live sandbox. |
| VNPAY space encoding `+` vs `%20` | EXTERNAL_BLOCKED | Cannot be settled without live sandbox. |
| `GATE_B_1_CRYPTOGRAPHIC_CONFORMANCE` | pending — awaiting command evidence | Gate-B.1 vectors defined and documented; exact run count is `pending — awaiting command evidence`. |
| `GATE_B_2_CROSS_PROVIDER_RACE_MATRIX` | pending — awaiting command evidence | 10 scenarios documented; exact run count is `pending — awaiting command evidence`. |
| `GATE_B_3_RECONCILIATION_CYCLE_INTEGRATION` | pending — awaiting command evidence | Worker tick wired; exact runtime behaviour is `pending — awaiting command evidence`. |

The Phase 8C documentation phase is **release-closure PASS only for
documentation**: every doc is in place, internally consistent, and
honest about the live gates that remain external-blocked.

## How operators verify (documentation phase)

1. `pnpm demo:preflight` reports `schema: phase-8c-payment-reconciliation-v1`.
2. `pnpm db:check` (pending — awaiting command evidence) reports
   no drift.
3. `pnpm test:unit packages/booking` (pending — awaiting command
   evidence) reports the new reconciliation tests green.
4. The reconciliation worker tick (pending — awaiting command
   evidence) reports a non-zero processed count when seeded with
   stuck `PENDING` attempts.

## How on-call reverts (Phase 8C documentation phase)

1. Stop the worker.
2. Remove the `apps/worker/src/reconciliation/` directory.
3. Revert the commit that introduced
   `packages/booking/src/payment/reconciliation.ts`,
   `apps/api/src/payment/providers/momo/momo.contracts.ts`
   (`momoQueryResponseSchema` addition),
   `apps/api/src/payment/providers/momo/momo.signature.ts`
   (`buildMomoQueryCanonicalString` addition), and the
   `momo.errors.ts` query-error types.
4. Revert the documentation set in `docs/architecture/adr/ADR-0011-*`,
   `docs/superpowers/specs/2026-07-28-phase-8c-*`,
   `docs/superpowers/plans/2026-07-28-phase-8c-*`,
   `docs/handoffs/phase-8c-*`, `docs/audit/phase-8c*`,
   `docs/runbooks/phase-8c-*`, and the cross-cutting docs.
5. Restore the `phase-8b1-pricing-product-vertical-v1` docs that
   were corrected in place (call graph, HEAD/commit order,
   pending evidence).
6. Restart the worker. Settlement continues to function via IPN only;
   `MOMO_INITIATION_OUTCOME_UNKNOWN` attempts remain
   `REVIEW_REQUIRED` until a manual status query from the ADMIN UI.

## What to watch

- `EXPECTED_SCHEMA_VERSION === 'phase-8c-payment-reconciliation-v1'`.
- `payment_attempts_reconciliation_attempt_count_ck` /
  `payment_attempts_reconciliation_lease_ck` /
  `payment_attempts_reconciliation_error_ck` constraints are
  present in the disposable database.
- The reconciliation tick logs `last_error_code` values without
  logging merchant credentials, raw webhook bodies, raw query
  responses, or signatures.
- An operational review can be opened with one of the new
  reconciliation categories; ADMIN can resolve it through the
  existing `/api/v1/admin/operational-reviews/:reviewId/resolve`
  endpoint.

## Next phase

The next phase is **Phase 8D — Live sandbox acceptance**. Phase 8D
requires merchant credentials (MoMo Partner Code + Access Key +
Secret Key; VNPAY TmnCode + HashSecret), a registered public HTTPS
callback URL reachable by both providers, provider-side configuration
of allowed return URLs and IP allowlist (if applicable), and an
operator-controlled test-transaction procedure. Until those are
present, `MOMO_SANDBOX_ACCEPTANCE` and `VNPAY_SANDBOX_ACCEPTANCE`
remain `EXTERNAL_BLOCKED`.