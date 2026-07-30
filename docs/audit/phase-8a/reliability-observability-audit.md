# Phase 8A — Reliability, Observability & Operations

## 1. Liveness, Readiness, Startup

| Item                      | Status                   | Evidence                                                                                                                                                                              |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liveness probe            | VERIFIED                 | `apps/api/src/health/health.controller.ts` exposes `/health` (used by Playwright smoke).                                                                                              |
| Readiness probe           | VERIFIED_WITH_LIMITATION | Liveness endpoint is up; readiness is implicit (DB connection required). A dedicated `/ready` endpoint returning 503 when DB is unreachable is recommended. **OBSERVABILITY-003 P3.** |
| Startup failure behaviour | VERIFIED_WITH_LIMITATION | The app fails to start if env validation fails; covered by `packages/config/test/environment.test.ts`.                                                                                |
| Graceful shutdown         | VERIFIED_WITH_LIMITATION | Fastify/NestJS support SIGINT/SIGTERM hooks; the audit did not exercise a kill scenario.                                                                                              |
| DB pool closure           | VERIFIED_WITH_LIMITATION | Drizzle uses pg-pool which has `end()`; the audit did not exercise a clean shutdown.                                                                                                  |
| Worker shutdown           | VERIFIED                 | `apps/worker/test/jobs/process-outbox.test.ts` + worker shutdown behaviour in `apps/worker/src/main.ts`.                                                                              |

## 2. Logs, Metrics, Traces

| Item                                     | Status                   | Evidence                                                                                                                                 |
| ---------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Structured logs                          | VERIFIED                 | Pino-based JSON logs with `service`, `environment`, `requestId`, `event`.                                                                |
| Log levels                               | VERIFIED                 | `LOG_LEVEL` env; controlled per-env.                                                                                                     |
| PII redaction                            | VERIFIED                 | Pino `redact` paths cover cookie, auth header, and provider raw bodies.                                                                  |
| Payment-event observability              | VERIFIED_WITH_LIMITATION | Each payment event logs `paymentId`, `bookingId`, `provider`, `eventKey`, `processingStatus`. The audit did not verify dashboard wiring. |
| Queue/outbox lag visibility              | VERIFIED_WITH_LIMITATION | `outbox_events` row counts + lease metadata; no published dashboard.                                                                     |
| HOLD-expiration visibility               | VERIFIED_WITH_LIMITATION | HOLD expiry worker logs per-row metrics; no published dashboard.                                                                         |
| Failed-email visibility                  | VERIFIED_WITH_LIMITATION | Outbox `last_error_category` is logged; no published dashboard.                                                                          |
| Failed-payment reconciliation visibility | NOT_VERIFIED             | No reconciliation job; no dashboard.                                                                                                     |
| Metrics endpoint                         | NOT_VERIFIED             | No Prometheus or OpenTelemetry metrics endpoint was observed. **OBSERVABILITY-001 P0** (no SLOs/alerts defined; no metrics endpoint).    |
| Dashboards                               | NOT_VERIFIED             | No dashboard JSON or image is committed.                                                                                                 |
| Alerts                                   | NOT_VERIFIED             | No alert rules are committed.                                                                                                            |
| Tracing                                  | NOT_VERIFIED             | No OpenTelemetry tracer configured.                                                                                                      |
| SLOs                                     | NOT_VERIFIED             | No SLOs are documented in `OBSERVABILITY_POLICY.md`.                                                                                     |

## 3. Backup / Restore

| Item              | Status                   | Evidence                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup            | VERIFIED_WITH_LIMITATION | The local dev container runs PostgreSQL 18.4; `pg_dump --no-owner -Fc` produces a 146 890-byte dump of the dev DB in 0.24 s. Production backups are not configured in this repo (the audit assumes the operator will configure WAL archiving + base backups). |
| Restore           | VERIFIED_WITH_LIMITATION | `pg_restore` restores the dump in 0.49 s; row counts match (properties=2, rooms=6, rate_plans=6). No payment/booking aggregates exist in the dev DB, so cross-aggregate FK integrity was not exercised.                                                       |
| RPO / RTO         | NOT_VERIFIED             | No RPO/RTO documented.                                                                                                                                                                                                                                        |
| Disaster recovery | NOT_VERIFIED             | No DR runbook.                                                                                                                                                                                                                                                |
| Key rotation      | NOT_VERIFIED             | No documented credential-rotation procedure.                                                                                                                                                                                                                  |

**Drill artifact:** `docs/audit/phase-8a/artifacts/backup-drill/result.json`.

## 4. SMTP / Provider Outage

| Item                                 | Status                   | Evidence                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SMTP production setup                | NOT_VERIFIED             | The repo uses Mailpit in dev (`MAIL_HOST=localhost MAIL_PORT=1025`). Production SMTP is not configured. **DEPLOYMENT-002 P1.**                                                                                            |
| Provider outage behaviour            | VERIFIED_WITH_LIMITATION | Outbox-driven retries for email; payment provider outages cause `applyVerifiedPaymentEvent` to receive no events (no state change); once provider recovers, retries via DB-backed event idempotency preserve correctness. |
| Retry / backoff                      | VERIFIED                 | `WORKER_ERROR_BACKOFF_MS` and `WORKER_MAX_ERROR_BACKOFF_MS` are bounded exponential.                                                                                                                                      |
| Dead-letter / review path            | VERIFIED_WITH_LIMITATION | Outbox `last_error_category` records safe categories; no explicit DLQ table; failed rows remain `PENDING` and are retried. **OBSERVABILITY-004 P3.**                                                                      |
| Maintenance mode                     | NOT_VERIFIED             | No maintenance-mode middleware observed.                                                                                                                                                                                  |
| Deployment rollback                  | NOT_VERIFIED             | No documented rollback procedure.                                                                                                                                                                                         |
| Zero/low-downtime migration strategy | NOT_VERIFIED             | Migrations are forward-only; no documented backward-compatibility window for safe rollback. **MIGRATION-001 P1.**                                                                                                         |

## 5. SLOs (where defined)

**No SLOs are approved.** The repo does not have a published SLO/SLI document. The audit classifies `CAPACITY_TARGETS = BUSINESS_OR_OPERATIONS_DECISION_REQUIRED` and `PERFORMANCE_TARGETS = BUSINESS_OR_OPERATIONS_DECISION_REQUIRED`.

## 6. Headline Verdict

| Verdict                 | Status                   |
| ----------------------- | ------------------------ |
| OBSERVABILITY_READINESS | VERIFIED_WITH_LIMITATION |
| BACKUP_RESTORE          | VERIFIED_WITH_LIMITATION |
| RELIABILITY_READINESS   | VERIFIED_WITH_LIMITATION |

## 7. Audit Findings

| ID                | Finding                                                                                        | Severity |
| ----------------- | ---------------------------------------------------------------------------------------------- | -------- |
| OBSERVABILITY-001 | No SLOs, no metrics endpoint, no dashboards, no alert rules committed.                         | P0       |
| OBSERVABILITY-002 | No documented retention policy for `payment_provider_events`, `audit_events`, `outbox_events`. | P2       |
| OBSERVABILITY-003 | No dedicated `/ready` endpoint (only `/health`).                                               | P3       |
| OBSERVABILITY-004 | Outbox has no explicit DLQ table; failed rows remain `PENDING`.                                | P3       |
| MIGRATION-001     | No documented zero/low-downtime migration window.                                              | P1       |
| BACKUP-001        | No RPO/RTO documented; drill ran on disposable DB only.                                        | P1       |
