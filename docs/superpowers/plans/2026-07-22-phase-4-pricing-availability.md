# Phase 4 Pricing and Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver ADMIN-managed rate-plan pricing, public room-type availability, and immutable 15-minute quotes without creating a booking, HOLD, coupon, payment, physical allocation, or PII record.

**Architecture:** A pure `PricingEngine` selects the authoritative plan from local business time and a tier-scoped ACTIVE price lookup. PostgreSQL provides catalog completeness, inventory anti-overlap and immutable quote storage; Nest services own transactions and shared Zod contracts own every external shape. Next.js only validates inputs and displays server results.

**Tech Stack:** Node 24.18.0, pnpm 10.33.2, TypeScript 5.9, NestJS 11/Fastify 5, Next.js 16 App Router, React 19, PostgreSQL 18, Drizzle 0.45, Zod, Vitest, Playwright and Storybook.

## Global Constraints

- Work only on `phase4-pricing-availability-engine`; do not create a worktree, push, PR, deploy, rewrite history, edit released migrations, use `db:push`, or run a volume-deleting command.
- Retain `DRAFT | ACTIVE | INACTIVE`; `INACTIVE` is the historical non-quotable state, never a hard-delete target.
- Use `Asia/Ho_Chi_Minh`, `[checkIn, checkOut)`, 15-minute precision, minimum 60 minutes, maximum 1,440 minutes, 15-minute quote TTL, and integer VND only.
- Keep `room_inventory_blocks` the sole physical inventory ledger. Search and quote must neither allocate a room nor insert a ledger row.
- Public responses contain no PII, room ID, room number or raw database detail. ADMIN actor/role/permission always comes from the server session.
- Every behavioral change starts with a focused failing test observed RED before minimal GREEN. Generated migration/OpenAPI/config artifacts are the only recorded exceptions.

---

### Task 1: Shared pricing and availability contracts

**Files:**

- Create: `packages/contracts/src/pricing.ts`, `packages/contracts/test/pricing-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/auth/src/permissions.ts`, `apps/api/test/phase4-test-commands.test.ts`, `package.json`

**Interfaces:** Produces `availabilitySearchRequestSchema`, `availabilitySearchResponseSchema`, `createQuoteRequestSchema`, `quoteSchema`, `pricingBreakdownSchema`, `ratePlanSchema`, `ratePlanPriceCommandSchema`, `ratePlanActivationSchema`, and inferred types. Produces permissions `pricing.rate_plan.read` and `pricing.rate_plan.manage`.

- [ ] **Step 1: Write failing contract and command-mapping tests.** Assert ISO timestamps with offsets, quarter-hour validation, 60–1,440 minute range, adults/children bounds, no client total/plan fields, VND integer values, no public room fields, quote line-item total consistency, and exact distinct scripts `test:pricing`, `test:availability`, `test:quotes`.
- [ ] **Step 2: Run RED.** Run `node --version`, `pnpm --version`, then `pnpm --filter @room/contracts test:unit -- pricing-contracts.test.ts`; expect missing exports. Run the API command-mapping test; expect missing scripts.
- [ ] **Step 3: Implement minimal schemas.** Use `.strict()` Zod objects, safe external identifiers, `z.number().int()` for VND response values, field-addressable refinements for local interval and capacity input, and export them from `index.ts`. Add the two fixed ADMIN permissions and truthful script entries that target only their named suites.
- [ ] **Step 4: Run GREEN and regressions.** Run `pnpm --filter @room/contracts test:unit`, `pnpm check:openapi` after controllers exist, and `pnpm typecheck`.
- [ ] **Step 5: Commit.** `git add packages/contracts packages/auth/src/permissions.ts apps/api/test/phase4-test-commands.test.ts package.json && git commit -m "feat(contracts): add pricing and availability contracts"`.

### Task 2: Pure deterministic pricing engine

**Files:**

- Create: `apps/api/src/pricing/pricing-engine.ts`, `apps/api/src/pricing/pricing.types.ts`, `apps/api/src/pricing/pricing.errors.ts`, `apps/api/test/pricing-engine.test.ts`

