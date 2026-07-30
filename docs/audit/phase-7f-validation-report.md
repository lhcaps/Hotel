# Phase 7F validation report

## What ran successfully inside the workspace

- `pnpm --filter @room/config test:unit` — 52 tests, all green (covers
  Google + deterministic OAuth env contract; rejects the
  `ROOM_TEST_OAUTH_*` switch in production and accepts it in
  development/test).
- `pnpm --filter @room/auth test:unit` — 16 tests, all green (9 prior
  - 7 security tests in `auth-factory-security.test.ts`).
- `pnpm --filter @room/database test:unit` — 17 tests, all green.
- `pnpm --filter @room/database db:test` — 129 integration tests, all
  green, after the schema version was bumped to
  `phase-7f-google-customer-identity-v1`.
- `pnpm --filter @room/api test:unit` — 168 unit tests, all green
  (163 prior + 5 new `customer-session.service.test.ts` cases).
- `pnpm --filter @room/api test:integration` — 68 catalog integration
  tests, all green. The new `customer-module.integration.test.ts`
  covers the profile patch + audit, ownership list, claim races,
  DISABLED CUSTOMER guard, authoritative payment status, and
  cross-CUSTOMER detail isolation.
- `pnpm --filter @room/api test:integration -- customer-oauth.deterministic` —
  8 deterministic OAuth end-to-end tests, all green. Exercises the
  full Better Auth HTTP flow (authenticate, callback, session mint)
  against a real PostgreSQL database through a localhost OIDC test
  server. Harness is gated by `NODE_ENV === 'test'`.
- `pnpm --filter @room/web test:unit` — 82 tests, all green (login
  page, customer-login client branch on test mode, account pages).
- `pnpm test:e2e` — 40 Playwright tests + 1 unavailable-suite test,
  all green. Includes the new `customer-identity-browser.spec.ts`
  (12 cases) which exercises the full Better Auth HTTP roundtrip
  through Chromium against the deterministic OIDC test server, plus
  the existing `customer-identity.spec.ts` (3 cases) adapted to the
  dual-mode (Google button / test-oidc button) login presentation.
  Total runtime: ~73s (main) + 4s (unavailable).
- `pnpm demo:lifecycle-test` — 15/15 demo lifecycle gates, including
  smoke 18/18, all green. The demo orchestrator starts the API, web,
  worker, runs the smoke flow, shuts everything down, and asserts
  that every disposable artefact (database, manifest, password file)
  is gone and the protected port 3001 owner is unchanged. The demo
  uses no Google credentials; the customer module is opt-in via the
  deterministic OAuth switch in tests only.
- `pnpm --filter @room/api typecheck` — clean.
- `pnpm --filter @room/web typecheck` — clean.
- `pnpm --filter @room/booking typecheck` — clean.
- `pnpm --filter @room/auth typecheck` — clean.
- `pnpm --filter @room/config typecheck` — clean.
- `pnpm --filter @room/database typecheck` — clean.
- `pnpm lint` — workspace lint across 9 packages, all green.

## What was deliberately skipped

- Live Google OAuth provider acceptance: no real client credentials in
  the workspace. The configuration is fully wired and validated by
  `packages/config` tests, and the full OAuth surface is exercised by
  the deterministic harness in `apps/api/test/integration/customer-oauth.deterministic.integration.test.ts`
  against a localhost OIDC test server. A real provider handshake was
  not attempted because it requires operator-supplied Google credentials.
- Live Google button through a real browser is not claimed; the
  Playwright browser vertical signs in via the deterministic
  test-oidc control (`ROOM_TEST_OAUTH_BROWSER_ENABLED=true` is wired
  in the Playwright global setup only and rejected in production by
  `packages/config`). This is the documented substitution: a real
  browser against real Google credentials is the next operator step.

## What changed in the build

- `packages/database/drizzle/0014_phase7f_google_customer_identity.sql`
  — new forward-only migration.
- `packages/database/src/schema.ts` — adds `customer_user_id` on
  `bookings` and the `customer_profiles` table.
- `packages/database/src/schema-status.ts` — bumps
  `EXPECTED_SCHEMA_VERSION` to `phase-7f-google-customer-identity-v1`.
- `packages/database/test/integration/historical-migration-identity.test.ts`
  — expects 14 committed migrations and 0014 snapshot.
