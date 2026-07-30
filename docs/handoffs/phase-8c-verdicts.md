# Phase 8C Verdicts

Date: 2026-07-28

## Top-line (documentation phase)

- ADR-0011: **PASS** (accepted; referenced by every Phase 8C doc).
- Phase 8B.1 documentation corrections: **PASS**
  (HEAD/commit order corrected; phantom `QuoteService.priceQuote`
  replaced with the actual `QuoteService.issue` →
  `calculatePricing` → `evaluatePricingCandidates` chain; lint /
  typecheck / test / build / openapi / db / audit / lifecycle rows
  marked `pending — awaiting command evidence`).
- Settlement authority boundary preserved: **PASS**
  (`applyVerifiedPaymentEvent` is the only mutation path).
- Gate B.1 cryptographic conformance gate (definitive vectors):
  **PASS** (vectors enumerated in
  `docs/audit/phase-8c/cryptographic-vectors.md`).
- Gate B.1 cryptographic conformance (run output):
  **pending — awaiting command evidence**.
- Gate B.2 cross-provider race matrix (definitive scenarios):
  **PASS** (10 scenarios enumerated in
  `docs/audit/phase-8c/cross-provider-race-matrix.md`).
- Gate B.2 cross-provider race matrix (run output):
  **pending — awaiting command evidence**.
- Gate B.3 reconciliation worker tick (definitive wiring):
  **PASS** (`apps/worker/src/reconciliation/` wired).
- Gate B.3 reconciliation worker tick (run output):
  **pending — awaiting command evidence**.
- Cross-cutting docs (payment-state-machine, business-invariants,
  user-journeys, payment-architecture, admin-api-contract,
  AUTH_RBAC_POLICY, threat-model, .env.example): **PASS**
  (consistent with ADR-0011).
- Phase 8B.1 regression re-run (lint, typecheck, test, build,
  OpenAPI, database check, dependency audit, demo lifecycle):
  **pending — awaiting command evidence**.

```
PHASE_8A_AUDIT=COMPLETE
PHASE_8A_RELEASE_CLOSURE=PASS

PHASE_8B_PRICING_CORRECTNESS=PASS
PHASE_8B1_CHEAPEST_PRODUCT_VERTICAL=PASS_WITH_DOC_CORRECTIONS

PHASE_8C_DOCUMENTATION_CLOSURE=PASS
PHASE_8C_ADR_0011=PASS
PHASE_8C_SETTLEMENT_AUTHORITY_BOUNDARY=PASS
PHASE_8C_GATE_B1_CRYPTOGRAPHIC_DEFINITION=PASS
PHASE_8C_GATE_B1_CRYPTOGRAPHIC_RUN=PENDING_AWAITING_COMMAND_EVIDENCE
PHASE_8C_GATE_B2_RACE_MATRIX_DEFINITION=PASS
PHASE_8C_GATE_B2_RACE_MATRIX_RUN=PENDING_AWAITING_COMMAND_EVIDENCE
PHASE_8C_GATE_B3_RECONCILIATION_CYCLE_DEFINITION=PASS
PHASE_8C_GATE_B3_RECONCILIATION_CYCLE_RUN=PENDING_AWAITING_COMMAND_EVIDENCE
PHASE_8C_CROSS_CUTTING_DOCS=PASS
PHASE_8B1_REGRESSION_RERUN=PENDING_AWAITING_COMMAND_EVIDENCE

MOMO_SANDBOX_ACCEPTANCE=EXTERNAL_BLOCKED
VNPAY_SANDBOX_ACCEPTANCE=EXTERNAL_BLOCKED
MOMO_PRODUCTION_ACCEPTANCE=EXTERNAL_BLOCKED
VNPAY_PRODUCTION_ACCEPTANCE=EXTERNAL_BLOCKED
VNPAY_AMOUNT_SCALING_100X=EXTERNAL_BLOCKED
VNPAY_SPACE_ENCODING_PLUS_VS_PCT20=EXTERNAL_BLOCKED

PRODUCTION_READINESS=NO_PENDING_PHASE_8D_LIVE_ACCEPTANCE
```