**Interfaces:** `calculatePricing(input: PricingInput, catalog: PricingCatalog): PricingBreakdown`; typed failures `InvalidPricingIntervalError` and `PricingConfigurationError`; `PricingCatalog` maps each code/tier to status and integer VND.

- [ ] **Step 1: Write table-driven failing tests.** Define catalog fixture prices for all six codes and three tiers. Test local `10:45`, `11:00`, `14:45`, `15:00`, `15:15`, 2h45, 3h, 3h15, 4h, 4h15, 5h, 5h15, `17:45`, `18:00`, 16h, 16h15 and 24h; assert selected code, base minutes, extra units, base/extra/total integer VND and `phase-4-pricing-availability-v1` rule version. Add invalid increment/interval/over-24h plus missing, DRAFT, INACTIVE and missing-tier failures.
- [ ] **Step 2: Run RED.** `pnpm --filter @room/api exec vitest run test/pricing-engine.test.ts`; expect the engine module to be absent.
- [ ] **Step 3: Implement the smallest pure selector.** Convert only `checkIn` to `Asia/Ho_Chi_Minh` with `Intl.DateTimeFormat`, calculate elapsed minutes from instants, apply the documented precedence table, compute `Math.ceil(excess / 60)`, read only ACTIVE matching tier prices, and form a frozen breakdown without I/O.
- [ ] **Step 4: Run GREEN and regression.** Re-run focused tests, then `pnpm test:pricing` and `pnpm test:unit`.
- [ ] **Step 5: Commit.** `git add apps/api/src/pricing apps/api/test/pricing-engine.test.ts && git commit -m "feat(pricing): add deterministic pricing engine"`.

### Task 3: Quote schema, migration and readiness

**Files:**

- Modify: `packages/database/src/schema.ts`, `packages/database/src/schema-status.ts`, `packages/database/src/index.ts`, `packages/database/drizzle/meta/_journal.json`, `packages/database/test/integration/migration-readiness.test.ts`
- Create: `packages/database/drizzle/0004_phase_4_quotes.sql`, `packages/database/drizzle/meta/0004_snapshot.json`, `packages/database/test/integration/quote-schema.test.ts`

**Interfaces:** Produces `quotes` table and `EXPECTED_SCHEMA_VERSION = 'phase-4-pricing-availability-v1'`. A quote stores property/room-type references, request interval/occupancy, `created_at`, `expires_at`, and JSONB snapshot with no physical-room/PII columns.

- [ ] **Step 1: Write failing real-PostgreSQL tests.** Verify empty migration creates quotes, a repeated migration is idempotent, Phase 3 readiness is false and Phase 4 readiness true, invalid interval/quarter-hour/money/expiry/snapshot fail, property ownership is enforced, `UPDATE` and `DELETE` reject, and the existing Phase 3 schema still migrates untouched.
- [ ] **Step 2: Run RED.** Start `pnpm infra:up`; then run `pnpm --filter @room/database exec vitest run test/integration/quote-schema.test.ts`; expect absent table/version.
- [ ] **Step 3: Add one forward migration.** Generate the Drizzle table/schema snapshot and add reviewed custom SQL triggers that reject every quote update/delete. Use database `CURRENT_TIMESTAMP` for the service’s expiration calculation rather than a clock-dependent CHECK. Update `schema_metadata` only in the new migration.
- [ ] **Step 4: Run GREEN.** Run `pnpm db:check`, focused quote-schema test, `pnpm db:test`, and `pnpm verify:database`.
- [ ] **Step 5: Commit.** `git add packages/database && git commit -m "feat(database): add immutable pricing quotes"`.

### Task 4: Rate-plan catalog administration

**Files:**

- Create: `apps/api/src/pricing/rate-plan.repository.ts`, `apps/api/src/pricing/rate-plan.service.ts`, `apps/api/src/pricing/rate-plan-admin.controller.ts`, `apps/api/test/rate-plan.integration.test.ts`, `apps/api/test/rate-plan.service.test.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/errors/problem-details.filter.ts`, `apps/api/src/catalog/catalog.errors.ts`, `scripts/generate-openapi.mts`

