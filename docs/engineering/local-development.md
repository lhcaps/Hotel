# Local development

Ports: web 3000, API 3001, PostgreSQL 5432, Redis 6379, Mailpit SMTP 1025 and Mailpit UI 8025. Copy `.env.example` to `.env`, run `pnpm infra:up`, then run the desired `pnpm dev:*` script. The host development scripts load the root `.env` when it is present. Confirm `docker compose ps`, web `/health`, API `/api/v1/health/live` and `/api/v1/health/ready`.

If readiness is 503, inspect PostgreSQL/Redis health rather than changing ports. If a port is occupied, stop the known owning process or container. `pnpm infra:down` preserves volumes.
