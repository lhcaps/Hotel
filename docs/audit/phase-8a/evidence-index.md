# Phase 8A - Evidence index

**Phase:** Phase 8A production-readiness audit.
**Repository HEAD at audit start:** `e767398b0e49918341db59637d74607b692972c3`
**Branch:** `phase5-booking-hold-guest-access`
**Worktree:** `D:/Study/Project/Room Management` (single worktree, confirmed via `git worktree list`)
**Phase 7F ancestry verification:** `git merge-base --is-ancestor cffeca2 HEAD` returned **0** (PASS).
**Working tree at audit start:** modified files: untracked (build outputs in `apps/api/dist` only); no tracked working-tree changes captured as product edits.

| ID     | Artifact                         | Path                                                                  | Purpose                                                                   |
| ------ | -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| E-0001 | Phase 7G verdicts (pasted claim) | `docs/handoffs/phase-7g-verdicts.md`                                  | Pre-audit claim baseline                                                  |
| E-0002 | Phase 7G validation report       | `docs/audit/phase-7g-validation-report.md`                            | Prior-phase evidence base                                                 |
| E-0003 | Phase 7G handoff                 | `docs/handoffs/phase-7g-admin-booking-operations.md`                  | Operational summary                                                       |
| E-0004 | Phase 7G admin runbook           | `docs/runbooks/phase-7g-admin-operations-demo.md`                     | Runbook evidence                                                          |
| E-0005 | Phase 7G admin API contract      | `docs/engineering/admin-api-contract.md`                              | Contract evidence                                                         |
| E-0006 | ADR-0009                         | `docs/architecture/adr/ADR-0009-admin-booking-lifecycle.md`           | Architectural decision                                                    |
| E-0007 | ADR-0005                         | `docs/architecture/adr/ADR-0005-data-driven-pricing-selection.md`     | Pricing decision                                                          |
| E-0008 | ADR-0006                         | `docs/architecture/adr/ADR-0006-payment-core-settlement.md`           | Settlement decision                                                       |
| E-0009 | Pricing rules (authoritative)    | `docs/domain/pricing-rules.md`                                        | Pricing rules source                                                      |
| E-0010 | Pricing decision matrix          | `docs/engineering/pricing-decision-matrix.md`                         | Authoritative matrix                                                      |
| E-0011 | Booking state machine            | `docs/domain/booking-state-machine.md`                                | Lifecycle contract                                                        |
| E-0012 | Business invariants              | `docs/domain/business-invariants.md`                                  | INV-001..033                                                              |
| E-0013 | Coupon rules                     | `docs/domain/coupon-rules.md`                                         | Coupon contract                                                           |
| E-0014 | Product scope                    | `docs/product/product-scope.md`                                       | MVP scope                                                                 |
| E-0015 | Quote architecture               | `docs/engineering/quote-architecture.md`                              | Immutable quote contract                                                  |
| E-0016 | Availability architecture        | `docs/engineering/availability-architecture.md`                       | Availability contract                                                     |
| E-0017 | Pricing architecture             | `docs/engineering/pricing-architecture.md`                            | Pricing domain map                                                        |
| E-0018 | Database architecture            | `docs/engineering/database-architecture.md`                           | DB design                                                                 |
| E-0019 | Auth architecture                | `docs/engineering/auth-architecture.md`                               | Auth domain map                                                           |
| E-0020 | Threat model                     | `docs/security/threat-model.md`                                       | THR-001..020                                                              |
| E-0021 | Pricing matcher source           | `apps/api/src/pricing/selection-rule-matcher.ts`                      | Pricing selector algorithm                                                |
| E-0022 | Pricing engine wrapper           | `apps/api/src/pricing/pricing-engine.ts`                              | Public API                                                                |
| E-0023 | Pricing unit test                | `apps/api/test/pricing-engine.test.ts`                                | Boundary test envelope                                                    |
| E-0024 | MoMo adapter source              | `apps/api/src/payment/providers/momo/momo.adapter.ts`                 | MoMo adapter                                                              |
| E-0025 | MoMo signature source            | `apps/api/src/payment/providers/momo/momo.signature.ts`               | MoMo HMAC-SHA256                                                          |
| E-0026 | MoMo adapter test                | `apps/api/test/payment/momo.adapter.test.ts`                          | MoMo signature tests                                                      |
| E-0027 | VNPAY adapter source             | `apps/api/src/payment/providers/vnpay/vnpay.adapter.ts`               | VNPAY adapter                                                             |
| E-0028 | VNPAY signature source           | `apps/api/src/payment/providers/vnpay/vnpay.signature.ts`             | VNPAY HMAC-SHA512                                                         |
| E-0029 | VNPAY adapter test               | `apps/api/test/payment/vnpay.adapter.test.ts`                         | VNPAY signature tests                                                     |
| E-0030 | Payment settlement code          | `packages/booking/src/payment/payment-service.ts`                     | applyVerifiedPaymentEvent + createPaymentAttempt + confirmNoChargeBooking |
| E-0031 | Migration 0012 (payment core)    | `packages/database/drizzle/0012_many_kylun.sql`                       | Schema payments/attempts/events                                           |
| E-0032 | Migration 0015 (Phase 7G)        | `packages/database/drizzle/0015_phase7g_admin_booking_operations.sql` | Operational reviews schema                                                |
| E-0033 | Phase 7G validation report       | `docs/audit/phase-7g-validation-report.md`                            | Pre-audit evidence base                                                   |
| E-0034 | Project reconciliation           | `docs/audit/project-production-readiness-reconciliation.md`           | Pre-audit reconciliation                                                  |

| Audit-only artifacts added by Phase 8A                      | Path                                             |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `docs/audit/phase-8a/master-production-readiness-audit.md`  | Master verdict                                   |
| `docs/audit/phase-8a/pricing-rule-provenance-matrix.md`     | Rule provenance table                            |
| `docs/audit/phase-8a/pricing-algorithm-verification.md`     | Oracle comparison                                |
| `docs/audit/phase-8a/combo-recommendation-analysis.md`      | Exact-/flexible-time analysis                    |
| `docs/audit/phase-8a/payment-gateway-assurance.md`          | Settlement concurrency proof                     |
| `docs/audit/phase-8a/payment-provider-spec-traceability.md` | MoMo/VNPAY spec trace                            |
| `docs/audit/phase-8a/security-privacy-audit.md`             | Security findings                                |
| `docs/audit/phase-8a/reliability-observability-audit.md`    | SRE findings                                     |
| `docs/audit/phase-8a/performance-capacity-baseline.md`      | Perf baseline                                    |
| `docs/audit/phase-8a/scalability-extensibility-audit.md`    | Future growth                                    |
| `docs/audit/phase-8a/migration-backup-restore-audit.md`     | DR evidence                                      |
| `docs/audit/phase-8a/gap-register.csv`                      | Master gap register                              |
| `docs/audit/phase-8a/risk-register.md`                      | Risks with mitigations                           |
| `docs/audit/phase-8a/next-phase-roadmap.md`                 | Prioritised phases                               |
| `docs/handoffs/phase-8a-production-readiness-audit.md`      | Handoff                                          |
| `docs/audit/phase-8a/artifacts/`                            | Machine-readable evidence (JSON, CSV, log files) |
