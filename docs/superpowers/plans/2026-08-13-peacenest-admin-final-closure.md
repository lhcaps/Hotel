# PeaceNest Admin Final Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close verified ADMIN-only visual, interaction, accessibility, and shadcn composition gaps without changing public/customer UX or business contracts.

**Architecture:** Keep generic primitives under `apps/web/src/components/ui`, and keep operational layout, records, filters, status, and responsive tables in `components/admin` or Admin feature files. Repair the existing canonical composition rather than introducing a data-grid framework or a second Admin visual system. CSS changes must remain scoped by `.admin-app-shell` or an Admin feature root.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn base UI, Vitest, Playwright.

## Global Constraints

- Main repository and `main` branch only; no worktree, branch, rebase, reset, stash, clean, force push, or production deployment.
- Preserve existing untracked artifacts. Stage each changed path explicitly; never use `git add .` or `git add -A`.
- ADMIN only: no intentional public, booking, account, auth, OTP, or customer-payment restyle.
- Preserve pricing, payment, RBAC, booking, and inventory behavior; defects are fixed only from a reproduced cause.
- Run current CI commands from `.github/workflows/ci.yml`; do not weaken assertions, retries, or timeouts.

> **Closure status (2026-08-13):** Tasks 1–4 and Task 5 steps 1–4 are complete. The final exact-path commit and hosted-CI observation remain the only publication actions pending at this snapshot.

---

### Task 1: Record the closure matrix and lock shared Admin regressions

**Files:**

