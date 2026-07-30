# Phase 3 Secure Admin Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure ADMIN catalog vertical slice with persistent sessions,
server-side permissions, atomic audits and database-enforced maintenance blocks.

**Architecture:** Better Auth 1.6.23 is hosted through a small direct Fastify
bridge and uses the API's existing process-owned Drizzle client. Nest guards
derive safe actor context and call a fixed permission map. Shared Zod contracts
are consumed by API, OpenAPI generation and the Next admin client; catalog use
cases own transactional mutations and audit writes.

**Tech Stack:** Node 24.18.0, pnpm 10.33.2, NestJS 11/Fastify 5, Next 16 App
Router, React 19, PostgreSQL 18, Drizzle 0.45.2, Better Auth 1.6.23, Zod,
Vitest, Playwright, Storybook.

## Global Constraints

- Preserve all Phase 2 migrations and database invariants; use one new forward migration only.
- Work only in this repository and branch; no worktree, push, PR, deployment, `db:push`, automatic migration or destructive volume command.
- Use direct Fastify Better Auth integration, not the Fastify-beta community Nest adapter.
- Never expose/log passwords, hashes, cookies, session tokens, verification tokens or raw database details.
- ADMIN is bootstrap-only; no public sign-up or client-controlled role/actor fields.
- PostgreSQL's `room_inventory_blocks` GiST exclusion remains the maintenance concurrency authority.
- Every behavioral change begins with a focused failing test; generated migration/config exceptions are recorded in `docs/engineering/phase-3-validation.md`.

---

### Task 2: Auth schema, migration and readiness

**Files:**

- Modify: `packages/database/src/schema.ts`, `packages/database/src/schema-status.ts`, `packages/database/src/index.ts`, `packages/database/package.json`
- Create: `packages/database/drizzle/0002_phase_3_auth.sql`, `packages/database/drizzle/meta/0002_snapshot.json`, `packages/database/test/integration/auth-schema.test.ts`
- Modify: `packages/database/drizzle/meta/_journal.json`, `packages/database/test/integration/migration-readiness.test.ts`

**Interfaces:** Produces `users`, `sessions`, `accounts`, `verificationRecords`,
`userRole`, `userStatus`, `PHASE_3_SCHEMA_VERSION = 'phase-3-admin-catalog-v1'`.
Consumes existing `createMigratedTestDatabase()` and schema readiness service.

- [ ] Write integration tests asserting an empty migrated database has the four auth tables, no user row, role rejects `SYSTEM_WORKER`, Phase 2 version reads not-ready, Phase 3 reads ready, and existing overlap/audit constraints still reject invalid writes.
- [ ] Run `pnpm --filter @room/database exec vitest run test/integration/auth-schema.test.ts`; expect RED because symbols/tables/version do not exist.
- [ ] Add only the required Drizzle enums/tables with UUID IDs, non-null timestamps, unique normalized email, `ADMIN|CUSTOMER` role, `ACTIVE|DISABLED` status, session expiry and restrictive foreign keys. Generate and review `0002` without modifying `0000`/`0001`; update `schema_metadata` to Phase 3 as migration SQL.
- [ ] Run `pnpm db:check; pnpm db:test`; expect GREEN and all pre-existing integration tests green.
- [ ] Commit `feat(database): add phase 3 authentication schema`.

### Task 3: `@room/auth` and guarded bootstrap

**Files:**

- Create: `packages/auth/package.json`, `packages/auth/tsconfig.json`, `packages/auth/src/index.ts`, `packages/auth/src/auth-factory.ts`, `packages/auth/src/bootstrap.ts`, `packages/auth/src/permissions.ts`, `packages/auth/test/bootstrap.test.ts`, `packages/auth/test/session-identity.test.ts`, `packages/auth/scripts/bootstrap-admin.ts`
- Modify: `pnpm-workspace.yaml`, `package.json`, `.env.example`, `packages/config/src/index.ts`, `packages/observability/src/index.ts`

