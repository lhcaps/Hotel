# Phase 5 Demo Handoff

This document is the entry point for any new developer who needs to run
or extend the Phase 5 vertical slice. It assumes a fresh Windows machine
with Node 24 LTS, pnpm 10.x and Docker Desktop.

> **Port 3001 belongs to the unrelated QLLaw project.** Never signal the
> process listening on `127.0.0.1:3001`. Identify owners with
> `Get-NetTCPConnection` and only act on the PIDs you (or Playwright)
> started.

## Repository

Two commits matter in this branch, plus the Phase 6B closure commit:

- **Stage B implementation evidence HEAD** — `e6a5a56` (`feat(worker): replace
one-shot loop with scheduler-driven worker`). This is the committed
  scheduler-driven worker that the vertical Playwright gate now exercises.
- **Dependency remediation HEAD** — `a74f6b1` (`chore(deps): patch phase 5
high-severity advisories`). Patches `next`, `nodemailer`, and
  `find-my-way`.
- **Implementation evidence HEAD** — `1a552ee` (`fix(e2e): stabilize
public booking vertical flow`). The legacy stabilization commit whose
  401-vs-200 race fix is retained by the Phase 6B closure.
- **Repository final documentation HEAD** — the closure commit that
  updates `phase-5-demo.md`, `phase-5.md`, `phase-5-demo-handoff.md`,
  `phase-5-final-audit.md`, and `.env.example`.

Do not check out `1a552ee` and call it the Final HEAD. The Final HEAD is
the closure commit, on top of `a74f6b1` and `e6a5a56`.

| Item                                | Value                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Branch                              | `phase5-booking-hold-guest-access`                                             |
| Stage B implementation HEAD         | `e6a5a56` (`feat(worker): replace one-shot loop with scheduler-driven worker`) |
| Dependency remediation HEAD         | `a74f6b1` (`chore(deps): patch phase 5 high-severity advisories`)              |
| Implementation evidence HEAD        | `1a552ee` (`fix(e2e): stabilize public booking vertical flow`)                 |
| Repository final documentation HEAD | the closure commit (current branch HEAD)                                       |
| Final audit evidence correction     | `f11f49e` (`docs: correct phase 5 final audit evidence`)                       |
| Stabilization commit                | `1a552ee` (`fix(e2e): stabilize public booking vertical flow`)                 |
| Original Task 10 commit             | `c60e2cd` (`docs: close phase 5 demo audit and handoff`)                       |
| Task 9 commit                       | `8960b09` (`feat(contracts): publish phase 5 public booking api`)              |
| Task 8 commit                       | `ca51b17` (`feat(web): add public booking hold and guest access flow`)         |
| Task 7 commit                       | `84dd383` (`feat(api): add public booking and guest access endpoints`)         |
| Task 6 commit                       | `5186cc4` (`feat(worker): deliver transactional outbox emails through smtp`)   |
| OTP email commit                    | `f4e0801` (`feat(worker): deliver booking otp challenge emails`)               |
| Task 5 commit                       | `5f630d4` (`feat(worker): expire stale booking holds atomically`)              |
| Task 4 commit                       | `801b7f0` (`test(booking): prove critical allocation concurrency`)             |
| Task 3 atomic HOLD closure          | `4f77ffb` (`fix(booking): close final phase 5 task 3 audit defects`)           |
| Phase 5 functional baseline         | `ca51b17`                                                                      |
| Phase 5 foundation                  | `84dd383`                                                                      |
| Migration baseline                  | `7698353`                                                                      |

## Port map

| Port | Owner                   | Notes                                  |
| ---- | ----------------------- | -------------------------------------- |
| 5432 | PostgreSQL 18 (Docker)  | persistent volume                      |
| 6379 | Redis 8 (Docker)        | persistent volume                      |
| 1025 | Mailpit SMTP (Docker)   | ephemeral                              |
| 8025 | Mailpit HTTP UI         | ephemeral                              |
| 3100 | `@room/web` Next.js dev | brought up by Playwright `globalSetup` |
| 3101 | `@room/api` NestJS dev  | brought up by Playwright `globalSetup` |
| 3000 | QLLaw web               | do not touch                           |
| 3001 | QLLaw API               | do not touch                           |

## Startup sequence