- `packages/config/src/index.ts` — adds `GOOGLE_AUTH_*`,
  `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, and the test-only
  `ROOM_TEST_OAUTH_*` envs with strict validation. The test switch
  is gated by `NODE_ENV !== 'production'`; the browser-mode switch
  is server-only and never exposed to the client bundle.
- `packages/auth/src/auth-factory.ts` — adds Google social provider
  config with `mapProfileToUser → role: 'CUSTOMER'`,
  `additionalFields.role` with `input: false`, `accountLinking`
  disabled, and a `generateId` function that emits `crypto.randomUUID()`
  so Better Auth's id generator is compatible with the
  `verification_records.uuid` column while leaving `sessions.id`
  unchanged (text, accepts the UUID string).
- `packages/auth/src/auth-factory.ts` — `trustedOrigins` extended to
  accept the loopback alias (`localhost` ↔ `127.0.0.1`) when the
  configured `WEB_ORIGIN` is one of them, so browser-initiated
  cross-origin requests pass the Better Auth origin check regardless
  of which loopback host Chromium binds to.
- `packages/auth/src/google-auth.ts` — new helper that builds the
  Better Auth Google provider block.
- `packages/booking/src/repository/booking-repository.ts` and
  `services/create-booking-hold.ts` — accept an optional
  `customerUserId` parameter.
- `apps/api/src/customer/*` — new module with profile, claim, and
  booking list/detail services and controllers.
- `apps/api/src/customer/customer-booking.service.ts` — derives the
  `paymentStatus` field from the authoritative `payments` table.
- `apps/api/src/auth/customer-session.service.ts` — new role filter
  that reuses `AdminSessionService` semantics.
- `apps/api/src/auth/auth.controller.ts` — new `@Controller({ path:
'auth', version: VERSION_NEUTRAL })` with `@Get('*')` / `@Post('*')`
  catch-alls delegating to `auth.handler`. Replaces the prior
  Fastify-bridge approach so `/api/auth/*` is routed by NestJS and
  participates in versioning and global filters.
- `apps/api/src/errors/problem-details.filter.ts` — maps
  `CustomerSessionRequiredError → 401` and `CustomerDisabledError →
403` with explicit problem-detail bodies instead of falling
  through to a generic 500.
- `apps/api/src/main.ts` — restored the `onRequest` hook that sets
  `x-request-id` (and echoes `x-correlation-id`) on every response;
  the foundation Playwright test depends on this header.
- `apps/api/test/oauth/oidc-test-server.ts` — localhost OIDC server for
  the deterministic OAuth harness; extended with `/test/queue`,
  `/test/clear`, `/test/expire-code`, and `/test/status` endpoints so
  the Playwright browser vertical can queue subjects, replay codes,
  and force provider failures.
- `apps/api/test/playwright-global-setup.ts` — spins up the OIDC
  test server, mirrors the deterministic OAuth env vars into the API
  and web processes, sets `NEXT_PUBLIC_API_BASE_URL` to the
  `/api/v1`-suffixed URL so admin pages reach the catalog
  controllers under their versioned prefix, and enables the browser
  test switch (`ROOM_TEST_OAUTH_BROWSER_ENABLED=true`) so the login
  page renders the test-oidc control.
- `apps/api/test/integration/customer-oauth.deterministic.integration.test.ts`
  — eight end-to-end Better Auth cases.
- `apps/api/test/integration/customer-module.integration.test.ts` — six
  end-to-end customer-surface cases (profile + audit, ownership list,
  claim races, DISABLED CUSTOMER, payment status, cross-CUSTOMER detail
  isolation).
- `apps/api/test/customer-session.service.test.ts` — role enforcement
  unit tests.
- `packages/auth/test/auth-factory-security.test.ts` — origin, cookie,
  account linking, and CUSTOMER role default tests.
- `apps/api/eslint.config.mjs` + `apps/web/eslint.config.mjs` updates —
  workspace lint config.
- `tests/e2e/customer-identity.spec.ts` — focused Playwright vertical
  for the login surface and unauthenticated `/account/*` redirects;
  adapted to the dual-mode (Google button / test-oidc button)
  presentation.
- `tests/e2e/customer-identity-browser.spec.ts` — full Better Auth
  HTTP roundtrip through Chromium against the deterministic OIDC
  test server; 12 cases covering first sign-in, repeat sign-in,
  callback safety, profile PATCH, ownership list, logout, admin
  takeover rejection, DISABLED CUSTOMER guard, invalid/reused code
  rejection, provider exchange failure, and the no-error / no-token
  invariant.
- `apps/web/src/app/login/customer-login-presentation.ts` — pure
  presentation derivation branched on the browser-mode switch.
- `apps/web/src/app/login/customer-login-client.tsx` — branches on
  the presentation to call the configured provider (Google or
  test-oidc).
- `apps/web/src/app/login/page.tsx` — server component derives the
  presentation directly from `process.env` so the page can prerender
  without forcing the full web env validation during build.
- `apps/web/src/app/admin/login/page.tsx` and `admin-logout-button.tsx`
  — call `/api/auth/sign-in/email` and `/api/auth/sign-out` against
  the API origin (not the versioned prefix).
- `apps/web/src/app/account/*` — server-side pages for the customer
  identity surface.
