# Production deployment contract

This Compose file exposes only Caddy on ports 80 and 443. PostgreSQL, Redis,
the API, worker, web and no-money payment-demo services remain on the private
Docker network. Caddy exposes the demo service at `PAYMENT_DEMO_DOMAIN`.

1. Copy `.env.production.example` to `.env.production`, replace placeholders,
   and restrict it to the deployment account (`chmod 600`).
2. Set `RELEASE_SHA` to the full commit SHA in that clean checkout, then run
   `node --env-file deploy/.env.production scripts/deploy/preflight.mjs`.
   This refuses placeholder values, a non-commit-shaped SHA, or an invalid
   Compose configuration without printing secrets.
3. Build from the clean committed release SHA only:
   `docker compose --env-file deploy/.env.production -f docker-compose.production.yml build`.
4. Before deployment, run `pnpm db:check` from the clean release checkout.
   Start the stack with `docker compose --env-file deploy/.env.production -f
docker-compose.production.yml up -d`. Its one-shot `migrate` service runs
   the compiled forward migrations before API and worker services can start.
5. Run `node --env-file deploy/.env.production scripts/deploy/status.mjs` to
   verify the public health endpoints and print container status. It does not
   expose environment values.

The helper `scripts/deploy/backup-postgres.mjs` creates a compressed
PostgreSQL backup with a SHA-256 sidecar. Restore is deliberately limited to a
disposable database by `scripts/deploy/restore-disposable-postgres.mjs`; it
will refuse a production database name.

Prepare external acceptance without placing credentials in the repository:

```sh
PUBLIC_E2E_BASE_URL=https://peacenest.vn \
PUBLIC_E2E_ADMIN_EMAIL=<operator-supplied> \
PUBLIC_E2E_ADMIN_PASSWORD=<operator-supplied> \
pnpm test:e2e:public

k6 run -e BASE_URL=https://peacenest.vn scripts/load/public-read-k6.js
```

The Playwright config refuses non-HTTPS origins. The k6 scenario is read-only
catalog traffic at 100 virtual users; it never requests OTP or payment flows.

`INTERNAL_API_BASE_URL=http://api:3001/api/v1` is mandatory. It prevents Next
server routes from re-entering Caddy and recursively proxying into themselves.

The loopback test payment simulator is intentionally absent. The separate
`payment-demo` service is the only public payment surface: it displays a
no-money disclosure, validates provider signatures, accepts mapping only via
the private bearer-token endpoint, and sends callbacks to the private API URL.
Never configure live merchant credentials for this service.
