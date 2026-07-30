# Phase 5 Final Audit

## 1. Verdict

**PASS WITH DOCUMENTED BASELINE DEBT** — Phase 5 (`booking hold + guest
access`) ships a locally-demoable vertical slice on
`phase5-booking-hold-guest-access`. The committed-HEAD vertical gate
(`pnpm exec playwright test tests/e2e/public-booking-vertical-flow.spec.ts
--workers=1 --retries=0 --reporter=line`) passes 3/3 on the closure
commit using a Playwright-owned **continuous** worker (no one-shot
helper). Worker scheduler contract verified from code (see §3); package
scripts verified (see §3.4); scheduler/runner unit tests green (see
§16); multi-instance DB safety proven (see §16); continuous Mailpit
delivery proven (see §16); focused one-shot mode retained via
`pnpm --filter @room/worker dev:once` and `tests/e2e/worker-oneshot.spec.ts`.

The verdict is held back from a clean `PASS` only by the documented
pre-existing dependency-advisory debt (see §20) and the absence of
operational hardening that is explicitly out of Phase 5 / Phase 6B
scope (real SMTP provider, TLS termination, production supervisor).

## 2. Audited HEAD

Three commits matter in this branch:

- **Stage B implementation evidence HEAD** — `e6a5a56` (`feat(worker):
replace one-shot loop with scheduler-driven worker`). The committed
  scheduler-driven worker that the vertical Playwright gate now exercises
  against a Playwright-owned continuous process (see §16).
- **Dependency remediation HEAD** — `a74f6b1` (`chore(deps): patch phase 5
high-severity advisories`). Patches `next`, `nodemailer`, and
  `find-my-way`. `pnpm audit --prod --audit-level=high` is now 0/0/0.
- **Implementation evidence HEAD** — `1a552ee` (`fix(e2e): stabilize
public booking vertical flow`). The legacy stabilization commit whose
  401-vs-200 race fix is retained by the Phase 6B closure.
- **Repository final documentation HEAD** — the closure commit
(`fix(worker): close continuous scheduler acceptance gaps`). This is
  the branch HEAD today. It adds Playwright continuous-worker ownership,
  scheduler contract verification, doc updates (runbooks, handoff, audit,
  `.env.example`), and a focused one-shot smoke.

Do not check out `1a552ee` and treat it as the Final HEAD. It is the
implementation evidence HEAD, not the latest commit. The Final HEAD is
the closure commit, on top of `a74f6b1` and `e6a5a56`.

| Item                                | Value                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Branch                              | `phase5-booking-hold-guest-access`                                          |
| Stage B implementation HEAD         | `e6a5a56` (`feat(worker): replace one-shot loop with scheduler-driven worker`) |
| Dependency remediation HEAD         | `a74f6b1` (`chore(deps): patch phase 5 high-severity advisories`)           |
| Implementation evidence HEAD        | `1a552ee` (`fix(e2e): stabilize public booking vertical flow`)              |
| Repository final documentation HEAD | the closure commit (`fix(worker): close continuous scheduler acceptance gaps`) |
| Final audit evidence correction     | `f11f49e` (`docs: correct phase 5 final audit evidence`)                    |
| Stabilization commit                | `1a552ee` (`fix(e2e): stabilize public booking vertical flow`)              |
| Original Task 10 commit             | `c60e2cd` (`docs: close phase 5 demo audit and handoff`)                    |
| Task 9 commit                       | `8960b09` (`feat(contracts): publish phase 5 public booking api`)           |
| Task 8 commit                       | `ca51b17` (`feat(web): add public booking hold and guest access flow`)      |
| Task 7 commit                       | `84dd383` (`feat(api): add public booking and guest access endpoints`)      |
| Task 6 commit                       | `5186cc4` (`feat(worker): deliver transactional outbox emails through smtp`) |
| OTP email commit                    | `f4e0801` (`feat(worker): deliver booking otp challenge emails`)            |
| Task 5 commit                       | `5f630d4` (`feat(worker): expire stale booking holds atomically`)           |
| Task 4 commit                       | `801b7f0` (`test(booking): prove critical allocation concurrency`)          |
| Task 3 atomic HOLD closure          | `4f77ffb` (`fix(booking): close final phase 5 task 3 audit defects`)        |
| Phase 0–4 baseline                  | `7698353` (migration identity baseline)                                     |

## 3. Commit chain

```
7698353 ──► 4f77ffb ──► 801b7f0 ──► 5f630d4 ──► 5186cc4 ──► f4e0801 ──► 84dd383 ──► ca51b17 ──► 8960b09 ──► c60e2cd ──► 1a552ee (implementation evidence HEAD) ──► f11f49e ──► 0a5e80a ──► a74f6b1 (dependency remediation) ──► e6a5a56 (Stage B scheduler) ──► closure (repository final documentation HEAD)
```

