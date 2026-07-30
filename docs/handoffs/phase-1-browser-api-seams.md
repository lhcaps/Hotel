# Phase 1 Handoff: Quality Gate Stabilization and P0 Browser/API Seams

## Summary

Phase 1 closed every P0 browser/API seam identified during the Phase 0 audit and
restored all of the static and database quality gates that were red at the start
of the session. The local demo is **not** yet ready (`LOCAL_DEMO_READY=NO`); this
phase is the seam-fixing prerequisite for Phase 2 (CUSTOMER vertical) and
Phase 3 (ADMIN vertical).

## Repository state

| Item                            | Value                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                          | `phase1-browser-api-seams`                                                                                                              |
| Phase 1 start SHA (github-main) | `495b9a7476d94d052c052973326f4bccb9eb99ad`                                                                                              |
| Functional HEAD (last code)     | `2fc59fb9abc26b0da1d72348d9da08abd4b6086a`                                                                                              |
| Phase 1.1 final SHA             | `50c08255921d53cffe30ebd961285d5e254a3313`                                                                                              |
| Working tree at end of phase    | clean (Next.js dev tooling rewrites `apps/web/next-env.d.ts` during Playwright runs; restored on each closure)                          |
| Phase 0 production changes      | 0                                                                                                                                       |
| Phase 1 production changes      | YES (see Rollback boundary for the exact source files)                                                                                 |
| Released migration SQL changes  | 0                                                                                                                                       |
| Package version changes         | 0                                                                                                                                       |

## Commit chain (16 forward-only commits)

The functional work landed in 14 commits on top of `github-main`. Phase 1.1
adds 2 more commits: the new browser payment-redirect tests and this handoff
reconciliation.

```
50c0825 docs(handoff): reconcile phase 1 closure evidence
86b9c3d test(e2e): prove simulator redirects through the browser
2fc59fb test(api,web): align nearby priceability test with expandMinutes > 0 and clean unused helper
eeaf367 test(db): fix sha256 variable shadowing in migration provenance test
605756c fix(db): relocate migration provenance manifest outside drizzle meta to avoid kit validation conflicts
e9f6b61 fix(db): relocate migration provenance manifest outside drizzle meta to avoid kit validation conflicts
31217a1 chore(format): normalize phase1 browser api seam files
da5918d test(e2e): prove phase1 browser api seams with real Chromium
30085f3 fix(recommendation): use recommendation plan code and update e2e nearby route to /public/availability/nearby
a9f4304 fix(i18n): localize critical customer booking copy and nearby interval datetime
fd2837c fix(api): omit unpriceable nearby room suggestions and gate web booking CTA on offer presence
0a4fbba fix(quote): preserve selected plan across coupon requote and stay-time recommendation
f9d72b0 fix(web): correct nearby route, safe simulator redirect, and cross-midnight hourly interval
a42e16c chore(format): normalize repository formatting
1812076 test(web,db): reproduce phase 1 browser api seam failures and durable migration provenance
653b269 docs(handoff): record phase 0 local demo baseline
```

Author / committer on every commit: `lhcaps <huyle210525@gmail.com>`. Zero
`Co-authored-by:` trailers.

### Duplicate `fix(db): relocate migration provenance manifest` commits

Commits `e9f6b61` and `605756c` share the same commit subject but contain
distinct content. They are **not** duplicates that should be squashed — they
document a deliberate two-step relocation:

- `e9f6b61` (rename-only): moves
  `packages/database/drizzle/meta/migration-provenance.json` →
  `packages/database/drizzle/migration-provenance.json`. `R100`, 0 insertions,
  0 deletions. This alone is what triggered the relocation.
- `605756c` (follow-up): updates `.prettierignore`,
  `packages/database/test/integration/historical-migration-identity.test.ts`,
  and `scripts/database/refresh-migration-provenance.ts` to point at the new
  manifest path.

Both commits are forward-only, authored by `lhcaps`, and required for the
manifest to be discoverable by every consumer. They are preserved as recorded
above — no squash, no amend, no rebase.

## Phase 0 handoff correction

The Phase 0 handoff (`docs/handoffs/phase-0-local-demo-baseline.md`) was
corrected in commit `653b269` so that it reflects the actual end-of-phase state:

- `WORKTREE_CLEAN=YES` (true after the handoff file is itself committed)
- Runtime browser reproduction: **not run** during Phase 0
- `PHASE_0_FORMAL_PASS=CONDITIONAL`
- `READY_TO_START_PHASE_1=YES`

The original wording implied that the browser blockers had been reproduced at
runtime; the corrected handoff makes the distinction explicit.

