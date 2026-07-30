# Phase 5 Operational Runbook

This runbook describes the operational facts of the Phase 5 vertical slice
as it ships on `phase5-booking-hold-guest-access`. It does not describe
future Phase 6 work.

## Schema version

| Item                      | Value                                     |
| ------------------------- | ----------------------------------------- |
| `EXPECTED_SCHEMA_VERSION` | `phase-5-booking-hold-guest-access-v1`    |
| Source                    | `packages/database/src/schema-status.ts`  |
| Recorded in               | `schema_metadata.schema_version` row id=1 |

If `pnpm db:check` reports `actualVersion !== expectedVersion`, the database
was not migrated to the Phase 5 baseline. Re-run `pnpm --filter @room/database
db:migrate`.

## Migrations

| Migration                           | Purpose                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `0000_silly_jocasta.sql`            | Phase 0 foundation (extensions, base tables).                                                   |
| `0001_custom_invariants.sql`        | Phase 1 (GiST exclusion + invariants).                                                          |
| `0002_tiny_ultragirl.sql`           | Phase 2.                                                                                        |
| `0003_gorgeous_punisher.sql`        | Phase 3.                                                                                        |
| `0004_natural_paper_doll.sql`       | Phase 4 (quote immutability trigger).                                                           |
| `0005_ambiguous_blazing_skull.sql`  | Phase 5 (bookings, contacts, OTP challenges, guest sessions, outbox extension).                 |
| `0006_phase5_custom_invariants.sql` | Phase 5 (widens booking immutability trigger, contact mutation rejection, schema version bump). |

Migrations 0000–0006 are byte-identical to the `7698353` baseline commit.

## HOLD lifecycle

1. Quote is created via `POST /api/v1/quotes` (TTL 15 minutes).
2. `POST /api/v1/public/quotes/{quoteId}/bookings` allocates a room under a
   single PostgreSQL transaction, inserts the booking row with `status =
HOLD`, an immutable `price_snapshot`, and an immutable contact row in
   `booking_contacts`. `hold_expires_at = now() + BOOKING_HOLD_DURATION_MS`.
3. `holdExpiresAt` is exposed in the booking-detail response while the
   status is `HOLD`. Once the timestamp passes, the next worker iteration
   flips the row to `EXPIRED`.
4. The booking code is `^[A-Z0-9-]{4,32}$` and is normalised on input —
   the API rejects any input whose normalisation would change it.

## Expiration job

Implemented by `expireStaleHolds(pool, { batchSize: 50, maxBatches: 4 })`
in `packages/booking`. The job:

1. Selects up to `batchSize` HOLD rows whose `hold_expires_at < now()`.
2. Updates each row to `EXPIRED` in the same transaction.
3. Repeats up to `maxBatches` times to bound the per-iteration cost.

If the bounded cleanup exhausts its retry budget while stale rows remain,
the booking hold creation service surfaces `STALE_HOLD_CLEANUP_RETRY`
(HTTP 503) instead of partial state.

## Transactional outbox

`apps/api/src/booking/services/booking-hold.service.ts` writes an outbox
event in the same transaction as the booking insert. The
`processOutbox` worker uses a claim-and-lease primitive (`leaseTtlMs = 30
000 ms`, `batchSize = 25`) so a worker crash does not lose events.

| Outbox event            | Payload                                                  | Triggered by        |
| ----------------------- | -------------------------------------------------------- | ------------------- |
| `booking.hold.created`  | `{ bookingId, holdExpiresAt }` (no PII)                  | HOLD service        |
| `booking.otp.requested` | `{ bookingId, challengeRefDigest }` (no OTP, no contact) | OTP request service |

The worker delivers `booking.otp.requested` via the SMTP outbox driver in
`apps/worker/src/email/`. Plain-text email bodies are rendered through
`apps/worker/src/email/templates/otp.ts`. The rendered body intentionally
includes the challenge reference and the 6-digit OTP code; nothing else.

## Worker operating model

`apps/worker/src/main.ts` runs the worker in one of two explicit modes,
selected by `WORKER_MODE`:

