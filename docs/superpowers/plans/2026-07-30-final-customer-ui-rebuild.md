# Final customer UI rebuild implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a customer-ready hospitality booking experience and a dense,
truthful ADMIN operations workspace without changing backend authority.

**Architecture:** Keep server/client data boundaries and route contracts in
place. Introduce a small presentation content boundary, reusable local UI
primitives and tokenised CSS, then update each real route family to consume the
same visual language. All booking and payment values continue to come from
existing API responses.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing CSS tokens,
Vitest, Playwright and jest-axe. No dependency addition.

## Global constraints

- Branch and baseline: `phase5-booking-hold-guest-access` at `635684a`.
- Do not create backend contracts, migrations, WebSocket state, CMS or pricing
  logic.
- Browser requests may form intervals only; server remains price, availability,
  room-allocation and settlement authority.
- Use local generated image assets only; never hotlink or fabricate transactional
  data.
- Verify visual surfaces at 390, 768, 1366 and 1440px and preserve vi/en.

---

### Task 1: Foundation, assets and route-safe public shell

**Files:**

- Create: `apps/web/src/content/public-hospitality-content.ts`
- Create: `apps/web/public/images/hospitality/*.png`
- Create: `apps/web/src/components/ui/{brand-mark,status-badge,empty-state,loading-skeleton}.tsx`
- Create: `apps/web/src/components/mobile-navigation-drawer.tsx`
- Modify: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`,
  `apps/web/src/components/public-header.tsx`, `apps/web/src/lib/i18n/messages.ts`
- Test: `apps/web/test/public-homepage.test.tsx`,
  `apps/web/test/customer-login-presentation.test.ts`

- [ ] Write a failing test that asserts public navigation has a single booking
      link, an accessible account control and no ADMIN target.
- [ ] Run `pnpm --filter @room/web exec vitest run test/public-homepage.test.tsx` and confirm RED.
- [ ] Add content, local assets, UI primitives and responsive public header.
- [ ] Re-run the focused test and `pnpm --filter @room/web typecheck`.
- [ ] Capture landing desktop/mobile screenshot and compare with reference.
- [ ] Commit boundary: `feat(web): establish customer-ready landing and public shell`.

### Task 2: Landing and hourly/overnight discovery

**Files:**

- Create: `apps/web/src/components/public-landing.tsx`,
  `apps/web/src/components/booking-mode-tabs.tsx`
- Modify: `apps/web/src/app/page.tsx`,
  `apps/web/src/components/availability-search-form.tsx`, `apps/web/src/app/globals.css`,
  `apps/web/src/lib/i18n/messages.ts`
- Test: `apps/web/test/public-homepage.test.tsx`,
  `apps/web/test/availability-search-form.test.tsx`

- [ ] Write failing tests for mode switching, hourly/overnight field labels and
      server-search button state without client price calculation.
- [ ] Run only the new/changed Vitest files to confirm RED.
- [ ] Implement landing sections and accessible mode tabs while preserving the
      existing `publicApi.searchAvailability` payload path.
- [ ] Verify GREEN, responsive styles and focused public axe test.
- [ ] Capture landing and both booking modes at desktop/mobile widths.
- [ ] Commit boundary: `feat(web): complete landing discovery and booking search`.

### Task 3: Results, quote, recommendation, HOLD and payment surfaces

**Files:**

- Create: `apps/web/src/components/{room-type-card,booking-stepper,price-summary}.tsx`
- Modify: `apps/web/src/components/{availability-search-form,quote-view,quote-summary,quote-contact-form,stay-time-recommendations,hold-success-panel,payment-provider-selector,payment-status-summary}.tsx`,
  `apps/web/src/app/globals.css`
- Test: `apps/web/test/{quote-summary,hold-success-panel,payment-localization}.test.tsx`,
  `tests/e2e/availability-quote.spec.ts`,
  `tests/e2e/payment-gate-b11-b12.spec.ts`

- [ ] Add failing tests for visible quote expiry/summary, recommendation safety
      copy and disabled unavailable provider state.
- [ ] Confirm RED with focused Vitest.
- [ ] Implement result cards, stepper, price breakdown and state-aware HOLD /
      payment visual treatment without altering API calls.
- [ ] Verify focused unit/E2E checks GREEN and capture results, quote, HOLD,
      provider and terminal-state screenshots.
- [ ] Commit boundary: `feat(web): complete hourly and overnight booking experience`.

### Task 4: Guest lookup and CUSTOMER account/confirmation

**Files:**

- Modify: `apps/web/src/app/booking/manage/**`, `apps/web/src/app/account/**`,
  `apps/web/src/components/{booking-detail-panel,otp-request-panel,otp-verify-panel}.tsx`,
  `apps/web/src/app/globals.css`
- Test: `apps/web/test/{otp-panels,customer-bookings,customer-profile-localization}.test.tsx`,
  `tests/e2e/customer-identity-browser.spec.ts`

- [ ] Write failing tests for navigation, booking summaries and semantic OTP
      form labels.
- [ ] Confirm RED, then implement account navigation, profile/bookings/detail
      presentation and print stylesheet without new data fields.
- [ ] Verify GREEN plus keyboard navigation/browser screenshots.
- [ ] Commit boundary: `feat(web): complete customer account and guest access surfaces`.

### Task 5: ADMIN shell, overview, board and CRUD alignment

**Files:**

- Create: `apps/web/src/components/ui/{admin-page-header,admin-filter-bar,responsive-table-region}.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/page.tsx`,
  `apps/web/src/components/{operational-report-dashboard,room-operations-board,room-housekeeping-manager,catalog-table}.tsx`,
  `apps/web/src/app/admin/**/page.tsx`, `apps/web/src/app/globals.css`
- Test: `apps/web/test/{phase8h-operations,admin-payments-page,catalog-table}.test.tsx`,
  `tests/e2e/{phase-8h-room-operations,phase-8h-reporting,phase-7g-admin-booking-operations}.spec.ts`

- [ ] Write failing tests for grouped labelled nav, text-plus-colour status and
      contained responsive tables.
- [ ] Confirm RED, implement shell/overview/board and apply shared table/filter
      primitives to actual ADMIN route families.
- [ ] Verify GREEN and capture overview, rooms board, bookings and report at
      desktop/mobile widths.
- [ ] Commit boundary: `feat(admin): refine hospitality operations workspace`.

### Task 6: Regression, i18n, accessibility and visual closure

**Files:**

- Create: `docs/handoffs/final-customer-ui-rebuild.md`
- Modify: focused existing web tests and `tests/e2e/phase-8i-visual-uat.spec.ts`

- [ ] Add only behaviour/semantic tests required by changed flows and prove
      each one fails before implementation.
- [ ] Run `pnpm check:i18n-critical`, `pnpm lint`, `pnpm typecheck`,
      `pnpm test:unit`, `pnpm build`, `pnpm db:check`, `pnpm db:status`.
- [ ] Run feature/endpoints/openapi/provider checks and sequential demo
      preflight, lifecycle and smoke commands.
- [ ] Run `pnpm test:e2e` twice with workers=1/retries=0 and record exact
      outcomes plus screenshot paths in the handoff.
- [ ] Inspect screenshots against both reference images, resolve all critical
      mismatch/overflow/accessibility defects and record any truthful external
      provider blockers.
- [ ] Commit boundaries: `test(e2e): prove final customer journeys` and
      `docs(handoff): record final UI fidelity evidence`.

## Plan self-review

Coverage: Tasks 1-4 cover every public, guest and customer route family;
Task 5 covers every ADMIN family; Task 6 covers tests, browser comparison,
handoff and final evidence. No task introduces backend authority or
unavailable fields. No placeholder or ambiguous ownership remains.
