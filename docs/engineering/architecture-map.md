# Architecture map

| Unit                     | Responsibility                                                           | Explicit non-responsibility                       |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------- |
| `apps/web`               | App Router shell, public availability/quote and ADMIN rate-plan screens  | Server pricing, authorization, physical inventory |
| `apps/api`               | REST, health, authz, pricing, availability and quote orchestration       | ORM/schema ownership, ad-hoc pools                |
| `apps/worker`            | Redis connectivity and graceful lifecycle                                | Fake jobs, booking mutation, ADMIN impersonation  |
| `packages/config`        | Zod environment validation                                               | Secret storage                                    |
| `packages/observability` | Structured/redacted logs                                                 | External telemetry SDK                            |
| `packages/database`      | Drizzle schema, migrations, guarded test DB lifecycle, development seed  | API routes, payment processing, Redis consistency |
| PostgreSQL               | Transactional authority for Phase 2 catalog, booking and inventory facts | Cache/queue coordination                          |
| Redis                    | Local queue/cache connectivity                                           | Authoritative state                               |

The inventory ledger records both booking and maintenance allocations. Its PostgreSQL exclusion constraint, not Redis or application timing, is the final overlap authority. Phase 4 pricing is a pure API-domain function; repositories resolve active catalog data and persist immutable quote snapshots. See [pricing architecture](pricing-architecture.md), [availability architecture](availability-architecture.md), [quote architecture](quote-architecture.md), and [database schema](database-schema.md).
