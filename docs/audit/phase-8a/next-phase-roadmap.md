# Phase 8A — Next-Phase Roadmap

The phases below are ordered by the closure impact of the gaps they resolve. Each phase lists the exact blockers it closes, its prerequisites, and the estimated effort.

## Phase 8B — Pricing Algorithm and Recommendation Correctness

**Blockers closed:**

- PRICING-001 P0 (cheapest-first vs priority-wins decision).
- PRICING-002 P1 (flexible-time recommendation rules).

**Prerequisites:** Product sign-off on (a) cheapest-first vs priority-wins vs hybrid (cheapest-with-priority-tie-break), (b) flexible-time rules.

**Affected modules:** `apps/api/src/pricing/`, `packages/contracts/src/`.

**Migration impact:** none.

**Test requirements:**

- Re-run audit-exhaustive and audit-property-random; aim for 100% match.
- New: tests for advisory recommender (if PRICING-002 is approved).

**External credentials / infrastructure:** none.

**Acceptance verdict:** `EXACT_TIME_CHEAPEST_PLAN = VERIFIED`, `FLEXIBLE_TIME_RECOMMENDATION = VERIFIED` (if implemented) or remains `BUSINESS_RULE_UNSOURCED` (if not).

**Estimated effort:** M (1-2 days for selector change + tests; 1-2 days for product-spec authoring + ADR).

**Execution order:** 1.

## Phase 8C — Payment Cryptographic and Settlement Hardening

**Blockers closed:**

- PAYMENT-001 P1 (status-query + reconciliation).
- DATA-001 P1 (operational_reviews.payment_id cross-check).
- MIGRATION-002 P2 (Phase 7F→7G historical-data simulation).

**Prerequisites:** Phase 7F historical seed dataset for the upgrade simulation.

**Affected modules:** `packages/booking/src/payment/`, `packages/database/drizzle/`.

**Migration impact:** one new migration for the operational_reviews cross-check trigger; no schema reshape.

**Test requirements:**

- Trigger-rejection unit test for DATA-001.
- Cross-provider race matrix (8 remaining race cases) for PAYMENT-001.
- Phase 7F → 7G simulation.

**External credentials / infrastructure:** none (sandbox acceptance is Phase 8D).

**Acceptance verdict:** `CROSS_PROVIDER_SETTLEMENT_SAFETY = VERIFIED`, `DATA_INTEGRITY = VERIFIED` (for the operational_reviews cross-check).

**Estimated effort:** M (3-5 days).

**Execution order:** 2.

## Phase 8D — Live Sandbox Provider Acceptance

**Blockers closed:**

- MOMO_SANDBOX_ACCEPTANCE (EXTERNAL_BLOCKED).
- VNPAY_SANDBOX_ACCEPTANCE (EXTERNAL_BLOCKED).
- PAYMENT-002 P1 (VNPAY space encoding).
- PAYMENT-003 P1 (VNPAY amount scaling).

**Prerequisites:**

- MoMo Partner Code + Access Key + Secret Key (sandbox).
- VNPAY TmnCode + HashSecret (sandbox).
- Public HTTPS endpoint reachable by both providers (staging).
- Provider-side configuration of allowed return URLs and IP allowlist.

**Affected modules:** `apps/api/src/payment/providers/{momo,vnpay}/`.

**Migration impact:** none.

**Test requirements:**

- Sandbox happy-path: quote → create-attempt → IPN → confirm.
- Sandbox negative: tampered signature → reject; replay → DUPLICATE.
- Sandbox reconciliation: status-query result matches server state.

**External credentials / infrastructure:** sandbox merchant credentials; staging HTTPS endpoint.

**Acceptance verdict:** `MOMO_SANDBOX_ACCEPTANCE = VERIFIED`, `VNPAY_SANDBOX_ACCEPTANCE = VERIFIED`, `PAYMENT-002` and `PAYMENT-003` resolved.

**Estimated effort:** M (3-5 days, plus customer turnaround for sandbox creds and DNS).

**Execution order:** 3.

## Phase 8E — Security, Abuse and Privacy Hardening

**Blockers closed:**

- SECURITY-001 P1 (security headers).
- SECURITY-002 P2 (dependency audit).
- SECURITY-003 P2 (Web bundle secret scan).
- PAYMENT-005 P3 (provider request-id in audit logs).

**Prerequisites:** none.

**Affected modules:** `apps/web/src/middleware.ts`, `apps/api/src/payment/providers/`, CI.

**Migration impact:** none.

**Test requirements:**

- Header assertion tests.
- `pnpm audit --prod` step.
- Bundle-scan script.

**External credentials / infrastructure:** none.

