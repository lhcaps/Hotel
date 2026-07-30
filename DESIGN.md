# Design boundary

The platform is a modular monolith with a Next.js web application, NestJS API, non-interactive worker, and a shared database package. PostgreSQL is the transactional authority; Redis is non-authoritative cache/queue infrastructure and must never decide booking availability or replace database constraints. Database pools are owned and closed by `@room/database`; the API receives a provider rather than owning ad-hoc connections. Shared packages exist only when consumed.

Phase 2 introduces PostgreSQL catalog, booking, inventory-ledger, audit, and outbox storage. It deliberately excludes payment processor state and payment execution. Phase 0 is defined in [product](docs/product/product-scope.md), [domain](docs/domain/business-invariants.md), [architecture](docs/architecture/system-context.md), and [security](docs/security/threat-model.md) documents.
