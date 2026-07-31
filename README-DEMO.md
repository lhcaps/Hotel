# Room Management — Local Demo Package

This archive is a self-contained snapshot of the Room Management monorepo
committed as `e5f8f95` on branch `main`. It is intended for a single
local demo run by a customer-success engineer; nothing in this package
leaves the machine and nothing is pushed to a remote.

## What is inside

| Path                 | Purpose                                                                                              |
|----------------------|------------------------------------------------------------------------------------------------------|
| `apps/web`           | Next.js customer + admin UI (port 3000)                                                              |
| `apps/api`           | NestJS HTTP API (port 3001)                                                                          |
| `apps/worker`        | Background worker (queues, emails, etc.)                                                             |
| `packages/*`         | Internal libraries (auth, booking, catalog, contracts, database, observability, config)             |
| `scripts/demo/*`     | `start-local.mjs`, `stop.mjs`, `verify.mjs` — the canonical demo driver                             |
| `tests/e2e/*`        | Playwright specs, including `final-local-demo-acceptance.spec.ts`                                   |
| `playwright.verify.config.ts` | Standalone Playwright config that targets the local demo stack (port 3000/3001/3090/8025)    |
| `docs/`              | Project documentation                                                                                |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Workspace wiring and dependency lockfile                            |
| `.env.example`       | Sample environment for the local demo                                                                |

The following build artefacts are intentionally **omitted** and must be
reproduced on the target machine before the demo:

- `node_modules/**`               (pnpm install will create it)
- `apps/web/.next/**`             (Next.js production output)
- `apps/api/dist/**`              (NestJS compile output)
- `apps/worker/dist/**`           (Worker compile output)
- `packages/*/dist/**`            (Compiled packages)
- `coverage/**`, `storybook-static/**`, `.turbo/**`
- `.git/**`, `.toolcache/**`, `test-results/**`, `tmp/**`

## Demo stack topology

| Service             | Host                  | Port | Started by                       |
|---------------------|-----------------------|------|----------------------------------|
| Web (Next.js)       | http://localhost:3000 | 3000 | `scripts/demo/start-local.mjs`   |
| API (NestJS)        | http://localhost:3001 | 3001 | `scripts/demo/start-local.mjs`   |
| Payment Simulator   | http://localhost:3090 | 3090 | `scripts/demo/start-local.mjs`   |
| Mailpit             | http://localhost:8025 | 8025 | `docker compose up -d mailpit`   |
| Postgres / Redis    | docker                | —    | `docker compose up -d`           |

All browser-visible URLs use the **`localhost`** hostname. The simulator
intermediate URL is allowed to redirect through `127.0.0.1:3090` because
the simulator's checkout page embeds its loopback URL; this is the only
exception to the `localhost` rule.

## Quick start (Windows PowerShell)

```powershell
# 0. One-time infra
docker compose up -d

# 1. Install dependencies (idempotent)
pnpm install --frozen-lockfile

# 2. Create the demo database (idempotent)
pnpm demo:db:create
pnpm demo:seed

# 3. Start the demo stack (WEB/API/SIM) and wait for readiness
pnpm demo:start:local

# 4. Run the deterministic verifier
pnpm demo:verify

# 5. Run the final local demo acceptance suite (Playwright)
npx playwright test tests/e2e/final-local-demo-acceptance.spec.ts `
    --config=playwright.verify.config.ts --workers=1 --retries=0

# 6. Tear it all down when finished
pnpm demo:stop
docker compose down
```

The same flow works on macOS / Linux with the same commands.

## Demo accounts

| Role          | Email                              | Password                  |
|---------------|------------------------------------|---------------------------|
| Administrator | `demo-verify@room.local`           | `Aa1-KnownVerifyPass-1234`|

The customer flow is intentionally passwordless: it uses the
booking-hold OTP channel via Mailpit instead of a registered account.

## Verified acceptance evidence

Captured against the HEAD of this archive (`e5f8f95`):

- `final-local-demo-acceptance.spec.ts` — 7/7 scenarios, run twice
  on the same committed HEAD (logs archived under `verification/`).
- `scripts/demo/verify.mjs` — 16/16 deterministic checks.
- Quality gates: `format:check`, `turbo lint` (9/9),
  `turbo typecheck` (9/9), OpenAPI drift check, `db:check`,
  `turbo test:unit` (337 tests), `turbo build` (9/9).

See `verification/README.md` for the artifact list.

## What is intentionally not in this package

- Live payment provider credentials, OAuth client secrets, or any
  production environment values.
- Drizzle migration history is included; the demos use a fresh
  database so released migrations are not edited by this closure.
- No remote operations are executed by the scripts in this archive.

## Support

If any of the verification steps fail after a clean extract, the
likely cause is a missing `node_modules` or a stale port. Rerun
`pnpm install`, then `pnpm demo:stop && pnpm demo:start:local` before
re-running `pnpm demo:verify`.