- `WORKER_MODE=continuous` (default) — the worker runs two independent
  jobs in a scheduler-driven loop:
  - `HOLD_EXPIRATION` invokes `expireStaleHolds` on `WORKER_EXPIRATION_INTERVAL_MS`.
  - `OUTBOX_DELIVERY` invokes `processOutbox` on `WORKER_OUTBOX_INTERVAL_MS`.
  - Each job has its own `inFlight` flag in `WorkerScheduler` so a slow
    iteration cannot stack pending executions of itself.
  - On failure, each job schedules its next attempt with bounded
    exponential backoff (`WORKER_ERROR_BACKOFF_MS`, `WORKER_MAX_ERROR_BACKOFF_MS`).
  - On SIGINT/SIGTERM the scheduler aborts pending waits, drains the active
    iteration, and emits `scheduler.completed` before the lifecycle closes
    the SMTP transport, Redis client, and database pool.
  - Multiple instances are safe because the outbox uses claim-and-lease
    and `expireStaleHolds` uses `FOR UPDATE SKIP LOCKED`.

- `WORKER_MODE=once` — runs one `expireStaleHolds` iteration followed by
  one `processOutbox` iteration, then exits 0. This is the recovery /
  debugging mode and is **not** suitable as the runtime: the API keeps
  producing outbox events after the worker exits.

Package commands:

```bash
pnpm --filter @room/worker dev         # continuous (default)
pnpm --filter @room/worker dev:once    # one-shot
pnpm --filter @room/worker start       # continuous (uses built dist/)
```

The vertical Playwright flow owns a continuous worker process (started by
`playwright.config.ts` `globalSetup`) and does not spawn any one-shot
worker after the OTP request. The continuous worker delivers the OTP
email on its own.

## OTP challenge lifecycle

| Knob                     | Default                 | Source                                                            |
| ------------------------ | ----------------------- | ----------------------------------------------------------------- |
| TTL                      | 10 minutes              | `GUEST_OTP_TTL_MS=600000`                                         |
| Resend cooldown          | 60 seconds              | `GUEST_OTP_RESEND_COOLDOWN_MS=60000`                              |
| Per-booking+email window | 3 requests / 15 minutes | `GUEST_OTP_REQUEST_LIMIT=3`, `GUEST_OTP_REQUEST_WINDOW_MS=900000` |
| Per-IP window            | 20 requests / hour      | `GUEST_OTP_IP_LIMIT=20`, `GUEST_OTP_IP_WINDOW_MS=3600000`         |

Rate-limit counters live in `guest_otp_challenges` and are incremented
inside the same transaction as the challenge insert. The application clock
is never trusted; all windows are checked against `now()` returned by
PostgreSQL.

The OTP itself is derived deterministically from the challenge nonce and
`GUEST_OTP_SECRET`; verification uses a constant-time comparison
(`timingSafeEqual` via `deriveOtpForChallenge`).

## Guest session

| Knob        | Default                          | Source                           |
| ----------- | -------------------------------- | -------------------------------- |
| TTL         | 30 minutes                       | `GUEST_SESSION_TTL_MS=1800000`   |
| Cookie name | `rm_guest_session_v1`            | `apps/api/src/booking/cookie.ts` |
| `Path`      | `/`                              |                                  |
| `HttpOnly`  | always                           |                                  |
| `SameSite`  | `Lax`                            |                                  |
| `Secure`    | when `NODE_ENV === 'production'` |                                  |

The session token is a 256-bit random value; only its SHA-256 digest is
stored in `guest_sessions.token_digest`. Sessions are scoped to a single
booking id; cross-booking access returns `GUEST_SESSION_INVALID`.

On successful OTP verify the controller rotates the session — the
existing digest row is replaced and the cookie's `Max-Age` is reset to
`GUEST_SESSION_TTL_MS`.

## Email delivery semantics

- The worker is **at-least-once**. A claim-and-lease primitive prevents
  two workers from sending the same email simultaneously. If a worker
  crashes after SMTP send but before the outbox row is marked delivered,
  the next invocation will re-send. Mailpit is the only SMTP target in
  the demo; do not assume exactly-once.
- The booking contact email/phone is stored only as a digest; the
  worker queries the digest to look up the booking row and never logs
  the plaintext body.

## Safe retry guidance

- Re-run the worker after a crash or stuck iteration.
- Do **not** retry a HOLD request on `STALE_HOLD_CLEANUP_RETRY` from the
  browser more than once every 30 seconds. The bounded cleanup is
  intentionally defensive.
- Do **not** re-insert a booking manually. The bookings schema enforces
  immutability on all booking facts (quote id, dates, amount, status,
  snapshot). Any direct INSERT outside the API will be rejected by the
  immutability triggers.

