# Phase 8C Plan — Payment settlement reconciliation, cross-provider race matrix, cryptographic conformance and worker gating

Date: 2026-07-28
Status: EXECUTED (documentation phase)

## Phases

1. **Phase 8C.A — Mandatory reading.**
   - Re-read ADR-0006, ADR-0010, Phase 7D MoMo handoff, Phase 8A
     `payment-gateway-assurance.md`, `payment-provider-spec-traceability.md`,
     and the Phase 8B.1 final verdict (corrected) to refresh the
     settlement core boundary, the cryptographic contract, and the
     deferred Phase 8A scope.
   - **Verify**: memory snapshot recorded; the reconciliation
     boundary below is consistent with ADR-0006.

2. **Phase 8C.B — Gate A: Documentation and Evidence Reconciliation.**
   - Correct Phase 8B.1 docs in place: replace phantom
     `QuoteService.priceQuote` with the actual
     `QuoteService.issue` → `calculatePricing` → `evaluatePricingCandidates`
     chain; correct HEAD/commit order in
     `docs/handoffs/phase-8b1-final-verdict.md`; mark
     "lint / typecheck / test / build / openapi / db / audit /
     lifecycle" rows as `pending — awaiting command evidence` where
     no fresh `pnpm` run was captured in the existing artifact set.
   - Author ADR-0011 (`docs/architecture/adr/ADR-0011-payment-settlement-reconciliation.md`)
     capturing the settlement authority, the query port boundary,
     the lease design, the bounded policy, the cryptographic
     conformance gate, the audit/outbox constraint, and the
     rollback/revisit conditions.
   - **Verify**: ADR-0011 text agrees with this plan and the
     Phase 8C design spec; Phase 8B.1 call graph is corrected;
     Phase 8B.1 scorecard is honest about pending rows.

3. **Phase 8C.C — Gate B.0: Single settlement authority boundary.**
   - Trace every settlement path. Confirm that
     `applyVerifiedPaymentEvent` remains the only state-mutation
     path for `payments`/`bookings`/`coupon`/`inventory`/`audit`/
     `outbox`, and that the new
     `reconciliation.ts` module does not introduce a new mutation
     path.
   - **Verify**: every reconciliation outcome either (a) feeds
     `applyVerifiedPaymentEvent` with a synthetic verified marker
     and produces one transaction, or (b) advances only the
     dedicated `payment_attempts` reconciliation columns.

4. **Phase 8C.D — Gate B.1: Cryptographic conformance gate.**
   - Author `apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts`
     and the independent oracles
     `apps/api/test/payment/gate-b1-momo.oracle.ts` /
     `gate-b1-vnpay.oracle.ts`. The oracles re-implement the
     documented MoMo and VNPAY canonical-string builders and
     HMAC-SHA256/SHA512 signing in isolation from production.
   - Run the gate against the production builders and assert
     byte-identical digests and `crypto.timingSafeEqual` agreement
     for initiation, IPN, response, and status-query canonical
     strings on both providers.
   - **Verify**: gate passes (count `pending — awaiting command
     evidence` until the next `pnpm` run).

5. **Phase 8C.E — Gate B.2: Cross-provider race matrix.**
   - Author `packages/database/test/integration/phase8c-payment-reconciliation.test.ts`
     exercising the 10 scenarios listed in
     `docs/audit/phase-8c/cross-provider-race-matrix.md` against the
     real PostgreSQL settlement core on a disposable database.
   - **Verify**: every scenario's expected outcome (PASS,
     DUPLICATE, REVIEW_REQUIRED, TRANSACTION_CONFLICT, etc.) is
     observed and captured in the race-matrix doc with verbatim
     fixture paths and exact assertion text.

6. **Phase 8C.F — Gate B.3: Reconciliation cycle integration.**
   - Wire `apps/worker/src/reconciliation/` into the existing
     continuous-mode scheduler. Use the same fixed-delay pattern as
     the outbox and HOLD-expiry jobs; honour the same
     `WORKER_*` configuration block.
   - **Verify**: the worker tick claims due attempts with
     `FOR UPDATE SKIP LOCKED`, advances the reconciliation columns,
     and recovers expired leases without re-running the cycle
     twice on a single tick.