## Scorecard

| Evidence gate                                                           | Result                              |
| ----------------------------------------------------------------------- | ----------------------------------- |
| ADR-0011 accepted                                                       | PASS                                |
| Phase 8C design spec                                                    | PASS                                |
| Phase 8C plan                                                           | PASS                                |
| Phase 8C handoff                                                        | PASS                                |
| Phase 8C validation report                                              | PASS (definitive sections)          |
| Phase 8C provider spec traceability (delta)                             | PASS                                |
| Phase 8C cryptographic vectors                                          | PASS                                |
| Phase 8C cross-provider race matrix                                     | PASS                                |
| Phase 8C runbook                                                        | PASS                                |
| Phase 8C verdicts                                                       | this document                       |
| Phase 8B.1 final verdict (corrected)                                    | PASS                                |
| Phase 8B.1 validation report (corrected)                                | PASS                                |
| Phase 8B.1 verdicts (corrected)                                         | PASS                                |
| `payment-state-machine.md` (updated)                                    | PASS                                |
| `business-invariants.md` (updated)                                      | PASS                                |
| `user-journeys.md` (updated)                                            | PASS                                |
| `payment-architecture.md` (new)                                         | PASS                                |
| `admin-api-contract.md` (updated)                                       | PASS                                |
| `AUTH_RBAC_POLICY.md` (updated)                                         | PASS                                |
| `threat-model.md` (updated)                                             | PASS                                |
| `.env.example` (updated, no secrets)                                    | PASS                                |
| `gate-b1-cryptographic-conformance.test.ts`                             | pending — awaiting command evidence |
| `phase8c-payment-reconciliation.test.ts`                                | pending — awaiting command evidence |
| `audit-phase8a/audit-payment-settlement.test.ts` race-matrix extensions | pending — awaiting command evidence |
| `pnpm lint` (full tree)                                                 | pending — awaiting command evidence |
| `pnpm typecheck` (full tree)                                            | pending — awaiting command evidence |
| `pnpm test:unit` (full tree)                                            | pending — awaiting command evidence |
| `pnpm build` (full tree)                                                | pending — awaiting command evidence |
| `pnpm check:openapi`                                                    | pending — awaiting command evidence |
| `pnpm db:check`                                                         | pending — awaiting command evidence |
| `pnpm audit --prod --audit-level=high`                                  | pending — awaiting command evidence |
| `node scripts/demo/lifecycle.test.mjs`                                  | pending — awaiting command evidence |

## Supersession chain

- ADR-0011 supersedes nothing in writing (it is a new ADR); it
  _augments_ ADR-0006 (single settlement authority) with a
  reconciliation layer that does not introduce a new mutation path.
- Phase 8C supersedes nothing in writing; it closes the deferred
  Phase 8A scope (`PS-09`, `PS-13`, `PS-14`, `PS-19`, and
  `PAYMENT-001` reconciliation job).
- Phase 8B.1 corrections in `phase-8b1-final-verdict.md`,
  `phase-8b1-verdicts.md`, and `phase-8b1-validation-report.md`
  do not change Phase 8B.1 substance; they correct the call graph,
  the HEAD/commit order, and mark rows as
  `pending — awaiting command evidence` where the prior report
  claimed exact counts that were not re-verified at HEAD `7d2ac0d`.

## Known follow-ups

- Live MoMo sandbox acceptance remains `EXTERNAL_BLOCKED`. The
  cryptographic-conformance oracle is deterministic and
  sandbox-independent; the live acceptance gate can only close
  when merchant credentials and a registered public HTTPS callback
  URL are present in the workspace.
- Live VNPAY sandbox acceptance remains `EXTERNAL_BLOCKED`. The
  two open Phase 8A gaps (VNPAY amount scaling ×100 vs ×1 and
  VNPAY space encoding `+` vs `%20`) cannot be settled without
  live sandbox.
- The Phase 8B.1 regression re-run (lint, typecheck, build, OpenAPI,
  database check, dependency audit, demo lifecycle) is
  `pending — awaiting command evidence` and is deferred to the next
  validation cycle.
