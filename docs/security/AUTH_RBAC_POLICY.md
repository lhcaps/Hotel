# Authentication and RBAC policy

This document is the single source of truth for how identities are
created, authenticated, and authorized. It is referenced by every phase
plan that touches identity, sessions, or the customer/admin boundary.

## Roles

- `ADMIN` — full operational access. Granted exclusively through
  `@room/auth`'s `bootstrapAdmin` script. Never created through Google
  sign-in.
- `CUSTOMER` — can sign in with Google (Phase 7F onward), can read
  their own profile and bookings, and can claim guest bookings. Has no
  admin permissions.

## Authentication

- ADMINs sign in through Better Auth's email + password flow. The
  password is required to satisfy the strong-password policy enforced
  by `bootstrapAdmin`.
- CUSTOMERs sign in through Better Auth's Google social provider. The
  social provider is configured to force `role: 'CUSTOMER'` and
  `status: 'ACTIVE'` on creation. Email is taken verbatim from the
  verified Google identity. Phone is not assumed.
- Google sign-in is disabled unless `GOOGLE_AUTH_ENABLED=true` and the
  server configuration accepts the required client id, client secret, and
  redirect URI. The login UI reads only the non-secret server-derived
  state from `GET /api/v1/public/provider-readiness`;
  `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` cannot activate the action. The actual
  client id and secret never reach the browser. Local registration uses the
  API-owned callback `http://localhost:3001/api/auth/callback/google`, not
  the Web port.

## Account linking

- `account.accountLinking.enabled = false` and
  `disableImplicitLinking = true` are set in the Better Auth factory.
- `users.email` carries a case-insensitive unique index
  (`users_email_ci_uq`). A second Google identity that shares the same
  verified email is therefore rejected by the database; the application
  surfaces a controlled authentication failure, never a duplicate user
  row.
- A new user is created on the first Google sign-in. Subsequent
  sign-ins from the same Google identity resolve to that user.
- ADMINs are never linked through Google email. A Google identity
  presenting the email of an existing ADMIN fails closed; the ADMIN row
  is unchanged, no CUSTOMER row is created, and no session is issued.

## Booking ownership

- `bookings.customer_user_id` is nullable. Booking creation accepts an
  optional `customerUserId` from the active CUSTOMER session; the
  browser never provides it.
- The claim flow requires a live guest session bound to the booking
  (HMAC-SHA256 of the session token matches `guest_sessions.token_digest`
  and `booking_id` matches). Email match is metadata only; it never
  authorizes a claim.

## Session security

- Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production. The
  default cookie attributes are set in
  `packages/auth/src/auth-factory.ts`.
- `trustedOrigins` is restricted to `WEB_ORIGIN`.
- Disabled users (`status = 'DISABLED'`) are rejected by the
  application-level session reader (`AdminSessionService`,
  `CustomerSessionService`). Their existing session rows remain in
  place but are not honored.
- Production deployments must set `NODE_ENV=production` so that
  `useSecureCookies` is enabled.

## Production readiness gate

The system is not production-ready until:

1. A live Google OAuth flow has been performed end-to-end against real
   Google credentials.
2. The deployed OAuth client configuration has been security-reviewed.
3. A deployment manifest with the production cookie and origin
   configuration is in place.

## Phase 7G - ADMIN booking lifecycle permissions

Phase 7G adds four fine-grained permissions to the `ADMIN` role:

- `booking.lifecycle.read` — list / detail of bookings.
- `booking.lifecycle.manage` — perform cancel / check-in / check-out /
  no-show transitions.
- `booking.review.read` — list / detail of operational reviews.
- `booking.review.manage` — resolve operational reviews.

All four are gated by `AdminPermissionGuard` + an active
`status = 'ACTIVE'` ADMIN session. The actor id, role, target booking
status, payment status, amount, resolver id, and physical-room
reassignment are never accepted from the browser; the API resolves them
from server-side context. CUSTOMER, guest, SYSTEM_WORKER interactive
identity, DISABLED ADMIN, and ADMIN lacking the relevant permission are
all rejected before any database mutation. The UI is not an
authorization boundary.

## Phase 8C - Payment settlement reconciliation permissions

Phase 8C reuses the Phase 7G operational-review permissions and
extends the categorical coverage to the new reconciliation
categories. The reconciliation worker is a `SYSTEM_WORKER` identity
that opens reviews through the same code path that IPN uses; it does
not bypass the `booking.review.*` permissions because it does not
read or write reviews itself — it only triggers review openings via
the canonical settlement core. ADMIN uses the existing
`booking.review.read` / `booking.review.manage` to inspect and
resolve the new categories:

- `RECONCILIATION_EXHAUSTED`
- `RECONCILIATION_TRANSIENT`
- `RECONCILIATION_NOT_FOUND`
- `RECONCILIATION_STALE_FAILURE`
- `CROSS_PROVIDER_TRANSACTION_CONFLICT`

No new role is introduced. The `SYSTEM_WORKER` identity itself
remains scoped to the worker tick and cannot act as `booking.review.*`.

The reconciliation worker also respects the `payment.providerSettings`
ADMIN toggle introduced in Phase 7G: it never queries a provider that
ADMIN has disabled, and it never persists a raw query response or
secret. The reconciliation worker does not log credentials or PII
beyond what the existing Pino `redact` paths already omit.
