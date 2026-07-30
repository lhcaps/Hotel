# Phase 6 — Demo Release Candidate Handoff

This document freezes the local repository as the Phase 6 demo release
candidate. It is the single authoritative handoff for the imminent project
demonstration. The operational step-by-step lives in
[`docs/runbooks/phase-6-local-demo.md`](../runbooks/phase-6-local-demo.md);
this handoff records the freeze state, the acceptance evidence, the
recovery commands, the rollback commands, and the strict safety warnings
that the runbook points to.

> **Port 3001 belongs to an unrelated local project (PID 47116).** Never
> signal the process listening on `127.0.0.1:3001`. Identify owners with
> `Get-NetTCPConnection` and only act on the PIDs that the demo runner
> itself prints.

---

## 1. Repository

| Item                                  | Value                                      |
| ------------------------------------- | ------------------------------------------ |
| Repository path                       | `D:\Study\Project\Room Management`         |
| Branch                                | `phase5-booking-hold-guest-access`         |
| Runtime-validated implementation HEAD | `3a12ae16497bc28c67b2448a534d6143c57dad47` |
| Authoritative freeze/handoff HEAD     | `98c06225d7c51a4844f92ec99b0d3c8ebcd78d7d` |
| Repository final HEAD                 | `98c06225d7c51a4844f92ec99b0d3c8ebcd78d7d` |
| Readiness status                      | `DEMO_RELEASE_CANDIDATE_LOCAL`             |
| Production-ready                      | **NO**                                     |
| Schema version                        | `phase-6-coupon-core-v3`                   |
| Migration identity                    | unchanged (0000–0010, metadata stable)     |
| Tracked tree                          | clean                                      |

Runtime validation was performed on implementation HEAD
`3a12ae16497bc28c67b2448a534d6143c57dad47`. The authoritative
freeze/handoff commit `98c06225d7c51a4844f92ec99b0d3c8ebcd78d7d` changes only this
documentation; no runtime revalidation was required after that docs-only
commit. The repository final HEAD for this recorded freeze is
`98c06225d7c51a4844f92ec99b0d3c8ebcd78d7d`.

## 2. Readiness and production status

| Status                      | Value                          |
| --------------------------- | ------------------------------ |
| Readiness                   | `DEMO_RELEASE_CANDIDATE_LOCAL` |
| Production-ready            | **NO**                         |
| Demo-blocking defect (open) | none observed                  |
| High dependency advisories  | 0                              |
| Acceptance gate (last pass) | PASS                           |

This is a local loopback demo release candidate only. It is not production-ready
and does not represent deployment, payment, or real SMTP readiness. See section
18 for the production pre-deployment blockers that remain open.

## 3. Complete Phase 6 capabilities

The frozen HEAD ships the following Phase 6 capabilities end-to-end:

- **Phase 6A** — Coupon domain library (`@room/coupon`).
- **Phase 6B** — Booking HOLD pipeline with guest-access authentication.
- **Phase 6C** — Coupon core: entry, validation, application, immutability,
  customer-digest binding, lifecycle states (`ACTIVE` / `DISABLED`),
  first-reference race semantics.
- **Phase 6D** — Public coupon Web flow on the public quote, HOLD, and
  booking-detail responses. Coupon summary is server-computed and rendered
  verbatim. Clear / re-apply issues a fresh quote (the old quote is never
  mutated).
- **Phase 6E** — ADMIN coupon Web workspace: list with lifecycle filters,
  detail, `FIXED` and `PERCENTAGE` create forms with scope selection, and
  disable-only action for ACTIVE coupons.
- **Phase 6F** — Local demo orchestration: hardened runner lifecycle,
  per-run ephemeral secrets, real TCP bind collision detection,
  per-run state manifest (without the password value), and stale-run
  recovery that drops only its own `room_management_demo_<uuid>` database.

The complete Phase 6 acceptance evidence is documented in
`docs/audit/` and `docs/runbooks/phase-6-local-demo.md`.

## 4. Startup procedure

Open **one** terminal as Terminal 1 (the demo terminal). All commands run
from the repository root.

```powershell
cd "D:\Study\Project\Room Management"
pnpm demo:preflight
pnpm demo:phase6
```

