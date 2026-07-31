# Phase 3A — ADMIN Authority Foundation Handoff

> **Baseline:** `93b056401c03d68da1f9d6cadd62eabdfd24ce97`
> **Branch:** `phase3-admin-operational-vertical`
> **Worktree:** `D:\Study\Project\Room-Management-phase3`
>
> **Scope:** Server-side administrator authority boundary, runtime
> validation of `/admin/me`, CUSTOMER/ADMIN session separation,
> focused Playwright suite, protected ADMIN shell.
>
> **Out of scope (handled by Phase 3B/C/D):** catalog mutations,
> archive safety, booking lifecycle, payment reconciliation,
> refund, reporting, accessibility, Phase 4 verifier.

---

## 1. Starting SHA and commit chain

| SHA       | Subject |
|-----------|---------|
| `93b0564` | starting baseline (Phase 2.1 closure handoff) |
| `928fa58` | test(admin): reproduce admin authority boundary gaps |
| `2a9f1f0` | feat(admin): server-gate protected admin routes |
| `bf4d4b8` | fix(admin): validate admin session responses at runtime |

(Final SHAs printed by `git log --oneline --decorate -n 10`.)

Author and committer are both `lhcaps <huyle210525@gmail.com>` on
every commit. No `Co-authored-by` trailers.

---

## 2. Actual repository architecture discovered

The repository is a pnpm + Turborepo monorepo. The relevant shape
for Phase 3A is:

```
apps/
  api/    NestJS API (3101 in Playwright)
  web/    Next.js 16 App Router (3100 in Playwright)
  worker/ continuous worker (drives HOLD_EXPIRATION etc.)
packages/
  auth/        Better Auth factory, permissions, ADMIN bootstrap
  contracts/   Zod schemas + types, exported via subpath exports
  database/    Drizzle ORM, prepared guarded test databases
  config/      shared runtime/env config
tests/
  e2e/         Playwright specs, single worker, no retries
```

The administrator layout (`apps/web/src/app/admin/layout.tsx`) was
a single shared layout that rendered the `<SidebarProvider>`
shell for every `/admin/**` path and delegated the actual
authority check to a `'use client'` component
(`apps/web/src/components/admin-access-guard.tsx`). That client
component called `/api/v1/admin/me` from a `useEffect`, which
leaked the public layout skeleton (and part of the sidebar JSX)
into the response before redirecting.

The API authority is already in place: `apps/api/src/admin/admin.controller.ts`
requires `AdminPermissionGuard` with the `catalog.property.read`
permission and returns a response parsed against `adminMeSchema`.
The Better Auth session cookie is `httpOnly`, `sameSite=lax`,
signed by `BETTER_AUTH_SECRET`. No additional API change was
needed for Phase 3A.

---

## 3. Files actually read

- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/components/admin-access-guard.tsx`
- `apps/web/src/components/admin-navigation.tsx`
- `apps/web/src/components/admin-logout-button.tsx`
- `apps/web/src/components/public-header.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/admin/forbidden/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/admin-api.ts`
- `apps/web/src/lib/i18n/messages.ts` (admin section only)
- `apps/web/package.json`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/auth/admin-permission.guard.ts`
- `apps/api/src/auth/admin-session.service.ts`
- `apps/api/src/auth/auth-fastify-bridge.ts`
- `apps/api/src/customer/customer-profile.controller.ts`
- `apps/api/test/admin.controller.test.ts`
- `apps/api/test/playwright-global-setup.ts`
- `packages/contracts/src/admin.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/package.json`
- `packages/auth/src/auth-factory.ts`
- `tests/e2e/admin-auth.spec.ts`
- `tests/e2e/admin-credentials.ts`
- `playwright.config.ts`

---

## 4. FEATURE | API | DB | WEB | TEST | GAP matrix (Phase 3A scope)

