# Phase 8A — Master Production-Readiness Audit

**Audit phase:** Phase 8A (production readiness, pricing algorithm, payment assurance, scalability).
**Repository:** `D:\Study\Project\Room Management`
**Branch at audit start:** `phase5-booking-hold-guest-access`
**HEAD at audit start:** `e767398b0e49918341db59637d74607b692972c3`
**Worktrees:** single worktree, confirmed via `git worktree list`.
**Phase 7F ancestry:** verified (`git merge-base --is-ancestor cffeca2 HEAD` returned 0).
**Phase 7G schema:** `phase-7g-admin-booking-operations-v1`, migration `0015_phase7g_admin_booking_operations.sql` already on HEAD.

## 1. Role Recap

This phase is an evidence-backed AUDIT. No product code, migration, schema, or adapter behaviour was modified by this audit. Only:

- audit-only Vitest suites (under `apps/api/test/audit-phase8a/**` and `packages/booking/test/audit-phase8a/**`);
- audit-only machine-readable evidence files (under `docs/audit/phase-8a/artifacts/**`);
- audit markdown reports (this directory);
- audit-only DDL scripts (none were run on any persistent database; the backup/restore drill used an isolated `audit_backup_drill_*` database which was dropped after the drill).

## 2. Headline Verdict

`PRODUCTION_READINESS = NO`

Honest evidence-derived verdict for an audit conducted without provider credentials, sandbox acceptance, or production infrastructure:

| Final verdict                                                                                                                                                         | Value                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| PHASE_8A_AUDIT                                                                                                                                                        | COMPLETE                                                                                                                            |
| PHASE_8A_RELEASE_CLOSURE                                                                                                                                              | PASS                                                                                                                                |
| CURRENT_POLICY_CONFORMANCE                                                                                                                                            | PASS                                                                                                                                |
| EXACT_TIME_CHEAPEST_OBJECTIVE                                                                                                                                         | FAIL (product-policy deficiency addressed by Phase 8B)                                                                              |
| DETERMINISTIC_PAYMENT_ASSURANCE                                                                                                                                       | VERIFIED_WITH_LIMITATION (HMAC-SHA256 / HMAC-SHA512 parity with audit oracles; one spec-compliance finding on VNPAY space encoding) |
| LIVE_MOMO_ACCEPTANCE                                                                                                                                                  | EXTERNAL_BLOCKED                                                                                                                    |
| LIVE_VNPAY_ACCEPTANCE                                                                                                                                                 | EXTERNAL_BLOCKED                                                                                                                    |
| DEPLOYMENT_READINESS                                                                                                                                                  | NOT_VERIFIED                                                                                                                        |
| OBSERVABILITY_READINESS                                                                                                                                               | VERIFIED_WITH_LIMITATION                                                                                                            |
| SECURITY_READINESS                                                                                                                                                    | VERIFIED_WITH_LIMITATION (no destructive black-box exploitation)                                                                    |
| PERFORMANCE_BASELINE                                                                                                                                                  | VERIFIED_WITH_LIMITATION (disposable only)                                                                                          |
| `CAPACITY_TARGETS = BUSINESS_OR_OPERATIONS_DECISION_REQUIRED` (no approved SLOs found; explicit SLOs and load-test acceptance criteria remain an operations decision) |
| PRODUCTION_READINESS                                                                                                                                                  | NO                                                                                                                                  |

## 3. Audit Artifacts

All under `docs/audit/phase-8a/`:

- `evidence-index.md`
- `master-production-readiness-audit.md` (this file)
- `pricing-rule-provenance-matrix.md`
- `pricing-algorithm-verification.md`
- `combo-recommendation-analysis.md`
- `payment-gateway-assurance.md`
- `payment-provider-spec-traceability.md`
- `security-privacy-audit.md`
- `reliability-observability-audit.md`
- `performance-capacity-baseline.md`
- `scalability-extensibility-audit.md`
- `migration-backup-restore-audit.md`
- `gap-register.csv`
- `risk-register.md`
- `next-phase-roadmap.md`
- `artifacts/` — machine-readable evidence (`pricing-exhaustive-summary.json`, `pricing-counterexamples.json`, `pricing-boundary-matrix.csv`, `pricing-property-random.json`, `backup-drill/result.json`).

## Pricing finding language