1. `docker compose up -d` — boots postgres, redis, mailpit.
2. `pnpm db:status` then `pnpm db:migrate`.
3. API on 3101: `pnpm --filter @room/api dev` (with `API_PORT=3101`,
   `WEB_ORIGIN=http://127.0.0.1:3100`, `AUTH_BASE_URL=http://127.0.0.1:3101`).
4. Web on 3100: `pnpm --filter @room/web dev` (with
   `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3101/api/v1`).
5. Worker: `pnpm --filter @room/worker dev` (continuous; with the
   `WORKER_OUTBOX_INTERVAL_MS` default of 2000 ms, the worker picks up
   every outbox event on its own without manual re-invocation). One-shot
   `pnpm --filter @room/worker dev:once` remains supported for recovery
   scripts.

## Environment variables

See [`.env.example`](../../.env.example) for the full list. Notable
secrets (placeholder values only) used by the API, web, and worker:

- `BETTER_AUTH_SECRET`
- `GUEST_OTP_SECRET`
- `GUEST_CHALLENGE_REF_SECRET`
- `GUEST_SESSION_SECRET`
- `BOOKING_IP_DIGEST_SECRET`
- `DATABASE_URL`, `TEST_DATABASE_URL`, `REDIS_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`

Each booking secret must be at least 32 characters; the API refuses to
start otherwise.

## Worker operating model

`apps/worker/src/main.ts` runs the worker in one of two explicit modes,
selected by `WORKER_MODE`:

- `WORKER_MODE=continuous` (default) — `WorkerScheduler` runs
  `HOLD_EXPIRATION` and `OUTBOX_DELIVERY` on independent intervals
  (`WORKER_EXPIRATION_INTERVAL_MS`, `WORKER_OUTBOX_INTERVAL_MS`). Each
  job uses bounded exponential backoff
  (`WORKER_ERROR_BACKOFF_MS`, `WORKER_MAX_ERROR_BACKOFF_MS`). Same-job
  overlap is prevented via a per-job `inFlight` flag. SIGINT/SIGTERM
  drain the active iteration, abort pending waits, and emit
  `scheduler.completed` before the lifecycle closes the SMTP transport,
  Redis client, and database pool. Multiple instances are safe because
  the outbox uses claim-and-lease and `expireStaleHolds` uses
  `FOR UPDATE SKIP LOCKED`.
- `WORKER_MODE=once` — runs one `expireStaleHolds` iteration followed by
  one `processOutbox` iteration, then exits 0. The recovery / debugging
  mode. **Not** the runtime mode.

The Playwright-owned vertical flow runs against a continuous worker
started by `playwright.config.ts` `globalSetup`; the vertical spec does
not spawn any one-shot worker after the OTP request. A focused
`tests/e2e/worker-oneshot.spec.ts` keeps the explicit one-shot mode
under CI.

```bash
pnpm --filter @room/worker dev         # continuous (default)
pnpm --filter @room/worker dev:once    # one-shot
pnpm --filter @room/worker start       # continuous (built dist)
```

## Worker configuration

| Knob                            | Default      | Unit     | Notes                                                 |
| ------------------------------- | ------------ | -------- | ----------------------------------------------------- |
| `WORKER_MODE`                   | `continuous` | enum     | `continuous` or `once`. Invalid values fail fast.     |
| `WORKER_OUTBOX_INTERVAL_MS`     | `2000`       | ms (≥50) | Outbox polling cadence in continuous mode.            |
| `WORKER_EXPIRATION_INTERVAL_MS` | `30000`      | ms (≥50) | Hold-expiration cadence in continuous mode.           |
| `WORKER_ERROR_BACKOFF_MS`       | `1000`       | ms (≥50) | Initial backoff after a job failure.                  |
| `WORKER_MAX_ERROR_BACKOFF_MS`   | `60000`      | ms (≥50) | Backoff ceiling. Must be `≥ WORKER_ERROR_BACKOFF_MS`. |

All five knobs are validated by `requireWorkerOperationalConfig` at
process start. Invalid values fail before any resource is constructed,
so a misconfigured worker cannot open a database pool or SMTP
transport. The Playwright-owned worker uses shorter intervals
(`WORKER_OUTBOX_INTERVAL_MS=250`, `WORKER_EXPIRATION_INTERVAL_MS=1000`,
`WORKER_ERROR_BACKOFF_MS=100`, `WORKER_MAX_ERROR_BACKOFF_MS=1000`) to
keep the vertical flow fast. **Do not use the Playwright values as
production defaults.**

## Playwright command

