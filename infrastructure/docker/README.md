# Local infrastructure

`compose.yaml` runs only PostgreSQL, Redis and Mailpit. Web, API and worker run on the host for fast local feedback; they are intentionally not containerized in Phase 1.

Copy `.env.example` to `.env`, then use `pnpm infra:up`. PostgreSQL and Redis expose healthchecks. Redis is non-authoritative: its data is not business state and normal `pnpm infra:down` preserves volumes. Do not use a reset command automatically.
