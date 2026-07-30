# Phase 7F Google CUSTOMER identity handoff

## Delivered

CUSTOMER sign-in uses Google (production) or the deterministic
test-oidc provider (test mode). The Better Auth factory
(`packages/auth/src/auth-factory.ts`) accepts a `googleAuth` block and
configures the social provider only when
`GOOGLE_AUTH_ENABLED === 'true'`. `mapProfileToUser` returns
`{ role: 'CUSTOMER' }` for every Google-created user; the
`users.role` and `users.status` columns are `additionalFields` with
`input: false`, so no external surface can promote a CUSTOMER or
disable the account through Better Auth. `account.accountLinking.enabled =
false` and `disableImplicitLinking = true` reject silent merges by
Google email.

A new `customer_profiles` table holds per-CUSTOMER phone and address
fields. The `bookings.customer_user_id` column links bookings to
authenticated CUSTOMERs. The schema migration is
`0014_phase7f_google_customer_identity` and bumps the schema version to
`phase-7f-google-customer-identity-v1`.

`BookingHoldService` accepts an optional `customerUserId` sourced
server-side from an active CUSTOMER session. The browser never sends
it. `ClaimBookingService` performs the guest-to-account claim
transactionally using the existing booking-scoped guest session as the
proof of ownership; email match is recorded as audit metadata only.

New APIs (all under `/api/v1/customer`):

- `GET  /profile` — read the authenticated CUSTOMER profile.
- `PATCH /profile` — update name, E.164 phone, address fields.
- `GET  /bookings?limit=20` — list bookings owned by the CUSTOMER.
- `GET  /bookings/:bookingCode` — booking detail with safe payment
  status string.
- `POST /bookings/:bookingCode/claim` — link a guest booking, requiring
  a guest session bound to the booking.

Better Auth endpoints are wired through a NestJS controller
(`apps/api/src/auth/auth.controller.ts`) under
`@Controller({ path: 'auth', version: VERSION_NEUTRAL })` with
catch-all `@Get('*')` and `@Post('*')` handlers that delegate to the
configured Better Auth `handler`. The controller is version-neutral so
Better Auth's `/api/auth/sign-in/oauth2` (no `/v1`) and the versioned
catalog endpoints (`/api/v1/admin/*`) coexist. The `ProblemDetailsFilter`
maps `CustomerSessionRequiredError → 401` and
`CustomerDisabledError → 403` with explicit problem-detail bodies.

Web routes:

- `/login` — public page; renders the Google button when
  `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'`, or the deterministic
  test-oidc button when the server-only
  `ROOM_TEST_OAUTH_BROWSER_ENABLED === 'true'`. The
  `customer-login-presentation.ts` derivation is unit-tested.
- `/account`, `/account/bookings`, `/account/bookings/:bookingCode`,
  `/account/profile` — server components that proxy the API with the
  session cookie.

## Locked contract and safety boundary

- Source: Better Auth 1.6.23 Google social provider plus the Phase 7F
  configuration contract (`packages/config/src/index.ts`). Better Auth
  handles the OAuth code exchange; the API stores the user with
  `role: 'CUSTOMER'` and `status: 'ACTIVE'` regardless of what the
  Google profile claims.
- Google secrets are server-side. The browser only sees
  `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`. The
  `ROOM_TEST_OAUTH_BROWSER_ENABLED` switch is server-only; it is not
  exposed to the client bundle and `packages/config` rejects it in
  `NODE_ENV === 'production'`. `useSecureCookies` is enabled in
  production through `auth-factory.ts`.
- `trustedOrigins` in the auth factory accepts both the configured
  `WEB_ORIGIN` and its loopback alias (`localhost` ↔ `127.0.0.1`) so
  browser-initiated cross-origin requests are accepted regardless of
  which loopback host the browser binds to. This is safe because both
  are localhost.
- ADMIN routes continue to use `@room/auth`'s password-based flow and
  are unaffected. CUSTOMER cookies carry no ADMIN permissions.
- A claim requires a live `guest_sessions` row pointing at the booking
  and an HMAC-SHA256 hash of the session token that matches
  `guest_sessions.token_digest`. Bulk-claiming by email match is
  impossible.

## Deterministic closure evidence

Test inventory after the Phase 7F work:

- `packages/config/test/environment.test.ts` + `playwright-env.test.ts`
  — 52 tests including the deterministic OAuth env cases (disabled,
  missing creds, loopback, invalid URL, production HTTP rejection,
  production loopback rejection, redirect host mismatch, placeholder
  rejection, valid production shape, browser-mode test switch
  acceptance in development/test, browser-mode production rejection).
- `packages/auth/test/google-auth.test.ts` — 5 unit tests covering
  `buildGoogleSocialProvider` failure modes and `mapProfileToUser`.
