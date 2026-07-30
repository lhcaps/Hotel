# Phase 8A — Migration, Backup & Restore Audit

## 1. Migration History

15 migrations, linear chain (per Phase 7G handoff):

| #    | File                                        | Description                                                          |
| ---- | ------------------------------------------- | -------------------------------------------------------------------- |
| 0001 | `0001_initial.sql`                          | core schema (users, properties, room types)                          |
| 0002 | `0002_*.sql`                                | room inventory                                                       |
| 0003 | `0003_*.sql`                                | availability / search                                                |
| 0004 | `0004_*.sql`                                | rate plans + price tiers                                             |
| 0005 | `0005_*.sql`                                | coupons                                                              |
| 0006 | `0006_*.sql`                                | hold / quote lifecycle                                               |
| 0007 | `0007_*.sql`                                | hold / quote lifecycle extensions                                    |
| 0008 | `0008_*.sql`                                | coupon applications                                                  |
| 0009 | `0009_*.sql`                                | quote pricing snapshots                                              |
| 0010 | `0010_*.sql`                                | customer identity                                                    |
| 0011 | `0011_*.sql`                                | rate plan CHECK constraints (15-minute alignment, duration windows)  |
| 0012 | `0012_many_kylun.sql`                       | payments + payment_attempts + payment_provider_events (payment core) |
| 0013 | `0013_*.sql`                                | operational reviews (Phase 7G)                                       |
| 0014 | `0014_*.sql`                                | ADMIN booking operations (Phase 7G)                                  |
| 0015 | `0015_phase7g_admin_booking_operations.sql` | operational_reviews + payments_id fk + idempotency                   |

**Audit verdict: `MIGRATION_SAFETY = VERIFIED_WITH_LIMITATION`.**

- All migrations are forward-only.
- `0011` enforces CHECK constraints at the DB level (15-minute alignment, duration windows).
- `0012` adds UNIQUE constraints on `payment_attempts.provider_order_id`, `payment_provider_events.event_key`.
- `0015` adds `operational_reviews.payment_id` FK to `payments.id` but **does not** enforce that the `payment_id` belongs to the same `booking_id`/`property_id` as the review. This is application-validated only. **DATA-001 P1.**

## 2. Foreign-Key Integrity

Cross-table FKs verified by `psql \d` output:

| FK                                           | Source                | Target                                                             | ON DELETE |
| -------------------------------------------- | --------------------- | ------------------------------------------------------------------ | --------- |
| `bookings.property_id`                       | `properties.id`       | RESTRICT                                                           |
| `bookings.room_type_id`                      | `room_types.id`       | RESTRICT                                                           |
| `bookings.guest_session_id`                  | `guest_sessions.id`   | RESTRICT                                                           |
| `payments.booking_id`                        | `bookings.id`         | RESTRICT (UNIQUE)                                                  |
| `payments.property_id`                       | `properties.id`       | RESTRICT                                                           |
| `payment_attempts.payment_id`                | `payments.id`         | RESTRICT                                                           |
| `payment_attempts.property_id`               | `properties.id`       | RESTRICT                                                           |
| `payment_provider_events.payment_attempt_id` | `payment_attempts.id` | RESTRICT                                                           |
| `payment_provider_events.property_id`        | `properties.id`       | RESTRICT                                                           |
| `operational_reviews.booking_id`             | `bookings.id`         | RESTRICT                                                           |
| `operational_reviews.property_id`            | `properties.id`       | RESTRICT                                                           |
| `operational_reviews.payment_id`             | `payments.id`         | RESTRICT (but not cross-checked against the same booking/property) |

All FKs use `ON DELETE RESTRICT`, which is the correct conservative choice.

## 3. Cross-Aggregate Integrity Gap

`operational_reviews.payment_id` is a FK to `payments.id` but has no DB-level check that the payment belongs to the same booking/property as the review. Application code (`packages/booking/src/booking/admin-booking-operations.service.ts`) enforces this; the audit did not find a malicious-input test path that bypasses it.

**Severity: P1. Data integrity invariant must be expressed at the DB layer.** See DATA-001.

## 4. Audit / Outbox / Coupon Append-Only Protection

- `audit_events`: no UPDATE/DELETE code path observed; immutability is by code path. No DB trigger. **DATA-002 P3.**
- `outbox_events`: lease fields are mutated; `published_at`, `last_error_*` are mutated. Not append-only by design.
- `coupons`: `usage_count` is incremented on redemption (not append-only by design).
- `bookings.state`, `payments.state`: transitioned via state-machine; no UPDATE-by-arbitrary-input code path.

## 5. Migration Path Safety

| Item                      | Status                   | Evidence                                                                                                                                   |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh migration 0001–0015 | VERIFIED                 | Dev DB exists with the full chain applied; `db:status` (via `drizzle-kit`) shows all migrations applied.                                   |
| Upgrade path              | VERIFIED_WITH_LIMITATION | The audit did not run a 7F-to-7G historical-data simulation in this phase; this is a Phase 8C task.                                        |
| Migration lock            | VERIFIED                 | Drizzle-kit uses an advisory lock; `pnpm db:migrate` is the documented command.                                                            |
| Migration duration        | VERIFIED_WITH_LIMITATION | The audit did not time the 15-migration apply against a realistic dataset.                                                                 |
| Seed safety               | VERIFIED                 | Seed scripts are gated to development/test by env.                                                                                         |
| Test DB guards            | VERIFIED                 | `packages/database/test/unit/test-database-guard.test.ts` + `seed-url-guard.test.ts` prevent running test migrations against non-test DBs. |

## 6. Backup Drill

**Artifact:** `docs/audit/phase-8a/artifacts/backup-drill/result.json`

| Step                                                             | Outcome                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `pg_dump --no-owner -Fc -d room_management`                      | 146 890 bytes, 0.24 s                                |
| `dropdb audit_backup_drill_dst; createdb audit_backup_drill_dst` | success                                              |
| `pg_restore --no-owner -d audit_backup_drill_dst`                | 0.49 s                                               |
| Row-count check on restored DB                                   | properties=2, rooms=6, rate_plans=6 (matches source) |

**Limitations:**

- No payment/booking aggregates in the dev source; cross-aggregate FK integrity not exercised.
- No WAL archive pipeline; point-in-time recovery not tested.
- No full app-boot round-trip on the restored DB (the audit confirms data is restored, not that the application can boot against it).

## 7. Audit Findings

| ID            | Finding                                                                       | Severity |
| ------------- | ----------------------------------------------------------------------------- | -------- |
| MIGRATION-001 | No documented zero/low-downtime migration window.                             | P1       |
| MIGRATION-002 | No historical-data upgrade simulation (Phase 7F → 7G) executed in this audit. | P2       |
| DATA-001      | `operational_reviews.payment_id` lacks DB-level booking/property cross-check. | P1       |
| DATA-002      | `audit_events` has no DB-level append-only trigger.                           | P3       |
| BACKUP-001    | No RPO/RTO documented; drill ran on disposable DB only.                       | P1       |

## 8. Headline Verdict

| Verdict            | Status                   |
| ------------------ | ------------------------ |
| DATABASE_INTEGRITY | VERIFIED_WITH_LIMITATION |
| MIGRATION_SAFETY   | VERIFIED_WITH_LIMITATION |
| BACKUP_RESTORE     | VERIFIED_WITH_LIMITATION |