`PHASE_0_PRODUCTION_SOURCE_CHANGES=0` — Phase 0 was docs + planning only.

## Format gate disposition

`pnpm format:check` was red at the start of Phase 1 (≈314 files reported by
the gate). Prettier-ignore review identified these generated / immutable
artifacts as legitimately outside Prettier's manual ownership:

- `packages/database/drizzle/meta/snapshot-*.json` (Drizzle-kit generated)
- `docs/audit/**/artifacts/**` (audit tooling output)
- `output/**` (release/audit output directory)
- `docs/audit/api-source-map-*.md` (audit tooling)
- `packages/database/drizzle/migration-provenance.json` (manifest)

After this disposition the full repository was formatted and committed as
`chore(format): normalize repository formatting` (commits `a42e16c` and
`31217a1` — split between baseline and the seam-fix files). Phase 1.1 added
a third pass to format the new Phase 1.1 spec file.

Result: `pnpm format:check` → exit 0.

## Migration provenance repair

`packages/database/test/integration/historical-migration-identity.test.ts`
required historic phase commit prefixes in current Git ancestry. The repository
was published as a single clean root commit, so 7 of those tests were
structurally unprovable.

The durable replacement introduced a manifest-driven design:

- `packages/database/drizzle/migration-provenance.json` — a machine-readable
  manifest containing `{ index, fileName, sha256, previousIntroductionReference? }`
  entries for every released migration. SHA-256 is computed over the migration
  SQL file content (lowercase hex).
- `scripts/database/refresh-migration-provenance.ts` — guarded refresh script.
  Refuses to overwrite hashes for already-released migrations unless
  `--allow-rewrite-released` is supplied. Use only for intentional forward
  migration releases.
- `historical-migration-identity.test.ts` — rewritten to assert:
  1. `_journal.json` and migration files match one-to-one
  2. monotonic journal indices
  3. no duplicate journal numbers
  4. every released migration has a manifest entry
  5. SQL SHA-256 equals the manifest
  6. released migration content unchanged
  7. informational historical references do not need to exist in current
     squash-published Git ancestry

Final run: `pnpm db:test` → 22 files, **164 tests passed (0 failed)**.

The manifest was also moved from `drizzle/meta/` (where drizzle-kit's
internal validator flagged it as malformed) to `drizzle/` to avoid
drizzle-kit schema checks. This triggered the small follow-up commits
`eeaf367` (sha256 parameter-shadowing bug) and `605756c` (path updates in
test + script + prettierignore).

## P0 browser/API seam fixes

### A. Nearby route

- **Before**: `publicApi.searchNearbyAvailability` POSTed to
  `/api/v1/availability/nearby` (an ADMIN endpoint, not the public one).
- **After**: `apps/web/src/lib/admin-api.ts` posts to
  `/api/v1/public/availability/nearby`.
- **Web unit test**: `apps/web/test/public-nearby-api.test.ts` asserts the
  exact URL with `expect(...).toBe(...)` (no `toMatch`).
- **E2E matcher**: `tests/e2e/landing-nearby-journey.spec.ts` was updated to
  intercept the correct path.
- **Evidence**: `tests/e2e/phase1-browser-api-seams.spec.ts` test
  "A. EXACT EMPTY → NEARBY" mocks the public route, submits an exact-empty
  search, then asserts:
  - exactly one POST to `/public/availability/nearby`
  - **zero** requests to the old `/availability/nearby`
  - nearby card shows a localized interval (no raw ISO timestamps)
  - nearby card shows a real offer price

### B. Payment redirect policy

- New helper: `apps/web/src/lib/payment-redirect.ts`
  `assertSafePaymentRedirect(rawUrl, runtime)` returns a parsed `URL` or throws.
- Allowed: `https:` in any runtime, `http:` only when `runtime ∈ {development, test}`
  and host is `localhost`, `127.0.0.1`, or `[::1]`.
- Rejected: `javascript:`, `data:`, `file:`, embedded credentials, malformed
  URLs, `http:` to non-loopback hosts, and `http:` in production.
- Integrated in `apps/web/src/components/payment-provider-selector.tsx`.
  Runtime is supplied via `NEXT_PUBLIC_PAYMENT_REDIRECT_RUNTIME`.
- **Web unit test**: `apps/web/test/payment-redirect.test.ts` covers the full
  policy matrix.
- **Browser evidence** (Phase 1.1): real Playwright/Chromium scenarios D, E, F, G
  in `tests/e2e/phase1-browser-api-seams.spec.ts` — see Browser evidence below.

### C. Cross-midnight hourly interval

