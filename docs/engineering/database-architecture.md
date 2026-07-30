# Phase 2 database architecture

## Authority and ownership

PostgreSQL is the authoritative transaction store for catalog, booking, inventory, audit, and outbox facts. Redis may support cache and queue transport, but it has no consistency role: a Redis key, lock, or queue result cannot authorize availability or override a PostgreSQL constraint.

`@room/database` owns Drizzle schema/migration code and all PostgreSQL pool creation. It exposes bounded helpers that close their pools. The API's database provider owns the application-lifetime pool; command scripts own their short-lived pools; guarded tests create, migrate, then drop a disposable database. Callers must not construct a parallel pool for the same workflow.

## Inventory model

Bookings and maintenance blocks are source records. `room_inventory_blocks` is the single ledger of physical-room occupancy: each active row points to exactly one booking or maintenance source. The `[start, end)` interval avoids a false collision when one stay ends exactly as another starts. The PostgreSQL GiST exclusion constraint prevents overlapping active allocations for the same room, including races that application-level checks or Redis coordination could miss. Releasing a block is an explicit state change, not a deletion.

## Boundaries

Prices and the booking price snapshot are database facts; the snapshot and hold expiry are immutable after creation. Audit events are append-only at the database layer. Outbox rows record publication work but do not make Redis authoritative.

Payments are intentionally separate from this phase: there is no payment provider callback, token, charge, ledger, or settlement table. A later payment module must define its own idempotency, retention, and provider-security contract before adding foreign keys or workflow coupling.

Phase 2 stores no dedicated guest PII fields. Do not add PII to JSON payloads as a shortcut. Future PII needs a documented purpose, access controls, retention/archive process, and deletion policy. Current relational facts use restrictive foreign keys and audit rows cannot be updated or deleted; archive/delete behavior must therefore be implemented as a reviewed future policy, not a direct destructive SQL operation.

See [database schema](database-schema.md) and [migration runbook](migration-runbook.md).