`pnpm demo:preflight` must return `ready: true` and exit 0. If any check
fails, follow the runbook's PRE-DEMO checklist and the RECOVERY section
before retrying.

`pnpm demo:phase6` boots the API on `127.0.0.1:3101`, the Web on
`127.0.0.1:3100`, the continuous worker, and a disposable
`room_management_demo_<uuid>` PostgreSQL database. On ready, it prints:

```
=========================================
Phase 6F demo is ready.
  Public web      : http://127.0.0.1:3100
  Public API base : http://127.0.0.1:3101/api/v1
  Mailpit UI      : http://127.0.0.1:8025
  Disposable DB   : room_management_demo_<random>
  ADMIN email     : admin.demo@example.local
  ADMIN password  : (written to <ephemeral path>; not printed)
  Coupon fixtures : DEMO-FIXED, DEMO-PERCENT, DEMO-DISABLED
  Reserved port   : 3001 (NOT touched)
=========================================
```

**Do not echo or paste the ephemeral password path contents.** The
runner writes the password to a per-run file and removes it on cleanup.

## 5. Demo URLs

| Service             | URL                                          |
| ------------------- | -------------------------------------------- |
| Public web          | <http://127.0.0.1:3100>                      |
| Public API base     | <http://127.0.0.1:3101/api/v1>               |
| Web liveness        | <http://127.0.0.1:3100/health> (HTTP 200)    |
| API liveness        | <http://127.0.0.1:3101/api/v1/health/live>   |
| Mailpit UI          | <http://127.0.0.1:8025>                      |
| Admin sign-in route | <http://127.0.0.1:3100/admin>                |
| Reserved (untouch.) | `127.0.0.1:3001` — do **not** call or signal |

## 6. Demo fixture data

The runner seeds:

- **ADMIN email** — `admin.demo@example.local` (printed by the runner;
  the value comes from `ADMIN_BOOTSTRAP_EMAIL` in `.env`).
- **ADMIN password** — written to a per-run ephemeral file. Read it
  privately with `Get-Content "<path-printed-by-runner>"`. Never echo
  it; never paste it into chat.
- **Coupons**:
  - `DEMO-FIXED` — `FIXED`; `ACTIVE`; applies to all room types.
  - `DEMO-PERCENT` — `PERCENTAGE`; `ACTIVE`; scoped to `Deluxe`.
  - `DEMO-DISABLED` — `FIXED`; `DISABLED`; applies to all room types; seeded
    directly with `disabled_at` set so disabled-coupon rejection is
    observable end-to-end.
- **Database** — `room_management_demo_<uuid>` (disposable; created and
  dropped by the runner).
- **Cookie name** — `rm_guest_session_v1`.

## 7. Presentation sequence (10–15 minutes)

The full script with URL, expected UI text, expected result, and per-step
fallback is in section 11 of this document and mirrors
`docs/runbooks/phase-6-local-demo.md`.

| Window      | Steps                                              |
| ----------- | -------------------------------------------------- |
| 0:00–2:00   | start runner; smoke (`pnpm demo:smoke` 18/18 PASS) |
| 2:00–7:00   | public flow steps 1–13                             |
| 7:00–13:00  | ADMIN flow steps 1–10                              |
| 13:00–14:00 | disable-then-reattempt step + Q&A buffer           |
| 14:00–15:00 | scripted shutdown + port-release confirmation      |

## 8. Health checks

Run these from a second PowerShell. They are non-invasive.

```powershell
Invoke-WebRequest `
  http://127.0.0.1:3100/health `
  -UseBasicParsing

Invoke-WebRequest `
  http://127.0.0.1:3101/api/v1/health/live `
  -UseBasicParsing
```

Both must return HTTP 200. If `3100/health` is down, the Web app is
stuck — check `pnpm demo:preflight` and Terminal 1 output. If
`3101/api/v1/health/live` is down, the API is stuck — same response.

Worker continuity is implicit in the runner's lifecycle; if the worker
fails to drain a `POST /api/v1/public/quotes/{id}/bookings` HOLD into
the OTP email within ~5 seconds, the worker is unhealthy.

## 9. Safe shutdown

Press **Ctrl+C exactly once** in Terminal 1 (the `pnpm demo:phase6`
window). Wait for the runner to print:

```
Phase 6F demo shutting down (reason=SIGNAL, exit=130)
  stopping worker pid=...
  stopping web pid=...
  stopping api pid=...
  dropping demo database ...
  removing admin password file
  cleanup complete
