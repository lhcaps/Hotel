# Phase 8G Hospitality Product UI Implementation Plan

Date: 2026-07-29
Baseline: `fd7538bba1c586d0c4bb082950474f3f4ab2b6bd`

## Interfaces and boundaries

- `apps/web/src/lib/admin-api.ts` and `apps/web/src/lib/booking-api.ts` remain the existing browser API clients.
- `@room/contracts` remains the only shared DTO/schema source.
- Public availability only returns room type name, capacity, and count; the UI will not claim backend fields it does not receive.
- Quote/recommendation/HOLD/payment continue through existing routes and domain APIs.
- Server-side CUSTOMER pages continue forwarding the incoming cookie to the existing authoritative endpoints.

## Controlled tasks

- [ ] Batch 1: Add semantic hospitality tokens and reusable CSS conventions in `apps/web/src/app/globals.css`; update `apps/web/src/components/public-header.tsx`, `apps/web/src/components/locale-switch.tsx`, `apps/web/src/app/layout.tsx`; add focused header unit tests in `apps/web/test/public-homepage.test.tsx`. Verify `pnpm --filter @room/web test:unit -- public-homepage.test.tsx` and screenshot `/` at desktop/mobile. Commit `feat(web): establish hospitality design system and auth shell`.
- [ ] Batch 2: Update `apps/web/src/components/availability-search-form.tsx` and related copy in `apps/web/src/lib/i18n/messages.ts` to render polished authoritative room-type results and complete empty/error/loading state. Update `apps/web/test/public-homepage.test.tsx`. Verify focused unit test and root booking browser flow. Commit `feat(web): complete public room discovery`.
- [ ] Batch 3: Update `apps/web/src/components/quote-view.tsx`, `quote-summary.tsx`, `stay-time-recommendations.tsx`; introduce a small plan-label helper only if used by quote and recommendation. Add unit coverage for labels and recommendation rendering. Verify quote/recommendation browser flow and screenshot. Commit `feat(web): complete quote and recommendation experience`.
- [ ] Batch 4: Update `apps/web/src/components/quote-contact-form.tsx` and `hold-success-panel.tsx` using shared classes/stepper markup only. Preserve validation, server clock sync, recheck, and no-payment-on-expiry. Extend focused component tests. Verify HOLD browser flow. Commit `feat(web): complete booking hold wizard`.
- [ ] Batch 5: Update `apps/web/src/components/payment-provider-selector.tsx`, `payment-status-summary.tsx`, and booking-detail composition if needed. Preserve provider readiness and status polling contracts. Extend payment localization/unit coverage. Verify deterministic provider states. Commit `feat(web): complete payment selection states`.
- [ ] Batch 6: Update `apps/web/src/app/account/layout.tsx`, account booking route pages, profile page/client. Keep server ownership/auth checks and protected email semantics. Add profile presentation/save unit test. Verify deterministic CUSTOMER profile/list/logout journey. Commit `feat(web): complete customer account surfaces`.
- [ ] Batch 7: Update `apps/web/src/app/admin/layout.tsx`, `apps/web/src/components/catalog-table.tsx`, and admin CSS conventions. Preserve `AdminAccessGuard` and every route. Add focused table/accessibility coverage. Verify ADMIN room-type page screenshot and responsive table overflow. Commit `feat(admin): establish professional table-driven CRUD shell`.
- [ ] Batch 8: Apply existing shared admin form/table classes to `apps/web/src/app/admin/bookings/page.tsx`, `payments/page.tsx`, and existing manager components only where they lack the pattern. No generic table or dynamic form builder. Extend existing admin E2E selectors only when needed. Verify real CRUD e2e. Commit `feat(admin): complete existing operations CRUD presentation`.
- [ ] Batch 9: Run visual screenshots at 390x844, 768x1024, 1366x768, 1440x900; run focused axe checks and keyboard flows. Create `docs/audit/phase-8g/visual-fidelity-ledger.md`. Commit UI test additions, then evidence docs separately.

## Test and verification commands

Focused during batches:

```powershell
pnpm --filter @room/web test:unit -- public-homepage.test.tsx
pnpm --filter @room/web test:unit -- stay-time-recommendations.test.tsx
pnpm --filter @room/web test:unit -- quote-contact-form.test.tsx hold-success-panel.test.tsx
pnpm --filter @room/web test:unit -- payment-localization.test.tsx
pnpm --filter @room/web test:unit -- customer-profile-localization.test.tsx
pnpm test:e2e
```

Final required command set:

```powershell
pnpm check:providers
pnpm check:features
pnpm check:google-oauth
pnpm check:i18n-critical
pnpm check:endpoints
pnpm check:openapi
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm db:check
pnpm db:status
pnpm db:test
pnpm audit --prod --audit-level=high
pnpm demo:preflight
pnpm demo:lifecycle-test
pnpm demo:smoke
pnpm test:e2e
pnpm test:e2e
```

## Screenshot checkpoints

Capture final browser evidence for public home desktop/mobile, search result, quote/recommendation, contact/HOLD, payment selection/status, CUSTOMER profile/bookings, ADMIN room types/bookings/payments. Compare hierarchy, palette, spacing, CTA emphasis, list/table anatomy and responsive behavior against the approved concept. Record each result in the visual fidelity ledger.

## Commit boundaries

Each commit is forward-only and contains only its related product/test/docs changes. Before committing run `git diff --cached`, `git diff --cached --check`; after committing run `git show --stat`, `git show --name-status`, and `git show --check`. Generated `.next*` output and `.env` remain uncommitted.

## Self-review

- No task relies on a new UI dependency, new API client, generic design system package, rate-plan selector, fake provider, or browser-authoritative state.
- The plan accounts for actual public data limitations instead of inventing rate-plan/room media data.
- The source contract and user-facing visual requirements align: presentation improves while server authority remains unchanged.
