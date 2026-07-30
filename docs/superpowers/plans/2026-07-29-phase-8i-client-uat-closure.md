# Phase 8I Client Acceptance Closure Implementation Plan

> **For agentic workers:** Execute inline in this checkout. Every repository-owned defect must follow RED -> minimal GREEN -> regression.

**Goal:** Produce fresh, reproducible client UAT and acceptance evidence for the existing Phase 8H scope without adding business features.

**Architecture:** Reuse the existing server-authoritative API, Playwright test database, `jest-axe`, deterministic OIDC/payment simulators, and development Docker stack. Evidence is written only under `docs/audit/phase-8i`, `docs/uat`, `docs/runbooks`, and `docs/handoffs`; external providers retain explicit blocked verdicts unless their opt-in prerequisites are available.

**Tech Stack:** pnpm workspace, NestJS, Next.js, PostgreSQL, Playwright, Vitest, jest-axe, Docker Compose.

## Global Constraints

- No partial payment, attribution, CRM, multi-property, pricing, accounting, deployment, or redesign work.
- No client workbook, `.env`, secrets, PII, real credentials, production providers, push, PR, reset, clean, stash, amend, or Docker-volume deletion.
- Preserve port 3001 ownership; inspect listeners before any local runtime action.
- Live Google/VNPAY/SMTP tests run only when their preflight script reports configured prerequisites.

### Task 1: Establish independent baseline and Phase 8H review

**Files:**
- Create: `docs/audit/phase-8i/phase-8h-independent-review.md`
- Read: `docs/audit/phase-8h/**`, `apps/api/src/**`, `apps/web/src/**`, `packages/contracts/**`, `packages/database/**`, `tests/e2e/**`

- [ ] Record HEAD, branch, clean-tree state, schema status, migration lineage, ignored workbook/env state and listener ownership.
- [ ] Trace each Phase 8H capability to its implementation, contract, authorization boundary, database source, frontend route, deterministic test and browser evidence.
- [ ] Classify each item PASS, DEFERRED_DOMAIN, or BLOCKED_EXTERNAL from fresh evidence only.

### Task 2: Reconcile runtime routes and provider prerequisites

**Files:**
- Create: `docs/audit/phase-8i/endpoint-reconciliation.md`
- Create: `docs/audit/phase-8i/external-acceptance-report.md`
- Update: `docs/runbooks/stable-sandbox-callback.md`, `docs/runbooks/google-oauth-local.md`, `docs/runbooks/vnpay-sandbox.md`, `docs/runbooks/production-smtp.md`
- Read: `scripts/check-endpoints.mts`, OpenAPI generators, provider check scripts and callback configuration

- [ ] Run `pnpm check:endpoints` and enumerate every runtime route as DOCUMENTED, EXPLICIT_ALLOWLISTED, FRAMEWORK_INTERNAL, or DEAD_OR_ORPHANED; totals must reconcile exactly.
- [ ] Run `pnpm check:openapi`, `pnpm check:providers` and `pnpm check:google-oauth`; execute opt-in live commands only after their own prerequisite output is READY.
- [ ] Record blocked external requirements verbatim without treating config readiness as live acceptance.

### Task 3: Measure all critical accessibility and deterministic UAT paths

**Files:**
- Modify/Create: `apps/web/test/phase8i-critical-surfaces.a11y.test.tsx`
- Modify/Create: `tests/e2e/phase-8i-client-uat.spec.ts`
- Create: `docs/audit/phase-8i/accessibility-measurement.md`
- Create: `docs/uat/phase-8i-client-uat-checklist.md`
- Create: `docs/uat/phase-8i-client-uat-results.md`

- [ ] Write focused failing tests before each proven repository-owned behavior fix.
- [ ] Measure the 13 required surfaces at 390x844 and 1366x768 with current `jest-axe` and assert zero critical/serious violations.
- [ ] Exercise keyboard locale/account/filter paths, visible focus, text fallbacks, reduced motion and confirmation semantics through deterministic browser tests.
- [ ] Run public, CUSTOMER, ADMIN catalog, room-operation, booking-operation and reporting UAT using synthetic data only.

### Task 4: Prove report and confirmation truth with deterministic fixtures

**Files:**
- Modify/Create: `packages/booking/test/operational-report*.test.ts`
- Modify/Create: `tests/e2e/phase-8i-confirmation.spec.ts`
- Create: `docs/audit/phase-8i/report-metric-contract.md`
- Create/Update: `docs/runbooks/client-uat-data.md`

- [ ] Create deterministic fixtures for empty, settled, pending, cancelled, failed, repeated customer, distinct customer and date-boundary report cases.
- [ ] Assert server aggregates and no client aggregation; retain null outstanding revenue where partial collection is unsupported.
- [ ] Verify authorized confirmation/print fields and prove no room, housekeeping, UUID, provider payload, attribution or secret leakage.

### Task 5: Capture sanitized visual evidence and handoff

**Files:**
- Create: `docs/audit/phase-8i/visual-uat-ledger.md`
- Create: `docs/handoffs/phase-8i-client-acceptance.md`
- Create: `docs/handoffs/phase-8i-verdicts.md`

- [ ] Capture the thirteen required public, CUSTOMER and ADMIN states from deterministic fixtures at desktop/mobile where requested.
- [ ] Record route, viewport, fixture, expected/actual state, a11y result, UAT result and intentional deviation without PII.
- [ ] Produce client-readable instructions, reset/reseed steps, exact external status and rollback boundary.

### Task 6: Final deterministic regression and clean-tree closure

**Files:**
- Verify only: all modified files and repository root

- [ ] Run provider/features/OAuth/i18n/endpoint/OpenAPI/lint/type/unit/build/db/audit gates independently.
- [ ] Run `pnpm demo:preflight`, `pnpm demo:lifecycle-test`, then `pnpm demo:smoke` sequentially.
- [ ] Run `pnpm test:e2e` twice from final HEAD, record exact counts and unavailable API result, then verify no owned port/database leak.
- [ ] Before each commit run `git diff --cached` and `git diff --cached --check`; after it run `git show --check <sha>`; final state requires clean `git status --short` and `git diff --check`.
