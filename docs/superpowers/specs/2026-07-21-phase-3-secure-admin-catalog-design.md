# Phase 3 Secure Admin Catalog Design

## Decision

Phase 3 adds one secure operational vertical slice: a bootstrap-created ADMIN
can log in by email/password, hold a persistent HttpOnly session, operate the
single property's catalog, and create/cancel physical-room maintenance blocks.
Every mutation is authorized on the API and commits its append-only audit event
in the same PostgreSQL transaction. Phase 3 does not add customer login,
availability, quote/pricing execution, booking creation, payments, OTP, Google
OAuth, password recovery, MFA, multi-property support, or deployment.

The database remains the transactional authority. Redis is not consulted for
catalog, authorization, maintenance, or inventory decisions. Existing released
Phase 2 migrations remain untouched.

## Auth integration decision

| Option                                | Assessment                                                                                                                                                                                                                                                                                                                                 | Decision  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Direct Better Auth handler on Fastify | Better Auth 1.6.23 documents a Fetch-compatible Fastify handler and `fromNodeHeaders`; it works with the existing Nest Fastify adapter without a second framework abstraction. Its Drizzle adapter supports `drizzle-orm` 0.45.2. A small bridge can be tested at the HTTP boundary and retains Nest's normal parsing for business routes. | Selected. |
| `@thallesp/nestjs-better-auth`        | Version 2.7.0 matches Nest 11, but Better Auth's own Nest page calls it community-maintained, says Fastify support is beta, and requires disabling Nest's global body parser. That would broaden risk across every business route.                                                                                                         | Rejected. |
| Custom authentication                 | Could fit the schema but would duplicate password hashing, session, CSRF/origin validation, cookie hardening and invalidation that Better Auth provides.                                                                                                                                                                                   | Rejected. |

`@room/auth` owns a factory that receives the already process-owned Drizzle
client, schema and validated auth options. It creates no Pool, never migrates,
does not know catalog mutations, and projects safe identities only. The API
registers the auth catch-all directly with Fastify at `/api/auth/*`; it forwards
method, URL, headers, body and response headers without writing secrets to logs.
Nest remains responsible for `/api/v1/*` controllers.

Better Auth email/password is enabled only for bootstrap-created users. No
public sign-up endpoint is exposed by the web client. The handler is configured
with explicit `WEB_ORIGIN` trusted origins, `SameSite=Lax`, HttpOnly cookies,
production-only Secure cookies, a finite session expiration, and no
cross-subdomain cookie setting. A production proxy configuration is explicit;
untrusted forwarded headers are not accepted.

## Authentication, sessions and authorization

The auth migration creates `users`, `sessions`, `accounts` and
`verification_records` using the model and field names selected by the Drizzle
adapter. `users` carries the fixed human role (`ADMIN` or `CUSTOMER`) and an
active/disabled state. `SYSTEM_WORKER` remains a non-human workload identity
and has no user row or login. The migration inserts no administrator and no
credential.

`admin:bootstrap` is the only ADMIN creation route. It validates a normalized
email and strong password supplied as process environment variables, rejects
production execution unless an explicit guarded operator acknowledgement is
set, delegates password representation to Better Auth, is idempotent by email,
and writes `ADMIN_BOOTSTRAPPED` in the same transaction. It prints neither the
password nor token/hash data.

For every `/api/v1/admin/*` request, an authentication guard derives the
session with `auth.api.getSession` from request headers, rejects missing,
expired, revoked, or disabled users with 401, projects a frozen `ActorContext`,
then looks up permissions in one `ROLE_PERMISSIONS` map. `ADMIN` has all Phase
3 catalog and audit permissions; `CUSTOMER` has none. `@RequirePermissions`
metadata and a Nest guard yield 403 when an authenticated actor lacks a
permission. Controllers never accept user ID, role, session or permission from
the body. `/api/v1/admin/me` returns only safe user fields, permissions and
session expiry. Logout is the Better Auth invalidation endpoint; later admin
requests fail authentication.

## Data and transactions

The forward Phase 3 migration advances `schema_metadata` to
`phase-3-admin-catalog-v1` and updates readiness expectation. It adds the
auth tables, role/status checks, indexes, and any missing catalog operational
fields strictly needed by the approved API (for example, a room archive state
or housekeeping state only if it has an immediate UI/API consumer). Existing
catalog tables are reused rather than duplicated. A generated migration is
reviewed with its Drizzle snapshot and journal; custom SQL is limited to
PostgreSQL invariants the ORM cannot express.

`CatalogRepository` accepts an injected `DatabaseClient` or transaction client
and returns contract-shaped records. `CatalogService` owns mutations: it
validates the command, loads the current property, executes one transaction,
writes the domain row(s), writes a scrubbed audit event, and maps database
unique/exclusion errors to typed domain errors. Forced audit insert failure
rolls back the catalog change.