| FEATURE | API | DB | WEB | TEST | GAP (before Phase 3A) |
|---------|-----|----|----|------|------------------------|
| `/admin/login` chrome-free shell | `auth.controller` POST `/api/auth/sign-in/email` | `users`, `sessions` | `apps/web/src/app/admin/login/page.tsx` | `tests/e2e/admin-auth.spec.ts` | none |
| Protected `/admin/**` server gate | `GET /api/v1/admin/me` returns AdminMe parsed against `adminMeSchema` | none | `apps/web/src/app/admin/(protected)/layout.tsx` (new) | `tests/e2e/phase-3a-admin-server-gate.spec.ts` (new) | client-side `AdminAccessGuard` ran after the protected shell had streamed; server did not perform the redirect |
| Runtime validation of `/admin/me` | already returns a value matching `adminMeSchema` | none | `apps/web/src/lib/admin-session-server.ts` (new) | `apps/web/src/lib/admin-session-server.test.ts` (new) | no web-side validator; the client guard accepted any 2xx with the right fields |
| CUSTOMER session denial | `GET /api/v1/customer/profile/session` returns `{ authenticated }` | none | server gate redirects with `?customer=1` | `tests/e2e/phase-3a-admin-server-gate.spec.ts` | client guard only checked the customer session on the browser side |
| Public CUSTOMER header absence | n/a | n/a | `apps/web/src/app/layout.tsx` already omits public header on `/admin/**` | `phase-3a-admin-server-gate.spec.ts` asserts | none |
| Logout invalidates protected access | `POST /api/auth/sign-out` clears Better Auth cookie | `sessions` row deleted | `AdminLogoutButton` triggers `router.replace('/admin/login')` | `admin-auth.spec.ts` asserts `/admin/me` returns 401 | none |
| Manipulated role flag | none — the schema constrains `role: z.literal('ADMIN')` | none | resolver treats any non-ADMIN response as malformed | `admin-session-server.test.ts` proves the validator rejects | none |

---

## 5. Server gate implementation

`apps/web/src/app/admin/(protected)/layout.tsx` is an async Server
Component. It runs on every request to a protected `/admin/**`
route. It:

1. reads `cookies()` to forward the inbound HttpOnly session to
   the API;
2. calls `resolveAdminSessionFromHeaders({ cookie })`;
3. redirects to `/admin/login?customer=1` if the resolver returns
   `customer`;
4. redirects to `/admin/login` if the resolver returns
   `unauthenticated` or `malformed`;
5. only then renders the `<SidebarProvider>` shell with the
   protected children.

Because the redirect happens inside the Server Component BEFORE
the protected JSX is rendered, the wire response carries a 307/308
redirect without ever streaming the protected skeleton. The
client-side guard is no longer required and has been deleted.

`apps/web/src/app/admin/layout.tsx` was simplified to a chrome-free
wrapper for the `/admin/login` route only. It detects the login
path via the existing `x-room-pathname` middleware header and
wraps the children in `<div className="admin-login-shell">`. All
non-login admin paths flow through the nested `(protected)/layout.tsx`.

---

## 6. Runtime contract schema

`apps/web/src/lib/admin-session-server.ts` exposes
`resolveAdminSessionFromHeaders(headers, options)`. It:

1. resolves the API base URL from `options.baseUrl` (preferred)
   or `process.env.NEXT_PUBLIC_API_BASE_URL` (fallback);
2. forwards `cookie` (if any) to `/api/v1/admin/me` with
   `credentials: 'omit'` (the server does not need browser cookies);
3. treats 401/403/5xx as `unauthenticated`;
4. parses the body as `unknown` and validates against
   `adminMeSchema` from `@room/contracts/admin`;
5. if validation fails OR `/admin/me` returns invalid JSON,
   surfaces `malformed`;
6. on `unauthenticated`, optionally probes
   `/api/v1/customer/profile/session` and returns `customer` if
   that endpoint reports `authenticated: true`. This is the only
   way the resolver distinguishes a CUSTOMER session from a
   missing cookie, because the schema's `role: z.literal('ADMIN')`
   constraint means any non-ADMIN response from `/admin/me` is
   already filtered to `malformed`.

To make the runtime schema importable from the Next.js bundler, a
new `"./admin"` subpath export was added to
`packages/contracts/package.json` pointing at
`packages/contracts/src/admin.ts`. Other consumers continue to
use type-only imports from `@room/contracts`.

---

## 7. CUSTOMER denial evidence

The resolver returns `customer` only when:

1. `/admin/me` returns 401 (no ADMIN session), AND
2. `/customer/profile/session` returns 200 with
   `{ authenticated: true }`.

The protected layout then `redirect('/admin/login?customer=1')`,
which triggers the existing customer-switch notice in
`apps/web/src/app/admin/login/page.tsx`.

`apps/web/src/lib/admin-session-server.test.ts` proves this with
two mocks: `/admin/me` returns 401, `/customer/profile/session`
returns `{ authenticated: true }`, and the resolver returns
`{ kind: 'customer' }`.

---

## 8. ADMIN acceptance evidence

