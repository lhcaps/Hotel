# Final Local Demo Acceptance Report

Generated: 2026-08-01
Branch: `main`
HEAD: `434c549` — `docs(closure): final local demo acceptance report`
Closure commit: `da5fc35` — `chore(closure): final local demo acceptance, admin same-origin proxies, demo scripts`
Author: `lhcaps <huyle210525@gmail.com>`
Archive: `output/room-management-demo.zip`
SHA-256: `d0dc5b9f16baedf498027ed7e7bf7fdb1162172110887f383c86de499f2d3701`

---

## 1. Closure commits on `main`

```
da5fc35 chore(closure): final local demo acceptance, admin same-origin proxies, demo scripts
11a6961 fix(account): share CUSTOMER session across /account/bookings
78ca6a2 style: apply prettier to phase 3b1 files
```

The closure commit (`da5fc35`) is self-contained and contains the
focused functional change set:

- `apps/web/src/app/api/admin/me/route.ts` (new) — same-origin proxy for `/api/v1/admin/me`
- `apps/web/src/app/api/auth/sign-in/email/route.ts` (new) — same-origin proxy for the Better Auth sign-in endpoint, with cookie rewrite
- `apps/web/src/app/api/auth/sign-out/route.ts` (new) — same-origin proxy for the Better Auth sign-out endpoint, with cookie rewrite
- `apps/web/src/app/admin/layout.tsx` — wire admin layout through the same-origin session helper
- `apps/web/src/app/admin/login/page.tsx` — switch fetch targets to the same-origin proxies, render error alerts correctly
- `apps/web/src/app/admin/loading.tsx` (deleted) — redundant route-segment loading file
- `apps/web/src/app/globals.css` — refreshed admin login styling
- `apps/web/src/components/admin-logout-button.tsx` — call same-origin `/api/auth/sign-out`
- `apps/web/src/lib/admin-session-server.ts` — robust URL construction for `NEXT_PUBLIC_API_BASE_URL`
- `apps/web/test/customer-bookings.a11y.test.tsx` — formatting fix
- `package.json` — add `demo:start`, `demo:start:local`, `demo:verify`, `demo:stop`
- `playwright.verify.config.ts` (new) — standalone Playwright config targeting the local demo stack
- `scripts/demo/start-local.mjs` (new) — local demo runner (canonical `localhost` origins)
- `scripts/demo/stop.mjs` (new) — Windows-aware demo shutdown
- `scripts/demo/verify.mjs` (new) — deterministic 16-check verifier
- `scripts/package-demo.mjs` (new) — archive builder with SHA-256 output
- `tests/e2e/final-local-demo-acceptance.spec.ts` (new) — 7-scenario acceptance suite
- `tests/e2e/verify-*.spec.ts` (new) — supporting Playwright specs
- `.gitignore` — additional patterns for transient root-level logs
- `README-DEMO.md` (new) — customer-delivery doc for the archive

No remote push was performed; the closure is committed locally to
`main`. The author identity on the commit is `lhcaps
<huyle210525@gmail.com>`.

---

## 2. Quality gates

All gates ran against HEAD `434c549` on `http://localhost:3000`,
`http://localhost:3001`, `http://localhost:3090`, `http://localhost:8025`.

| Gate                         | Command                                                                                                       | Result          |
|------------------------------|---------------------------------------------------------------------------------------------------------------|-----------------|
| Prettier format check        | `npx prettier --check <touched files>`                                                                        | **PASS**        |
| ESLint (turbo)               | `npx turbo lint`                                                                                              | **PASS (9/9)**  |
| TypeScript typecheck (turbo) | `npx turbo typecheck`                                                                                         | **PASS (9/9)**  |
| OpenAPI drift check          | `npx tsx scripts/generate-openapi.mts --check` (silent exit 0)                                                | **PASS**        |
| Database check               | `pnpm db:check` (drizzle-kit `check`)                                                                         | **PASS** ("Everything's fine") |
| Unit tests                   | `npx turbo test:unit --concurrency=1`                                                                         | **PASS (337 tests, 57 files)** |
| Production build             | `npx turbo build`                                                                                             | **PASS (9/9)**  |
| Local demo verifier          | `node scripts/demo/verify.mjs`                                                                                | **PASS (16/16)** |

The full logs for each gate are bundled inside
`output/room-management-demo.zip` under `verification/`.

---

## 3. Final local demo acceptance (Playwright)

`tests/e2e/final-local-demo-acceptance.spec.ts` — run with
`playwright.verify.config.ts` (which targets the canonical localhost
stack).