Maintenance creation creates a source `maintenance_blocks` row and an ACTIVE
`room_inventory_blocks` ledger row in one transaction. The existing GiST
exclusion constraint remains the final concurrency authority; its violation is
translated to `ROOM_TIME_CONFLICT` (409) without emitting SQL, a constraint
name, URL or credentials. Cancellation locks the active source and ledger rows,
marks both historical records cancelled/released, audits the transition, and is
idempotent. It never deletes a source or ledger row.

## API and contracts

`@room/contracts` is the sole Zod source for pagination, safe problem details,
session, property, price tier, room type, amenity, room and maintenance shapes.
It exports schemas and inferred types to the API and web. The API converts Zod
issues to a field-addressable error envelope:

```json
{
  "type": "catalog-conflict",
  "title": "Room time conflict",
  "status": 409,
  "code": "ROOM_TIME_CONFLICT",
  "detail": "The selected room is unavailable in that interval.",
  "requestId": "…",
  "errors": []
}
```

All listed business routes are under `/api/v1/admin`: `me`, `property`, price
tiers, room types, amenities (including room-type assignments), rooms, and
maintenance blocks. Collection routes use bounded pagination and deterministic
ordering. Archive/deactivate operations are state changes, never hard deletes.
The single property's timezone and currency remain locked. A generated OpenAPI
JSON artifact is checked against the shared schemas in CI; Swagger UI is absent
in production.

## Web design

The Next App Router gains `/admin/login`, `/admin`, `/admin/property`,
`/admin/price-tiers`, `/admin/room-types`, `/admin/amenities`, `/admin/rooms`,
`/admin/rooms/new`, `/admin/rooms/[id]`, and `/admin/maintenance`. A single
typed Admin API client includes credentials, preserves request IDs, normalizes
the error envelope, and translates 401 to session-expired handling and 403 to a
visible forbidden state. It does not log request bodies or keep a second global
copy of server state.

`@room/ui` contains only reused Phase 3 components: shell, page header, status
badge, empty/loading/error states, form field/error summary, table/list,
pagination, confirmation dialog and datetime range controls. The shell provides
responsive navigation, current safe identity, logout, breadcrumb and mobile
navigation. The home page shows real setup counts, never fabricated revenue or
occupancy. Forms use shared Zod schemas and React Hook Form, show labels and
field/form errors in page content, preserve a dirty state before navigation,
and expose submit/disabled/success/conflict states.

Visual rules are deliberate typography, spacing, visible focus, semantic
elements, reduced-motion support and responsive layouts. No gradients,
glassmorphism, fake charts, arbitrary icons or generic dashboard widgets are
introduced. Meaningful reusable components get Storybook stories for default,
loading, empty, validation error, API error, disabled, confirmation, long
Vietnamese text, narrow viewport and reduced motion; critical stories receive
accessibility checks.

## Validation and security

Tests proceed RED → GREEN per behavior. Guarded real PostgreSQL tests cover the
new migration, old Phase 2 invariants, bootstrap, disabled/expired sessions,
permission boundaries, catalog persistence/archiving, transaction rollback,
maintenance overlap/touching intervals/different rooms and cancellation.
API tests cover anonymous 401, CUSTOMER 403, ADMIN success and normalized
validation/conflict errors. Component tests cover keyboard/focus/error state;
Playwright uses a real test ADMIN, API, web and disposable PostgreSQL database
for the required auth, authorization, catalog, conflict, maintenance and
responsive/accessibility flows.

Request and correlation IDs remain present in normalized errors and logs. Pino
redaction is extended and tested for Better Auth cookies/session/token/password
paths. Login gets an approved rate limiter backed only by a non-authoritative
mechanism; it does not change catalog/inventory authority. Public ADMIN signup,
role selection, token URL/localStorage storage, wildcard credentialed CORS,
raw database error leakage and plaintext secrets are blocked by tests.

## Rollout, rollback and risks

The deployment order is: apply the reviewed forward migration; run
`db:status`; invoke guarded bootstrap through a secure operator shell; deploy
API/web; verify login and a non-destructive read; monitor auth failures and
database error rate. The application never runs migrations automatically.
Rollback stops application release only. A schema issue is repaired by a new
reviewed forward migration; no released migration, journal or snapshot is
rewritten. Catalog history, audit history and maintenance history are retained.

Residual risks: Phase 3 has no MFA, password reset delivery, external identity
provider or production operator proof. MFA is a mandatory before-production
control. Local evidence cannot prove a production proxy's TLS/cookie behavior,
real threat monitoring, or GitHub Actions Gitleaks availability; CI retains the
remote Gitleaks action and the documented dependency-audit policy.

## Design self-review

This design has no TODO/TBD/placeholders; preserves Phase 2 ownership and
invariants; names one auth and contracts source of truth; confines auth to a
direct Fastify bridge; specifies forward-only recovery; and maps every included
vertical slice to a testable boundary. No Phase 4 feature appears in scope.