- New helper: `buildHourlyInterval({ date, time, durationMinutes })` in
  `apps/web/src/lib/booking-search-state.ts`. Uses `Intl.DateTimeFormat` with
  `Asia/Ho_Chi_Minh` to serialize +07:00 and to compute the rolling day,
  month, and year deltas. Rounds the start to the next quarter hour.
- Validation: rejects duration < 60, > 1440, not divisible by 15, and
  invalid `YYYY-MM-DD` / `HH:mm`.
- The legacy `addMinutes` helper was removed.
- **Web unit test**: `apps/web/test/hourly-interval.test.ts` covers the
  spec matrix:
  - `2026-07-31 20:00 + 180` → `2026-07-31T23:00:00+07:00`
  - `2026-07-31 23:00 + 180` → `2026-08-01T02:00:00+07:00` (day rollover)
  - `2026-12-31 23:45 + 60` → `2027-01-01T00:45:00+07:00` (year rollover)
  - `2026-07-31 23:53` → `2026-08-01T00:00:00+07:00` (quarter rounding
    with day rollover)
- **E2E**: `tests/e2e/phase1-browser-api-seams.spec.ts` test
  "B. CROSS MIDNIGHT" submits `2026-07-31T23:00` → `2026-08-01T02:00` and
  asserts the API receives `+07:00` offsets, not UTC.

### D. Coupon plan parity

- `QuoteContext` now carries `selectedPlanCode?: string`.
- `apps/web/src/app/booking/quote/[quoteId]/page.tsx` reads
  `selectedPlanCode` from the URL search parameters and forwards it into
  the `QuoteView` context.
- `apps/web/src/components/quote-view.tsx` propagates the plan through
  `reissueQuote` and `buildContextQuery`, both when applying a coupon and
  when clearing a coupon. The plan is never inferred from the first
  eligible offer.
- Stay-time recommendations use the recommendation's chosen plan
  explicitly (`apps/web/src/components/stay-time-recommendations.tsx`).
- **Web unit test**: `apps/web/test/quote-view-coupon.test.tsx` verifies
  plan parity across apply/clear coupon paths and across multiple plans.

### E. Unpriceable nearby room types

- `apps/api/src/pricing/nearby-availability.service.ts` filters
  `entry.offer !== null` after `availableRoomCount > 0` is confirmed.
- `apps/web/src/components/availability-search-results.tsx` gates the
  booking CTA on `availableRoomCount > 0 && offer !== null` as a
  defensive check. The Web does not compute prices.
- Interval display now uses `formatDateTime(locale, value)` — no raw ISO
  on nearby cards.
- **Integration test**: `apps/api/test/integration/nearby-availability-priceability.test.ts`
  asserts that the response schema, candidate structure, and offer
  invariants all hold when querying the service with the demo seed.

### F. Critical customer i18n

- New keys added to `apps/web/src/lib/i18n/messages.ts` (vi + en):
  `ratePlan.includeDuration`, `ratePlan.includedDurationCopy`,
  `ratePlan.extraHourCopy`, `hold.printConfirmation`.
- Hard-coded English removed from
  `apps/web/src/components/room-detail-quote-action.tsx` and
  `apps/web/src/components/booking-detail-panel.tsx`.
- Nearby interval uses `formatDateTime(locale, candidate.checkIn/checkOut)`.
- **Web unit test**: `apps/web/test/i18n-critical-copy.test.tsx` asserts that
  none of the listed strings render raw and that all localized text is
  pulled from the typed VI/EN dictionary.
- `pnpm check:i18n-critical` → `DIRECT_VI_COPY_CRITICAL_SOURCE=0`.

## Browser evidence

Real Chromium via Playwright against the live demo stack (API on 3101,
Web on 3100, MoMo + VNPAY simulator on 3090, disposable PostgreSQL).

### Functional runs (Phase 1, commit `da5918d`)

| Run | Command | Result | Duration |
|-----|---------|--------|----------|
| 1   | `pnpm exec playwright test tests/e2e/phase1-browser-api-seams.spec.ts --workers=1 --retries=0` | 2 / 2 passed | 14.1 s |
| 2   | same | 2 / 2 passed | 13.9 s |

Coverage: A (nearby), B (cross-midnight). No deterministic skips, no retries.

### Phase 1.1 closure runs (after payment-redirect scenarios were added)

| Run | Command | Result | Duration |
|-----|---------|--------|----------|
| 1   | `pnpm exec playwright test tests/e2e/phase1-browser-api-seams.spec.ts --workers=1 --retries=0` | 6 / 6 passed | 17.8 s |
| 2   | same | 6 / 6 passed | 17.2 s |

