# ADR-0007 - Google CUSTOMER identity via Better Auth

**Status:** Accepted
**Date:** 2026-07-27

## Decision

Phase 7F introduces a single, mandatory authentication path for CUSTOMER
identities: Google sign-in through Better Auth. The CUSTOMER role is
assigned exclusively through the Better Auth `mapProfileToUser` hook, which
returns `{ role: 'CUSTOMER' }` for every Google-created user. The
`users.role` and `users.status` columns are also exposed as
`user.additionalFields` with `input: false`, so neither external
registrations nor any HTTP request body can promote a CUSTOMER to an ADMIN
or downgrade them to `DISABLED`.

Email verification is delegated to Google. The CUSTOMER email is taken
verbatim from the verified Google identity. Phone numbers are not assumed
to be present in the Google profile; the `customer_profiles.normalized_phone_e164`
column is nullable and validated to the E.164 shape only when the user
supplies a value.

## Account linking is fail-closed

`account.accountLinking.enabled = false` and `disableImplicitLinking = true`
are passed to Better Auth. A `users.email` case-insensitive unique index
(`users_email_ci_uq`) is enforced at the database layer. The combination
produces the following fail-closed contract:

| Case | Result |
|------|--------|
| First Google login (subject A, email verified) | One new CUSTOMER user, one Google `account` row, one session |
| Repeat login with the same Google subject A and same verified email | Same user, same account, no duplicates |
| Different Google subject B with the same verified email | **Email-collision error** — Better Auth returns a controlled failure, the application surfaces a 401, no duplicate user is created, the database `users_email_ci_uq` is not violated, and no 5xx is leaked |
| Existing ADMIN has email `admin@example.com` and a Google identity with the same verified email is presented | **ADMIN is not linked** — ADMIN row is unchanged, no new CUSTOMER row, no session for the conflicting identity, no role promotion |
| Existing disabled CUSTOMER row that already owns the matching provider account | No usable application session is issued (the application-level session reader rejects `status = 'DISABLED'`) |

The case-insensitive unique index is intentionally not relaxed. Account
linking is never implicitly enabled. ADMINs are never created through
Google sign-in.

Google secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`) live exclusively in the API environment and are
never exposed to the browser. The web app receives only
`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, which gates the visibility of the
Google button on `/login` and never carries credential material.

## Consequences

- There is no local password sign-in for CUSTOMER accounts.
- ADMIN accounts remain bootstrapped through `@room/auth` `bootstrapAdmin`
  and never appear in the Google sign-in flow.
- A future provider (Apple, Microsoft, etc.) must repeat the same
  `mapProfileToUser` discipline; the role safety is per-provider.
- Email cannot be modified through `/api/v1/customer/profile`. The
  `users.email` is the authoritative identity claim.
- Two Google identities that share a verified email will not both
  succeed; the second one is refused. The fail-closed behaviour is the
  contract, not a bug.
- The disabled-user rejection is delegated to the application-level
  session reader (`AdminSessionService` / `CustomerSessionService`).
  When the underlying Better Auth session lookup would still return a
  row for a disabled user, the application reader refuses to mint an
  actor context. The on-disk session row remains in place but is not
  honored.
