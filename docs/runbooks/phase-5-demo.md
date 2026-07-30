# Phase 5 Demo Runbook

This runbook walks a new developer through the full Phase 5 vertical
demo on a fresh Windows machine. It assumes only Node 24 LTS,
Corepack/pnpm, and Docker Desktop are installed.

> **Port 3001 belongs to the unrelated QLLaw project.** Never send a signal
> to the process listening on `127.0.0.1:3001`. Always inspect owners with
> `Get-NetTCPConnection` and only act on the PIDs you (or Playwright) started.

## Prerequisites

| Tool           | Version                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| Node           | 24 LTS (the repo pins `engines.node = 24.x`)                                 |
| pnpm           | 10.x (`packageManager` in `package.json`)                                    |
| Docker Desktop | any recent build with Compose v2                                             |
| OS             | Windows 10/11 PowerShell 7 (or Linux/macOS bash — adjust the shell snippets) |

Required ports (and the services that own them in the demo):

| Port | Service                        |
| ---- | ------------------------------ |
| 5432 | PostgreSQL 18 (Docker)         |
| 6379 | Redis 8 (Docker)               |
| 1025 | SMTP — Mailpit (Docker)        |
| 8025 | Mailpit HTTP UI                |
| 3100 | `@room/web` Next.js dev server |
| 3101 | `@room/api` NestJS/Fastify     |

Ports 3000 and 3001 are owned by the QLLaw project. **Do not touch them.**

## Environment

Copy `.env.example` to `.env`. The defaults are placeholder secrets only
(no real credentials). The Phase 5 demo reuses the same placeholders the
API and worker expect:

```env
NODE_ENV=development
LOG_LEVEL=info
API_HOST=127.0.0.1
API_PORT=3101
WEB_PORT=3100
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3101/api/v1
WEB_ORIGIN=http://127.0.0.1:3100
AUTH_BASE_URL=http://127.0.0.1:3101

# placeholder secrets (32+ chars each — they must satisfy validation but are NOT real)
BETTER_AUTH_SECRET=local-dev-only-secret-with-at-least-thirty-two-characters
GUEST_OTP_SECRET=test-guest-otp-secret-32-chars-min-aaaaaa
GUEST_CHALLENGE_REF_SECRET=test-challenge-ref-secret-32-chars-aaaa
GUEST_SESSION_SECRET=test-guest-session-secret-32-chars-aaaa
BOOKING_IP_DIGEST_SECRET=test-ip-digest-secret-32-chars-aaaaa

DATABASE_URL=postgresql://room:room@localhost:5432/room_management
TEST_DATABASE_URL=postgresql://room:room@localhost:5432/room_management_test_base
REDIS_URL=redis://localhost:6379

SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_FROM=no-reply@room-management.local
```

The CORS origin allowed by the API is `http://127.0.0.1:3100` (set by
`WEB_ORIGIN`). The web app reads `NEXT_PUBLIC_API_BASE_URL` at build time;
restart `next dev` after changing it.

## Startup sequence

1. **Bring up Docker infrastructure.**

   ```powershell
   docker compose up -d
   docker compose ps
   ```

   Confirm `roommanagement-mailpit-1`, `roommanagement-postgres-1`, and
   `roommanagement-redis-1` are healthy. Mailpit must be reachable on
   `http://127.0.0.1:8025`.

2. **Confirm the database schema.**

   ```powershell
   pnpm db:status
   pnpm db:migrate
   ```

   The expected schema version is `phase-5-booking-hold-guest-access-v1`
   (asserted by `packages/database/src/schema-status.ts`).

3. **Start the API on port 3101.**

   ```powershell
   $env:API_PORT = '3101'
   $env:WEB_ORIGIN = 'http://127.0.0.1:3100'
   $env:AUTH_BASE_URL = 'http://127.0.0.1:3101'
   pnpm --filter @room/api dev
   ```

   Wait until `http://127.0.0.1:3101/api/v1/health/live` returns 200.

4. **Start the web app on port 3100.**

   ```powershell
   $env:WEB_PORT = '3100'
   $env:NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3101/api/v1'
   pnpm --filter @room/web dev
   ```

   Wait until `http://127.0.0.1:3100/health` returns 200.

