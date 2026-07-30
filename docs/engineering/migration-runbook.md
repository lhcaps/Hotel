# Migration runbook

## Preconditions

- Node 24 with Corepack and pnpm 10.
- PostgreSQL 18 reachable through `DATABASE_URL`.
- For local verification, Docker Compose services started with `pnpm infra:up`.
- A reviewed migration generated from the current Drizzle schema; never hand-edit released history.

## Local workflow

```powershell
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:check
pnpm db:test
pnpm db:migrate
pnpm db:status
```

`db:check` validates Drizzle history without changing a database. `db:test` creates and removes only a loopback `room_management_test_<uuid>` database from `TEST_DATABASE_URL`. `db:migrate` uses `DATABASE_URL`; confirm that URL and the target ownership before running it. Never run it as a way to probe a production or long-lived shared target.

## Change and recovery policy

1. Change `packages/database/src/schema.ts`, generate a new migration, and review generated SQL.
2. Add narrowly scoped custom SQL only for PostgreSQL-only invariants. Explain ordering, idempotence, lock/extension implications, and tests in the review.
3. Run static history validation and guarded real-database tests before merge.
4. Release migrations once, observe schema status, and retain the exact files/journal.

Do not edit, delete, or reorder released migration files. If rollout fails, stop and create a reviewed forward-fix migration after understanding the target state. Rollback plans may stop an application release, but never justify rewriting migration history or direct production DDL.

## Limitations

This repository has local and CI proof only. Production rollout still needs a target-specific backup/restore plan, lock-window assessment, migration operator, monitoring, and approved change window. `btree_gist` availability and database permissions must be confirmed by that operator.