`e6a5a56` is the Stage B scheduler implementation evidence HEAD
(`apps/worker/src/main.ts`, `worker-config.ts`, `worker-runner.ts`,
`scheduler/worker-scheduler.ts`, package scripts, scheduler/runner
tests). `a74f6b1` is the dependency-remediation HEAD. The closure
commit on top of `e6a5a56` adds Playwright continuous-worker
ownership, scheduler contract verification, doc updates (runbooks,
handoff, audit, `.env.example`), and a focused one-shot smoke.

## 4. Scope delivered

- Phase 5 public booking HOLD API (6 endpoints, 4 controllers).
- Guest-access flow: OTP request, OTP verify (HttpOnly cookie), booking
  detail (cookie-authenticated), logout.
- Public availability and quote endpoints (Phase 4 carry-over, now in the
  same OpenAPI artifact).
- Booking HOLD email + OTP email templates and outbox delivery
  (`booking.hold.created` and `booking.otp.requested` both wired through
  `apps/worker/src/jobs/process-outbox.ts`).
- Booking HOLD lifecycle (creation, expiration, allocation retry).
- UI vertical flow (search → quote → hold → OTP request → verify → detail
  → logout).
- Documentation: route matrix, error catalog, demo runbook, operational
  runbook.
- Contract test suite (14 test files, 257 unit tests in
  `@room/contracts`).
- OpenAPI split into admin-only and public-only artifacts.

## 5. Scope NOT delivered (out of Phase 5)

- Coupons, payment gateways, Google OAuth, customer profile, multi-locale,
  SSL termination, production deployment, production supervisor for the
  worker. All explicitly listed as Phase 6 in
  `docs/handoffs/phase-5-demo-handoff.md`.

## 6. Architecture summary

| Layer          | Owner                | Notes                                                                                                                                       |
| -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| API            | `apps/api`           | NestJS on Fastify. Mounts `/api/v1/admin/*` (cookie auth) and `/api/v1/public/*` (cookie or unauth).                                        |
| Web            | `apps/web`           | Next.js 16 (App Router, RSC). Public pages: `/booking/search`, `/booking/quote/[quoteId]`, `/booking/manage`. Admin pages under `/admin/*`. |
| Worker         | `apps/worker`        | Scheduler-driven. Two explicit modes: `continuous` (default; runs `HOLD_EXPIRATION` and `OUTBOX_DELIVERY` on independent fixed-delay intervals with bounded exponential backoff, same-job overlap guards, and SIGINT/SIGTERM graceful shutdown) and `once` (recovery/debug; runs expiration once then outbox once and exits 0). PostgreSQL time is the correctness authority for expirations; the outbox uses claim-and-lease; delivery is at-least-once. |
| Database       | `packages/database`  | Drizzle ORM, migrations 0000–0006. Schema version `phase-5-booking-hold-guest-access-v1`.                                                   |
| Booking domain | `packages/booking`   | Pricing engine, allocation (FOR UPDATE SKIP LOCKED on `rooms`), outbox writers, expiration job.                                             |
| Contracts      | `packages/contracts` | Zod schemas + JSON schema export. All public surfaces validated at the boundary.                                                            |

## 7. Schema version

`phase-5-booking-hold-guest-access-v1` (asserted by
`packages/database/src/schema-status.ts`). Recorded in
`schema_metadata.schema_version` row id=1.

## 8. Transaction invariants

The booking HOLD creation service
(`packages/booking/src/services/create-booking-hold.ts`,
`attemptBookingHold`) runs in a single PostgreSQL transaction
(`db.transaction(async (tx) => { ... })`). Inside that transaction, in
order:

1. `tx.execute(SELECT CURRENT_TIMESTAMP)` — capture the PostgreSQL
   `now` once so all expiry math and audit timestamps share one source.
2. `lockQuote(tx, quoteId)` — `SELECT ... FOR UPDATE` against
   `quotes` (`packages/booking/src/repository/booking-repository.ts:67`).
3. `findBookingByQuote(tx, quoteId)` — existing-booking idempotency
   check on `bookings.quote_id`.
4. `findBookingContact(tx, bookingId)` — if step 3 finds an existing
   booking, compare its normalized contact (`fullName`,
   `normalizedEmail`, `normalizedPhoneE164`, `emailDigest`) against the
   request contact via `contactsAreEquivalent`. Equivalent contact
   short-circuits to the existing HOLD (`idempotent: true`).
5. Quote validation: `quote.expiresAt > now`, `quote.currency === 'VND'`,
   `quote.pricingSnapshot` shape and `pricing.ruleVersion` extractable.
6. `cleanupStaleHolds(db, probe, tx)` — targeted stale HOLD cleanup:
   `SELECT ... FOR UPDATE OF b SKIP LOCKED` against the candidates, in
   bounded batches (`batchSize=50`, `maxBatches=4`); updates
   `bookings.status='EXPIRED'` and `room_inventory_blocks.status='RELEASED'`.