**Interfaces:** `RatePlanService.list()`, `updatePrice(actor, planId, tierId, body)`, `activate(actor, planId)`, `inactivate(actor, planId)`; routes under `/api/v1/admin/rate-plans`; errors `RATE_PLAN_INCOMPLETE` and `PRICING_CONFIGURATION_UNAVAILABLE`.

- [ ] **Step 1: Write failing tests.** Cover deterministic listing, positive VND only, property ownership, duplicate plan/tier conflict, incomplete ACTIVE rejection, all-active-tier complete activation, DRAFT/INACTIVE exclusion, no hard delete, ADMIN 200/CUSTOMER 403/anonymous 401, audit write in the same transaction, and audit failure rollback.
- [ ] **Step 2: Run RED.** With local infrastructure running, execute `pnpm --filter @room/api test:integration -- rate-plan.integration.test.ts`; expect unavailable controller/service.
- [ ] **Step 3: Implement transactional administration.** Reuse `DatabaseProvider`, `AuditRepository`, server-derived `ActorContext`, the existing problem-details envelope and property-scoped repository pattern. Before ACTIVE, query all ACTIVE tiers used by current ACTIVE room types and require one positive VND price per tier; write audit before transaction commit. `INACTIVE` preserves rows and never silently becomes ACTIVE.
- [ ] **Step 4: Run GREEN.** Focused unit/integration tests, `pnpm test:catalog`, `pnpm test:integration`, `pnpm check:openapi` and `pnpm typecheck`.
- [ ] **Step 5: Commit.** `git add apps/api/src/pricing apps/api/test apps/api/src/app.module.ts apps/api/src/errors scripts/generate-openapi.mts && git commit -m "feat(api): manage rate plans and tier prices"`.

### Task 5: Availability repository and public API

**Files:**

- Create: `apps/api/src/availability/availability.repository.ts`, `apps/api/src/availability/availability.service.ts`, `apps/api/src/availability/availability.controller.ts`, `apps/api/test/availability.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/errors/problem-details.filter.ts`

**Interfaces:** `AvailabilityService.search(request)` returns room-type summaries and `availableRoomCount`; `POST /api/v1/availability/search` is anonymous and returns no physical-room data.

- [ ] **Step 1: Write failing guarded PostgreSQL/API tests.** Seed property/tier/type/rooms and prove no blocks, one blocked, all blocked, touching, overlap, different room, INACTIVE room, INACTIVE room type, maintenance ledger rows, adults/children/combined capacity rejection, stable ordering, and the literal absence of room `id` and `roomNumber` from JSON.
- [ ] **Step 2: Run RED.** `pnpm --filter @room/api test:integration -- availability.integration.test.ts`; expect missing module/route.
- [ ] **Step 3: Implement the anti-overlap query.** Restrict rows to active property, type and rooms; use `NOT EXISTS` against active ledger blocks with half-open `tstzrange` overlap, group count by room type, and order by type name/id. Validate public schema before database access and normalize no-result versus invalid/capacity outcomes.
- [ ] **Step 4: Run GREEN.** Focused test, `pnpm test:availability`, `pnpm test:integration`, `pnpm db:test` and `pnpm check:openapi`.
- [ ] **Step 5: Commit.** `git add apps/api/src/availability apps/api/test/availability.integration.test.ts apps/api/src/app.module.ts apps/api/src/errors && git commit -m "feat(availability): search room type inventory"`.

### Task 6: Quote issuance and retrieval API

**Files:**

- Create: `apps/api/src/pricing/quote.repository.ts`, `apps/api/src/pricing/quote.service.ts`, `apps/api/src/pricing/quote.controller.ts`, `apps/api/test/quote.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/errors/problem-details.filter.ts`

**Interfaces:** `QuoteService.issue(request)` and `get(quoteId)`; `POST /api/v1/quotes`; `GET /api/v1/quotes/:quoteId`; stored snapshot is the only quote response source after creation.