```

Confirm:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 3100,3101 } |
  Format-Table LocalAddress,LocalPort,OwningProcess
```

3100 and 3101 must not appear. 3001 must still appear with the same
owning PID (47116) it had at startup. The disposable password file
path and the per-run manifest must be gone from `%TEMP%`.

**Do not close Terminal 1 before the runner prints `cleanup complete`.**

## 10. Cleanup expectations

`pnpm demo:phase6` is self-cleaning. On signal:

1. Stop children in reverse spawn order (worker → web → api).
2. Wait bounded for graceful exit, then force-kill its own children only.
3. Drop only the exact `room_management_demo_<uuid>` database.
4. Remove only its own ephemeral password file (basename match).
5. Remove its own per-run state manifest.

The runner never scans the global temp directory, never deletes random
databases, and never touches Docker volumes. On stale-run startup, the
same strict prefix guards apply — only the exact manifest-recorded
artefacts are removed.

## 11. Presentation script (full)

### 11.1 PUBLIC FLOW (≈5 minutes)

For every step: **URL → UI text → expected result → fallback**.

| #   | URL                                  | UI text / action                               | Expected result                                                          | Fallback if it fails                                                                                                               |
| --- | ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | <http://127.0.0.1:3100>              | open the public home                           | Next.js public home rendered with the availability search form           | refresh; if 5xx, run health checks (section 8) and check Terminal 1                                                                |
| 2   | `/` → search                         | fill check-in, check-out, guests → Search      | `3 room types` shown — `Standard`, `Deluxe`, `Suite`                     | if availability empty, `pnpm demo:preflight` + `pnpm db:status`                                                                    |
| 3   | `/search` → Deluxe                   | select `Deluxe` → Continue                     | quote summary page opened                                                | navigate back to `/` and re-search                                                                                                 |
| 4   | `/booking/quote/[quoteId]` (no code) | leave coupon input blank → Apply (or continue) | `total` line shown, no discount line                                     | re-load the quote page with the same `quoteId`                                                                                     |
| 5   | same                                 | enter `DEMO-FIXED` → Apply                     | `gross > discount > final`, `discountType = FIXED`                       | if rejected, run `pnpm demo:smoke`; if `COUPON_NOT_FOUND_OR_UNAVAILABLE`, the runner seeded without the fixture — restart the demo |
| 6   | same                                 | Clear → re-enter `DEMO-FIXED` → Apply          | a fresh quote id is in the URL; the same `discountType = FIXED` is shown | if id is unchanged, the UI bug — restart the demo with a fresh disposable DB                                                       |
| 7   | same                                 | Create HOLD                                    | booking code shown (e.g. `RM-A8DX-T872-4C38`)                            | if `409` or `5xx`, check Terminal 1 logs                                                                                           |
| 8   | OTP request page                     | enter guest email → Send                       | "OTP sent" notice                                                        | if no email arrives within 5 s, `docker compose ps mailpit`; check Mailpit UI                                                      |
| 9   | <http://127.0.0.1:8025>              | open the most recent message; copy the OTP     | 6-digit code visible                                                     | if Mailpit is empty, the outbox worker is unhealthy — check section 8 (worker implicit)                                            |
| 10  | OTP verify page                      | paste the code → Verify                        | "verified" notice, cookie `rm_guest_session_v1` set                      | on failure, request a new OTP (cooldown applies)                                                                                   |
| 11  | `/booking/[code]`                    | open booking details                           | contact (masked) and pricing line items including the coupon discount    | cookie not set → re-do steps 8–10                                                                                                  |
| 12  | `/booking/[code]` → logout           | click Logout                                   | session cleared; 401 / "protected access" message on next detail attempt | if logout returns 5xx, retry once                                                                                                  |
| 13  | reopen `/booking/[code]`             | (cookie should be cleared)                     | protected-access rejection visible                                       | if 200 returned, the cookie was not cleared — re-do step 12                                                                        |