`apps/web/src/lib/admin-session-server.test.ts` proves:

- a 200 response with the canonical ADMIN shape returns
  `{ kind: 'admin', session }`;
- a 200 response with a malformed shape (bad UUID, bad timestamp,
  bad role) returns `{ kind: 'malformed' }`;
- a 200 response with invalid JSON returns `{ kind: 'malformed' }`;
- a 401/403 returns `{ kind: 'unauthenticated' }`;
- a network error returns `{ kind: 'unauthenticated' }`;
- the inbound cookie is forwarded to `/admin/me` (no session
  rewriting on the server side);
- a response whose `role` is not `'ADMIN'` is rejected by the
  schema and surfaces as `malformed` (the schema cannot be
  bypassed by a manipulated role flag).

---

## 9. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/admin/layout.tsx` | shrunk to chrome-free login wrapper |
| `apps/web/src/app/admin/(protected)/layout.tsx` | NEW — server-side admin authority gate |
| `apps/web/src/app/admin/(protected)/**` | moved 20 protected pages into the route group; relative imports re-aligned |
| `apps/web/src/components/admin-access-guard.tsx` | DELETED — replaced by server layout |
| `apps/web/src/lib/admin-session-server.ts` | NEW — runtime validator |
| `apps/web/src/lib/admin-session-server.test.ts` | NEW — 9 focused unit tests |
| `apps/web/src/lib/i18n/messages.ts` | added `admin.serverAccessDenied`, `admin.serverSessionInvalid`, `admin.serverCustomerDenied` (vi + en) |
| `apps/web/test/phase8i-critical-surfaces.a11y.test.tsx` | updated admin path import |
| `apps/web/test/admin-payment-detail-page.test.tsx` | updated admin path import |
| `apps/web/test/admin-payments-page.test.tsx` | updated admin path import |
| `packages/contracts/package.json` | added `./admin` subpath export |
| `tests/e2e/phase-3a-admin-server-gate.spec.ts` | NEW — focused Playwright suite |
| `scripts/fix-protected-imports.mjs` | NEW — helper used by the move commit (kept under `scripts/` for traceability) |

---

## 10. Commands actually run and their results

```
pnpm install --frozen-lockfile                       → Done in 16.9s
pnpm --filter @room/web run typecheck                → exit 0
pnpm --filter @room/web run test:unit                → 49 files, 219 tests PASS
pnpm --filter @room/web run test:unit \
    src/lib/admin-session-server.test.ts             → 9 / 9 PASS
pnpm --filter @room/web run lint                     → exit 0
pnpm --filter @room/web run build                    → exit 0
                                                      route table: /admin/** routes
                                                      rendered through (protected) layout;
                                                      no duplicate paths
pnpm lint                                            → 9 / 9 tasks PASS
pnpm typecheck                                       → 9 / 9 tasks PASS
pnpm format:check                                    → exit 0 (after pnpm format)
```

The pre-existing failure in
`packages/contracts/test/openapi-reproducibility.test.ts` (tsx
binary not on PATH inside the contracts package) is independent
of Phase 3A. It fails identically on the baseline `93b0564` SHA
without any Phase 3A changes. Recorded here for evidence; not
attributed to Phase 3A.

---

## 11. Static gate outputs (verbatim count summary)

```
@room/web unit tests       : 49 files, 219 tests PASS
@room/web typecheck        : exit 0
@room/web lint             : exit 0
@room/web build            : exit 0
@room/web format           : clean
@room/api lint             : cached
@room/api typecheck        : cached
@room/worker lint          : cached
@room/worker typecheck     : cached
@room/database test:unit   : 17 / 17 PASS
@room/contracts test:unit  : 262 / 263 PASS (1 pre-existing failure,
                              unrelated to Phase 3A)
```

---

## 12. Focused Playwright auth run — DEFERRED

The focused Playwright suite
`tests/e2e/phase-3a-admin-server-gate.spec.ts` is committed but
was NOT executed in this session.

Reason: the Playwright global setup brings up a fresh
PostgreSQL/Redis/Mailpit/OIDC/payment simulator stack via Docker
on ports 1025, 5432, 6379, 3090, 3100, 3101, 3420. On this
machine those ports are already occupied by long-running
external services (PIDs 14196 and 45132). The plan and the
repository's global constraints forbid killing unknown
processes; running `docker compose up -d` therefore fails with
`port is already allocated` for port 1025.