- [ ] **Step 1: Write failing tests.** Assert available room type issues quote, unavailable rejects, catalog missing price rejects, database-time 15-minute expiry, snapshot immutability, old quote unchanged after Admin price update, new quote uses new amount, expired retrieval typed failure, no inventory block, no room assignment, no PII and safe errors.
- [ ] **Step 2: Run RED.** `pnpm --filter @room/api test:integration -- quote.integration.test.ts`; expect missing service/routes.
- [ ] **Step 3: Implement quote transaction.** Revalidate availability and load the tier-scoped catalog; pass it to the pure engine; use `SELECT CURRENT_TIMESTAMP` in the transaction to produce expiry; insert a snapshot without physical IDs and return the persisted snapshot. Retrieve by id with database-time expiry predicate and never update quote rows.
- [ ] **Step 4: Run GREEN.** Focused suite, `pnpm test:quotes`, `pnpm test:pricing`, `pnpm test:availability`, `pnpm test:integration`, `pnpm db:test`, and `pnpm check:openapi`.
- [ ] **Step 5: Commit.** `git add apps/api/src/pricing apps/api/test/quote.integration.test.ts apps/api/src/app.module.ts apps/api/src/errors && git commit -m "feat(pricing): issue immutable room quotes"`.

### Task 7: Admin pricing UI and reusable states

**Files:**

- Create: `apps/web/src/app/admin/rate-plans/page.tsx`, `apps/web/src/components/rate-plan-manager.tsx`, `apps/web/src/components/rate-plan-completeness-panel.tsx`, `apps/web/src/components/rate-plan-completeness-panel.stories.tsx`, `apps/web/test/rate-plan-manager.a11y.test.tsx`
- Modify: `apps/web/src/lib/admin-api.ts`, `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/globals.css`

**Interfaces:** Typed `adminApi.listRatePlans`, `updateRatePlanPrice`, `activateRatePlan`, `inactivateRatePlan`; UI has labelled tier price fields and server-authoritative completeness/activation feedback.

- [ ] **Step 1: Write failing component and browser tests.** Cover loading, empty, incomplete/disabled activation, field errors, successful activation/reload, keyboard operation, visible focus, long Vietnamese content and no serious axe issue.
- [ ] **Step 2: Run RED.** `pnpm --filter @room/web test:unit -- rate-plan-manager.a11y.test.tsx`; expect missing component.
- [ ] **Step 3: Implement minimal admin surface.** Reuse the existing Admin API request/error model and shell. Submit integer VND strings parsed to numbers only after client validation; render server state after mutation; never offer rule-code/formula editing or hard deletion. Add narrow responsive CSS and meaningful Storybook stories.
- [ ] **Step 4: Run GREEN.** Component test, `pnpm storybook:build`, and the ADMIN Playwright pricing flow after Task 8 adds global fixtures.
- [ ] **Step 5: Commit.** `git add apps/web/src/app/admin apps/web/src/components apps/web/src/lib/admin-api.ts apps/web/src/app/globals.css apps/web/test && git commit -m "feat(admin): configure room pricing"`.

### Task 8: Public availability and quote experience

**Files:**

- Create: `apps/web/src/app/booking/search/page.tsx`, `apps/web/src/app/booking/quote/[quoteId]/page.tsx`, `apps/web/src/components/availability-search-form.tsx`, `apps/web/src/components/room-type-availability-card.tsx`, `apps/web/src/components/quote-breakdown.tsx`, `apps/web/src/components/vnd-amount.tsx`, `apps/web/src/components/quote-expiry-notice.tsx`, their meaningful stories, `apps/web/test/public-pricing.a11y.test.tsx`, `tests/e2e/availability-quote.spec.ts`
- Modify: `apps/web/src/lib/admin-api.ts` renamed or split to `apps/web/src/lib/api-client.ts`, `apps/web/src/app/globals.css`, `scripts/run-playwright.mjs`, `playwright.config.ts`

**Interfaces:** Anonymous `publicApi.searchAvailability`, `issueQuote`, `getQuote`; `/booking/search` and `/booking/quote/[quoteId]` consume only shared contract response shapes.

