# Final Delivery Master Record

Branch: `phase5-booking-hold-guest-access`
Actual starting full SHA: `061ae57586c63ac3c18f98de5e7bbabcb1bbc5d6`
Final implementation SHA before this documentation-only record: `74c29cfd0ce4d9d657568e046ad26a6208b73758`
Schema at start: `phase-8d-client-acceptance-v1`

## 1. Actual starting state

- Repository root: `D:/Study/Project/Room Management`; required branch was checked directly.
- Starting worktree was clean: `git status --short`, `git diff --stat`, `git diff --name-status`, and `git diff --check` emitted no changes; `git show --check HEAD` passed.
- Phase 8H and 8I ancestry is the contiguous chain `1258b9c` through `061ae57`; the Phase 8I closure commits are `46173eb`, `f0aa9b9`, `f29bec5`, `dfcd6e4`, `f27ff4d`, and `061ae57`.
- `.env` is ignored, no `.env` file is tracked, no `.xlsx`/`.xlsm` workbook is tracked, and the only live infrastructure services are the healthy loopback PostgreSQL, Redis, and Mailpit containers.
- Existing listeners on 3000 and 3001 were observed but not changed. Docker owns 5432, 6379, and 8025 through its WSL relay.

## 2. Repository audit

- The authoritative source contracts preserve PostgreSQL as transactional authority, server-side RBAC, immutable released migrations, server-authoritative pricing/settlement, and return-URL read-only payment semantics.
- No duplicate API client, contract, readiness endpoint, report aggregator, booking projection, fixture system, dependency, migration, or provider integration is introduced by this final phase.
- The development UAT seed is development-only, loopback-guarded and synthetic (`example.test` identities and fixed UAT codes); it does not read the customer workbook or create live provider evidence.

## 3. Hydration diagnosis

Investigation target: the historic development React hydration message whose diff showed `style={{caret-color: "transparent"}}` on a home-page input.

- `git grep -n -E "caret-color|caretColor|transparent" -- apps packages tests scripts` found only two intentional CSS `background: transparent` declarations; no caret declaration. A compiled-artifact scan found no `caret-color` or `caretColor` occurrence.
- Production managed Chromium (isolated `.next-hydration-production`, `next start`, route `/`) received four server `<input>` tags with no style. DOMContentLoaded and post-hydration DOM retained `style=null`; only React's expected `value` attribute synchronization was observed. Console errors and page errors: `0`; extension runtime id: `null`.
- Development managed Chromium (isolated `.next-hydration-development`, `next dev`, route `/`) likewise had no input style mutation and no hydration warning. Its only console errors were a CORS refusal for the real API session probe because this isolated web origin was intentionally `3111` while the already-running API allows `3000`; this is not a hydration symptom.
- The deterministic Phase 8I Playwright visual journey passed after this inspection without the historic hydration message.
- The in-app browser rendering of the already-running local application contained the same four inputs with `style=null` and no warning/error logs. It is a controlled application browser, not evidence that a separately installed normal-browser profile or its extensions were inspected.

Final classification: `TEST_HARNESS_DEFECT`.

- A direct Playwright probe on the local home page showed that `page.screenshot({ fullPage: true })` temporarily applies `style="caret-color: transparent !important;"` to each of the four inputs, then removes it. The same probe with `caret: 'initial'` made zero style mutations. This is the exact historic hydration-diff value and explains its intermittent race with hydration.
- The only correction is the existing Phase 8I capture helper in `tests/e2e/phase-8i-visual-uat.spec.ts`: every full-page UAT screenshot now sets `caret: 'initial'`. No product code, injected style, `suppressHydrationWarning`, browser extension, or warning filter was added.
- Final managed production, managed development, and in-app browser probes contain no unexplained hydration warning. A separately installed normal-browser profile/extension inventory was not available to automate, so it is not represented as a passing source of evidence; it is not needed for the confirmed deterministic harness root cause.

## 4. Endpoint inventory

Final-HEAD endpoint and OpenAPI commands are recorded in the regression section. The reconciliation contract is `78 runtime = 74 documented + 4 explicitly allowlisted`; unclassified routes are rejected by the checker.

## 5. Accessibility