5. **Worker operating model — read this carefully.**

   The Phase 6B worker runs continuously by default. It owns two
   independent jobs:

   - `HOLD_EXPIRATION` — expires stale booking holds older than 15 minutes.
   - `OUTBOX_DELIVERY` — claims pending outbox events and delivers them
     via SMTP through Mailpit.

   Both jobs use bounded exponential backoff on failure (initial
   `WORKER_ERROR_BACKOFF_MS`, capped at `WORKER_MAX_ERROR_BACKOFF_MS`).
   The same job can never overlap with itself; a slow iteration blocks
   the next scheduling tick but does not stack pending executions.

   For the demo, start the worker once and leave it running. Any outbox
   event created by the API will be picked up on the next outbox tick
   (default `WORKER_OUTBOX_INTERVAL_MS=2000`):

   ```powershell
   pnpm --filter @room/worker dev
   ```

   The worker stays up until you send SIGINT/SIGTERM (Ctrl+C). On signal
   it drains the active iteration before closing the database pool,
   Redis client, and SMTP transport.

   The legacy one-shot mode is still supported for debugging and recovery
   scripts:

   ```powershell
   pnpm --filter @room/worker dev:once
   ```

   `dev:once` runs one `expireStaleHolds` + one `processOutbox` iteration
   and exits 0. **Do not start a one-shot worker for the demo** — the
   API will keep producing outbox events after it exits.

## Manual demo sequence

Open `http://127.0.0.1:3100` in a browser, then:

1. Open the public quote flow and create or find a fifteen-minute quote.
2. Open the quote; you should see the booking HOLD panel.
3. Enter a contact (full name, email, phone in E.164).
4. Submit the HOLD; record the booking code from the response.
5. Note the booking code (it is also shown on the page).
6. Click "Request OTP".
7. The continuous worker is already running (step 5). It will pick up the
   queued outbox event on the next `WORKER_OUTBOX_INTERVAL_MS` tick and
   deliver the OTP email. Wait up to a few seconds.
8. Open Mailpit at `http://127.0.0.1:8025` and confirm the OTP email was
   delivered. Record the 6-digit code.
9. Enter the OTP and challenge reference on the verify panel and submit.
   The browser should now set `rm_guest_session_v1` and route to the
   booking detail page.
10. Inspect the booking detail page (masked email and phone, HOLD status,
    hold expiry).
11. Click "Logout". The cookie is cleared; the booking detail page
    returns to the OTP request step.

## Automated demo

The vertical Playwright flow drives the entire stack — it boots the API on
3101, the web app on 3100, and a **continuous worker process** that owns
the outbox/expiration iterations. The vertical spec does not spawn any
one-shot worker after the OTP request; the continuous worker delivers the
OTP email on its own.

```powershell
node scripts/run-playwright.mjs
```

Expected outcome:

- A disposable `room_management_test_<uuid>` database is created from
  `TEST_DATABASE_URL`, migrated, seeded, and torn down.
- The vertical spec `tests/e2e/public-booking-vertical-flow.spec.ts` plus
  the admin/auth specs run with `--workers=1` and `--retries=0`.
- The focused one-shot smoke `tests/e2e/worker-oneshot.spec.ts` verifies
  that `WORKER_MODE=once` still exits 0 in the same suite.
- The script prints the test counts and exits 0.

The `playwright.config.ts` `globalSetup` brings up the API, web, and
continuous worker on 3100/3101 using its own
`taskkill.exe /pid <pid> /t /f` cleanup path for the API/web and a
SIGTERM-then-force-kill path for the worker. No other process is
signalled.

## Phase 6D — Public Coupon Web (Stage I)

The customer-facing coupon flow is wired onto the existing public quote
and HOLD experience:

- An optional coupon input on the quote page sends **only** `couponCode`
  to `POST /api/v1/quotes`. Blank input omits the field.
- Server-authoritative pricing: the browser never recomputes discount or
  final amount. The quote response carries a safe `coupon` summary
  (normalized code, discount type, gross, discount, final) that the UI
  renders with the existing VND formatter and a provisional
  revalidation notice.
- Clear / Replace issues a brand-new quote. A monotonic `loadTokenRef`
  and per-request `AbortController` ensure older coupon responses cannot
  overwrite newer ones.
- HOLD and the cookie-authenticated booking detail return the same safe
  coupon summary. HOLD-time coupon revalidation failures surface as safe
  problem codes (`COUPON_REQUOTE_REQUIRED`, `COUPON_EXPIRED`,
  `COUPON_HOLD_WINDOW_INCOMPATIBLE`, `COUPON_MINIMUM_NOT_MET`,
  `COUPON_LIMIT_REACHED`, `COUPON_CUSTOMER_LIMIT_REACHED`,
  `COUPON_NOT_APPLICABLE`, `COUPON_NOT_FOUND_OR_UNAVAILABLE`) without
  exposing quota, digest, UUIDs, or another customer's state.