`CURRENT_POLICY_CONFORMANCE = PASS`: the historical selector correctly implemented priority-first selection. `EXACT_TIME_CHEAPEST_OBJECTIVE = FAIL`: the approved new customer-cheapest objective was not implemented during Phase 8A. For each counterexample, the raw eligible plans are enumerated first, conflict resolution applies the historical LUNCH priority rule, the economic candidate is the lowest-gross plan, and the authoritative historical selection is the priority winner. In particular, THREE_HOUR_COMBO at 11:00 is raw-eligible but is excluded after conflict resolution by the higher-priority LUNCH plan; it is not valid under the final historical policy.

Phase 8B is the approved forward change for new quotes only. Historical quote snapshots retain their original rule version and amounts.

For every claim we attempted to satisfy the hierarchy (highest first):

1. Fresh runtime/database/provider behaviour.
2. Independent reference-oracle comparison.
3. Current source.
4. Fresh tests.
5. Generated OpenAPI/schema artifacts.
6. Approved specification or ADR.
7. Historical reports.
8. Comments and executor summaries.

The pricing algorithm correctness claim is grounded in (1) + (2): the audit-only oracle enumerates every eligible plan, computes the cheapest total in integer VND, and we ran 8 928 exhaustive scenarios + 2 000 random scenarios against it.

The MoMo / VNPAY signature correctness claim is grounded in (1) + (2) + (3) + (4): independent audit oracles (`audit-momo-oracle.ts`, `audit-vnpay-oracle.ts`) re-derived canonical strings from the documented rules and HMAC algorithms, then the production functions were exercised to confirm byte-level parity (or divergence recorded).

## 5. Required Final Verdicts (verbatim per Section 26)

| Verdict key                        | Status                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRICING_EXHAUSTIVE_ORACLE_MATCH    | FAIL (Phase 8A measured the previous priority-first selector; Phase 8B re-runs this under the approved cheapest policy)                                                                                                                      |
| PRICING_RANDOM_PROPERTY_TESTS      | FAIL (Phase 8A measured the previous priority-first selector; Phase 8B re-runs this under the approved cheapest policy)                                                                                                                      |
| CURRENT_POLICY_CONFORMANCE         | PASS                                                                                                                                                                                                                                         |
| EXACT_TIME_CHEAPEST_OBJECTIVE      | FAIL (newly approved customer-cheapest objective; not a defect against the historical priority-first contract)                                                                                                                               |
| FLEXIBLE_TIME_RECOMMENDATION       | BUSINESS_RULE_UNSOURCED                                                                                                                                                                                                                      |
| COMBO_RECOMMENDATION_PRODUCT_RULES | BUSINESS_RULE_UNSOURCED                                                                                                                                                                                                                      |
| MOMO_OFFICIAL_SPEC_TRACEABILITY    | VERIFIED                                                                                                                                                                                                                                     |
| MOMO_SANDBOX_ACCEPTANCE            | EXTERNAL_BLOCKED                                                                                                                                                                                                                             |
| VNPAY_OFFICIAL_SPEC_TRACEABILITY   | VERIFIED                                                                                                                                                                                                                                     |
| VNPAY_SANDBOX_ACCEPTANCE           | EXTERNAL_BLOCKED                                                                                                                                                                                                                             |
| CROSS_PROVIDER_SETTLEMENT_SAFETY   | VERIFIED_WITH_LIMITATION (no destructive races against the real test DB during this audit; settlement unit tests cover duplicate success, amount mismatch, transaction conflict, zero-amount HOLD; exhaustive race matrix requires Phase 8C) |
| PAYMENT_BOOKING_STATE_SAFETY       | VERIFIED_WITH_LIMITATION                                                                                                                                                                                                                     |
| PAYMENT_COUPON_ATOMICITY           | VERIFIED_WITH_LIMITATION                                                                                                                                                                                                                     |
| DATABASE_INTEGRITY                 | VERIFIED_WITH_LIMITATION (operational_reviews.payment_id lacks database-level booking/property cross-check; documented as P1)                                                                                                                |
| MIGRATION_SAFETY                   | VERIFIED_WITH_LIMITATION (15 migrations in linear chain; no destructive upgrade path executed on the dev DB; historical-data upgrade simulation requires Phase 8C)                                                                           |
| BACKUP_RESTORE                     | VERIFIED_WITH_LIMITATION (drill completed in <1 s on disposable DB; restore verified via row counts; bookings, payments, coupons, outbox, sessions and application startup against the restored DB were not exercised)                       |
| SECURITY_READINESS                 | VERIFIED_WITH_LIMITATION                                                                                                                                                                                                                     |
| OBSERVABILITY_READINESS            | VERIFIED_WITH_LIMITATION                                                                                                                                                                                                                     |
| PERFORMANCE_BASELINE               | VERIFIED_WITH_LIMITATION (EXPLAIN plans captured on disposable dataset; pricing micro-benchmark only — load test not executed; pricing micro-benchmark is NOT a capacity or load test)                                                       |
| CAPACITY_TARGETS                   | BUSINESS_OR_OPERATIONS_DECISION_REQUIRED                                                                                                                                                                                                     |
| SCALABILITY_READINESS              | VERIFIED_WITH_LIMITATION                                                                                                                                                                                                                     |
| EXTENSIBILITY_READINESS            | VERIFIED_WITH_LIMITATION                                                                                                                                                                                                                     |
| DEPLOYMENT_READINESS               | NOT_VERIFIED (no production Docker, no reverse proxy, no TLS termination, no observability pipeline, no SMTP, no merchant credentials, no DNS, no rollback procedure in repo)                                                                |
| PRODUCTION_READINESS               | NO                                                                                                                                                                                                                                           |

