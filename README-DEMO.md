# Room Management — Local Demo Package

This archive is a self-contained snapshot of the Room Management monorepo.
It is intended for a single local demo run on a Windows machine by a
customer-success engineer. Nothing in this package leaves the machine
and nothing is pushed to a remote.

## Verify the archive

The SHA-256 of `room-management-demo.zip` lives in
`output/room-management-demo.zip.sha256` **next to** the archive, NOT
inside it. That external file is the authoritative integrity record.
A copy of the expected hash is also embedded at
`verification/SHA256-EXPECTED.txt` for convenience, but the file in
`output/` is what you trust.

```powershell
Get-FileHash output\room-management-demo.zip -Algorithm SHA256
```

Compare the value to the line in
`output\room-management-demo.zip.sha256`. See `verification/INDEX.md`
for the full list of gate artifacts that were captured at build time.

## Platform support

**Windows only.** The demo runner (`scripts/demo/start-local.mjs`),
stop script (`scripts/demo/stop.mjs`), and customer PS1 wrappers
(`RUN-DEMO.ps1`, `VERIFY-DEMO.ps1`, `STOP-DEMO.ps1`) all use Windows
APIs (`tasklist`, `taskkill /PID`) and refuse to run on macOS / Linux.
The remainder of the archive (Web, API, worker, packages) is portable,
but the orchestration surface in this package is Windows-only.

## What is inside the archive

| Path                                                                    | Purpose                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`                                                              | Next.js customer + admin UI (port 3000)                                                 |
| `apps/api`                                                              | NestJS HTTP API (port 3001)                                                             |
| `apps/worker`                                                           | Background worker                                                                       |
| `packages/*`                                                            | Internal libraries (auth, booking, catalog, contracts, database, observability, config) |
| `scripts/demo/{start-local,stop,verify}.mjs`                            | Local demo driver                                                                       |
| `tests/e2e/*`                                                           | Playwright specs, including `final-local-demo-acceptance.spec.ts`                       |
| `playwright.verify.config.ts`                                           | Standalone Playwright config that targets the local demo stack                          |
| `RUN-DEMO.ps1` / `VERIFY-DEMO.ps1` / `STOP-DEMO.ps1`                    | Customer-facing Windows wrappers                                                        |
| `compose.yaml`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json` | Workspace wiring and dependency lockfile                                                |
| `.env.example`                                                          | Sample environment for the local demo                                                   |
| `README-DEMO.md`                                                        | This file                                                                               |
| `verification/`                                                         | Gate logs and INDEX.md captured at build time                                           |
| `docs/`                                                                 | Public-facing documentation (internal agent handoffs excluded)                          |

The following build artefacts are intentionally **omitted** and must be
reproduced on the target machine before the demo:

- `node_modules/**` (pnpm install will create it)
- `apps/web/.next/**` (Next.js output)
- `apps/api/dist/**` (NestJS compile output)
- `apps/worker/dist/**` (Worker compile output)
- `packages/*/dist/**` (Compiled packages)
- `coverage/**`, `storybook-static/**`, `.turbo/**`
- `.git/**`, `.toolcache/**`, `test-results/**`, `tmp/**`, `output/**`
- `docs/handoffs/**` (internal agent handoffs)
- Internal policy / agent / runbook markdown files (see packager)

## Demo stack topology

| Service           | Host                  | Port | Started by                         |
| ----------------- | --------------------- | ---- | ---------------------------------- |
| Web (Next.js)     | http://localhost:3000 | 3000 | `RUN-DEMO.ps1` → `start-local.mjs` |
| API (NestJS)      | http://localhost:3001 | 3001 | `RUN-DEMO.ps1` → `start-local.mjs` |
| Worker            | (no public port)      | —    | `RUN-DEMO.ps1` → `start-local.mjs` |
| Payment Simulator | http://localhost:3090 | 3090 | `RUN-DEMO.ps1` → `start-local.mjs` |
| Mailpit           | http://localhost:8025 | 8025 | `docker compose up -d mailpit`     |
| Postgres / Redis  | docker                | —    | `docker compose up -d`             |

The runner writes `.demo/start-manifest.json` listing every PID it
spawned. `STOP-DEMO.ps1` reads that manifest and terminates **only** the
PIDs in it. It never scans ports, never uses `taskkill /IM`, and never
touches an unrelated listener.

## Quick start (Windows PowerShell)

```powershell
# 0. One-time infra
docker compose up -d

# 1. Install dependencies (idempotent)
pnpm install --frozen-lockfile

# 2. Create the demo database (idempotent)
pnpm demo:db:create
pnpm demo:seed

# 3. Start the demo stack — waits for all four services
.\RUN-DEMO.ps1

# 4. Run the deterministic verifier
.\VERIFY-DEMO.ps1

# 5. Run the final local demo acceptance suite (Playwright)
npx playwright test tests/e2e/final-local-demo-acceptance.spec.ts `
    --config=playwright.verify.config.ts --workers=1 --retries=0

# 6. Tear it all down — kills ONLY runner-owned PIDs
.\STOP-DEMO.ps1

docker compose down
```

## Demo accounts

| Role          | Email                    | Password                   |
| ------------- | ------------------------ | -------------------------- |
| Administrator | `demo-verify@room.local` | `Aa1-KnownVerifyPass-1234` |

The customer flow is intentionally passwordless: it uses the
booking-hold OTP channel via Mailpit instead of a registered account.

## What is intentionally not in this package

- Live payment provider credentials, OAuth client secrets, or any
  production environment values.
- Author personal email or machine-specific paths.
- Internal agent runbooks (`docs/handoffs/**`) and policy markdown
  files not needed at demo time.
- Generated artefacts (`dist/`, `.next/`, `coverage/`, `storybook-static/`,
  `.turbo/`, `test-results/`).
- The `.env` file. `.env.example` is included; customers copy it to
  `.env` and fill in non-secret defaults.

## Support

If any of the verification steps fail after a clean extract, the
likely cause is a missing `node_modules` or a stale port. Rerun
`pnpm install`, then `.\STOP-DEMO.ps1 && .\RUN-DEMO.ps1` before
re-running `.\VERIFY-DEMO.ps1`.
