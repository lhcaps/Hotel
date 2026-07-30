# Phase 8H Client Operations Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an audited ADMIN room board, truthful housekeeping, safe confirmation presentation, and authoritative operational reporting while retaining existing price and settlement domains.

**Architecture:** `@room/contracts` defines all new API boundaries; NestJS services and repositories authorize and aggregate database state; Next.js ADMIN/client components render DTOs and submit state changes. PostgreSQL remains the inventory, pricing, and reporting authority.

**Tech Stack:** Next.js App Router, NestJS, Zod, Drizzle/PostgreSQL, Vitest, Playwright.

## Global Constraints

- Do not commit or transcribe client workbook PII or formulas.
- Use only one current property; do not introduce tenancy.
- Full-payment settlement remains unchanged; partial payment remains deferred.
- Write each behavioral test before its implementation and observe the focused failure.
- Preserve Phase 8G CSS tokens and table-driven ADMIN visual system.
- Add no dashboard, generic table, formula-engine, or shadcn dependency.

---

### Task 1: Document redacted parity and decisions

**Files:**
- Create: `docs/audit/phase-8h/client-workbook-parity-matrix.md`
- Create: `docs/audit/phase-8h/client-workbook-parity-matrix.csv`
- Create: `docs/audit/phase-8h/pricing-adjustment-reconciliation.md`
- Create: `docs/audit/phase-8h/payment-collection-gap.md`

**Interfaces:**
- Consumes: workbook structural inventory and current schema/API contracts.
- Produces: `PARTIAL_PAYMENT=DOMAIN_CHANGE_REQUIRED_DEFERRED` and single-property decision for all later tasks.

- [ ] Verify the matrix contains no names, phone numbers, booking identifiers, formula text, or values.
- [ ] Verify `git diff --check` and commit `docs: map client workbook operational parity`.

### Task 2: Housekeeping authority and operations DTO

**Files:**
- Modify: `packages/database/src/schema.ts`
- Create: `packages/database/drizzle/0020_phase8h_room_housekeeping.sql`
- Modify: `packages/contracts/src/admin.ts`
- Modify: `apps/api/src/catalog/catalog.controller.ts`
- Modify: `apps/api/src/catalog/catalog.service.ts`
- Modify: `apps/api/src/catalog/catalog.repository.ts`
- Create: `apps/api/test/catalog/catalog-housekeeping.service.test.ts`
- Create: `packages/database/test/integration/phase8h-housekeeping.test.ts`

**Interfaces:**
- Produces `RoomHousekeepingStatus = 'CLEAN' | 'DIRTY' | 'CLEANING'` and `PATCH /api/v1/admin/rooms/:roomId/housekeeping` accepting `{ status: RoomHousekeepingStatus }`.
- Emits existing `audit_events` aggregate `ROOM` with safe `{ status }` payload.

- [ ] Write a service test asserting an ADMIN update persists `CLEANING`, emits one audit event, and rejects any non-enum value.
- [ ] Run the focused test and observe failure because the route/service does not exist.
- [ ] Add the enum, forward migration, contract, guarded service/controller mutation, and audit emission.
- [ ] Run focused unit and disposable-database migration tests; commit `feat(rooms): add housekeeping operations boundary`.

### Task 3: Server-shaped ADMIN room operations board

**Files:**
- Modify: `packages/contracts/src/admin.ts`
- Modify: `apps/api/src/catalog/catalog.controller.ts`
- Modify: `apps/api/src/catalog/catalog.repository.ts`
- Modify: `apps/api/src/catalog/catalog.service.ts`
- Modify: `apps/web/src/lib/admin-api.ts`
- Create: `apps/web/src/components/room-operations-board.tsx`
- Create: `apps/web/test/room-operations-board.test.tsx`
- Create: `tests/e2e/phase-8h-room-operations.spec.ts`

**Interfaces:**
- Produces `GET /api/v1/admin/rooms/operations?date=<ISO date>` returning room code, room type/tier, housekeeping state, and server-shaped occupancy labels.
- Consumes the Task 2 update endpoint and refreshes server data after a successful update.

- [ ] Write component and repository tests asserting selected-date occupancy is returned by the server and status is readable without colour.
- [ ] Run them and observe failure because `RoomOperationsBoard` and operations DTO do not exist.
- [ ] Implement the minimal repository query, contract validation, ADMIN guard, client API method, and board route composition.
- [ ] Run focused unit/API tests and one Playwright board mutation/refresh flow; commit `feat(admin): add room operations board`.

### Task 4: Preserve and clarify existing booking/pricing presentation

**Files:**
- Modify: `apps/web/src/components/rate-plan-manager.tsx`
- Create: `apps/web/test/rate-plan-matrix.test.tsx`
- Modify: `apps/web/src/components/booking-detail-panel.tsx`
- Modify: `apps/web/test/booking-detail-panel.test.tsx`

