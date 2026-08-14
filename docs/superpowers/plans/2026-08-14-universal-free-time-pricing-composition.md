# Universal Free-Time Pricing Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make mode-free customer intervals priceable through the existing versioned policy graph, preserving exact `[checkIn, checkOut)` coverage and quote/availability parity.

**Architecture:** Keep legacy catalog and Operations V3 as independent candidate producers. Extend the governed B0 bootstrap representation so leading/trailing started-unit components cover the property stay-policy horizon, then use the existing exact-coverage composer and deterministic resolver for every mode-free request. Historical policies, quotes, and bookings remain immutable; production data is changed only through the existing draft/preview/publish/supersede lifecycle.

**Tech Stack:** TypeScript, NestJS, Zod contracts, Drizzle/Postgres, Vitest, Playwright, pnpm/Turbo.

## Global Constraints

- Customer submits only `checkIn`, `checkOut`, and `adults` (with existing children/property fields); customer mode is omitted.
- A candidate must cover exactly `[checkIn, checkOut)` with no gaps, overlaps, rounding, or fabricated duration.
- Do not expose catalog/policy/V3/component internals in customer copy.
- Do not modify historical published policies, quote snapshots, or bookings.
- Do not edit production DB directly; use draft, validate, preview, publish, and supersede lifecycle.
- Work only in `D:\Study\Project\Room Management` on `main`; preserve historical untracked artifacts; stage exact paths only.
- Do not redesign customer visuals or add a customer-facing mode selector.

### Task 1: Capture the real universal coverage contract

**Files:**

- Create: `apps/api/test/universal-free-time-pricing.test.ts`
- Modify: `apps/api/src/pricing-policy/pricing-policy.service.ts`
- Test: `apps/api/test/pricing-policy.service.test.ts`

- [ ] Write a failing bootstrap-lifecycle test that exercises `bootstrapDraft` with a real V1 source and asserts generated leading/trailing components permit the full configured stay horizon rather than five started-hour units.
- [ ] Run the focused service test and confirm the failure is the old `300`/`5` bootstrap shape.
- [ ] Replace the hard-coded bootstrap boundary values with named constants representing a 24-hour boundary window and 24 started units; retain the database validator's existing 44,640-minute upper bound and preserve historical rows.
- [ ] Run the focused service test and confirm the generated draft is publication-ready with `boundaryMaxDurationMinutes = 1_440` and `maximumBillingUnits = 24`.

### Task 2: Prove real composer coverage for arbitrary intervals

**Files:**

- Modify: `apps/api/test/universal-free-time-pricing.test.ts`
- Modify: `apps/api/src/pricing-policy/pricing-policy.composer.ts` only if a failing real-composition case identifies a source defect.

- [ ] Build a real published-policy fixture with explicit leading/trailing started-unit prices, 24-hour continuation, a local 21:00–09:00 window, all directed edges, and deterministic VND amounts.
- [ ] Add real composition cases for same-day 3h and 5h, 21→09, 22→10, 09:00→next 10:00, 09:06→next 10:06, 14:15→next 11:00, day+2, day+3, cross-month, cross-year, leap-day, minimum, maximum, above-maximum, missing price, and middle-segment coverage boundaries.
- [ ] Assert request mode is omitted at the service boundary, exact line contiguity, selected component codes, exact total derived from fixture prices, and display night count; never assert fabricated totals.
- [ ] Run the focused composer test before any implementation change and record the first failing case.
- [ ] Make the smallest source correction required by the failing case, then rerun focused tests.

### Task 3: Align flexible availability and quote candidate handling

**Files:**

- Modify: `apps/api/src/pricing/availability.service.ts`
- Modify: `apps/api/src/pricing/availability.repository.ts` only if parity evidence requires it.
- Modify: `apps/api/src/pricing/quote.service.ts`
- Modify: `apps/api/src/pricing/flexible-stay-resolver.ts` only if candidate metadata or ranking is incomplete.
- Test: `apps/api/test/integration/universal-free-time-pricing.integration.test.ts`

- [ ] Add DB-backed mode-free integration cases that call availability and quote for the same property, room type, exact interval, and guests.
- [ ] Assert ordinary producer non-applicability does not erase a valid candidate from the other producer, while infrastructure failures still reject safely.
- [ ] Assert availability and quote select the same family, component representation, exact interval, and total amount.
- [ ] Assert `mode` is absent from the customer request and never required by the flexible path.
- [ ] Run the new integration test RED, then implement only the parity/producer handling defect it exposes.

### Task 4: Preserve HOLD and single-room continuity

**Files:**

- Test: `apps/api/test/integration/universal-free-time-pricing.integration.test.ts`
- Test: `tests/e2e/availability-quote.spec.ts` or a new narrowly scoped E2E spec if the existing flow cannot express arbitrary intervals.

- [ ] Extend the real flow from availability to quote and HOLD for 3h, overnight, 25h, 2-night, and 3-night intervals.
- [ ] Assert one quote, one HOLD, one booking, one inventory block spanning the full half-open interval, and one physical room ID throughout.
- [ ] Add inventory, maintenance, capacity, and missing-price cases that prove availability fails closed without repricing or room stitching.
- [ ] Run the focused integration/E2E tests and keep existing payment/cancellation/access lifecycle tests unchanged.

### Task 5: Remove false customer 15-minute restriction and keep customer copy generic

**Files:**

- Modify: `apps/web/src/components/availability-search-form.tsx` only if custom validation or copy rejects arbitrary minutes.
- Modify: `apps/web/src/lib/i18n/messages.ts` for actionable generic success/unavailable copy only.
- Test: `apps/web/test/availability-search-form.test.tsx`
- Test: `apps/web/test/availability-search-results.test.tsx`

- [ ] Add a failing browser-form test for `09:06` proving no client-side 15-minute rejection and no mode parameter in the submitted request.
- [ ] Remove only false validation/copy; retain native `step=900` as a browser hint if it is not a hard rejection.
- [ ] Assert successful copy describes the selected interval total without exposing `PRICING_CONFIGURATION_UNAVAILABLE`, catalog, V3, policy, or component terms.

### Task 6: Verify all gates and governed release readiness

**Files:**

- Modify: no production data files.
- Test: all files changed above plus `.github/workflows/ci.yml` command set.

- [ ] Run focused RED/GREEN tests, then every command currently listed in `.github/workflows/ci.yml`.
- [ ] Run `git diff --check`, stage only exact changed paths, commit on `main`, and push.
- [ ] Poll hosted CI for the exact pushed SHA and report each independent gate; do not call in-progress E2E a pass.
- [ ] Do not deploy production unless an active human release authorization is present; if not deployed, report the remaining production configuration/release work explicitly.