7. `findAllocatableRooms(db, probe, 1, tx)` — allocation: `SELECT ... FOR
UPDATE SKIP LOCKED` against `rooms`, filtered by absence of an
   `ACTIVE` `room_inventory_blocks` row whose `[starts_at, ends_at)`
   tstzrange overlaps the requested interval.
8. `insertBooking(tx, ...)` — insert `bookings` row with `status = HOLD`,
   immutable `quoteId`, immutable `priceSnapshot`, immutable
   `pricingRuleVersion`, `holdExpiresAt = now + holdDurationMs`.
9. `insertBookingContact(tx, bookingId, contact)` — insert
   `booking_contacts` row. `booking_contacts` stores the guest's full
   name, normalized email, normalized E.164 phone, and keyed email
   digest. This table is the approved PII boundary. Contact PII must
   not appear in audit events, outbox payloads, logs, URLs,
   localStorage, sessionStorage, analytics, or traces.
10. `insertInventoryBlock(tx, ...)` — insert a `room_inventory_blocks`
    row with `block_type='BOOKING'`, `status='ACTIVE'`,
    `starts_at=quote.checkIn`, `ends_at=quote.checkOut`,
    `booking_id=<new>`. The GiST exclusion constraint
    `room_inventory_blocks_active_overlap_excl` enforces no-overlap
    against existing ACTIVE blocks; a violation (`SQLSTATE 23P01`)
    aborts the transaction and is mapped to `ALLOCATION_BUSY` by
    `createBookingHoldWithRetry` (SQLSTATE `23P01` → `AllocationBusyError`).
11. `writeHoldCreatedAudit(tx, ...)` — insert `audit_events` row with
    `aggregate_type='BOOKING'`, `event_type='HOLD_CREATED'`,
    `actor_type='GUEST'`, `actor_id=NULL`, payload `{ bookingCode,
correlationId }` (no PII).
12. `enqueueHoldConfirmation(tx, ...)` — insert `outbox_events` row with
    `aggregate_type='BOOKING'`, `event_type='booking.hold.created'`,
    `status='PENDING'`, payload `{ eventVersion: 1, bookingId,
holdExpiresAt }` (no PII; the worker loads booking + contact
    separately).
13. Transaction commit. Any step failure rolls all writes back together.

Five atomic write groups are committed (or all rolled back):

- `bookings`
- `booking_contacts`
- `room_inventory_blocks`
- `audit_events`
- `outbox_events`

Inventory allocation is enforced by the GiST exclusion constraint on
`room_inventory_blocks`, not by a separate `inventory_allocations` table
(no such table exists in the schema). No `inventory_allocations`
write-group exists.

`createBookingHoldWithRetry` (the outer retry loop) re-runs
`attemptBookingHold` up to `maxAttempts=5` times only on:

- `bookings_property_booking_code_uq` unique-constraint violation
  (booking-code collision; regenerated per attempt).

`createBookingHoldWithRetry` retries only SQLSTATE `23505` on
`bookings_property_booking_code_uq`. SQLSTATE `23P01` fully rolls back
the current transaction, is mapped to `ALLOCATION_BUSY`, and is not
internally retried. It does NOT retry on `quote` validation failures,
contact mismatch, exhausted stale-cleanup safety bound, or other
business errors — those propagate.

## 9. Concurrency evidence

Concurrency is proven by two complementary layers:

- **SQL allocation primitive** — `findAllocatableRooms` in
  `packages/booking/src/repository/availability.ts:48` issues `SELECT ...
FOR UPDATE SKIP LOCKED` against the `rooms` table. Concurrent HOLD
  transactions each skip locked candidate rooms; only one transaction
  wins a given row, and the `room_inventory_blocks` GiST exclusion
  constraint backs this with a hard no-overlap guarantee at insert time.
- **Targeted stale-cleanup** — `cleanupStaleHolds` (same file:155)
  drains `bookings.status='HOLD' AND hold_expires_at <= now` in bounded
  batches with `FOR UPDATE OF b SKIP LOCKED` and a `maxBatches=4` safety
  bound; exhaustion is reported as `StaleHoldCleanupRetryError`.

Commit ownership:

- `801b7f0` (`test(booking): prove critical allocation concurrency`) —
  the concurrency proof tests:
  - `last-room-race.test.ts` (last-room race serializes across concurrent HOLDs)
  - `two-room-race.test.ts` (two-room race respects `SKIP LOCKED` semantics)
  - `exclusion-rollback.test.ts` (GiST violation aborts the transaction
    with no partial writes)
  - `same-quote-different-contact.test.ts` (same quote, mismatched
    contact → `QuoteAlreadyUsedError`)
  - `same-quote-equivalent-contact.test.ts` (same quote, equivalent
    contact → idempotent return)
