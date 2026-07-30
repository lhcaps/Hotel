# Database migration policy

Phase 2 owns the initial PostgreSQL schema. Drizzle schema changes and the generated migration history are reviewed together; released migration files and their journal entries are immutable. Run `pnpm db:check` before review, and validate a migration with a guarded real PostgreSQL test database before it is merged.

Every subsequent change needs a forward migration, an owner, a rollout/lock-impact assessment, and a tested forward fix. Do not edit, reorder, delete, or regenerate released migrations, and do not run direct DDL against a production or persistent shared environment. Seed data is a separate, development-only concern.

Custom SQL is required where the ORM cannot express a PostgreSQL invariant safely (for example, the inventory GiST exclusion constraint and append-only triggers). It must be idempotent where appropriate, ordered after generated DDL, commented with its invariant, checked by `db:check`, and exercised by integration tests. A failed deployed migration is repaired by a new reviewed forward migration; rollback is not permission to mutate history.
