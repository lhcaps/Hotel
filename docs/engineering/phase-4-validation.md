# Phase 4 validation

Focused commands:

- `pnpm test:pricing` - pricing engine boundaries.
- `pnpm test:availability` - real PostgreSQL availability semantics.
- `pnpm test:quotes` - real PostgreSQL immutable quote semantics.
- `pnpm test:catalog` - guarded API integration including rate-plan administration.

Forward-only schema version is `phase-4-pricing-availability-v1`. Rollback stops the application release; a database defect requires a reviewed forward migration. Phase 5 may consume neither an inventory reservation nor a quote mutation from this phase.