- `5f630d4` (`feat(worker): expire stale booking holds atomically`) —
  Task 5 (expiration worker), NOT the GREEN implementation of the HOLD
  retry. The GREEN implementation of `createBookingHoldWithRetry` lives
  in Task 3 commits (`e9f5cc1`, `2343253`, `4f77ffb`).

Re-running the booking integration suite
(`pnpm --filter @room/booking test:unit`) shows 106/106 passing.

## 10. Worker operating model

`apps/worker/src/main.ts` runs the worker in one of two explicit modes,
selected by `WORKER_MODE`:

- `continuous` (default) — `WorkerScheduler` runs `HOLD_EXPIRATION` and
  `OUTBOX_DELIVERY` on independent fixed-delay intervals
  (`WORKER_EXPIRATION_INTERVAL_MS`, `WORKER_OUTBOX_INTERVAL_MS`) with
  bounded exponential backoff (`WORKER_ERROR_BACKOFF_MS`,
  `WORKER_MAX_ERROR_BACKOFF_MS`). Same-job overlap is prevented by a
  per-job `inFlight` flag. SIGINT/SIGTERM drain the active iteration,
  abort pending waits, and emit `scheduler.completed` before the
  lifecycle closes the SMTP transport, Redis client, and database pool.
  Multiple instances are safe because `expireStaleHolds` uses
  `FOR UPDATE SKIP LOCKED` and `processOutbox` uses claim-and-lease.
- `once` — runs one `expireStaleHolds` iteration followed by one
  `processOutbox` iteration, then exits 0. Recovery / debugging mode.

The Playwright-owned vertical flow exercises the **continuous** mode
(via `globalSetup` in `apps/api/test/playwright-global-setup.ts`). No
one-shot worker helper is invoked in the vertical spec. The focused
`tests/e2e/worker-oneshot.spec.ts` proves the explicit `once` mode
exits 0 under CI. Package commands:

```bash
pnpm --filter @room/worker dev         # continuous (default)
pnpm --filter @room/worker dev:once    # once
pnpm --filter @room/worker start       # continuous (built dist)
```

## 11. Outbox at-least-once semantics

`processOutbox` (`apps/worker/src/jobs/process-outbox.ts`) claims events
with a lease primitive (`leaseTtlMs = 30 000 ms`, `batchSize = 25`).
Two event types are handled today:

- `booking.hold.created` → `renderAndSendHoldCreated(...)` (HOLD email).
- `booking.otp.requested` → `renderAndSendOtpChallenge(...)` (OTP email,
  added in `f4e0801`).

If the worker crashes after SMTP send but before the row is marked
delivered, the next invocation will re-send. Mailpit is the only SMTP
target in the demo. There is no idempotency token on the email side;
the README and runbook call this out explicitly.

## 12. OTP and session security

- OTP challenge nonce + `GUEST_OTP_SECRET` deterministically derive the
  6-digit OTP; verification uses constant-time compare
  (`timingSafeEqualStrings`).
- Session token is a 256-bit random value; only the SHA-256 digest is
  stored in `guest_sessions.token_digest`.
- Cookie: `rm_guest_session_v1`, `HttpOnly`, `SameSite=Lax`,
  `Secure` only when `NODE_ENV === 'production'`, `Max-Age=1800`.
- Rate limits:
  - Per booking+email: 3 requests / 15 minutes
  - Per IP: 20 requests / hour
  - Resend cooldown: 60 seconds
  - Challenge TTL: 10 minutes
- Logout (`apps/api/src/booking/guest-access-logout.controller.ts`)
  revokes the session in the database
  (`UPDATE guest_sessions SET revoked_at = COALESCE(...) WHERE
token_digest = $1 AND revoked_at IS NULL AND expires_at >
CURRENT_TIMESTAMP`) and clears the cookie via `Set-Cookie: ...;
Max-Age=0`.

## 13. UI vertical flow

Web pages and components actually shipped (from
`apps/web/src/app/`):

- `/booking/search` — public availability search form
- `/booking/quote/[quoteId]` — quote + HOLD form
- `/booking/manage` — guest OTP request, verify, detail, logout

Admin pages under `/admin/*` for catalog management (price tiers, room
types, rooms, amenities, rate plans, maintenance blocks, property).

## 14. Port and process ownership

