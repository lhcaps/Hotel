# Developer guide

## Local prerequisites

- Node 24 with Corepack and pnpm 10.
- Docker Desktop with Docker Compose v2.
- A local `.env` created from `.env.example`; it must contain only local-development configuration.

Windows PowerShell setup:

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm infra:up
pnpm dev
```

Local health endpoints are web `http://localhost:3000/health`, API live `http://localhost:3001/api/v1/health/live`, and API ready `http://localhost:3001/api/v1/health/ready`.

## Local validation

Run targeted gates first, then the aggregate verifier when appropriate:

```powershell
pnpm db:check
pnpm db:test
pnpm typecheck
pnpm test
pnpm build
pnpm check:release-integrity
```

`pnpm db:test` may create and remove only a disposable `room_management_test_<uuid>` database from `TEST_DATABASE_URL`. Do not point `DATABASE_URL` or `TEST_DATABASE_URL` at a shared or production target. `pnpm infra:down` is the safe local shutdown command and preserves volumes.

## Database and migration rules

Follow [the migration runbook](engineering/migration-runbook.md). Generate reviewed migrations from the Drizzle schema, validate history before changing a database, and use forward fixes if a released migration is defective. Never edit, remove, reorder, or hand-rewrite released migration history.

## Release development rules

- Release artifacts must come from an exact committed SHA, never a modified checkout.
- `pnpm check:release-integrity` verifies repository release tooling; it does not attest production.
- Keep local tests, CI, isolated environments, and production evidence distinct in reports.
- Do not add credentials, generated runtime artifacts, archives, or untracked incident helpers to source control.

## Clean-room package verification

When release closure requires a source package, an operator should create an isolated temporary directory, generate `git archive <FINAL_SHA>`, calculate SHA-256, and scan the extracted contents with the approved secret scanner. In that extracted tree, run the documented frozen install and selected typecheck, build, and core-test gates. Record command exit outcomes and the source SHA, but do not include environment values, lockfile mirrors, or local overlays in the package.

## Where to look next

- [Handoff](HANDOFF.md) for release/transfer state.
- [Operations runbook](OPERATIONS_RUNBOOK.md) for production gates.
- [Environment contract](engineering/environment-contract.md) for variable classification.
- [Security handoff](SECURITY_HANDOFF.md) for ownership and incident boundaries.
