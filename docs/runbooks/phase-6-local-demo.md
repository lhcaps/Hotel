# Phase 6 — Local Demo Runbook

This runbook is the single source of truth for running the Phase 6 (Public
Coupon + ADMIN Coupon) local demo release candidate on a developer laptop.
It is intentionally concise: a 10–15 minute scripted demo with a strict
recovery path.

> **Scope.** Public coupon flow + ADMIN coupon flow on a disposable
> `room_management_demo_<uuid>` database. No payment, no webhook, no
> production SMTP, no TLS.

---

## PRE-DEMO (5 minutes)

### 1. Repository

```bash
cd "D:\Study\Project\Room Management"
git branch --show-current   # expected: phase5-booking-hold-guest-access
git status --short          # expected: clean
git rev-parse HEAD           # expected: b61981d8d946e1572b216f59813025be6355971e
```

### 2. Local environment

The demo runner uses your existing `.env` (or `.env.example`) for the
loopback PostgreSQL/Redis/Mailpit URLs. The only requirement is that
`POSTGRES_USER=room` / `POSTGRES_PASSWORD=room` are reachable on
`127.0.0.1:5432`.

Optional overrides (only if the default loopback differs):

```bash
DEMO_ADMIN_DATABASE_URL=postgresql://room:room@127.0.0.1:5432/postgres
DEMO_WEB_PORT=3100
DEMO_API_PORT=3101
```

These are **optional** — the runner defaults to the loopback config.

### 3. Preflight

```bash
pnpm demo:preflight
```

Expected outcome (machine-readable):

```json
{
  "ready": true,
  "database": "loopback",
  "mailpit": "healthy",
  "schema": "phase-6-coupon-core-v3",
  "webPort": 3100,
  "apiPort": 3101,
  "protectedPort3001Touched": false
}
```

If `ready` is `false`, the report prints the failing checks. Common fixes:

- Docker daemon not running → start Docker Desktop.
- `pnpm` not on PATH → `npm i -g pnpm`.
- Loopback PostgreSQL down → `pnpm infra:up` (or `docker compose up -d`).
- Loopback Redis/Mailpit down → same as above.
- Ports 3100/3101 occupied → `netstat -ano | findstr "3100 3101"` → kill the
  process owning the port (do NOT touch 3001).

### 4. Port discipline

| Port | Owner                               |
| ---- | ----------------------------------- |
| 3000 | unrelated local dev (do not touch)  |
| 3001 | **protected — never start or kill** |
| 3100 | Demo Web (Next.js)                  |
| 3101 | Demo API (Fastify)                  |
| 8025 | Mailpit UI (loopback)               |

If port 3100 or 3101 is already taken by something unrelated, override the
demo port via `DEMO_WEB_PORT` / `DEMO_API_PORT`. **Never** move the demo
to port 3001.

### 5. Cleanup leftovers from prior runs

If a previous demo crashed and left resources behind:

```bash
pnpm demo:db:drop   # only drops the demo DB if you have its name
```

The runner also drops its own disposable database on shutdown.

---

## 10–15 MINUTE DEMO SCRIPT

### Step 1 — Start the demo

```bash
pnpm demo:phase6
```

The runner prints a banner:

```
=========================================
Phase 6F demo is ready.
  Public web      : http://127.0.0.1:3100
  Public API base : http://127.0.0.1:3101/api/v1
  Mailpit UI      : http://127.0.0.1:8025
  Disposable DB   : room_management_demo_<random>
  ADMIN email     : admin.demo@example.local
  ADMIN password  : (written to <ephemeral path> for smoke; not printed)
  Coupon fixtures : DEMO-FIXED, DEMO-PERCENT, DEMO-DISABLED
  Reserved port   : 3001 (NOT touched)
=========================================
```

**Do not echo the admin password file contents.** The runner does not
print the password.

### Step 2 — Smoke verification (1 minute)

In a separate terminal:

```bash
pnpm demo:smoke
```

Expected: `Smoke summary: 18/18 passed`. If any check fails, run
`pnpm demo:preflight` and follow the recovery section below.

### Step 3 — Public flow

1. Open http://127.0.0.1:3100 (Next.js public home).
2. **Availability** — fill check-in / check-out / adults → Search.
   Expect `3 room types`, including `Standard`, `Deluxe`, `Suite`.
3. **Quote without coupon** — select Deluxe → Continue → Quote.
   Note `total` (e.g., 360000 VND).