## Rollback and recovery

| Symptom                                 | Recovery                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking stuck in HOLD past expiry       | The continuous worker expires it on its next `WORKER_EXPIRATION_INTERVAL_MS` tick. For one-off recovery, run `pnpm --filter @room/worker dev:once`. |
| OTP challenges piled up                 | `processOutbox` cleans delivered ones on the next outbox tick. For one-off recovery, run `pnpm --filter @room/worker dev:once`.                     |
| Session cookie no longer authenticating | The cookie's `Max-Age=1800`; the user re-verifies via OTP. The old digest is revoked by the next successful verify.                                 |
| Mailpit unavailable                     | Restart the container; **do not** delete volumes.                                                                                                   |
| Schema version mismatch                 | Re-run `pnpm --filter @room/database db:migrate`. The 0006 migration is the only one that bumps the schema version.                                 |
| Worker outage                           | Restart with `pnpm --filter @room/worker dev`. The continuous scheduler resumes with the next due tick. Multiple instances are safe.                |

There is no destructive DDL or seed reset path inside Phase 5.

## Local Mailpit inspection

Mailpit's HTTP UI is at `http://127.0.0.1:8025`. The Playwright vertical
flow deletes its own test messages through the Mailpit API
(`/api/v1/message/{id}`) so you will only see real messages in the UI
during a manual demo.

To inspect raw message bodies programmatically:

```powershell
Invoke-RestMethod http://127.0.0.1:8025/api/v1/messages |
  Select-Object -ExpandProperty messages
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
so a misconfigured worker cannot open a database pool or SMTP transport.

## Known limitations

- Worker has two explicit modes (`continuous` and `once`) but no
  production supervisor; the demo relies on interactive `pnpm --filter
@room/worker dev`.
- Mailpit is the only supported SMTP target.
- No TLS, no production deployment, no payment, no automated refund,
  no OAuth. Coupons ship on the public Web flow (Phase 6C/6D) but
  remain without an ADMIN Web surface and without email distribution.
- Session and OTP secrets are loaded from the environment at boot. The
  API refuses to start if any of the booking secrets are shorter than 32
  characters.
- The booking-detail response always masks the contact, even for an
  authenticated guest session. This is by design.
- Email delivery is at-least-once. A worker crash after SMTP send but
  before the outbox row is marked delivered will re-send on the next
  tick. Duplicate-send windows in the crash/recovery path are accepted
  as known debt.

## Phase 6C/6D coupon addendum

The HOLD pipeline now revalidates an optional coupon inside the same
transaction as the booking insert:

1. `POST /api/v1/quotes` accepts an optional `couponCode`. The server
   evaluates the coupon at quote time and returns an optional `coupon`
   summary alongside the price snapshot. The field is omitted entirely
   when no coupon is applied.
2. `POST /api/v1/public/quotes/{quoteId}/bookings` does **not** accept
   a coupon code. The HOLD service `revalidateCouponForHold` re-runs
   every coupon rule under the booking transaction. A coupon that is
   no longer valid at HOLD time throws
   `CouponHoldWindowIncompatibleError`, `CouponExpiredError`,
   `CouponMinimumNotMetError`, `CouponLimitReachedError`,
   `CouponCustomerLimitReachedError`, or `CouponRequoteRequiredError`
   depending on the failure. The controller maps these to the
   corresponding RFC 7807 codes (HTTP 409).
3. The booking response and the booking-detail response both carry an
   optional `coupon` summary object with the same shape as the quote
   `coupon` snapshot. The snapshot is computed in `BookingHoldResult`
   and re-parsed through `bookingHoldCouponSummarySchema` at the
   controller boundary.
4. The public Web flow must never retry the HOLD with a patched
   discount. The safe envelope is the only authority; the UI must
   surface the Vietnamese error message and ask the user to reissue
   the quote.

The coupon snapshot is stored in `booking_coupon_applications` joined
to `bookings` and is filtered by `application_status IN ('ASSOCIATED',
'RESERVED', 'REDEEMED')` so released applications never reappear.

The current `EXPECTED_SCHEMA_VERSION` is `phase-6-coupon-core-v3`
(see `packages/database/src/schema-status.ts`). If `pnpm db:check`
reports a mismatch, re-run `pnpm --filter @room/database db:migrate`.
Migrations 0000–0010 cover the schema baseline; no new migration is
required for the Phase 6D contract changes.