- [ ] **Step 1: Write failing component/Playwright tests.** Cover 15-minute control validation, below/above duration, capacity failure, loading/empty/unavailable/API-error states, room-card safe fields, quote route/breakdown/expiry/non-reservation notice/reload, price snapshot after Admin update, narrow viewport, keyboard and axe checks.
- [ ] **Step 2: Run RED.** `pnpm --filter @room/web test:unit -- public-pricing.a11y.test.tsx` and `pnpm exec playwright test tests/e2e/availability-quote.spec.ts`; expect routes/components absent.
- [ ] **Step 3: Implement server-led public flow.** Keep pricing calculations out of the browser; restrict datetime controls to quarter-hours; format integer VND with `Intl.NumberFormat('vi-VN')`; never render room ID/number, personal data, coupon, HOLD or payment action. Extend the real Playwright bootstrap only with deterministic catalog fixture setup, not mock API responses.
- [ ] **Step 4: Run GREEN.** Component suites, `pnpm storybook:build`, `pnpm test:e2e`, `pnpm build` and `pnpm check:openapi`.
- [ ] **Step 5: Commit.** `git add apps/web tests/e2e scripts/run-playwright.mjs playwright.config.ts && git commit -m "feat(web): add availability and quote experience"`.

### Task 9: Documentation, CI, final review and proof

**Files:**

- Create: `docs/engineering/pricing-architecture.md`, `docs/engineering/availability-architecture.md`, `docs/engineering/quote-architecture.md`, `docs/engineering/pricing-decision-matrix.md`, `docs/engineering/phase-4-validation.md`
- Modify: `README.md`, `DESIGN.md`, `API_CONTRACT.md`, `AUTH_RBAC_POLICY.md`, `DB_MIGRATION_POLICY.md`, `TESTING_STRATEGY.md`, `OBSERVABILITY_POLICY.md`, `RELEASE_CHECKLIST.md`, `docs/domain/pricing-rules.md`, `docs/domain/business-invariants.md`, `docs/engineering/architecture-map.md`, `docs/engineering/database-schema.md`, `docs/engineering/environment-contract.md`, `docs/engineering/ci-pipeline.md`, `docs/security/threat-model.md`, `.github/workflows/ci.yml`, `package.json`

**Interfaces:** Documents exact decision precedence, integer VND, status lifecycle, activation completeness, SQL semantics, quote immutability/TTL, endpoints, errors, test commands, forward-fix and Phase 5 handoff. CI runs the named new suites distinctly.

- [ ] **Step 1: Write failing documentation/command tests where established.** Extend command-mapping test to assert CI contains distinct pricing, availability and quote gates in correct dependency order; add OpenAPI drift assertion after route generation.
- [ ] **Step 2: Run RED.** `pnpm --filter @room/api test:unit -- phase4-test-commands.test.ts`; expect absent required command/CI entries.
- [ ] **Step 3: Implement narrow docs and CI changes.** Record all generated-artifact TDD exceptions, public rate-limit decision, no Redis authority, warnings versus evidence, rollback as forward fix, and the unstarted Phase 5 boundary. Do not document fictitious production readiness.
- [ ] **Step 4: Perform final adversarial review and run GREEN.** Read every acceptance gate against diff, then run fresh: `pnpm install --frozen-lockfile`, format, lint, typecheck, unit/auth/catalog/pricing/availability/quotes/integration, OpenAPI, Storybook, build; `pnpm infra:up`; db check/migrate/status/test/verify database/e2e; `pnpm infra:down`; audit and verify; documented Docker Gitleaks history scan. Record command, scanner version, exit code, finding count and exact test totals.
- [ ] **Step 5: Commit.** `git add README.md DESIGN.md API_CONTRACT.md AUTH_RBAC_POLICY.md DB_MIGRATION_POLICY.md TESTING_STRATEGY.md OBSERVABILITY_POLICY.md RELEASE_CHECKLIST.md docs .github/workflows/ci.yml package.json apps/api/test/phase4-test-commands.test.ts && git commit -m "docs(ci): validate phase 4 pricing and availability"`.

## Plan self-review

The plan maps every included rule boundary, database invariant, permission edge, public disclosure requirement, UI state and verification gate to a test-first task. It uses existing catalogs, auth guards, repository/audit transaction patterns and migration policy; it creates no booking/HOLD/coupon/payment/worker or Redis feature. All price amounts not supplied by Phase 0 remain explicit catalog fixtures/configuration, not invented customer charges.