Coverage on both runs: A (nearby), B (cross-midnight), D (MoMo redirect),
E (VNPAY redirect), F (unsafe external HTTP rejection), G (production
runtime helper rejection). No deterministic skips, no retries, 1 worker.

Per-test breakdown (Phase 1.1, Run 1 ≈ Run 2):

| Test | Real network | What it asserts |
|------|--------------|-----------------|
| A. EXACT EMPTY → NEARBY             | `/api/v1/public/availability/nearby` POST mocked   | exactly one call to public route, zero calls to old route, localized interval, real offer |
| B. CROSS MIDNIGHT                   | `/api/v1/availability/search` POST captured        | checkIn `2026-07-31T23:00:00+07:00`, checkOut `2026-08-01T02:00:00+07:00` |
| D. MOMO BROWSER REDIRECT            | real API + real simulator at `127.0.0.1:3090`      | click MoMo → browser navigates to `http://127.0.0.1:3090/momo-test/pay?orderId=…` |
| E. VNPAY BROWSER REDIRECT           | real API + real simulator at `127.0.0.1:3090`      | click VNPAY → browser navigates to `http://127.0.0.1:3090/vnpay-test/pay?vnp_TxnRef=…` |
| F. UNSAFE REDIRECT                  | `/api/v1/public/bookings/.../payments/momo/attempts` mocked to return `http://evil.example/pay` | click MoMo → no navigation; localized alert visible; button returns to enabled |
| G. PRODUCTION RUNTIME HELPER        | helper called directly                              | `assertSafePaymentRedirect('http://127.0.0.1:3090/...', 'production')` throws; HTTPS still accepted |

D and E use `cancel` simulator mode so the payment stays PENDING and
does not promote the booking while later assertions run. F intercepts the
initiation response with `http://evil.example/pay` so the browser never
navigates; G exercises the helper at runtime=`production` to lock the
HTTP-rejection contract.

## Validation totals (Phase 1.1 closure re-run)

| Gate                       | Result                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| `pnpm format:check`        | exit 0                                                                       |
| `pnpm lint`                | 9 / 9 packages clean                                                         |
| `pnpm typecheck`           | 9 / 9 packages clean                                                         |
| `pnpm test:unit`           | 21 worker + 56 api + 43 web = 666 tests passed (auth + booking + contracts + config + database + observability + web + worker) |
| `pnpm build`               | 9 / 9 packages build (`@room/web` Next.js production build OK)               |
| `pnpm db:check`            | `Everything's fine 🐶🔥`                                                     |
| `pnpm db:test`             | 22 files, **164 / 164 tests passed**                                         |
| `pnpm test:integration`    | 24 files, **132 / 132 tests passed**                                         |
| `pnpm test:pricing`        | 1 file, **29 / 29 tests passed**                                             |
| `pnpm test:availability`   | 1 file, **5 / 5 tests passed**                                               |
| `pnpm test:quotes`         | 1 file, **3 / 3 tests passed**                                               |
| `pnpm check:openapi`       | `admin: 43 ops, public: 22 ops`; coupon schema 11/11                         |
| `pnpm check:endpoints`     | `85 runtime routes; 81 documented; 4 allowlisted`                            |
| `pnpm check:i18n-critical` | `CRITICAL_SOURCE_FILES_SCANNED=112`, `DIRECT_VI_COPY_CRITICAL_SOURCE=0`      |
| `pnpm audit:deps`          | 1 low, 2 moderate (no high or critical)                                      |

## Phase 1 acceptance verdicts