## 6. P0 / P1 / P2 / P3 Counts (from gap-register.csv)

| Severity | Count |
| -------- | ----- |
| P0       | 4     |
| P1       | 9     |
| P2       | 6     |
| P3       | 3     |

Total: **22 gaps.**

## 7. Production-Readiness Percentage

We do NOT pre-fill PASS or assign a percentage. The audit verdict is **NO**. The 4 P0 gaps (PRICING-001 cheapest-selector, PAYMENT-002 VNPAY space-encoding spec deviation, DEPLOY-001 no production deployment artifacts, OBSERVABILITY-001 no SLOs/alerts defined) are individually sufficient to block production cutover.

## 8. Roadmap

See `docs/audit/phase-8a/next-phase-roadmap.md`. Proposed phases (numbered and ordered by closure impact, not by alpha):

- Phase 8B — Pricing Algorithm and Recommendation Correctness (closes PRICING-001 P0 and PRICING-002 P1).
- Phase 8C — Payment Cryptographic and Settlement Hardening (closes PAYMENT-001..003 P1, plus historical-data upgrade simulation).
- Phase 8D — Live Sandbox Provider Acceptance (closes MOMO/VNPAY SANDBOX_ACCEPTANCE external blockers; prerequisites: merchant sandbox credentials, registered callback URLs).
- Phase 8E — Security, Abuse and Privacy Hardening (closes SECURITY-001..003 P1).
- Phase 8F — Observability, Backup and Operational Readiness (closes OBSERVABILITY-001 P0, BACKUP-001 P1, MIGRATION-001 P1).
- Phase 8G — Performance, Capacity and Scalability Hardening (closes CAPACITY-001 BUSINESS_OR_OPERATIONS_DECISION, PERFORMANCE-001 P2, SCALABILITY-001 P2).
- Phase 8H — Deployment and Production Acceptance (closes DEPLOYMENT-001 P0 and DEPLOYMENT-002 P1).

## 9. Rollback / Removal of Audit-Only Tooling

To remove all Phase 8A audit artefacts (no production behaviour was changed by them, but they may be deleted):

```bash
# Audit-only Vitest suites
rm -rf apps/api/test/audit-phase8a
rm -rf packages/booking/test/audit-phase8a

# Audit-only evidence
rm -rf docs/audit/phase-8a
rm -f docs/handoffs/phase-8a-production-readiness-audit.md

# No commits were amended; no schema/migration touched; no production code touched.
git status
```

No secrets, payment credentials, or session tokens were committed during this audit. The backup-restore drill used disposable `audit_backup_drill_*` databases on the local docker PostgreSQL; these are owned by the audit and can be dropped via:

```bash
docker exec roommanagement-postgres-1 dropdb --if-exists -U room audit_backup_drill_src
docker exec roommanagement-postgres-1 dropdb --if-exists -U room audit_backup_drill_dst
```

## 10. End of Master Report

Refer to the per-section reports for detailed evidence. The master gap register is in `docs/audit/phase-8a/gap-register.csv`.