For the full suite (admin + public vertical + foundation + quotes),
using the wrapper that also sets the admin bootstrap password:

```bash
PLAYWRIGHT_BETTER_AUTH_SECRET="local-dev-only-secret-with-at-least-thirty-two-characters" \
  node scripts/run-playwright.mjs
```

The script:

1. Boots the API on 3101, the web on 3100, and a **continuous worker**
   via `globalSetup`.
2. Creates and migrates a disposable `room_management_test_<uuid>` DB.
3. Runs the vertical flow plus admin specs plus the focused one-shot
   smoke.
4. Tears down its own servers and the disposable DB. The worker is
   SIGTERM'd first (graceful drain) and only force-killed if it does
   not exit within the bounded timeout.
5. Exits 0.

For the vertical spec invocation (the exact committed command in this
audit):

```bash
PLAYWRIGHT_BETTER_AUTH_SECRET="local-dev-only-secret-with-at-least-thirty-two-characters" \
PLAYWRIGHT_ADMIN_PASSWORD="<32+ char random password>" \
  pnpm exec playwright test \
    tests/e2e/public-booking-vertical-flow.spec.ts \
    --workers=1 --retries=0 --reporter=line
```

The `PLAYWRIGHT_ADMIN_PASSWORD` env var is required even though the
vertical spec itself does not exercise the admin flow — the
`globalSetup` calls `admin:bootstrap` before launching the servers.

## E2E stability result (this audit)

The committed direct command (`pnpm exec playwright test
tests/e2e/public-booking-vertical-flow.spec.ts --workers=1 --retries=0
--reporter=line`) was run three consecutive times from the audited
HEAD. Result: **3/3 desktop PASS, 3/3 mobile PASS**.

A pre-fix observation recorded in the audit's §16 showed the test
failing 1/3 desktop on the original `c60e2cd` HEAD with the failure
isolated to the post-logout credentialed GET. Root cause: the test
fired the GET before awaiting the in-flight logout POST, so on fast
machines the GET arrived before the session was revoked and the cookie
cleared. The stabilization commit `1a552ee` adds a
`page.waitForResponse(...)` for the logout endpoint, mirroring the
sequencing already used for hold, OTP request, and OTP verify. After
the fix, three consecutive runs all pass.

## Mailpit procedure

Mailpit's HTTP UI is at `http://127.0.0.1:8025`. Each message in the
demo is rendered with a fresh Mailpit-internal id; the API never
references the Mailpit API. To inspect the OTP body of a freshly
delivered message:

```bash
curl -s http://127.0.0.1:8025/api/v1/messages | jq '.messages[0].ID'
curl -s http://127.0.0.1:8025/api/v1/message/<id> | jq '.MIME.Parts[].Body'
```

Playwright deletes only its own messages between runs.

## Core routes

| Route                                      | Method | Notes                                     |
| ------------------------------------------ | ------ | ----------------------------------------- |
| `/api/v1/availability/search`              | POST   | Public availability search.               |
| `/api/v1/quotes`                           | POST   | Create immutable quote (15 min TTL).      |
| `/api/v1/quotes/{id}`                      | GET    | Fetch immutable quote.                    |
| `/api/v1/public/quotes/{quoteId}/bookings` | POST   | Create booking HOLD.                      |
| `/api/v1/public/guest-access/otp/request`  | POST   | Request OTP challenge.                    |
| `/api/v1/public/guest-access/otp/verify`   | POST   | Verify OTP, mint session cookie.          |
| `/api/v1/public/bookings/{bookingCode}`    | GET    | Booking detail (cookie auth).             |
| `/api/v1/public/booking-holds/status`      | POST   | HOLD status probe (HOLD/EXPIRED/UNKNOWN). |
| `/api/v1/public/guest-access/logout`       | POST   | Clear cookie, revoke session.             |

Full matrix: [`docs/contracts/routes.md`](../contracts/routes.md).
Public errors: [`docs/contracts/errors.md`](../contracts/errors.md).

## Cookie name

`rm_guest_session_v1`

| Attribute  | Value                                         |
| ---------- | --------------------------------------------- |
| `HttpOnly` | always                                        |
| `SameSite` | `Lax`                                         |
| `Secure`   | when `NODE_ENV === 'production'`              |
| `Path`     | `/`                                           |
| `Max-Age`  | `GUEST_SESSION_TTL_MS` (default 1800 seconds) |

## Schema version

`phase-6-coupon-core-v3`.

