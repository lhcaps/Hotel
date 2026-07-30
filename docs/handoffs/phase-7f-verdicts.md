# Phase 7F verdicts

| # | Verdict | Value | Source |
|---|---------|-------|--------|
| 1 | Phase completion | GREEN-BUILD (build/typecheck/test/lint/e2e/lifecycle all green) | 52 config, 17 db unit, 129 db integration, 16 auth, 168 api unit, 68 api integration, 8 deterministic OAuth, 82 web unit, 40+1 Playwright, 15/15 demo lifecycle |
| 2 | Google contract conformance | CODE-COMPLETE, no live provider acceptance | `@room/config` env + `auth-factory.ts` + `apps/api/test/integration/customer-oauth.deterministic.integration.test.ts` |
| 3 | Customer profile | CODE-COMPLETE + E2E-VERIFIED | `customer_profiles` table + `/customer/profile` + Playwright PATCH |
| 4 | Booking ownership | CODE-COMPLETE + E2E-VERIFIED | `bookings.customer_user_id` + claim txn + Playwright ownership list |
| 5 | Deterministic OAuth harness | CODE-COMPLETE + E2E-VERIFIED (browser) | `apps/api/test/oauth/oidc-test-server.ts` + `customer-oauth.deterministic.integration.test.ts` + `tests/e2e/customer-identity-browser.spec.ts` (12 cases) |
| 6 | Live Google OAuth | NOT VERIFIED | honest blocker: no real client credentials |
| 7 | Production readiness | NO | until real provider run + security review + deploy |

## Honest blockers

- No real `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
  `GOOGLE_REDIRECT_URI`. A live Google OAuth flow cannot be exercised
  inside this workspace without operator-supplied credentials.
- Better Auth's `databaseHooks.session.create.before` was intentionally
  not extended. The `status = 'DISABLED'` check is delegated to the
  application-level session reader used by `AdminSessionService` and
  `CustomerSessionService`. Adding a database hook was rejected as
  outside the scope of the configured Better Auth shape and would
  require a drizzle call inside the hook.
- The deterministic OAuth harness covers the full Better Auth HTTP
  flow (authenticate, callback, session mint) against a real
  PostgreSQL database. The browser-level Playwright vertical
  (`tests/e2e/customer-identity-browser.spec.ts`, 12 cases) exercises
  the same flow through Chromium against the same deterministic
  OIDC test server. A live Google button in a real browser still
  needs operator-supplied credentials.
- The `phase-7c-payment-schema.test.ts`,
  `phase-6-coupon-concurrency-hardening.test.ts`,
  `phase-6-migration-0010-catalog.test.ts` were updated to expect the
  new schema version. `historical-migration-identity.test.ts` now
  treats the committed `0014` migration as expected history.

## What the next operator must do

1. Configure Google OAuth credentials in the production `.env` and
   confirm that the redirect URI matches `GOOGLE_REDIRECT_URI`.
2. Run the deterministic OAuth suite (`pnpm --filter @room/api test:integration -- customer-oauth.deterministic`)
   on every PR that touches the auth package; the suite proves the
   full Better Auth HTTP surface against a real database.
3. Run the Playwright browser vertical
   (`pnpm exec playwright test tests/e2e/customer-identity-browser.spec.ts`)
   on every PR that touches the login or account surfaces; the suite
   proves the full Better Auth HTTP roundtrip through Chromium.
4. Schedule a security review of the deployed OAuth client and the
   production cookie configuration.
5. Re-run the full `pnpm -r typecheck` and `pnpm -r test:unit` suites
   after credential rotation to confirm zero regressions.