### 11.2 ADMIN FLOW (≈6 minutes)

| #   | URL                                      | UI text / action                                                            | Expected result                                                                    | Fallback if it fails                                                               |
| --- | ---------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | <http://127.0.0.1:3100/admin>            | open admin sign-in                                                          | sign-in form                                                                       | if 404, navigate via the public site footer                                        |
| 2   | sign-in                                  | email from banner + password from ephemeral file (privately)                | admin dashboard                                                                    | if 401, password misread; use `Get-Content` again on the printed file path         |
| 3   | `/admin/coupons`                         | open ADMIN Coupons                                                          | list shows `DEMO-FIXED`, `DEMO-PERCENT`, `DEMO-DISABLED`; lifecycle filter present | restart the demo with a fresh disposable DB                                        |
| 4   | create form                              | type = `FIXED`, valid code, save                                            | 201 + status `ACTIVE`                                                              | if 400, the form rejected a missing field — re-check the create form               |
| 5   | create form                              | type = `PERCENTAGE`, scope = `Deluxe`, validUntil ~30d ahead, minimum order | 201 + status `ACTIVE` (Deluxe-only)                                                | if 400, the scope or amount rule failed — re-check inputs                          |
| 6   | detail page of the new PERCENTAGE coupon | open detail                                                                 | normalized display code, lifecycle `ACTIVE`, scope `Deluxe`                        | if scope is missing, the discount type / scope conflict was not honoured — restart |
| 7   | detail page → Disable                    | click Disable                                                               | 200/201 + status `DISABLED`                                                        | if 409, the coupon was already disabled — pick a different ACTIVE one              |
| 8   | detail page                              | observe the action bar                                                      | **no re-enable action exists** for DISABLED coupons                                | this is by design — the runbook confirms it                                        |
| 9   | return to public quote                   | enter the disabled code → Apply                                             | `COUPON_NOT_APPLICABLE` problem-details response shown safely                      | if accepted, the disable did not commit — restart                                  |
| 10  | same                                     | observe coupon summary                                                      | no final pricing line; safe problem-details payload                                | if the response is `200`, the disable pipeline is broken — restart                 |

### 11.3 Scripted shutdown (≈1 minute)

| #   | Action                                                 | Expected result                               |
| --- | ------------------------------------------------------ | --------------------------------------------- |
| 1   | Terminal 1: press Ctrl+C exactly once                  | cleanup banner printed                        |
| 2   | Terminal 1: wait for `cleanup complete`                | ports 3100/3101 not in `Get-NetTCPConnection` |
| 3   | Terminal 1: confirm password file path is gone         | `%TEMP%` no longer lists it                   |
| 4   | Terminal 1: confirm port 3001 owner is still PID 47116 | unchanged                                     |
| 5   | (optional) `pnpm demo:preflight`                       | `ready: true` (or "ports free"), tree clean   |

## 12. Emergency recovery commands

These are non-invasive. Use them in order. If a step fails, stop.

```powershell
# 1. Health
Invoke-WebRequest `
  http://127.0.0.1:3100/health `
  -UseBasicParsing

Invoke-WebRequest `
  http://127.0.0.1:3101/api/v1/health/live `
  -UseBasicParsing

# 2. Smoke
pnpm demo:smoke

# 3. Listeners (audit only)
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 3001,3100,3101 } |
  Format-Table LocalAddress,LocalPort,OwningProcess