The existing measured suite covers 13 critical surfaces, keyboard account/locale/filter paths, report text/table fallback, print semantics, focus states, non-colour-only status presentation, and reduced motion. The focused final run covered 10 files / 48 tests with `AXE_CRITICAL=0`; its repository-wide companion is in the final regression section.

## 6. UAT

The existing deterministic visual UAT uses isolated synthetic data for public search/results/HOLD, customer bookings/profile, and ADMIN reporting, rooms, bookings, payments, rate plans, and reviews at desktop and mobile widths. The 13 retained sanitized captures are below; the remaining requested journey states (quote/recommendation choice, payment choice, confirmation/print, housekeeping and empty report) are exercised behaviorally by the full Playwright suite rather than duplicated into a second screenshot system.

- `01-public-entry-desktop.png` `FEFABA4A2BA5256287CB955B679032B445D9BACDD6FF3116CE28FA8388B4E6AA`
- `02-availability-results-desktop.png` `D35F9491DADFE0942B9242AE461419A015B0142039DC6B05756344F29C93208B`
- `03-hold-contact-desktop.png` `67F452FC939F225CCE2C4E85A6A0378C4A0646376ACEB3B720FA706CCB63B744`
- `04-customer-bookings-desktop.png` `3BC333EA413D2A38BBEB1291AD5B82E98DC32BB43D9299E3A424A162940AC67D`
- `05-customer-profile-desktop.png` `EB1C3A77669BD5D39446CDF390E480F1C2FDD6CEF775B236AF840E9250E5FCB9`
- `06-admin-report-nonempty-desktop.png` `6BF853FCB59BE86FAD5FD8850D061A2CE722608DE540CA37D32179F724F72C2A`
- `07-admin-room-operations-desktop.png` `4EEAC86744FFF30C3667F329289B9436A804EA60A245B21BE48F09CBB312C6B4`
- `08-admin-bookings-desktop.png` `30BD23504F7AA4B0C8198E5A00E925CC954592140EC83FE91AE738153EA1FB85`
- `09-admin-payments-desktop.png` `27612C0C7BD7053E9C503F1C77808BE6EAE199282C7074B659016E54253773E6`
- `10-admin-rate-plans-desktop.png` `00425C6D0A0EB677545F1EC74A701664AC034D5375F5A67AD70802011DA73D12`
- `11-admin-operational-reviews-desktop.png` `B3E7E3CC88AD73CE87FAEEC5270AB0FB4E3793D15B386E1B9BF11AC8C094536A`
- `12-admin-room-operations-mobile.png` `84CE4BCAEB3B9BCC1058C0EE980687AC2D3AB5DCE146B24C8CA4791546CF8735`
- `13-admin-report-nonempty-mobile.png` `58F8B47FFF0CC58BD6292160E8F5C84F1FCFA396724ECB3617ACFA2C7CF7FE35`

## 7. Report metrics

The report is property-scoped, uses `Asia/Ho_Chi_Minh` local-day bucketing, and renders server aggregates only. Gross excludes `CANCELLED` and `EXPIRED`; settled requires `SUCCEEDED`; booking count includes terminal states; customers are distinct non-null customer ids; returning customers have more than one filtered booking. Outstanding remains `null`, not an inferred subtraction, because partial payment is deferred. Final fixture verification is recorded below.

## 8. Google

Formal live-local acceptance requires manual Google account selection and is never password, MFA, cookie, or token automated. `pnpm test:e2e:google-live-local` returned `LIVE_ACCEPTANCE=NOT_RUN_MANUAL_CHECKPOINT_REQUIRED`; therefore `GOOGLE_LIVE_LOCAL=BLOCKED_USER_INTERACTION_REQUIRED`, despite local configuration/code readiness passing.

## 9. HTTPS callback

Public callback acceptance requires a reachable HTTPS hostname and provider portal registration. `CALLBACK_URL_SINGLE_AUTHORITY=PASS` and `CALLBACK_HOST_VALIDATION=PASS`, but `PUBLIC_HTTPS_CALLBACK_LIVE=BLOCKED_PUBLIC_HTTPS_CALLBACK_UNAVAILABLE`. No public hostname is configured, so no fabricated portal URLs were submitted. Required paths after a hostname exists are `/api/v1/payments/providers/vnpay/return`, `/api/v1/webhooks/vnpay`, `/api/v1/payments/providers/momo/return`, and `/api/v1/webhooks/momo`.