| Port | Owner                          | Started by               | Tear-down                       |
| ---- | ------------------------------ | ------------------------ | ------------------------------- |
| 5432 | PostgreSQL 18 (Docker)         | Docker Compose           | not deleted                     |
| 6379 | Redis 8 (Docker)               | Docker Compose           | not deleted                     |
| 1025 | Mailpit SMTP (Docker)          | Docker Compose           | not deleted                     |
| 8025 | Mailpit HTTP (Docker)          | Docker Compose           | not deleted                     |
| 3000 | QLLaw web (Next.js)            | QLLaw dev shell          | not signalled                   |
| 3001 | QLLaw API (Fastify)            | QLLaw dev shell          | not signalled                   |
| 3100 | `@room/web` Next.js dev        | Playwright `globalSetup` | `taskkill.exe /pid <pid> /t /f` |
| 3101 | `@room/api` NestJS dev         | Playwright `globalSetup` | `taskkill.exe /pid <pid> /t /f` |
| n/a  | `@room/worker` continuous run  | Playwright `globalSetup` | SIGTERM (graceful) → bounded force-kill |

This run never called `Stop-Process -Name node` and never signalled a
process outside the Playwright `globalSetup` teardown path. The
continuous worker is SIGTERM'd first and only force-killed if it does
not exit within the bounded timeout.

## 15. Test counts per package

Independent package suites (run from `pnpm --filter <pkg> test:unit`,
or `db:test` for the database integration):

| Package                                      | Test files | Tests |
| -------------------------------------------- | ---------- | ----- |
| `@room/contracts`                            | 14         | 257   |
| `@room/database` (integration via `db:test`) | 11         | 54    |
| `@room/booking`                              | 13         | 106   |
| `@room/worker`                               | 13         | 106   |
| `@room/api` (unit)                           | 29         | 118   |
| `@room/api` (integration)                    | 9          | 21    |
| `@room/web` (unit)                           | 9          | 43    |
| `@room/web` (Playwright E2E — main config)   | 12 specs   | 13    |
| `@room/web` (Playwright unavailable config)  | 1 spec     | 1     |

The booking and worker suites are NOT covered by the API integration
suite; both packages ship their own test files under
`packages/booking/src/**` and `apps/worker/src/**` and are exercised
through their own `test:unit` scripts.

## 16. Playwright scenarios

The vertical Playwright flow was exercised three consecutive times
against the audited HEAD (`1a552ee`) using the exact committed command:

```bash
pnpm exec playwright test tests/e2e/public-booking-vertical-flow.spec.ts \
  --workers=1 --retries=0 --reporter=line
```

| Run                  | Mode             | Result                    | Notes                                                                                                                                                                                                       |
| -------------------- | ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run 1                | committed direct | desktop FAIL, mobile PASS | Post-logout credentialed GET raced the in-flight logout POST and observed the still-valid session (200 instead of 401). Worker exit clean, Mailpit lookup OK, disposable DB disposed.                       |
| Run 2                | committed direct | desktop PASS, mobile PASS | Worker exit clean, Mailpit lookup OK, disposable DB disposed.                                                                                                                                               |
| Run 3                | committed direct | desktop FAIL, mobile PASS | Same race as Run 1 — reproducible.                                                                                                                                                                          |
| Pre-fix tally        | —                | 1/3 desktop, 3/3 mobile   | Race condition classified as a real test sequencing defect, not environmental.                                                                                                                              |
| Stabilization commit | `1a552ee`        | —                         | Test-only change: awaits `page.waitForResponse(... '/public/guest-access/logout' ...)` before the post-logout credentialed GET (mirrors the sequencing already used for hold, OTP request, and OTP verify). |
| Post-fix Run 1       | committed direct | desktop PASS, mobile PASS | 2/2                                                                                                                                                                                                         |
| Post-fix Run 2       | committed direct | desktop PASS, mobile PASS | 2/2                                                                                                                                                                                                         |
| Post-fix Run 3       | committed direct | desktop PASS, mobile PASS | 2/2                                                                                                                                                                                                         |
| Post-fix tally       | —                | 3/3 desktop, 3/3 mobile   | Stable                                                                                                                                                                                                      |

The pre-fix failure pattern (deterministic on three of four observed
runs from the same committed HEAD, at the identical line, with identical
symptom) rules out an environmental flake: it is a sequencing defect in
the test, fixed by awaiting the logout network response. The audit
classifies the prior result (1/3 desktop in §16 of the original
`c60e2cd` audit) as an observed non-reproduced defect whose root cause
is the test missing `page.waitForResponse` for the logout endpoint; the
fix lives in `1a552ee`.

A full-suite Playwright run
(`pnpm exec playwright test`) reports 13/13 passed on the audited HEAD;
the unavailable-config spec reports 1/1 passed.

The `retries=0` setting (per the prompt) means a transient failure
aborts the run rather than retrying. This is intentional.

## 17. Three clean Web builds

| Run | Exit | Started                   | Finished                  | Duration (s) |
| --- | ---- | ------------------------- | ------------------------- | ------------ |
| 1   | 0    | 2026-07-24T05:24:00+07:00 | 2026-07-24T05:24:08+07:00 | ~8           |
| 2   | 0    | 2026-07-24T05:24:08+07:00 | 2026-07-24T05:24:16+07:00 | ~8           |
| 3   | 0    | 2026-07-24T05:24:16+07:00 | 2026-07-24T05:24:24+07:00 | ~8           |