4. **Apply `DEMO-FIXED`** — enter the code → Apply.
   Expect `gross > discount > final`, `discountType = FIXED`.
5. **HOLD** — Create HOLD. Expect a short booking code (e.g.
   `RM-A8DX-T872-4C38`).
6. **Request OTP** — enter the guest email → Send.
   Switch to Mailpit at http://127.0.0.1:8025 and read the OTP.
7. **Verify OTP** — return to the form → enter the code → Verify.
8. **Booking detail** — open the booking detail page; expect contact
   info and pricing line items.
9. **Logout / protected access** — log out → re-open the detail URL →
   expect 401/prohibited access.

### Step 4 — ADMIN flow

1. Open http://127.0.0.1:3100/admin (or the ADMIN sign-in route).
2. Sign in with the email from the banner and the password from the
   ephemeral file (read it privately, do not paste it in chat).
3. **Coupon list** — open `/admin/coupons`. Expect `DEMO-FIXED`,
   `DEMO-PERCENT`, `DEMO-DISABLED` plus any prior smoke-test coupons.
4. **Coupon detail** — click `DEMO-FIXED`. Expect code, status, scope,
   validity window.
5. **Create PERCENTAGE coupon scoped to Deluxe** — choose percentage,
   scope = `Deluxe` only, set a `validUntil` ~30 days ahead and a
   minimum order amount. Submit. Expect 201 + status `ACTIVE`.
6. **Inspect** — open the new coupon's detail page.
7. **Disable** — click Disable on the new coupon. Expect 200/201 +
   status `DISABLED`. Confirm there is **no re-enable** button.
8. **Return to public flow** — go back to the public quote, re-apply
   the newly disabled coupon code → expect `COUPON_NOT_APPLICABLE`.

### Step 5 — Stop the demo

Press `Ctrl+C` in the `demo:phase6` terminal. The runner prints:

```
=== Phase 6F demo shutting down ===
  killing api pid=...
  killing web pid=...
  killing worker pid=...
  dropping demo database <name>
  cleanup complete
```

Confirm ports 3100 and 3101 are released:

```bash
netstat -ano | findstr "3100 3101"
```

---

## RECOVERY

| Symptom                                  | First response                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm demo:phase6` fails on preflight    | run `pnpm demo:preflight` directly, follow the failing check.                                                                                     |
| `demo:phase6` fails on database create   | confirm `DEMO_ADMIN_DATABASE_URL` is on loopback; confirm `room_management` is **not** used as the demo.                                          |
| Web/API not reachable on 3100/3101       | `docker compose ps` for postgres/redis; `curl 127.0.0.1:3101/api/v1/health/live` should be 200.                                                   |
| Mailpit empty when OTP is requested      | `docker compose ps mailpit`; UI: http://127.0.0.1:8025.                                                                                           |
| Quote returns 409 PRICING_CONFIGURATION  | verify the demo seed has run; restart the demo with a fresh disposable DB.                                                                        |
| Coupon code rejected unexpectedly        | `pnpm demo:db:drop` then restart `pnpm demo:phase6` to reseed fixtures.                                                                           |
| Process will not exit on `Ctrl+C`        | `taskkill /F /PID <pid>` for the only the PIDs reported by the runner; never mass-kill `node.exe`.                                                |
| Orphan database `room_management_demo_*` | `pnpm demo:db:drop` (the runner asks for the exact name before dropping).                                                                         |
| Port 3001 was touched                    | **STOP** — the runbook is wrong; check the scripts in `scripts/demo/` and confirm `DEMO_PROTECTED_PORT` is hard-coded as 3001 and never assigned. |

### Safe restart

```bash
pnpm demo:db:drop   # only if you have the disposable DB name
pnpm demo:phase6
```

The runner always rejects known persistent database names (`room_management`,
`postgres`, `template0`, `template1`).

### Safe shutdown

`Ctrl+C` in the `demo:phase6` window. The runner kills its own children
and drops its own disposable database. It does **not** kill unrelated
processes and does **not** delete Docker volumes.

---

## DEFERRED SCOPE (intentionally out of 6F)

- payment, MoMo, VNPAY, webhooks/IPN, refunds
- coupon re-enable / edit / delete
- coupon email distribution
- analytics dashboard
- Google OAuth expansion
- production SMTP / TLS / secrets
- deployment / production release

---

## CONFIRMATION

- No secrets committed.
- No migrations were added or modified.
- No persistent data is written.
- Port 3001 is never touched.
- Cleanup removes only resources created by this runner.
