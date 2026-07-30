# Phase 8D Client Requirement Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver evidence-backed deterministic acceptance for the Room Management client requirements, with coupon delivery, vi/en localization, HTTPS readiness, payment/OpenAPI verification, and constrained UI quality.

**Architecture:** Extend the existing modular monolith rather than adding services: a forward database migration and the existing transactional outbox carry coupon-delivery requests; web localization uses local dictionaries and a cookie; HTTPS safeguards remain environment validation plus Fastify proxy configuration. Existing payment adapters and settlement authority are exercised, not replaced.

**Tech Stack:** Next.js 16, React 19, NestJS/Fastify, Drizzle/PostgreSQL, Zod, Vitest, Playwright, SMTP/Mailpit loopback simulation.

## Global Constraints

- Keep the current branch and preserve released migrations `0000` through `0018` byte-for-byte.
- Never push, create a PR, deploy, contact live providers, charge money, expose secrets, delete volumes, or touch port 3001.
- PostgreSQL is authoritative; money is integer VND; availability ranges are `[checkIn, checkOut)`.
- The only payment settlement mutation remains `applyVerifiedPaymentEvent`.
- Use native/local capabilities before new dependencies; no generic translation platform, campaign system, new design system, or decorative motion.
- Run every new behavior red then green, recording the failing command before production code.

---

### Task 1: Establish current acceptance evidence and traceability

**Files:**

- Create: `docs/audit/phase-8d/client-requirement-matrix.md`
- Create: `docs/audit/phase-8d/endpoint-inventory.csv`
- Modify: `docs/audit/phase-8d/validation-report.md`

**Interfaces:**

- Consumes: live controller decorators, generated OpenAPI, package tests, prior Phase 8C evidence.
- Produces: a one-row-per-requirement evidence matrix and route inventory with no inferred PASS values.

- [ ] Record Gate 0 values, migration hashes/list, and port ownership.
- [ ] Map REQ-01 through REQ-09 to endpoint, page/component, unit, PostgreSQL, Playwright, external dependency, and verdict.
- [ ] Compare relevant `@Controller` / HTTP decorators against generated OpenAPI and write zero-or-exact-gap counts.
- [ ] Run focused existing deterministic payment, booking, pricing, coupon, OAuth, and browser tests before changing source; record their exact output.

### Task 2: Deliver ADMIN coupon-email command through the existing outbox

**Files:**

- Create: `packages/database/drizzle/0019_phase8d_coupon_delivery.sql`
- Modify: `packages/database/src/schema.ts`, `packages/contracts/src/coupon.ts`, `apps/api/src/booking/admin-booking-operations.controller.ts`, `apps/api/src/booking/booking.module.ts`, `apps/worker/src/jobs/process-outbox.ts`
- Create: focused API, PostgreSQL, worker, and browser test files alongside existing booking/coupon/outbox specs.

**Interfaces:**

- Consumes: `POST /api/v1/admin/bookings/:bookingCode/send-coupons`, request `{ couponCodes: string[] }`, header `Idempotency-Key`.
- Produces: an immutable delivery request, `coupon.delivery.requested` outbox event, and safe `{ deliveryId, status }` response.

- [ ] Write a failing service/integration test proving an ADMIN can enqueue a bounded set of active property coupons for a booking contact without supplying an email.
- [ ] Run it and confirm the feature-missing failure.
- [ ] Add the smallest forward migration/schema/repository/service/controller path with unique property/idempotency ownership and a safe audit event.
- [ ] Re-run the focused test until green.
- [ ] Write a failing worker test proving it renders from persisted snapshots and does not log recipient/body data.
- [ ] Implement the one new outbox renderer/template branch, then run the worker test green.
- [ ] Add the ADMIN UI action with selection, confirmation, loading, success, and safe error states; prove it in Playwright and at 390x844.

### Task 3: Add local vi/en application localization and bounded dynamic translation

**Files:**

- Create: `apps/web/src/lib/i18n/*`, `apps/api/src/translation/*`
- Modify: critical public/account/admin pages and their client components, `apps/web/src/app/layout.tsx`, `packages/config/src/index.ts`, `.env.example`
- Create: web/API unit and browser tests.

**Interfaces:**

- Consumes: `room_locale` cookie, locale `vi | en`, server-only translation environment flag/credentials.
- Produces: typed `t(locale, key)` labels, a visible locale switch, and `translateApprovedPublicDescription(input)` with safe source-language fallback.

- [ ] Write a failing web test for locale persistence and selected HTML language; run it red.
- [ ] Implement cookie parsing/setting and typed static dictionaries for the critical flows; run it green.
- [ ] Write failing tests for localized validation/error copy and canonical code/VND/provider/status preservation; implement only needed labels and run green.
- [ ] Write failing API tests for disabled/no-credential fallback, PII rejection, bounded input, cache key, and timeout behavior of the dynamic adapter.
- [ ] Implement the server-only adapter without wiring unapproved dynamic content; run green.
- [ ] Add deterministic Playwright for vi/en booking/payment/customer/admin flows and no mixed critical locale screen.

### Task 4: Close proxy/HTTPS configuration and callback documentation

**Files:**

- Modify: `apps/api/src/main.ts`, `packages/config/src/index.ts`, `packages/config/test/environment.test.ts`, `.env.example`
- Create: `docs/runbooks/ssl-and-callback-setup.md`

**Interfaces:**

- Consumes: `TRUSTED_PROXY_CIDRS`, `WEB_ORIGIN`, Google/MoMo/VNPAY callback URLs.
- Produces: trusted-proxy-aware Fastify startup and a documented reverse-proxy/callback operator checklist.

- [ ] Write a failing configuration/bootstrap test for trusted proxy parsing and rejected public HTTP callbacks.
- [ ] Run it red.
- [ ] Apply the minimal Fastify trust-proxy wiring and configuration validation; run green.
- [ ] Write the runbook distinguishing locally-proven readiness from external domain/certificate/provider registration.

### Task 5: Validate payment, UI, OpenAPI, documentation, and regressions

**Files:**

- Create: `docs/audit/phase-8d/ui-minimalism-report.md`, `docs/audit/phase-8d/ui-requirement-matrix.csv`, `docs/handoffs/phase-8d-client-acceptance.md`, `docs/handoffs/phase-8d-verdicts.md`, `docs/architecture/adr/ADR-0013-client-requirement-acceptance.md`
- Modify: `README.md`, `docs/product/user-journeys.md`, `docs/engineering/payment-architecture.md`, `docs/engineering/admin-api-contract.md`, `docs/security/threat-model.md`, OpenAPI artifacts, `docs/audit/phase-8d/validation-report.md`

**Interfaces:**

- Consumes: all focused test output, generated OpenAPI, local TLS/proxy/config checks, screenshots only for changed critical pages.
- Produces: exact PASS/PARTIAL/EXTERNAL_BLOCKED verdicts and a clean worktree after focused commits.

- [ ] Run payment vectors, VNPAY x100/query tests, reconciliation tests, and simulator browser paths; record exact counts.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm check:openapi`, `pnpm db:check`, `pnpm db:status`, `pnpm db:test`, and `pnpm audit --prod --audit-level=high`.
- [ ] Run the complete deterministic Playwright suite twice with `workers=1`, `retries=0`, `reporter=line`, then demo preflight/lifecycle/smoke.
- [ ] Audit changed UI at 390x844 and 1366x768 for keyboard focus, labels, overflow, clipped controls, loading/error/success, and language consistency.
- [ ] Generate only required OpenAPI artifacts, write final evidence docs, stage focused paths, inspect the staged diff/check, and create forward commits without amend.