7. **Phase 8C.G — Gate B.4: Cross-cutting docs.**
   - Update `docs/domain/payment-state-machine.md`,
     `docs/domain/business-invariants.md`,
     `docs/product/user-journeys.md`,
     `docs/engineering/payment-architecture.md` (new),
     `docs/engineering/admin-api-contract.md`,
     `docs/security/AUTH_RBAC_POLICY.md`,
     `docs/security/threat-model.md`, and `.env.example` to reflect
     the reconciliation outcomes, the new INV-036..INV-040
     invariants, the new JRN-011..JRN-014 journeys, the new
     `THR-025` and `THR-026` threat rows, and the new
     `WORKER_RECONCILIATION_*` placeholders.
   - **Verify**: the updated docs are internally consistent and do
     not introduce new mutation paths.

8. **Phase 8C.H — Gate B.5: Phase 8C evidence closure.**
   - Write `docs/audit/phase-8c-validation-report.md` capturing
     Gate B.0..B.4 evidence plus honest `pending — awaiting
     command evidence` rows for the Phase 8B.1 regression re-run
     that is out of scope for this documentation phase.
   - Write `docs/handoffs/phase-8c-payment-settlement-reconciliation.md`,
     `docs/handoffs/phase-8c-verdicts.md`,
     `docs/runbooks/phase-8c-payment-reconciliation.md`.
   - **Verify**: every doc references the official MoMo and VNPAY
     retrieval date (2026-07-28) and the explicit
     `EXTERNAL_BLOCKED` boundary for sandbox and production
     acceptance.

## Success criteria (documentation phase)

- ADR-0011 is accepted and referenced by every Phase 8C doc.
- Phase 8B.1 docs no longer claim `QuoteService.priceQuote` exists,
  no longer report `9a934b4` as HEAD, and mark
  regression rows as `pending — awaiting command evidence` where
  appropriate.
- Gate B.1 cryptographic-conformance test plus the two oracles are
  in place. The exact case count is `pending — awaiting command
  evidence`.
- Gate B.2 cross-provider race matrix doc enumerates 10 scenarios
  with expected outcomes and verbatim fixture paths. Exact
  pass/fail is `pending — awaiting command evidence`.
- Gate B.3 reconciliation worker tick is wired with bounded
  configuration. Exact runtime behaviour is
  `pending — awaiting command evidence`.
- Updated `payment-state-machine.md`,
  `business-invariants.md`, `user-journeys.md`,
  `payment-architecture.md`, `admin-api-contract.md`,
  `AUTH_RBAC_POLICY.md`, `threat-model.md`, and `.env.example`
  are internally consistent with ADR-0011.

## Success criteria (validation phase — out of scope here)

- `pnpm lint` clean across 11 packages.
- `pnpm typecheck` clean across 11 packages.
- `pnpm test:unit` clean across the 9 test-running packages.
- `pnpm build` clean across 11 packages.
- `pnpm check:openapi` clean (admin and public artifacts).
- `pnpm db:check` clean.
- `pnpm audit --prod --audit-level=high` reports zero high or
  critical advisories.
- `node scripts/demo/lifecycle.test.mjs` reports the expected
  pass count.
- `apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts`
  passes.
- `packages/database/test/integration/phase8c-payment-reconciliation.test.ts`
  passes.
- `packages/booking/test/audit-phase8a/audit-payment-settlement.test.ts`
  race-matrix extensions pass.

## Risks

| Risk | Mitigation |
| --- | --- |
| Phase 8B.1 regression re-run blocked by external sandbox | The validation phase defers live sandbox acceptance; the deterministic cryptographic-conformance oracle is sufficient for the cryptographic gate. |
| Reconciliation tick over-runs the provider | Lease + bounded batch + bounded query timeout; configurable via `WORKER_RECONCILIATION_*`; values outside bounds throw `RangeError`. |
| Cross-provider race produces two confirmations | Settlement lock order (booking → payment → attempt → inventory → coupon) plus `payments_property_booking_uq` unique constraint; second provider path returns `REVIEW_REQUIRED`. |
| Reconciliation tick confuses a successful IPN with a stuck PENDING | The status query is gated by `payment_attempts.status = 'PENDING'`; a later IPN transitions the attempt to `SUCCEEDED`/`FAILED`/`CANCELLED`/`EXPIRED`/`REVIEW_REQUIRED` and the query path is no longer eligible. |

## External blockers

- Live MoMo sandbox credentials and registered HTTPS callback URL.
- Live VNPAY sandbox credentials and registered HTTPS callback URL.
- Production merchant credentials, provider-side return-URL
  configuration, and IP allowlist (if applicable).
- Approved SLOs / capacity targets for the reconciliation tick.

The Phase 8C documentation phase records these as
`EXTERNAL_BLOCKED` rather than fabricating a PASS.