**Acceptance verdict:** `SECURITY_READINESS = VERIFIED`.

**Estimated effort:** S (1-2 days).

**Execution order:** 4.

## Phase 8F — Observability, Backup and Operational Readiness

**Blockers closed:**

- OBSERVABILITY-001 P0 (SLOs / metrics / dashboards / alerts).
- BACKUP-001 P1 (RPO/RTO + restore procedure).
- MIGRATION-001 P1 (zero/low-downtime migration strategy).
- OBSERVABILITY-002 P2 (retention).
- DATA-002 P3 (audit-events append-only trigger).
- PRICING-003 P3 (quote immutability trigger).
- OBSERVABILITY-003 P3 (readiness endpoint).
- OBSERVABILITY-004 P3 (outbox DLQ).

**Prerequisites:** monitoring infra (Prometheus/Grafana or equivalent); SRE decision on SLOs.

**Affected modules:** `apps/api/src/health/`, `apps/worker/src/jobs/`, `packages/database/drizzle/`.

**Migration impact:** triggers + retention cron.

**Test requirements:**

- `/ready` endpoint behaviour.
- DLQ archival.
- Trigger-rejection tests for DATA-002 / PRICING-003.

**External credentials / infrastructure:** monitoring infra; on-call rota.

**Acceptance verdict:** `OBSERVABILITY_READINESS = VERIFIED`, `BACKUP_RESTORE = VERIFIED` (with documented RPO/RTO).

**Estimated effort:** L (1-2 weeks).

**Execution order:** 5.

## Phase 8G — Performance, Capacity and Scalability Hardening

**Blockers closed:**

- PERFORMANCE-001 P2 (load + soak tests).
- CAPACITY-001 BUSINESS_OR_OPERATIONS_DECISION_REQUIRED (approved SLOs).
- CAPACITY-002 P2 (per-property HOLD concurrency cap).
- SCALABILITY-001 P2 (outbox / audit retention).
- EXTENSIBILITY-001 P2 (generic PaymentProviderAdapter interface).
- EXTENSIBILITY-002 P3 (admin UI for new pricing plan).

**Prerequisites:** approved SLOs from Phase 8F.

**Affected modules:** `apps/api/src/payment/payment.module.ts`, `apps/web/src/app/admin/rate-plans/`, `packages/database/`.

**Migration impact:** outbox partition or archival table.

**Test requirements:**

- k6 or autocannon load test against the disposable API.
- Adapter-pluggability test for EXTENSIBILITY-001.

**External credentials / infrastructure:** load-test target environment.

**Acceptance verdict:** `PERFORMANCE_BASELINE = VERIFIED`, `CAPACITY_TARGETS = VERIFIED`, `SCALABILITY_READINESS = VERIFIED`, `EXTENSIBILITY_READINESS = VERIFIED`.

**Estimated effort:** L (1-2 weeks).

**Execution order:** 6.

## Phase 8H — Deployment and Production Acceptance

**Blockers closed:**

- DEPLOYMENT-001 P0 (production Docker / compose / Helm / TLS / WAF / DNS).
- DEPLOYMENT-002 P1 (production SMTP).

**Prerequisites:** customer infrastructure access; SMTP provider credentials.

**Affected modules:** repo root (`Dockerfile`, `compose.production.yaml`, `helm/` or `kustomize/`), CDN/WAF config.

**Migration impact:** none.

**Test requirements:**

- Staging end-to-end smoke (quote → hold → pay → confirm → admin cancel).
- TLS cert renewal automation.
- WAF rule-set validation.

**External credentials / infrastructure:** CDN, WAF, DNS, SMTP provider, vault / KMS, monitoring.

**Acceptance verdict:** `DEPLOYMENT_READINESS = VERIFIED`, `PRODUCTION_READINESS = VERIFIED`.

**Estimated effort:** L (1-2 weeks).

**Execution order:** 7.

## Execution-Order Summary

1. Phase 8B (Pricing) — closes PRICING-001 P0.
2. Phase 8C (Settlement hardening) — closes PAYMENT-001, DATA-001, MIGRATION-002.
3. Phase 8D (Sandbox) — closes PAYMENT-002, PAYMENT-003; external live gate.
4. Phase 8E (Security) — closes SECURITY-001..003.
5. Phase 8F (Observability) — closes OBSERVABILITY-001 P0.
6. Phase 8G (Performance) — closes CAPACITY-001, SCALABILITY-001.
7. Phase 8H (Deployment) — closes DEPLOYMENT-001 P0.

After Phase 8H, the system can be promoted to PRODUCTION_READINESS = YES if all P0/P1 items are resolved and Phase 8D live acceptance is VERIFIED.