## 10. VNPAY

Only a completed sandbox browser interaction plus a signed IPN can establish live acceptance. `pnpm test:e2e:vnpay-sandbox` returned `LIVE_ACCEPTANCE=NOT_RUN_MANUAL_CHECKPOINT_REQUIRED`; final status is `VNPAY_SANDBOX_LIVE=BLOCKED_PUBLIC_HTTPS_CALLBACK_UNAVAILABLE` (and manual sandbox/portal completion remains required).

## 11. MoMo

MoMo sandbox runs only with supplied sandbox merchant credentials. `pnpm test:e2e:momo-sandbox` returned `MOMO_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS`; required variables are `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, and `MOMO_API_BASE_URL`. The deterministic simulator is not merchant acceptance.

## 12. SMTP

Mailpit remains the deterministic default. `pnpm test:email:live` returned `SMTP_LIVE=BLOCKED_MISSING_SMTP_CREDENTIALS`; a verified sender plus `SMTP_LIVE_TEST_RECIPIENT` are required. Mailpit's local readiness passed.

## 13. Regression

All results below ran after the capture-helper correction; the documentation-only commit follows them.

| Command / evidence                                             | Final result                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check:providers`, `check:features`, `check:google-oauth` | PASS for repository readiness; external statuses remain the explicit BLOCKED values above                                                     |
| `pnpm check:i18n-critical`                                     | PASS: 76 files scanned, 0 direct Vietnamese copy                                                                                              |
| `pnpm check:endpoints` / `pnpm check:openapi`                  | PASS: 78 runtime = 74 documented + 4 allowlisted; admin 39, public 19, coupon validation 11/11                                                |
| `pnpm lint`, `pnpm typecheck`, `pnpm build`                    | PASS: 9/9 lint, 9/9 typecheck, 9/9 build tasks                                                                                                |
| `pnpm test:unit`                                               | PASS: database 17, contracts 263, API 307, worker 150, plus remaining package suites; existing non-failing test logs are not product failures |
| `pnpm db:check`, `pnpm db:status`, `pnpm db:test`              | PASS; schema `phase-8d-client-acceptance-v1`; 22 files / 165 integration tests                                                                |
| `pnpm audit --prod --audit-level=high`                         | PASS exit status; audit reports 1 low and 1 moderate, no high severity                                                                        |
| focused axe suite                                              | PASS: 10 files / 48 tests, `AXE_CRITICAL=0`                                                                                                   |
| `pnpm test:e2e` post-fix run 1                                 | PASS: 72 tests plus 1 unavailable-provider assertion; no hydration diagnostic                                                                 |
| `pnpm test:e2e` post-fix run 2                                 | PASS: 72 tests plus 1 unavailable-provider assertion; no hydration diagnostic                                                                 |
| `pnpm demo:preflight`, `demo:lifecycle-test`, `demo:smoke`     | PASS; lifecycle 15/15 twice, smoke 22/22, four owned PIDs gone, disposable databases removed, port 3001 unchanged (`PID 53976`)               |

## 14. Production blockers

`PRODUCTION_READINESS=NO`. Blocking prerequisites: hosting; production database/Redis/worker; stable domain and TLS; trusted proxy deployment; production Google OAuth/verified domains; merchant approvals and callback registration; production SMTP/verified sender; monitoring/alerting; backups and restore test; secret manager; incident runbook; and security review. This local/sandbox completion does not represent production deployment.

## 15. Final verdict

`FINAL_REPOSITORY_ACCEPTANCE=PASS` for the repository-owned local/sandbox scope. `PRODUCTION_READINESS=NO`. External provider statuses remain exact `BLOCKED` values until the stated human/provider action actually completes.

## 16. Rollback

Rollback boundary is the final documentation commit from this phase. Use `git revert` of final-phase commits newest-first; do not reset, rewrite released migrations, delete Docker volumes, or alter the protected 3001 listener. The capture correction is independently reversible before the documentation commit.