- Create: `docs/admin-v2/ADMIN_FINAL_CLOSURE_MATRIX.md`
- Modify: `tests/e2e/admin-v3-authenticated-qa.spec.ts`
- Modify: `apps/web/src/components/admin/admin-ui.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**

- Consumes: the protected route tree under `apps/web/src/app/admin/(protected)` and the existing `AdminTabs`, `AdminDataTable`, `AdminRowActions`, `AdminFormSheet`, and status primitives.
- Produces: a 29-route evidence matrix, an AdminTabs indicator constrained to its `TabsList`, and test coverage for the rendered closure denominator.

- [x] **Step 1: Write failing focused browser regression tests.**

Add an expectation on `/admin/accounts` that the active AdminTabs indicator bounding box is vertically inside the tabs list, and extend the existing QA inventory with all required closure screenshots.

- [x] **Step 2: Run the focused test and verify the expected failure.**

Run: `pnpm exec playwright test tests/e2e/admin-v3-authenticated-qa.spec.ts -g "tab indicator"`

Expected: FAIL because `.admin-tabs-system__indicator` is laid out after `TabsContent`, not from the root origin.

- [x] **Step 3: Apply the minimal shared correction.**

Give the indicator an explicit root origin and keep its animation to `transform` and `opacity`; do not replace the accepted sliding-indicator behavior. Retain the existing reduced-motion path.

- [x] **Step 4: Verify the shared contract.**

Run: `pnpm exec playwright test tests/e2e/admin-v3-authenticated-qa.spec.ts`

Expected: all rendered-route, interaction, and primary-screenshot cases pass with no page or console errors.

- [x] **Step 5: Write the route and primitive matrix.**

For every protected filesystem route, record route, family, redirect/render status, shell, table/form/filter/tab/action/detail/feedback composition, source classification, rendered QA result, and remediation. Record `customer-accounts` as the intentional redirect to `accounts?view=customers`, not as an unrendered failure.

### Task 2: Recompose the priority pricing and catalog management surfaces

**Files:**

- Modify: `apps/web/src/components/rate-plan-manager.tsx`
- Modify: `apps/web/src/components/pricing-policy-manager.tsx`
- Modify: `apps/web/src/components/price-tier-manager.tsx`
- Modify: `apps/web/src/components/room-type-manager.tsx`
- Modify: `apps/web/src/components/amenity-manager.tsx`
- Modify: `apps/web/src/components/property-editor.tsx`
- Modify: focused existing tests in `tests/e2e/admin-rate-plan.spec.ts`, `tests/e2e/admin-price-tier.spec.ts`, `tests/e2e/admin-room-type.spec.ts`, `tests/e2e/admin-amenity.spec.ts`, and `tests/e2e/admin-property.spec.ts`

**Interfaces:**

- Consumes: existing API contracts in `apps/web/src/lib/admin-api.ts`, canonical Admin compositions, and shadcn `Field`, `Table`, `Select`, `DropdownMenu`, `Sheet`, and `AlertDialog` primitives.
- Produces: management surfaces with real Field validation, grouped Select items, Table anatomy, one menu-based secondary action architecture, and explicit destructive confirmation.

- [x] **Step 1: Add one failing behavior test per confirmed defect.**

Cover the Price Tier edit-menu/archive-confirm flow; Rate Plan shared tabs, price and rule validation; Room Type amenity assignment; Amenity edit/archive confirmation; and Property invalid field state. Use the existing authenticated fixture and API contracts.

- [x] **Step 2: Run each focused spec to prove the pre-fix defect.**

Run the individual file with `pnpm exec playwright test <exact-file>` or the closest existing Vitest component test. Record a failure only when it demonstrates the stated defect; otherwise revise the test rather than changing production code.

- [x] **Step 3: Make minimal composition corrections.**

Use `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell`; use `FieldSet`/`FieldLegend` where forms have meaningful sections; put `SelectItem` inside `SelectGroup`; use `AdminTabs`; move edit/detail work into existing sheets; route destructive work through `AlertDialog`; and replace raw alerts with `Alert` or `FieldError` where appropriate. Preserve current API payloads and lifecycle semantics.

- [x] **Step 4: Re-run each focused test and the web unit suite.**

Run: `pnpm --filter @room/web test:unit`

Expected: focused regression tests and the web unit suite pass without an assertion relaxation.

### Task 3: Close remaining management, detail, and dense-operational inconsistencies

**Files:**

- Modify as proven necessary: `apps/web/src/components/coupon-list.tsx`, `apps/web/src/components/coupon-form.tsx`, `apps/web/src/components/coupon-detail.tsx`, `apps/web/src/components/payment-provider-manager.tsx`
- Modify as proven necessary: `apps/web/src/app/admin/(protected)/departments/page.tsx`, `apps/web/src/app/admin/(protected)/audit/page.tsx`, `apps/web/src/app/admin/(protected)/profile/page.tsx`
- Modify as proven necessary: `apps/web/src/app/admin/(protected)/bookings/page.tsx`, `apps/web/src/app/admin/(protected)/bookings/[bookingCode]/page.tsx`, `apps/web/src/app/admin/(protected)/payments/page.tsx`, `apps/web/src/app/admin/(protected)/payments/[paymentId]/page.tsx`
- Modify as proven necessary: `apps/web/src/components/operational-report-dashboard.tsx`, `apps/web/src/components/room-operations-board.tsx`, `apps/web/src/components/housekeeping-workboard.tsx`, `apps/web/src/components/maintenance-manager.tsx`
- Test: the closest affected `tests/e2e/admin-*.spec.ts` files

**Interfaces:**

- Consumes: existing Admin API and RBAC boundaries plus Task 1 shared primitives.
- Produces: consistent list/detail/form grammar, working visible controls, compact feedback states, and no intentional customer/public styling change.

- [x] **Step 1: Audit visible controls route by route.**

Classify each search, filter, tab, sort, pagination, reset, row action, loading, empty, and error state as WORKING, BROKEN, INERT, or REDUNDANT from authenticated browser evidence.

- [x] **Step 2: Add focused failing regressions only for confirmed broken or inert behavior.**

Use real user flows and existing fixtures. Do not add tests that only assert implementation markup.

- [x] **Step 3: Correct individual root causes.**

Use the canonical Admin composition applicable to the local task. Keep dense tables dense at desktop sizes; use deliberate horizontal scroll for safety only when the required desktop viewport cannot retain meaningful columns.

- [x] **Step 4: Verify each corrected interaction in an authenticated browser run.**

Check the route identity, visible state change, console health, and affected desktop/tablet layout after every narrow change set.

### Task 4: Consolidate Admin-scoped CSS and verify non-Admin isolation

**Files:**

- Modify: `apps/web/src/app/globals.css`
- Test: `tests/e2e/admin-v3-authenticated-qa.spec.ts` and relevant public/customer regression specs already selected by current CI

**Interfaces:**

- Consumes: the final Admin compositions and established CSS variables.
- Produces: one authoritative Admin cascade for shell, tabs, data tables, status, overlays, forms, and responsive behavior.

- [x] **Step 1: Write or extend a regression for each cascade bug selected for removal.**

For example, preserve the account-tab indicator placement and the required 1440px dense-table behavior before deleting superseded selector blocks.

- [x] **Step 2: Collapse only demonstrably superseded Admin selector blocks.**

Keep semantic tokens and final rules; remove earlier duplicate declarations only after comparing their effect in the rendered UI. Do not touch unscoped customer/public selectors.

- [x] **Step 3: Validate desktop, tablet, and mobile safety.**

Run the Admin QA at 1920x1080, 1440x900, 1280x800, 1024x768, and safety checks at 768/390. Verify sidebar access, sheet/dialog fit, no trapped action, no catastrophic overflow, focus visibility, keyboard tabs, and reduced motion.

### Task 5: Final evidence, review, and release gate

**Files:**

- Modify: `docs/admin-v2/ADMIN_FINAL_CLOSURE_MATRIX.md`
- Modify: `docs/superpowers/plans/2026-08-13-peacenest-admin-final-closure.md`

**Interfaces:**

- Consumes: all previous tasks and the current `.github/workflows/ci.yml` gate sequence.
- Produces: exact-SHA evidence, screenshot index, closure matrix, review findings, and final report values.

- [x] **Step 1: Run route-wide rendered QA and inspect screenshots.**

Use the authenticated test fixture for all 29 route contracts, including the intentional customer-account redirect. Capture each required screen at 1440 and primary views at their required desktop sizes. Inspect the resulting images, not only test output.

- [x] **Step 2: Audit shared primitive non-Admin consumers.**

For every changed generic primitive, search all consumers and run the relevant public/customer regression gate. Report `PUBLIC_CUSTOMER_INTENTIONAL_REDESIGN=NOT_ATTEMPTED`.

- [x] **Step 3: Run current quality gates in CI order.**

Run: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:catalog`, `pnpm test:auth`, `pnpm test:pricing`, `pnpm test:availability`, `pnpm test:quotes`, `pnpm check:openapi`, `pnpm db:check`, `pnpm db:test`, `pnpm audit:deps`, `pnpm build`, `pnpm check:release-integrity`, `pnpm storybook:build`, `pnpm --filter @room/web test:unit`, and `pnpm test:e2e`.

- [x] **Step 4: Request an independent final code review.**

Review the final exact diff for shadcn composition, duplicate primitives, giant managers, raw controls, dead CSS, Admin/public coupling, RBAC, pricing authority, and payment authority. Fix every valid Critical or Important finding and repeat affected checks.

- [ ] **Step 5: Commit and publish only fresh, verified changes.**

Stage exact paths, commit on `main`, push `main`, then use GitHub Actions to verify that `FINAL_SHA == ORIGIN_MAIN_SHA` and the exact hosted CI run concludes `success`. Stop before production deployment.