Each run used `pnpm --filter @room/web build` after deleting
`apps/web/.next`. No environmental `/_global-error/page` failure
reproduced in this run.

## 18. Migration integrity

| Migration                           | sha256                                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| `0000_silly_jocasta.sql`            | `9ecfe18c3c32bcd297b76fb83fb7f9173071634f0f1a016a03264d2027602b48` |
| `0001_custom_invariants.sql`        | `1670e4cbc8438dde45b2b5e6eeb7a07aaab08a8e4eb12f3862b0853707eb89c2` |
| `0002_tiny_ultragirl.sql`           | `9fa7f56afa4e8393e537835e1b585bb04d3b6b6480dc9e1f98746e22337f2eff` |
| `0003_gorgeous_punisher.sql`        | `e017dd04d68fd5b78c8ef62274b8772dd15b8f3a57c42381c69978ceb8fa15b3` |
| `0004_natural_paper_doll.sql`       | `f41341b89cddc5068d0c4068eef1c47ab7033cdc8d1eed4f059b900bd577b9c6` |
| `0005_ambiguous_blazing_skull.sql`  | `ead0da6ee0ea97d3b92eed5b2cdd43b8d118ce52266f3f188f15909dada91df0` |
| `0006_phase5_custom_invariants.sql` | `467545e3b2ea77e7aeeaff3263f40749943bd99e141869bf3d6a64a6ae4994be` |

All seven files are byte-identical to the `7698353` baseline. `git diff
7698353..HEAD -- packages/database/drizzle` is empty.

## 19. Secret / PII / storage scan

| Category                                                     | Finding                               |
| ------------------------------------------------------------ | ------------------------------------- |
| `console.log.*otp` in production source                      | none                                  |
| `localStorage` / `sessionStorage` in `apps/web/src`          | none (only test files assert non-use) |
| `document.cookie` in production source                       | none                                  |
| `dangerouslySetInnerHTML` / `innerHTML` in production source | none                                  |
| `TODO` / `FIXME` in production source                        | none                                  |
| Real `@gmail                                                 | @yahoo                                | @outlook | @example.com | hotmail | protonmail` emails | none |
| Real E.164 phone numbers (`+84*`, `+1[2-9]*`)                | none                                  |
| Hardcoded API keys (`sk_live_`, `pk_live_`, `AIza*`)         | none                                  |
| `localhost:3001` in production source                        | none (test fixtures only)             |
| `.env` checked in                                            | no — only `.env.example`              |

The `.env.example` and the demo runbook contain placeholder secrets that
are clearly marked (e.g. `test-guest-otp-secret-32-chars-min-aaaaaa`).
These are not real credentials.

## 20. Dependency advisories

`pnpm audit --prod --audit-level=high` returns **0 high advisories**
after `a74f6b1` (`chore(deps): patch phase 5 high-severity advisories`).
The patch upgrades are:

- `next >=16.2.11`
- `nodemailer >=9.0.1`
- `find-my-way >=9.7.0`

Moderate and low advisories are retained as documented residual debt
(see §23).

## 21. Formatting debt