```
FORMAT_CHECK                              = PASS
DB_TEST                                   = PASS
NEARBY_REQUEST_PATH                       = /api/v1/public/availability/nearby
OLD_NEARBY_REQUEST_COUNT                  = 0
NEARBY_BROWSER                            = PASS
CROSS_MIDNIGHT_BROWSER                    = PASS
MOMO_BROWSER_REDIRECT                     = PASS  (real browser navigation to 127.0.0.1:3090/momo-test/pay)
VNPAY_BROWSER_REDIRECT                    = PASS  (real browser navigation to 127.0.0.1:3090/vnpay-test/pay)
EXTERNAL_HTTP_PAYMENT_REDIRECT            = REJECTED  (helper + browser assertion in scenario F)
PRODUCTION_LOOPBACK_HTTP_REDIRECT         = REJECTED  (helper assertion in scenario G)
CROSS_MIDNIGHT_HOURLY                     = PASS
MONTH_ROLLOVER                            = PASS
YEAR_ROLLOVER                             = PASS
QUARTER_HOUR_VALIDATION                   = PASS
COUPON_APPLY_PLAN_PARITY                  = PASS
COUPON_CLEAR_PLAN_PARITY                  = PASS
UNPRICEABLE_NEARBY_SELECTABLE_RESULTS     = 0
CLIENT_PRICE_AUTHORITY                    = 0
RAW_CRITICAL_ENGLISH_CUSTOMER_COPY        = 0
RAW_NEARBY_ISO_OUTPUT                     = 0
PHASE_1_BROWSER_RUN_1                     = 6 passed / 6 total / 17.8 s (workers=1, retries=0)
PHASE_1_BROWSER_RUN_2                     = 6 passed / 6 total / 17.2 s (workers=1, retries=0)
DETERMINISTIC_SKIPS                       = 0
RETRIES                                   = 0
PHASE_1_HANDOFF_ACCURATE                  = YES
WORKTREE                                  = CLEAN
PHASE_1_PASS                              = YES
LOCAL_DEMO_READY                          = NO
```

`LOCAL_DEMO_READY` remains `NO`. Phase 1 closes only the browser/API seams.
Customer vertical, ADMIN vertical, deterministic demo verifier, UI/accessibility,
and full release gates remain.

## Remaining Phase 2 (CUSTOMER vertical) blockers

These are the items the next phase must close. They were **not** addressed in
Phase 1 and are explicitly out of scope:

1. **DB-only room fallback must be truthful** — when a room detail page
   has no live availability data, the page must either show an explicit
   "check availability" CTA or surface the truth (no availability found)
   rather than fabricating a fallback.
2. **Browse-only room detail needs a search CTA** — room-type pages
   reached from browsing without an active availability search must offer
   an in-page CTA to run a search for that room type, instead of a dead
   end.
3. **Guest session must survive refresh through booking-code route** —
   the customer must be able to refresh or reopen the booking-code
   confirmation page after returning from a payment provider without
   losing session state.
4. **Payment states need visible loading/error/retry/success** — the
   current PaymentProviderSelector shows a redirecting label and a
   generic error. Phase 2 must add explicit success and retry surfaces
   plus a visible loading indicator.
5. **Confirmed booking needs a clear success surface** — after a payment
   settles, the customer must land on (or be redirected to) a page that
   unambiguously confirms the booking and lists the booking code.
6. **MoMo and VNPAY must complete through the browser** — Phase 1 only
   proved the simulator redirect. Phase 2 must walk the full IPN → settle
   → confirmed flow through the browser for both providers.
7. **Full CUSTOMER browser vertical must pass desktop and mobile** —
   cover the entire customer flow at multiple viewports and prove no
   regressions vs the local demo baseline.

Cancellation/refund and review/feedback are explicitly **not** in Phase 2
scope unless current product scope is updated to require them.

## Rollback boundary

Phase 1 changes are isolated to:

- Web: `apps/web/src/lib/admin-api.ts`,
  `apps/web/src/lib/booking-search-state.ts`,
  `apps/web/src/lib/payment-redirect.ts`,
  `apps/web/src/components/payment-provider-selector.tsx`,
  `apps/web/src/components/quote-view.tsx`,
  `apps/web/src/components/availability-search-results.tsx`,
  `apps/web/src/components/booking-detail-panel.tsx`,
  `apps/web/src/components/room-detail-quote-action.tsx`,
  `apps/web/src/components/stay-time-recommendations.tsx`,
  `apps/web/src/components/public-landing.tsx`,
  `apps/web/src/app/booking/quote/[quoteId]/page.tsx`,
  `apps/web/src/lib/i18n/messages.ts`.
- API: `apps/api/src/pricing/nearby-availability.service.ts`.
- Database tooling:
  `packages/database/drizzle/migration-provenance.json`,
  `packages/database/test/integration/historical-migration-identity.test.ts`,
  `scripts/database/refresh-migration-provenance.ts`,
  `.prettierignore`.
- Tests: `apps/web/test/*` (unit), `apps/api/test/integration/*` (one new),
  `tests/e2e/phase1-browser-api-seams.spec.ts`,
  `tests/e2e/landing-nearby-journey.spec.ts` (route matcher),
  `tests/e2e/_fixtures/booking-otp.mjs`,
  `tests/e2e/_fixtures/payment-redirect-helper.mjs`.
- Docs: this handoff and the Phase 0 correction.

To roll back Phase 1: `git reset --hard github-main`. Released migrations are
unchanged; the provenance manifest is additive and git-ignored for formatting
only — deleting it does not affect migration application.
