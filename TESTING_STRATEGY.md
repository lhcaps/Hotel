# Testing strategy

Use a test pyramid: unit tests for pure configuration, logging and lifecycle behavior; guarded PostgreSQL integration tests for schema, migrations, constraints, seed safety, and database boundaries; then short Playwright smoke tests for web/API wiring. `pnpm db:test` requires `TEST_DATABASE_URL` and creates/drops only names matching `room_management_test_<uuid>` on a loopback target. It never uses seed data or a persistent environment.

CI starts PostgreSQL and Redis, runs `pnpm db:check` and `pnpm db:test` before Playwright, and does not migrate production-like data. Coverage is evidence, with generated output and infrastructure excluded. Future booking work adds concurrency, idempotency, authorization, and payment callback tests from Phase 0 invariants.

## Provider acceptance boundary

`pnpm test:e2e` is deterministic and never calls public Google, MoMo, VNPAY, or SMTP services. It uses loopback identity/payment simulators, Mailpit, one worker, zero retries, and `.next-playwright`; demo tooling uses isolated `.next-demo` output. `pnpm check:providers` is the repository-owned non-secret readiness check. `pnpm test:e2e:google-live-local`, `pnpm test:e2e:momo-sandbox`, `pnpm test:e2e:vnpay-sandbox`, and `pnpm test:email:live` are opt-in manual acceptance commands only. A blocked command is not a failure or a live pass, and a browser return URL is never payment settlement evidence.