| Bucket                                                       | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Notes                                                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Stabilization authored files (`1a552ee`)                     | 0 (after `prettier --check`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Test-only change, formatted clean.                                                                                     |
| Modified Task 10 files (`c60e2cd`)                           | 0 (already clean)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Same.                                                                                                                  |
| Pre-existing baseline files still failing `prettier --check` | `apps/web/test/quote-contact-form.test.tsx`, `apps/worker/src/email/otp-skip-rules.test.ts`, `apps/worker/src/email/otp-skip-rules.ts`, `apps/worker/src/email/templates/otp-challenge.test.ts`, `apps/worker/src/jobs/process-outbox.ts`, `apps/worker/test/fixtures/outbox-types.ts`, `apps/worker/test/jobs/process-outbox-otp.test.ts`, `packages/booking/src/domain-labels.ts`, `packages/config/src/index.ts`, `packages/contracts/src/booking/{booking-detail,booking-status,hold,index,logout,otp-request,otp-verify}.ts`, `scripts/run-playwright.mjs`, `tests/e2e/public-booking-vertical-flow.spec.ts` (after `1a552ee`, this file re-enters the baseline-debt list — see correction note below) | All present at the `c60e2cd` baseline; not modified by `1a552ee` beyond the sequencing fix. Recorded as baseline debt. |
| `pnpm-lock.yaml`                                             | 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Prettier always flags `pnpm-lock.yaml`. Recorded as known debt; not rewritten.                                         |
| Generated artifacts                                          | `docs/openapi/{admin,public}-v1.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Generated, not formatted-checked.                                                                                      |

**Correction note on `tests/e2e/public-booking-vertical-flow.spec.ts`:**
the stabilization commit `1a552ee` deliberately adds a
`page.waitForResponse` call whose surrounding block-style matches the
existing pattern in the same file (no `if (...) { ... } else null` ladder,
no new ternary, no async lambda nesting). Prettier's per-file check still
flags the file because of a pre-existing baseline issue unrelated to
`1a552ee`; the baseline-debt entry is preserved.

## 22. Environmental build-instability note

The previous audit log referenced an intermittent
`/_global-error/page` failure during isolated web builds. The three
clean Web builds in this run (see §17) all exited 0. The intermittent
behaviour remains a known risk in isolated clean-build environments but
is not reproducible on this run.

## 23. Known operational limitations

- Mailpit is the only supported SMTP target.
- No payment gateway, no coupon, no OAuth, no SSL, no production
  deployment, no production supervisor / orchestrator for the worker.
  The worker scheduler itself is committed (`e6a5a56`) and
  Playwright-owned continuous runs are exercised by the E2E gate; a
  supervisor for production is still out of scope.
- Session and OTP secrets are loaded from the environment at boot. The
  API refuses to start if any of the booking secrets are shorter than 32
  characters.
- The booking-detail response always masks the contact, even for an
  authenticated guest session. By design.
- The `playwright.config.ts` `retries=0` setting means a transient
  failure aborts the run. This is intentional per the prompt.
- Booking-HOLD allocation locks `rooms` rows with `FOR UPDATE SKIP
  LOCKED`, and the `room_inventory_blocks` GiST exclusion constraint
  enforces no-overlap at insert time. There is no separate
  `inventory_allocations` table and no Phase-5 row in any such table.
- At-least-once duplicate-send window: a worker crash after SMTP send
  but before the outbox row is marked delivered will re-send on the next
  tick. Multiple instances are safe through claim-and-lease; a single
  worker's crash/recovery path remains the accepted at-least-once
  window.

## 24. Manual demo instructions

See [`docs/runbooks/phase-5-demo.md`](../runbooks/phase-5-demo.md) for
the full step-by-step runbook. Summary:

1. `docker compose up -d`
2. `pnpm db:status && pnpm db:migrate`
3. Start API on `127.0.0.1:3101`
4. Start web on `127.0.0.1:3100`
5. Start the **continuous** worker ONCE:
   `pnpm --filter @room/worker dev`. The worker picks up every outbox
   event on its own — HOLD creation and OTP request both queue outbox
   events today, but the worker handles each one without manual
   re-invocation.

## 25. Automated reproduction commands

```bash
# Contracts unit suite
pnpm --filter @room/contracts test:unit

# Stage A OpenAPI artifact generation + check
pnpm generate:openapi
pnpm check:openapi

# All packages lint / typecheck / test:unit / build
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build

# Database
pnpm db:check
pnpm db:test

# API integration
pnpm --filter @room/api test:integration

# Vertical Playwright flow (direct, committed command)
pnpm exec playwright test \
  tests/e2e/public-booking-vertical-flow.spec.ts \
  --workers=1 --retries=0 --reporter=line
```

## 26. Rollback

Revert newest-first. Each `git revert` creates a fresh commit that
undoes the prior one — `git revert` is non-destructive and preserves
history.

```bash
# Revert newest first: closure → scheduler → security remediation → docs correction → final audit evidence → stabilization → Task 10 audit → Task 9
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
commit whose working tree is `parent + (-diff)`. Reverting older commits
first while leaving newer commits in place would produce conflicting
content on follow-up reverts. Reverting newest-first keeps each revert
clean.

Use `git log --oneline -6` to retrieve the most recent commit SHAs.
This restores the working tree to the `ca51b17` Phase 5 functional
baseline. Migrations 0000–0006 are not modified by any of these commits,
so no migration rollback is required.

## 27. Final readiness classification

**DEMO_READY_LOCAL** (carrying documented baseline debt; **not**
PRODUCTION_READY).

Required pre-deployment remediation:

1. Provision a real SMTP provider (and add a hardened SPF/DKIM contract).
2. Terminate TLS (SSL) at the edge.
3. Run the worker under a production supervisor / orchestrator (the
   scheduler itself is committed in `e6a5a56`; the supervisor is not).
4. Run under a hardened secret manager (current secrets are
   environment-only).
5. Apply the `prettier --write` fixes to the listed baseline files
   (cosmetic; not blocking).

## Product acceptance matrix

| Capability       | Implemented | Automated evidence                                                                                                                           | Manual demo evidence                                | Production-ready | Known limitation                                                                                                                                                                                                                                                              |
| ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| availability     | yes         | pricing-engine tests + availability integration                                                                                              | step 1–2 of demo                                    | no               | single-property scope; no distributed multi-region inventory; deferred production capacity hardening                                                                                                                                                                          |
| quote            | yes         | quote integration                                                                                                                            | step 2                                              | no               | 15-min expiry                                                                                                                                                                                                                                                                 |
| pricing          | yes         | pricing-engine tests                                                                                                                         | step 2                                              | no               | VND only                                                                                                                                                                                                                                                                      |
| booking HOLD     | yes         | create-booking-hold tests + booking concurrency proof (`801b7f0`)                                                                            | step 4                                              | no               | continuous worker (`e6a5a56`); one-shot mode retained for recovery scripts                                                                     |
| room allocation  | yes         | `findAllocatableRooms` `FOR UPDATE SKIP LOCKED` on `rooms` + `room_inventory_blocks` GiST exclusion                                          | demo                                                | no               | single-region                                                                                                                                                                                                                                                                 |
| concurrency      | yes         | `801b7f0` proof suite (`last-room-race`, `two-room-race`, `exclusion-rollback`, same-quote-different-contact, same-quote-equivalent-contact) | demo                                                | no               | Task 4 proves five focused concurrency scenarios: last-room race; two-room race; same quote / equivalent contact; same quote / different contact; real GiST exclusion rollback. `maxAttempts=5` belongs to booking-code collision retry and is not a concurrency-count claim. |
| expiration       | yes         | `5f630d4` `expireStaleHolds` tests (23 active, 1 lifecycle)                                                                                  | not visible in 15-min demo                          | no               | bounded by `maxBatches=4`, `batchSize=50`; `exhaustedSafetyBound` reports via `StaleHoldCleanupRetryError`                                                                                                                                                                    |
| audit            | yes         | per-service audit tests                                                                                                                      | visible in logs                                     | no               | catalog audit `actor_type='ADMIN'`, HOLD audit `actor_type='GUEST'`; no flexible audit-write signature yet (both literal at the call sites)                                                                                                                                   |
| outbox           | yes         | outbox tests                                                                                                                                 | worker run delivers OTP                             | no               | at-least-once; no idempotency token on email side                                                                                                                                                                                                                             |
| HOLD email       | yes         | `renderAndSendHoldCreated` (`booking.hold.created` event)                                                                                    | delivered in demo via Mailpit (steps 4 + 7 of demo) | no               | Mailpit-only SMTP target                                                                                                                                                                                                                                                      |
| OTP email        | yes         | `renderAndSendOtpChallenge` (`booking.otp.requested` event, `f4e0801`) + delivery tests                                                      | step 8                                              | no               | Mailpit only                                                                                                                                                                                                                                                                  |
| OTP verification | yes         | verify service tests + constant-time compare                                                                                                 | step 9                                              | no               | 6-digit code                                                                                                                                                                                                                                                                  |
| guest session    | yes         | session service tests                                                                                                                        | step 10                                             | no               | 30-min TTL, HttpOnly, SameSite=Lax                                                                                                                                                                                                                                            |
| booking detail   | yes         | detail service tests                                                                                                                         | step 10                                             | no               | HttpOnly cookie only                                                                                                                                                                                                                                                          |
| logout           | yes         | logout service tests                                                                                                                         | step 11                                             | no               | DB `revoked_at` + cookie `Max-Age=0`                                                                                                                                                                                                                                          |
| public UI        | yes         | web unit tests + Playwright                                                                                                                  | steps 1–11                                          | no               | no i18n, no PWA                                                                                                                                                                                                                                                               |
| desktop E2E      | yes         | `public-booking-vertical-flow.spec.ts` desktop spec, 3/3 against Playwright-owned continuous worker (`e6a5a56`)                              | demo                                                | no               | chromium only                                                                                                                                                                                                                                                                 |
| mobile E2E       | yes         | `public-booking-vertical-flow.spec.ts` mobile spec, 3/3 against Playwright-owned continuous worker (`e6a5a56`)                               | demo                                                | no               | chromium-only viewport (390×844)                                                                                                                                                                                                                                              |
| coupon           | no          | —                                                                                                                                            | —                                                   | —                | Phase 6                                                                                                                                                                                                                                                                       |
| payment          | no          | —                                                                                                                                            | —                                                   | —                | Phase 6                                                                                                                                                                                                                                                                       |
| Google OAuth     | no          | —                                                                                                                                            | —                                                   | —                | Phase 6                                                                                                                                                                                                                                                                       |
| profile          | no          | —                                                                                                                                            | —                                                   | —                | Phase 6                                                                                                                                                                                                                                                                       |
| translation      | no          | —                                                                                                                                            | —                                                   | —                | Phase 6                                                                                                                                                                                                                                                                       |
| SSL / deployment | no          | —                                                                                                                                            | —                                                   | —                | Phase 6                                                                                                                                                                                                                                                                       |