The current schema version lives in
`packages/database/src/schema-status.ts` and is recorded in
`schema_metadata.schema_version` row id=1. If `pnpm db:check` reports
`actualVersion !== expectedVersion`, re-run `pnpm --filter
@room/database db:migrate`. Migrations 0000–0010 cover the schema
baseline and are not modified by Phase 6C/6D; no new migration is
required for the public Web flow changes.

## Current state — Phase 6D Public Coupon Web (Stage I)

The branch now exposes the optional customer-facing coupon flow on top of
the accepted Phase 6C core:

- An optional coupon input on `/booking/quote/[quoteId]` accepts the raw
  user-entered code and submits **only** `couponCode` to `POST /api/v1/quotes`.
  Blank input omits the field entirely.
- The browser never computes discount or final amount. The quote response
  carries a safe `coupon` summary (normalized display code, discount
  type, gross, discount, final) that the UI renders verbatim with the
  existing VND formatter and a provisional revalidation notice.
- A monotonic `loadTokenRef` + per-request `AbortController` pattern
  suppresses stale coupon responses from overwriting newer ones. Clear
  and replace reissue the quote rather than mutating an existing one.
- HOLD and guest-authenticated detail responses expose the same safe
  coupon summary through the contract schema. The HOLD service maps the
  accepted coupon domain errors (`COUPON_REQUOTE_REQUIRED`,
  `COUPON_EXPIRED`, `COUPON_HOLD_WINDOW_INCOMPATIBLE`,
  `COUPON_MINIMUM_NOT_MET`, `COUPON_LIMIT_REACHED`,
  `COUPON_CUSTOMER_LIMIT_REACHED`, `COUPON_NOT_APPLICABLE`,
  `COUPON_NOT_FOUND_OR_UNAVAILABLE`) to safe problem codes without
  exposing quota, digest, or UUIDs.
- HOLD requote/no-fallback behaviour is enforced: a coupon revalidation
  failure never produces an undiscounted HOLD and never auto-retries.
  Stale-HOLD cleanup retry retains its separate mapping.
- The coupon code never lands in `localStorage`, `sessionStorage`, or
  the URL. Search context is propagated through non-coupon query params
  so the quote page can reissue a fresh quote on coupon changes.
- A real desktop and `390x844` mobile Playwright vertical scenario plus
  an ADMIN-disable-before-HOLD scenario are committed in
  `tests/e2e/phase6d-public-coupon.spec.ts`.

Payment, ADMIN coupon Web, MoMo/VNPAY, refund restoration, and
production SMTP/TLS remain deferred. Migrations `0000`–`0010` and
Drizzle metadata are unchanged.

## Latest accepted commits

| SHA       | Message                                                            |
| --------- | ------------------------------------------------------------------ |
| closure   | `fix(worker): close continuous scheduler acceptance gaps`          |
| `e6a5a56` | `feat(worker): replace one-shot loop with scheduler-driven worker` |
| `a74f6b1` | `chore(deps): patch phase 5 high-severity advisories`              |
| `0a5e80a` | `docs: correct phase 5 retry and contact-storage facts`            |
| `f11f49e` | `docs: correct phase 5 final audit evidence`                       |
| `1a552ee` | `fix(e2e): stabilize public booking vertical flow`                 |
| `c60e2cd` | `docs: close phase 5 demo audit and handoff`                       |
| `8960b09` | `feat(contracts): publish phase 5 public booking api`              |
| `ca51b17` | `feat(web): add public booking hold and guest access flow`         |
| `84dd383` | `feat(api): add public booking and guest access endpoints`         |
| `f4e0801` | `feat(worker): deliver booking otp challenge emails`               |
| `5186cc4` | `feat(worker): deliver transactional outbox emails through smtp`   |
| `5f630d4` | `feat(worker): expire stale booking holds atomically`              |
| `801b7f0` | `test(booking): prove critical allocation concurrency`             |
| `4f77ffb` | `fix(booking): close final phase 5 task 3 audit defects`           |
| `7698353` | Phase 0–4 migration baseline                                       |

## Files owning each subsystem