- `packages/auth/test/permissions.test.ts`, `bootstrap.test.ts`,
  `bootstrap-credentials.test.ts`, `auth-factory-security.test.ts` —
  16 tests including 7 security cases (origin, cookie, account
  linking, CUSTOMER role default).
- `packages/database/test/unit/*` — 17 tests.
- `packages/database/test/integration/*` — 129 integration tests
  passing against the bumped schema, including the migration runner,
  snapshot lineage, and coupon/booking tests.
- `apps/api/test/...` — 168 unit tests including the new
  `customer-profile.schema.test.ts` (10 cases),
  `customer-session.service.test.ts` (5 cases for role enforcement),
  and `auth-factory-security.test.ts` (7 cases for cookie/origin/link).
- `apps/api/test/integration/customer-module.integration.test.ts` — 6
  end-to-end cases covering profile patch + audit, ownership list, claim
  races (link / idempotent / mismatch / already-linked), DISABLED CUSTOMER
  guard, authoritative payment status from the `payments` table, and
  cross-CUSTOMER detail isolation. Total: 68 catalog integration tests
  passing.
- `apps/api/test/oauth/oidc-test-server.ts` plus
  `apps/api/test/integration/customer-oauth.deterministic.integration.test.ts`
  — eight deterministic end-to-end OAuth cases exercising the full
  Better Auth HTTP flow against a real PostgreSQL database:

    1. first sign-in → one CUSTOMER + one Google `accounts` row + one
       session.
    2. repeat sign-in reuses the same CUSTOMER row.
    3. different Google subject with the same verified email does
       not silently link.
    4. replayed authorization code is rejected with `invalid_grant`.
    5. exchange of an unknown code returns `invalid_grant`.
    6. provider-forced error aborts the flow without persisting a
       user.
    7. missing email claim fails closed (no user row).
    8. ACTIVE CUSTOMER signs in; DISABLED CUSTOMER is refused.

  The harness is gated by `NODE_ENV === 'test'`; production builds
  no longer add `genericOAuth`.

- `apps/web/test/...` — 82 tests covering the login page,
  customer-login client (Google + test-oidc branches), and the
  customer-facing account pages.
- `tests/e2e/customer-identity.spec.ts` — 3 Playwright cases
  covering the public `/login` render (Google button OR
  deterministic test-oidc button) and the unauthenticated
  `/account/profile` and `/account` redirects.
- `tests/e2e/customer-identity-browser.spec.ts` — 12 Playwright
  cases exercising the full Better Auth HTTP roundtrip through
  Chromium against the deterministic OIDC test server:

    1. DEBUG: capture redirect chain during sign-in
    2. renders the deterministic test-identity control on `/login`
    3. first sign-in creates a usable CUSTOMER session
    4. callback returns only to an allowlisted application URL with
       no token in URL
    5. authenticated `/account/profile` loads and PATCH persists
    6. owned booking list is accessible after sign-in
    7. logout invalidates application access to `/account/*`
    8. existing ADMIN email cannot be taken over by the CUSTOMER
       sign-in flow
    9. DISABLED CUSTOMER receives no usable CUSTOMER route access
    10. invalid / reused authorization code fails safely
    11. provider exchange failure creates no authenticated session
    12. no console, page, or hydration errors during the full flow

  The OIDC test server exposes `/test/queue`, `/test/clear`,
  `/test/expire-code`, and `/test/status` so the Playwright specs
  can queue subjects, replay codes, and force provider failures
  through real HTTP without touching the database directly.

- `pnpm test:e2e` — 40 main + 1 unavailable = 41 Playwright tests,
  all green; runtime ~77s end-to-end.
- `pnpm demo:lifecycle-test` — 15/15 demo lifecycle gates all
  green; smoke 18/18, manifest/DB/port cleanup, protected port
  3001 untouched. The demo does not enable Google; it exercises
  the existing guest + OTP + ADMIN path against a disposable
  database.

Typecheck passes for `@room/api`, `@room/booking`, `@room/auth`,
`@room/config`, `@room/web`. Workspace lint (`pnpm lint`) passes
across all 9 packages after the eslint config work in
`apps/api/eslint.config.mjs` and the browser-globals addition in
`apps/web/eslint.config.mjs`.

## Live gate and next phase

- No real Google OAuth client id, secret, or approved redirect URI was
  configured in this workspace. A live end-to-end sign-in flow is
  therefore not claimed. The configuration is wired and validated; flipping
  `GOOGLE_AUTH_ENABLED=true` with valid `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` is the only step
  needed to attempt a real flow. The Playwright browser vertical
  can then be re-run with `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`
  and the test-oidc switch turned off to verify the Google button
  against real credentials.
- ADMIN sign-in, guest booking, OTP-based booking access, and the MoMo
  and VNPAY payment adapters are unchanged.
- Production readiness remains **NO** until a real provider
  acceptance run, a security review of the deployed OAuth client
  configuration, and a deployment manifest with hardened cookie
  attributes are completed.