**Interfaces:** `createRoomAuth({ database, environment }): Auth`; `getSafeSession(headers): Promise<SafeSession | null>`; `ROLE_PERMISSIONS`; `bootstrapAdmin(input, dependencies)`; root `admin:bootstrap` command. `SafeSession` is `{ user: { id,email,name,role }, session: { id,expiresAt } }` only.

- [ ] Write tests for first bootstrap, idempotent rerun, invalid email, weak password, unsafe production rejection, no password output/log, disabled-user rejection and safe identity omission of hash/token/provider data.
- [ ] Run `pnpm --filter @room/auth test:unit`; expect RED because package and exports do not exist.
- [ ] Add exact Better Auth 1.6.23 and Drizzle adapter dependencies after checking peer resolution. Use the injected database client, explicit trusted origin, `SameSite=Lax`, HttpOnly and `useSecureCookies: NODE_ENV === 'production'`; disable public signup in web exposure. Bootstrap takes `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, and production acknowledgement only from environment, normalizes email, never echoes secret fields, and records a scrubbed audit event.
- [ ] Run `pnpm --filter @room/auth test:unit; pnpm typecheck`; expect GREEN.
- [ ] Commit `feat(auth): add guarded admin authentication foundation`.

### Task 4: API auth bridge, actor guard and normalized errors

**Files:**

- Create: `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/auth-fastify-bridge.ts`, `apps/api/src/auth/session.guard.ts`, `apps/api/src/auth/permissions.decorator.ts`, `apps/api/src/auth/permissions.guard.ts`, `apps/api/src/auth/actor-context.ts`, `apps/api/src/errors/problem-details.filter.ts`, `apps/api/test/auth-http.test.ts`, `apps/api/test/authorization.test.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/http-adapter.ts`, `apps/api/package.json`, `packages/config/src/index.ts`

**Interfaces:** `@RequirePermissions(...permissions)`; `getActor(request): ActorContext`; `ProblemDetails` from `@room/contracts`; Fastify route `/api/auth/*`; `/api/v1/admin/me`.

- [ ] Write HTTP tests for anonymous 401, CUSTOMER 403, permitted ADMIN 200, expired/logout 401, disabled 401, ignored body role, and a response/log without cookie/token/password data.
- [ ] Run `pnpm --filter @room/api test:unit -- auth-http.test.ts authorization.test.ts`; expect RED.
- [ ] Mount the documented direct handler with `fromNodeHeaders`, forward Better Auth response headers/body, and retain Nest body parsing globally. Register guards globally only for `/api/v1/admin`, derive immutable actor context from server session, and map Zod/domain/unknown errors to safe request-ID-bearing problem details.
- [ ] Run focused tests then `pnpm --filter @room/api test:unit; pnpm test:e2e`; expect GREEN.
- [ ] Commit `feat(api): enforce admin sessions and permissions`.

### Task 5: Shared contracts and OpenAPI

**Files:**

- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/index.ts`, `packages/contracts/src/admin.ts`, `packages/contracts/test/admin-contracts.test.ts`, `scripts/generate-openapi.mts`, `docs/openapi/admin-v1.json`
- Modify: `package.json`, `apps/api/package.json`, `apps/api/src/app.module.ts`, `.github/workflows/ci.yml`

**Interfaces:** `paginationQuerySchema`, `problemDetailsSchema`, `adminMeSchema`,
`propertySchema`, entity command/result schemas and `maintenanceBlockCommandSchema`; `generate:openapi` and `check:openapi` scripts.

- [ ] Write contract tests asserting page size bounds, uppercase code transformation, capacity constraints, archive command shape, interval validity, and exact problem envelope parsing.
- [ ] Run `pnpm --filter @room/contracts test:unit`; expect RED.
- [ ] Implement schemas/types once, consume them from API boundary parsing and generated OpenAPI JSON, then make `check:openapi` fail on a committed-artifact diff.
- [ ] Run `pnpm --filter @room/contracts test:unit; pnpm check:openapi`; expect GREEN.
- [ ] Commit `feat(contracts): define admin catalog contracts`.

### Task 6: Property and price tiers

**Files:**

- Create: `apps/api/src/catalog/catalog.module.ts`, `apps/api/src/catalog/catalog.repository.ts`, `apps/api/src/catalog/catalog.service.ts`, `apps/api/src/catalog/catalog.controller.ts`, `apps/api/src/catalog/audit.repository.ts`, `apps/api/test/property-price-tier.integration.test.ts`

**Interfaces:** `CatalogService.getProperty(actor)`, `updateProperty(actor,input)`, `listPriceTiers(actor,page)`, `createPriceTier(actor,input)`, `updatePriceTier`, `archivePriceTier`; all mutation methods use a transaction-aware audit repository.

- [ ] Write real-PostgreSQL tests for ADMIN read/update, locked timezone/currency, duplicate tier 409, CUSTOMER rejection, rollback on forced audit failure and persisted reload.
- [ ] Run `pnpm --filter @room/api test:integration -- property-price-tier`; expect RED.
- [ ] Implement controller parsing/guards only; implement service transaction and repository mapping with deterministic ordering and safe conflict conversion.
- [ ] Run focused test plus `pnpm db:test; pnpm test:integration`; expect GREEN.
- [ ] Commit `feat(admin): manage property and price tiers`.

### Task 7: Room types and amenities

**Files:**

- Modify: `apps/api/src/catalog/catalog.repository.ts`, `apps/api/src/catalog/catalog.service.ts`, `apps/api/src/catalog/catalog.controller.ts`, `packages/contracts/src/admin.ts`
- Create: `apps/api/test/room-types-amenities.integration.test.ts`

- [ ] Write RED tests for create/update/archive type, cross-property tier rejection, invalid capacity, archived-type room rejection, amenity assign/deactivate, no hard delete and audit rollback.
- [ ] Implement type and amenity commands using current-property scoped queries and status transitions; map archived/inaccessible resources deliberately to 404.
- [ ] Run focused integration, all API integration and `pnpm db:test`; expect GREEN.
- [ ] Commit `feat(admin): manage room types and amenities`.

### Task 8: Physical rooms

**Files:**

- Modify: `apps/api/src/catalog/catalog.repository.ts`, `apps/api/src/catalog/catalog.service.ts`, `apps/api/src/catalog/catalog.controller.ts`, `packages/contracts/src/admin.ts`
- Create: `apps/api/test/rooms.integration.test.ts`

- [ ] Write RED tests for create/update/archive, duplicate room number 409, invalid status transition, no silent archive reactivation, filters, pagination bounds/order and raw error redaction.
- [ ] Implement scoped room repository/service, explicit transition table and deterministic `room_number,id` ordering; preserve history with status changes.
- [ ] Run focused integration and complete API suite; expect GREEN.
- [ ] Commit `feat(admin): manage physical rooms`.

### Task 9: Maintenance ledger

**Files:**

- Modify: `apps/api/src/catalog/catalog.repository.ts`, `apps/api/src/catalog/catalog.service.ts`, `apps/api/src/catalog/catalog.controller.ts`, `packages/contracts/src/admin.ts`
- Create: `apps/api/test/maintenance.integration.test.ts`

- [ ] Write RED real-PostgreSQL tests for source+ledger creation, booking/maintenance conflict 409, touching ranges, different rooms, cancellation release, idempotent cancellation, audit rollback and no exclusion-detail leak.
- [ ] Implement creation/cancellation using one transaction and `SELECT … FOR UPDATE` for cancellation; translate PostgreSQL `23P01` to `ROOM_TIME_CONFLICT` only.
- [ ] Run `pnpm --filter @room/api test:integration -- maintenance; pnpm db:test`; expect GREEN.
- [ ] Commit `feat(admin): manage room maintenance blocks`.

### Task 10: Admin UI, stories and browser flows

**Files:**

- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`, `packages/ui/src/admin-shell.tsx`, `packages/ui/src/page-header.tsx`, `packages/ui/src/entity-table.tsx`, `packages/ui/src/form-field.tsx`, `packages/ui/src/error-summary.tsx`, `packages/ui/src/status-badge.tsx`, `packages/ui/src/confirm-dialog.tsx`, `packages/ui/src/date-time-range-fields.tsx`, `packages/ui/src/admin-shell.stories.tsx`, `packages/ui/src/entity-table.stories.tsx`, `packages/ui/src/form-field.stories.tsx`, `apps/web/src/lib/admin-api.ts`, `apps/web/src/app/admin/login/page.tsx`, `apps/web/src/app/admin/page.tsx`, `apps/web/src/app/admin/property/page.tsx`, `apps/web/src/app/admin/price-tiers/page.tsx`, `apps/web/src/app/admin/room-types/page.tsx`, `apps/web/src/app/admin/amenities/page.tsx`, `apps/web/src/app/admin/rooms/page.tsx`, `apps/web/src/app/admin/rooms/new/page.tsx`, `apps/web/src/app/admin/rooms/[id]/page.tsx`, `apps/web/src/app/admin/maintenance/page.tsx`, `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/loading.tsx`, `apps/web/src/app/admin/error.tsx`, `apps/web/src/app/admin/forbidden/page.tsx`, `apps/web/test/admin-shell.test.tsx`, `apps/web/test/admin-login.test.tsx`, `tests/e2e/admin.spec.ts`, `.storybook/main.ts`, `.storybook/preview.ts`
- Modify: `apps/web/package.json`, `apps/web/src/app/globals.css`, `package.json`, `playwright.config.ts`

- [ ] Write component RED tests for login/error/disabled state, shell keyboard navigation/focus, long Vietnamese content and page overflow; write Playwright RED Flow A–F using real bootstrap credentials in process-only test environment.
- [ ] Implement typed credentials client, route-level loading/error/forbidden pages, shell and catalog forms/tables with shared contracts and React Hook Form. Add stories/accessibility for reused UI only.
- [ ] Run `pnpm --filter @room/web test:unit; pnpm storybook:build; pnpm test:e2e`; expect GREEN.
- [ ] Commit `feat(web): complete secure admin workspace`.

### Task 11: Documentation, CI and adversarial review

**Files:**

- Create: `docs/engineering/auth-architecture.md`, `docs/engineering/admin-catalog-architecture.md`, `docs/engineering/admin-bootstrap-runbook.md`, `docs/engineering/admin-api-contract.md`, `docs/engineering/phase-3-validation.md`
- Modify: `README.md`, `AUTH_RBAC_POLICY.md`, `FRONTEND_RULES.md`, `API_CONTRACT.md`, `DB_MIGRATION_POLICY.md`, `TESTING_STRATEGY.md`, `OBSERVABILITY_POLICY.md`, `RELEASE_CHECKLIST.md`, `docs/engineering/architecture-map.md`, `docs/engineering/database-schema.md`, `docs/engineering/environment-contract.md`, `docs/engineering/ci-pipeline.md`, `.github/workflows/ci.yml`

- [ ] Add precise runbooks, migration/forward-fix and MFA residual-risk documentation; record the Phase 2 local-env configuration exception and dependency advisory classification.
- [ ] Add CI ordering: frozen install, quality, migration/database, auth/catalog integrations, OpenAPI drift, Storybook/a11y, Playwright, Gitleaks and high/critical audit.
- [ ] Perform adversarial review against every acceptance gate, correct all critical/important findings with RED tests, and rerun the original failing command after each correction.
- [ ] Run the complete final command set from the approved prompt with infrastructure up/down and preserve exact exit codes/test totals in `phase-3-validation.md`.
- [ ] Commit `docs(ci): validate phase 3 secure admin catalog`.

## Plan self-review

Each included behavior is assigned a test-first task, exact files, producing
interfaces, RED command, GREEN/regression command and focused commit. The plan
uses no placeholders, does not delegate authorization to UI, does not alter
released migrations, and contains forward-fix/rollback, secret, concurrency and
MFA-risk coverage. Phase 4 pricing/availability work is absent.