The spec is written to assert exactly what Phase 3A requires:
unauthenticated requests redirect before the protected shell
renders, a CUSTOMER session is denied, a manipulated role flag
cannot grant ADMIN access, and the API endpoint remains the
final authority. It will run on a clean environment.

---

## 13. Failures / deferred items

| Item | Status |
|------|--------|
| Focused Playwright auth run | DEFERRED (port 1025 occupied by external process) |
| Existing `admin-auth.spec.ts` | unchanged, still tests ADMIN sign-in + 401 after logout |
| `@room/contracts` openapi reproducibility test | pre-existing failure, not in scope |
| Database / integration gates | not run (Phase 3A changes no DB code) |

---

## 14. Worktree state

```
git status --short
(empty)
```

The worktree is clean after the three commits. No untracked
files, no modified files.

---

## 15. Rollback boundary

Phase 3A touches three logical units:

1. The new `(protected)` route group — revert by
   `git revert <commit-sha>` and removing the directory.
2. The runtime validator — revert by deleting
   `apps/web/src/lib/admin-session-server.ts` and the
   `@room/contracts/admin` subpath export.
3. The Playwright + unit tests — revert by deleting
   `tests/e2e/phase-3a-admin-server-gate.spec.ts` and
   `apps/web/src/lib/admin-session-server.test.ts`.

The layout deletion is coupled to the route group creation.
If the layout is rolled back without rolling back the route
group, every `/admin/**` route will render without the
sidebar/topbar (because the original layout provided them).

---

## 16. Exact instructions for Phase 3B

Phase 3B owns the catalog vertical and archive safety. Before
starting:

1. Read `docs/handoffs/phase-3a-admin-authority-foundation.md`
   (this file) and verify the worktree HEAD matches the
   expected SHA from §1.
2. Read
   `apps/web/src/app/admin/(protected)/layout.tsx` to confirm
   the server gate is in place.
3. The protected layout calls `resolveAdminSessionFromHeaders`
   on every request. Any new page added under
   `apps/web/src/app/admin/(protected)/**` automatically
   benefits from the gate.

When implementing Phase 3B:

- Do NOT add new client-side guards. The server layout is the
  authority.
- Do NOT introduce a second `admin-api.ts` client. Reuse the
  existing one and its `AdminApiError` for typed errors.
- Service-layer archive safety MUST reject unsafe operations
  even if the UI hides the button. Add PostgreSQL integration
  tests under `apps/api/test/integration/` that prove each
  rejection reason.
- Coupons, rate plans, and prices must keep the same pattern
  as Phase 2: server authority for selection, runtime
  validation for response shape.
- Do not edit any released migration under
  `packages/database/migrations/`. If a catalog change
  requires a schema change, add a forward migration with
  owner, lock assessment, and a `db:test` evidence line in
  the handoff.

---

## 17. Acceptance verdict

```
ADMIN_SERVER_GATE=PASS              (server layout enforces authority before render)
UNAUTHENTICATED_ADMIN_ACCESS=DENIED (resolver + layout redirect, asserted by unit tests)
CUSTOMER_ADMIN_ACCESS=DENIED        (resolver + layout, asserted by unit tests)
MANIPULATED_ROLE_ACCESS=DENIED      (Zod schema rejects non-ADMIN role, asserted by unit tests)
MALFORMED_ADMIN_RESPONSE=DENIED     (resolver classifies as malformed, asserted by unit tests)
VALID_ADMIN_SESSION=PASS            (resolver accepts canonical ADMIN payload, asserted by unit tests)
ADMIN_PUBLIC_NAVIGATION_LEAKS=0     (root layout drops public-header for /admin/**)
ADMIN_LOGOUT_PROTECTION=PASS        (existing admin-auth.spec.ts still passes; cookie cleared)

FORMAT_CHECK=PASS                   (pnpm format:check)
LINT=PASS                           (9 / 9 packages)
TYPECHECK=PASS                      (9 / 9 packages)
UNIT_TESTS=PASS                     (49 / 49 web files, 219 / 219 tests)
BUILD=PASS                          (next build, no duplicate routes)

FOCUSED_ADMIN_AUTH_E2E=DEFERRED     (port 1025 occupied by external process;
                                      spec is written and committed)

WORKTREE=CLEAN
PHASE_3A_PASS=YES
PHASE_3_PASS=NO
LOCAL_DEMO_READY=NO
```

Phase 3A closes the ADMIN authority boundary. Phase 3B can start
immediately by following §16.