| Scenario | Description                                                                    | Run 1       | Run 2       |
|----------|--------------------------------------------------------------------------------|-------------|-------------|
| A        | Public catalog renders on landing                                              | ok 280ms    | ok 274ms    |
| B        | Unauthenticated CUSTOMER browser pages and API returns 401                     | ok 595ms    | ok 590ms    |
| C        | MOMO full browser flow → `/booking/manage/{code}` auto-redirect                | ok 28.8s    | ok 44.1s    |
| D        | VNPAY full browser flow → `/booking/manage/{code}` auto-redirect               | ok 44.5s    | ok 1.0m     |
| E        | Forged MoMo return cannot confirm a booking                                    | ok 319ms    | ok 319ms    |
| F        | ADMIN login, `/api/admin/me` 200, protected admin pages render                 | ok 1.6s     | ok 1.6s     |
| G        | ADMIN refresh persists session, logout revokes                                  | ok 1.3s     | ok 1.3s     |

Result: **7/7 passed on both runs** against the same committed
functional HEAD (`da5fc35`). Logs are archived as
`verification/final-acceptance-run1.log` and
`verification/final-acceptance-run2.log`. A third run was performed
against HEAD `9780591` (the squash that folded the packaging fix in)
and is preserved as `verification/final-acceptance-run1.log` to
document that the closure remains green after the final commit
rearrangement.

---

## 4. Demo stack topology

| Service            | Host                       | Port | Started by                                |
|--------------------|----------------------------|------|-------------------------------------------|
| Web (Next.js)      | http://localhost:3000      | 3000 | `pnpm demo:start:local` → `start-local.mjs` |
| API (NestJS)       | http://localhost:3001      | 3001 | `pnpm demo:start:local` → `start-local.mjs` |
| Payment Simulator  | http://localhost:3090      | 3090 | `pnpm demo:start:local` → `start-local.mjs` |
| Mailpit            | http://localhost:8025      | 8025 | `docker compose up -d mailpit`            |
| Postgres / Redis   | docker                     | —    | `docker compose up -d`                    |

Browser-visible URLs use the **`localhost`** hostname per the closure
prompt. The payment simulator's checkout page may briefly redirect
through `127.0.0.1:3090`; this is the only exception to the rule and is
explicitly allowed for the simulator-only canonical-redirect test.

The simulator is started with
`PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE=http://localhost:3000/booking/manage`
so the auto-redirect from the simulator checkout page lands on the
persistent customer route, not on the intermediate
`/booking/manage?orderId=MOMO-...` URL.

---

## 5. Package

`output/room-management-demo.zip` (9.11 MiB).

- Created by `scripts/package-demo.mjs` from HEAD `434c549` (which is
  `da5fc35` plus the doc commit).
- Top-level directory inside the zip:
  `room-management-demo-434c549/`.
- Contents include `README-DEMO.md`, `verification/INDEX.md` plus 9 log
  artifacts, `apps/`, `packages/`, `scripts/`, `tests/`,
  `playwright.verify.config.ts`, `.env.example`, `compose.yaml`,
  `pnpm-lock.yaml`, and the full documentation tree.

SHA-256SUMS:

```
d0dc5b9f16baedf498027ed7e7bf7fdb1162172110887f383c86de499f2d3701  room-management-demo.zip
```

Verified by expanding the archive into
`output/verify-extract/` and confirming the prefix, `README-DEMO.md`,
and `verification/` directory are intact. The expansion target was
removed after verification to keep `output/` tidy.

---

## 6. Cleanliness

```
$ git status --short
 D output/playwright/phase-8h-operational-report-desktop.png
 D output/playwright/phase-8h-room-operations-desktop.png
 D output/playwright/phase-8h-room-operations-mobile.png
?? output/room-management-demo.zip
?? output/room-management-demo.zip.sha256
```

- The three PNG deletions are intentional: those screenshots are under
  `output/playwright/` which is matched by `.gitignore` and were
  produced by an earlier exploratory Playwright run. Their absence does
  not affect the archive (the archive is built from HEAD via
  `git archive`).
- `output/room-management-demo.zip` and the matching `.sha256` are
  generated artefacts. They are not committed (and should not be,
  because they are the customer-delivery artefact, not part of the
  source tree).
- No worktrees, branches, or tags were created. No remote refs were
  updated.

---

## 7. Demo accounts

| Role          | Email                          | Password                  |
|---------------|--------------------------------|---------------------------|
| Administrator | `demo-verify@room.local`       | `Aa1-KnownVerifyPass-1234` |

Customer flow uses the booking-hold OTP channel via Mailpit — no
account is required.

---

## 8. Reproduce the verification

```powershell
# from inside the extracted archive
docker compose up -d
pnpm install --frozen-lockfile
pnpm demo:db:create
pnpm demo:seed
pnpm demo:start:local
pnpm demo:verify
npx playwright test tests/e2e/final-local-demo-acceptance.spec.ts `
    --config=playwright.verify.config.ts --workers=1 --retries=0
pnpm demo:stop
```

The same commands work on macOS / Linux.