| Subsystem                         | Primary files                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public quote + HOLD API           | `apps/api/src/booking/booking-hold.controller.ts`, `apps/api/src/booking/services/booking-hold.service.ts`                                                         |
| Booking HOLD transaction (Task 3) | `packages/booking/src/services/create-booking-hold.ts`, `packages/booking/src/repository/booking-repository.ts`, `packages/booking/src/repository/availability.ts` |
| OTP request                       | `apps/api/src/booking/guest-access-otp.controller.ts`, `apps/api/src/booking/services/guest-access-otp-request.service.ts`                                         |
| OTP verify                        | `apps/api/src/booking/guest-access-otp.controller.ts`, `apps/api/src/booking/services/guest-access-otp-verify.service.ts`                                          |
| Booking detail                    | `apps/api/src/booking/booking-detail.controller.ts`, `apps/api/src/booking/services/booking-detail.service.ts`                                                     |
| Logout                            | `apps/api/src/booking/guest-access-logout.controller.ts`                                                                                                           |
| HOLD status                       | `apps/api/src/booking/booking-hold-status.controller.ts`                                                                                                           |
| Session cookie                    | `apps/api/src/booking/cookie.ts`, `apps/api/src/booking/services/guest-session.service.ts`                                                                         |
| Outbox writer                     | `packages/booking/src/repository/booking-repository.ts` (`enqueueHoldConfirmation`) — same transaction as the booking insert                                       |
| Outbox worker                     | `apps/worker/src/main.ts`, `apps/worker/src/jobs/process-outbox.ts`, `apps/worker/src/email/`                                                                      |
| HOLD email template               | `apps/worker/src/email/templates/hold-confirmation.ts`                                                                                                             |
| OTP email template                | `apps/worker/src/email/templates/otp-challenge.ts`                                                                                                                 |
| Public UI                         | `apps/web/src/app/booking/*`, `apps/web/src/components/booking-detail-panel.tsx`, `apps/web/src/components/otp-{request,verify}-panel.tsx`                         |
| Expiration job                    | `apps/worker/src/jobs/expire-stale-holds.ts`                                                                                                                       |
| Error envelope                    | `apps/api/src/errors/problem-details.filter.ts`                                                                                                                    |
| Schemas                           | `packages/contracts/src/booking/*`                                                                                                                                 |
| Migrations                        | `packages/database/drizzle/0005_*.sql`, `packages/database/drizzle/0006_*.sql`                                                                                     |

## Test counts (independent package suites)

| Package                                      | Tests               |
| -------------------------------------------- | ------------------- |
| `@room/contracts`                            | 257                 |
| `@room/database` (integration via `db:test`) | 54                  |
| `@room/booking`                              | 106                 |
| `@room/worker`                               | 106                 |
| `@room/api` (unit)                           | 118                 |
| `@room/api` (integration)                    | 21                  |
| `@room/web` (unit)                           | 43                  |
| `@room/web` (Playwright main config)         | 13 tests / 12 specs |
| `@room/web` (Playwright unavailable config)  | 1 test / 1 spec     |

Booking and worker suites are NOT covered by the API integration
suite; they have their own `test:unit` scripts and exercise their own
modules directly.

## Known debt

- **Dependency advisories** — patched in `a74f6b1` (next, nodemailer,
  find-my-way). The audit log records 0 high advisories post-patch.
- **Manual worker re-invocation** — re-invocation is no longer required
  for the demo; the continuous worker handles every outbox event on its
  own. The continuous scheduler is `e6a5a56`.
- **Mailpit retention** — Mailpit only retains messages within the
  container session. Do not rely on it for long-term email storage.
- **Prettier baseline debt** — pre-existing files flagged by
  `prettier --check`. Not modified by Phase 5; will be cleaned up
  together with the next dependency upgrade.
- **At-least-once duplicate-send window** — a worker crash after SMTP
  send but before the outbox row is marked delivered will re-send on the
  next tick. The outbox lease prevents two concurrent workers from
  sending the same email simultaneously; a single worker's
  crash/recovery path remains the accepted at-least-once window.
- **Residual moderate/low dependency debt** — see
  `pnpm audit --prod --audit-level=high` for the current high count.
- **`apps/web` transient build flakes** — historical
  `/_global-error/page` failures during isolated builds; not reproduced
  in this audit (see §17 of the audit).

## Pre-deployment blockers

1. Provision a real SMTP provider.
2. Terminate TLS at the edge.
3. Add a hardened rate-limit policy at the load balancer for
   HTTP/2-related findings.
4. Run the worker under a production supervisor / orchestrator (the
   scheduler itself is committed; the supervisor is not).
5. Run under a hardened secret manager (current secrets are
   environment-only).

## Phase 6 status snapshot (closeout HEAD `5a806a0`)

Accepted:

- Phase 6C — Coupon core (entry, validation, application, immutability).
- Phase 6D — Public Coupon Web (Stage I: quote + HOLD + detail coupon
  summary, desktop + mobile + admin-disable Playwright evidence,
  OpenAPI snapshot regenerated, migrations 0000–0010 unchanged,
  Drizzle metadata unchanged).

Remaining (not started):

- ADMIN coupon Web.
- Payment gateways (MoMo, VNPAY).
- Refund restoration.
- Google OAuth and customer profile.
- Production deployment (cloud, secrets manager, TLS).
- Translation and locale resolution.
- Admin UX redesign and concurrency hardening (10+ simultaneous
  HOLDs).
- Dependency upgrades (`next`, `nodemailer`, `find-my-way` carry
  moderate/low esbuild advisory — see Stage G debt).

## Prohibited shortcuts

- `git reset --hard`, `git clean -fdx`, `git stash --include-untracked`.
- `git reset --hard origin/phase5-booking-hold-guest-access`.
- `Stop-Process -Name node` or any blanket kill.
- `taskkill.exe /im node.exe /f`.
- `docker compose down -v`, `docker volume rm`, `docker system prune`.
- Editing `.env` with real credentials, real OTP secrets, or real
  customer emails/phones.
- Touching port 3001 (or sending a signal to any process listening on
  3000–3001).
- GitHub push, PR creation, or deployment.
- Rewriting migrations 0000–0006.
- `pnpm-lock.yaml` upgrades (Phase 6 territory).

## Rollback commands

Revert newest first. Each `git revert` creates a fresh commit that
undoes the prior one — `git revert` is non-destructive and preserves
history.

```bash
# Newest first: closure → scheduler → security remediation → docs correction → final audit evidence → stabilization → Task 10 audit → Task 9
git revert HEAD
git revert e6a5a56
git revert a74f6b1
git revert 0a5e80a
git revert f11f49e
git revert 1a552ee
git revert c60e2cd
git revert 8960b09
```

Newest-first ordering is required: a single `git revert` produces a
commit whose working tree is `parent + (-diff)`. Reverting older
commits first while leaving newer commits in place would produce
conflicting content on follow-up reverts. Reverting newest-first keeps
each revert clean.

Use `git log --oneline -6` to retrieve the most recent commit SHAs.
After all five reverts succeed, the working tree is restored to the
`ca51b17` Phase 5 functional baseline. Migrations 0000–0006 are not
modified by any of these commits, so no migration rollback is required.

There is no sanctioned `git reset --hard` path. All rollback flows
must use `git revert`. `git reset --hard` is destructive — it discards
the documentation commits and rewrites the working tree, which makes
the corrected audit and handoff unrecoverable on this branch.

## Operational entry points

| Need                           | File                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Demo step-by-step              | [`docs/runbooks/phase-5-demo.md`](../runbooks/phase-5-demo.md)                                                       |
| Operational knobs and defaults | [`docs/runbooks/phase-5.md`](../runbooks/phase-5.md)                                                                 |
| Route matrix                   | [`docs/contracts/routes.md`](../contracts/routes.md)                                                                 |
| Public errors                  | [`docs/contracts/errors.md`](../contracts/errors.md)                                                                 |
| Final audit                    | [`docs/audit/phase-5-final-audit.md`](../audit/phase-5-final-audit.md)                                               |
| OpenAPI artifacts              | [`docs/openapi/admin-v1.json`](../openapi/admin-v1.json), [`docs/openapi/public-v1.json`](../openapi/public-v1.json) |

## Phase 6C/6D addendum

The public HOLD pipeline now accepts an optional coupon at quote time
and revalidates it inside the booking transaction. The `coupon` summary
object is exposed on the public quote, the HOLD response, and the
booking-detail response with the same safe shape. The Web flow keeps
the coupon code on the server only — no URL, no localStorage, no
sessionStorage. Adding or clearing a coupon navigates the user to a
new quote URL; the old quote is never mutated in place.

A focused Playwright spec, `tests/e2e/phase6d-public-coupon.spec.ts`,
exercises the desktop vertical flow, the mobile vertical flow, and an
admin-disable-before-HOLD scenario. The desktop flow runs in the same
continuous-worker environment as the Phase 5 vertical flow; no
additional infrastructure is required. The Playwright handoff pattern
(OTP mail via Mailpit, masked contact on detail, logout, 401) is
retained end-to-end.