```

**Do not** run any of:

- `taskkill /IM node.exe`
- `Stop-Process -Name node`
- `git reset`
- `git clean`
- `docker compose down -v`, `docker volume rm`, `docker system prune`
- `kill -9 47116` or any signal to PID 47116 (the owner of port 3001)
- direct `DROP DATABASE room_management_demo_<uuid>` from `psql` —
  the runner will do this on its own shutdown

## 13. Validation evidence

The following gates passed on the runtime-validated implementation HEAD
(`3a12ae16497bc28c67b2448a534d6143c57dad47`):

| Gate                                    | Result                                       |
| --------------------------------------- | -------------------------------------------- |
| `pnpm demo:preflight`                   | PASS                                         |
| `pnpm demo:lifecycle-test`              | 15/15 PASS                                   |
| `pnpm demo:smoke`                       | 18/18 PASS                                   |
| Interactive demo soak                   | 582 seconds PASS                             |
| Web health (`/health`)                  | HTTP 200                                     |
| API health (`/api/v1/health/live`)      | HTTP 200                                     |
| Worker continuity                       | PASS                                         |
| Manual SIGINT cleanup                   | PASS                                         |
| Full Playwright suite                   | PASS                                         |
| Root lint / typecheck / unit / build    | PASS                                         |
| OpenAPI structure + admin-coupon schema | PASS                                         |
| `pnpm db:status`                        | `phase-6-coupon-core-v3` (actual = expected) |
| High dependency advisories              | 0                                            |
| Migration identity                      | unchanged                                    |
| Tracked tree                            | clean                                        |
| Port 3001 untouched                     | confirmed                                    |

Stage A of this freeze re-verified: branch, HEAD, clean tree, schema,
port 3001, `db:status`, and OpenAPI. No full Playwright re-run was
required.

## 14. Dependency debt

- **At-least-once duplicate-send window.** A worker crash after SMTP
  send but before the outbox row is marked delivered will re-send on
  the next tick. The outbox lease prevents two concurrent workers
  from sending the same email simultaneously; a single worker's
  crash/recovery path remains the accepted at-least-once window.
- **Mailpit retention.** Mailpit only retains messages within the
  container session. Do not rely on it for long-term email storage.
- **Residual moderate / low dependency debt.** `pnpm audit --prod
--audit-level=high` returns zero high advisories; lower severities
  remain and are tracked separately.
- **`apps/web` transient build flakes.** Historical
  `/_global-error/page` failures during isolated builds; not reproduced
  in the current acceptance runs.

## 15. Formatting and lint coverage debt

- **Prettier baseline debt.** Pre-existing files flagged by
  `prettier --check`. Not modified by Phase 6; will be cleaned up
  together with the next dependency upgrade.
- **scripts/demo narrow ESLint + TypeScript ownership.** The demo
  scripts use a narrow `scripts/demo/eslint.config.mjs` and
  `scripts/demo/tsconfig.json` that extend the strict Node base but
  include only `scripts/demo/**/*.mjs`. The root `tsconfig.json`
  remains the solution-style file with `include: []`.

## 16. Deferred functionality

Not implemented in this release candidate:

- **Payment** — no payment flow exists. The booking HOLD is intentionally
  unpaid; the runner exposes no payment provider.
- **MoMo.**
- **VNPAY.**
- **Webhook / IPN.**
- **Refunds.**
- **Coupon re-enable.** DISABLED coupons stay DISABLED; there is no
  re-enable action in the ADMIN UI or in the admin API.
- **Coupon edit / delete.** Coupons are immutable after creation except
  for the `DISABLED` lifecycle transition.
- **Coupon distribution campaigns.** No bulk distribution, no email
  blast, no campaign tracking.
- **Production SMTP.** Mailpit only.
- **TLS.** The local runner is loopback HTTP only.
- **Secrets manager.** Secrets are env-only (loopback `.env`).
- **Deployment.** No cloud target, no staging, no production release.
- **Production monitoring.** No metrics sink, no alerting.
- **Production backup and restore rehearsal.** Not in scope.

Anyone reviewing this code must not assume any of the above are
implemented.

## 17. Strict safety warnings

- **No payment exists.** Do not try to demonstrate payment, refund, or
  any gateway flow. The script does not reference any.
- **No real secrets are committed.** All demo secrets are generated per
  run via `randomBytes`. The committed `.env` is loopback-only.
- **No persistent / shared data is written.** The runner creates only
  `room_management_demo_<uuid>` and removes it on shutdown.
- **Port 3001 is never touched.** The runner hard-codes the demo port
  range to 3100/3101. Verify with `Get-NetTCPConnection` after each
  run.
- **No Git push / PR / deployment is performed by this freeze.**
- **No destructive Git.** Only `git status`, `git rev-parse`, `git log`,
  `git show --check`, and `git diff --check` are used here. No `git