**Interfaces:**
- Consumes existing `RatePlan.prices`, existing ADMIN booking detail, and no new money calculations.
- Produces readable rate-plan x price-tier matrix and masked list/detail disclosure consistent with existing contracts.

- [ ] Write rendering tests that prove a matrix displays plan, tier, eligibility, included duration, extra-hour row, and amount supplied by API.
- [ ] Run focused tests and observe failure before matrix markup.
- [ ] Reshape only markup and labels; keep existing create/update API calls and values intact.
- [ ] Run rate-plan, booking-detail, and public quote regression; commit `feat(pricing): clarify rate plan and tier configuration`.

### Task 5: Customer-safe confirmation projection

**Files:**
- Create: `apps/web/src/components/booking-confirmation.tsx`
- Modify: `apps/web/src/app/account/bookings/[bookingCode]/page.tsx`
- Modify: `apps/web/src/app/booking/manage/[bookingCode]/claim-client.tsx`
- Create: `apps/web/test/booking-confirmation.test.tsx`

**Interfaces:**
- Consumes existing authorized customer/guest booking DTOs only.
- Produces a printable summary with booking code, public property name, room type, interval, occupancy, final amount, booking/payment status, and support instruction.

- [ ] Write a rendering test asserting internal room number, housekeeping, attribution, UUID, and raw provider values are absent.
- [ ] Run it and observe failure because the dedicated projection does not exist.
- [ ] Implement projection and print CSS using existing route authorization.
- [ ] Run focused tests plus guest/customer authorization browser flow; commit `feat(web): add customer booking confirmation surface`.

### Task 6: Authoritative operational reporting

**Files:**
- Create: `packages/contracts/src/admin-reporting.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/reporting/admin-operational-report.repository.ts`
- Create: `apps/api/src/reporting/admin-operational-report.service.ts`
- Create: `apps/api/src/reporting/admin-operational-report.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/reporting/admin-operational-report.service.test.ts`
- Create: `apps/web/src/app/admin/reports/page.tsx`
- Create: `apps/web/src/components/operational-report.tsx`
- Create: `apps/web/test/operational-report.test.tsx`
- Create: `tests/e2e/phase-8h-operational-report.spec.ts`

**Interfaces:**
- Produces `GET /api/v1/admin/operational-report?from=<ISO>&to=<ISO>&bookingStatus=<optional>&paymentStatus=<optional>&ratePlanId=<optional>&roomTypeId=<optional>`.
- Returns dated VND aggregates, measures metadata, category breakdowns, detailed table rows, and `generatedAt`.

- [ ] Write a repository/service test using deterministic bookings/payments proving cancellation/exclusion and settled-revenue rules.
- [ ] Run it and observe failure because report service does not exist.
- [ ] Implement parameter validation, ADMIN permission, property-scoped SQL aggregates, empty response, and parallel independent aggregate reads.
- [ ] Write the page/component test for summary text, table fallback, filter labels, loading, empty, error, stale, and last-updated states.
- [ ] Implement one daily series and two categorical summaries with semantic tables as the accessible primary fallback.
- [ ] Run focused API/component tests and Playwright desktop/tablet report flows; commit `feat(reporting): add authoritative operational report`.

### Task 7: Accessibility, evidence, and fresh closure

**Files:**
- Create: `docs/audit/phase-8h/visual-fidelity-ledger.md`
- Modify: `tests/e2e/phase-8h-room-operations.spec.ts`
- Modify: `tests/e2e/phase-8h-operational-report.spec.ts`

- [ ] Add one compatible development-only axe Playwright dependency only when no installed integration can execute a measurement.
- [ ] Run focused axe checks for public search, quote, payment, customer profile, room board, booking operation, and report; record measured critical and serious counts.
- [ ] Capture redacted screenshots for the room board, booking surfaces, rate-plan matrix, confirmation, and report states.
- [ ] Run static checks, database gates, demo lifecycle/smoke, then full Playwright twice serially with workers=1 and retries=0.
- [ ] Review staged diff/check output, commit `test(e2e): prove client operations parity` and `docs: record Phase 8H evidence`.

## Exact validation sequence

`pnpm check:providers`, `pnpm check:features`, `pnpm check:google-oauth`, `pnpm check:i18n-critical`, `pnpm check:endpoints`, `pnpm check:openapi`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm db:check`, `pnpm db:status`, `pnpm db:test`, `pnpm audit --prod --audit-level=high`, `pnpm demo:preflight`, `pnpm demo:lifecycle-test`, `pnpm demo:smoke`, `pnpm test:e2e`, `pnpm test:e2e`.

## Rollback boundary

Revert Phase 8H commits in reverse order. The housekeeping migration is forward-only; rollback means deploy a new migration that preserves known values while disabling the ADMIN mutation path, never edit migration history. Reporting and presentation have no data mutation beyond Task 2.