- A coupon revalidation failure never produces an undiscounted HOLD and
  never auto-retries. Stale-HOLD cleanup retry retains its separate
  mapping.
- The coupon code never lands in `localStorage`, `sessionStorage`, or the
  URL. Non-coupon search context stays in query params so the quote page
  can reissue a fresh quote on coupon changes.
- Real desktop and `390x844` mobile Playwright vertical flows plus an
  ADMIN-disable-before-HOLD scenario live in
  `tests/e2e/phase6d-public-coupon.spec.ts`.

Payment, ADMIN coupon Web, MoMo/VNPAY, refund restoration, and
production SMTP/TLS remain deferred. Migrations `0000`–`0010` and
Drizzle metadata are not modified.

## Troubleshooting

### Port already occupied

Identify the owner first:

```powershell
Get-NetTCPConnection -LocalPort 3100,3101 -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess,
    @{N='Process';E={(Get-Process -Id $_.OwningProcess -EA SilentlyContinue).ProcessName}},
    @{N='CommandLine';E={(Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" -EA SilentlyContinue).CommandLine}}
```

Stop only the PIDs you (or the previous Playwright run) started. Do **not**
call `Stop-Process -Name node` — that would also kill the QLLaw process
listening on 3000/3001.

### API unavailable

Confirm `API_PORT=3101` in the API shell and that
`http://127.0.0.1:3101/api/v1/health/live` returns 200. If not, check the
`.env` file and re-run `pnpm --filter @room/api dev`.

### Mailpit unavailable

`docker compose ps` should show `roommanagement-mailpit-1` as healthy on
1025/8025. **Do not recreate volumes** — that would wipe Mailpit
configuration. Restart with `docker compose restart mailpit` if needed.

### No OTP email

The continuous worker is not running, or the outbox event was claimed
before the worker connected. Confirm the worker process is up:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'with-local-env.mjs.*worker' }
```

If it is not running, start it:

```powershell
pnpm --filter @room/worker dev
```

The worker logs `worker.started` as soon as dependencies are connected
and the scheduler begins executing. Once it is up, re-trigger the OTP
request flow — the next outbox tick will deliver the email.

### Expired HOLD

`BOOKING_HOLD_DURATION_MS` is 15 minutes (900 000 ms). If a HOLD has
expired, create a new quote and try again. The booking code on the expired
HOLD will no longer be usable.

### Stale disposable database

Playwright creates and disposes `room_management_test_<uuid>` databases
under `TEST_DATABASE_URL`. Never touch the persistent `room_management`
database during the demo. If the disposable test DB looks stale, run:

```powershell
pnpm --filter @room/database db:test
```

This script provisions, migrates, exercises and disposes a fresh disposable
database.

### Identifying execution-owned PIDs safely

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'Room Management' }
```

This lists only the `node.exe` processes whose working directory contains
`Room Management`. The QLLaw node processes use `QLLaw-main` and are not
returned. Never use a blanket `Stop-Process -Name node`.

## Quality baseline at Phase 6D closeout (HEAD `5a806a0`)

- Configured `pnpm lint` (turbo over 11 packages) and
  `pnpm typecheck` both pass with exit 0.
- Every Phase 6D changed file (40 in `abf16be..HEAD`) passes
  targeted Prettier.
- Every Phase 6D changed test file (13) passes targeted ESLint with
  vitest/playwright globals configured for the new
  `apps/web/eslint.config.mjs` and `tests/eslint.config.mjs`.
- `pnpm format:check` still reports 80 pre-existing baseline files
  flagged outside Phase 6D. These are pre-existing format debt, not
  part of Phase 6D closeout.
- Repository-wide lint coverage is still incomplete:
  `@room/web` and `@room/booking` package lint only cover `src`;
  `scripts/*.mjs` is not owned by a workspace lint command; root
  `tests/e2e` and the web test directory were added targeted-only in
  this closeout and still depend on the new test configs.
- `pnpm audit --prod --audit-level=high` exits 0 — zero high
  advisories. One moderate and one low `esbuild` advisory remain
  (better-auth → drizzle-kit → esbuild path; no upstream fix
  available inside the Phase 6D scope).
- Rollback must use `git revert` newest-first; do not use
  `git reset --hard`.

## Prohibited shortcuts

- `git reset --hard`, `git clean -fdx`, `git stash --include-untracked`.
- `Stop-Process -Name node` or any blanket kill.
- `docker compose down -v`, `docker volume rm`, `docker system prune -a`.
- Editing `.env` with real credentials, real OTP secrets, or real
  customer emails/phones.
- Touching port 3001 (QLLaw).