reset`, no `git clean`.
- **No Docker volume deletion.** Only the demo runner may touch its own
  disposable database. Volumes are not pruned.
- **Never mass-kill `node.exe`.** Identify the PIDs the runner prints
  and signal only those (or use Ctrl+C in Terminal 1).
- **Never paste the ephemeral ADMIN password in chat or docs.** Read it
  privately with `Get-Content "<path-printed-by-runner>"` when you need
  to type it into the admin sign-in form.

## 18. Production pre-deployment blockers

These remain open after this freeze:

1. Provision a real SMTP provider.
2. Terminate TLS at the edge.
3. Add a hardened rate-limit policy at the load balancer.
4. Run the worker under a production supervisor / orchestrator (the
   scheduler itself is committed; the supervisor is not).
5. Run under a hardened secret manager (current secrets are
   environment-only).
6. Coupon re-enable / edit / delete endpoints (deferred).
7. Payment provider integration (deferred — MoMo, VNPAY).
8. Production monitoring, alerting, and backup / restore rehearsal
   (deferred).
9. Multi-instance worker scale-out validation.

## 19. Rollback commands

Roll back using `git revert` only. Each revert creates a non-destructive
fresh commit that undoes the prior one. Newest-first ordering is
required; reverting older commits while leaving newer ones in place
would produce conflicting content on follow-up reverts.

The authoritative freeze/handoff commit is the documentation-only commit
`98c06225d7c51a4844f92ec99b0d3c8ebcd78d7d`. Revert it first, then continue
newest-first through Phase 6F, 6E, 6D, 6C, and Phase 5 closure.

```powershell
git log --oneline -10   # retrieve the SHAs at freeze time if needed
```

```powershell
# Reverse order of the public history at freeze time.
git revert 98c06225d7c51a4844f92ec99b0d3c8ebcd78d7d    # docs-only authoritative freeze/handoff
git revert 3a12ae16497bc28c67b2448a534d6143c57dad47    # Phase 6F runner closure
git revert 608f665              # docs: add phase 6 local demo runbook
git revert 20ba27c              # test(demo): add phase 6 smoke verification
git revert 8693fd1              # feat(demo): add guarded local demo orchestration
git revert b61981d              # style(web): apply prettier formatting to Phase 6E changes
git revert 1e60356              # fix(api): map coupon domain errors to safe problem-details responses
git revert 1a9ec4c              # test(e2e): complete admin coupon management vertical
```

After any future commits, operators must start with the recorded exact freeze SHA
`98c06225d7c51a4844f92ec99b0d3c8ebcd78d7d`; do not assume `HEAD` still
refers to the handoff commit. Continue newest-first through the exact commit
chain shown above. Use `git log --oneline -10` only to inspect history, not to
substitute a moving ref for the recorded freeze SHA.

There is **no sanctioned `git reset --hard` path**. `git reset --hard`
is destructive — it discards the documentation commits and rewrites
the working tree, which makes the corrected audit and handoff
unrecoverable on this branch. Rollback must use `git revert`.

After all reverts succeed, the working tree is restored to the Phase
6E-acceptance baseline. Migrations 0000–0010 are not modified by any
of these commits, so no migration rollback is required.

## 20. Exact next development phase

The next development phase is **Phase 7 — Payment & Refund**. It will
introduce:

- Payment gateway abstraction (currently none exists).
- MoMo integration (currently not implemented).
- VNPAY integration (currently not implemented).
- Webhook / IPN handling.
- Refund flow.
- Coupon re-enable / edit endpoints (gated by the same audit posture
  the rest of Phase 6 used).

Phase 7 is **not** in this freeze. It must not start until the project
demonstration is complete and the freeze is lifted by a fresh audit.

---

## Confirmation

- No payment flow is implemented in this release candidate.
- No secrets are committed to source.
- No migrations were added or modified.
- No persistent or shared data is written by the demo runner.
- Port 3001 is never touched by the demo runner.
- No `git push`, no GitHub PR creation, and no deployment is performed
  by this freeze.
- No destructive `git reset` / `git clean` was used in the freeze.
- No Docker volume was deleted in the freeze.
