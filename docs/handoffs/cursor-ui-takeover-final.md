# Cursor UI takeover final

## Starting point

- Actual starting full SHA: `daaa860f510b00dbdfb3d937413af25096a6c879`
- Starting branch: `phase5-booking-hold-guest-access`
- Starting worktree: clean after the Codex catalog delivery.
- Schema: `phase-8d-client-acceptance-v1`.
- Endpoint reconciliation: 79 runtime routes, 75 documented routes, 4 explicit allowlist entries.

## Codex chain audited and preserved

`2808866` → `f882d48` → `725e4e7` → `b271aa6` → `3f10bcc` → `2407253` → `6dcf6b2` → `daaa860`

The following remained intact:

- Next.js App Router, React Server Components, Tailwind v4, and the existing shadcn/Base UI foundation.
- Dedicated public room catalog projection, without physical-room or operational data.
- URL-backed, single-source booking mode and interval availability ownership.
- Deterministic property selection, server-issued quote, server-side HOLD authority, and payment settlement boundary.
- Customer session/account flows and ADMIN RBAC with the existing shadcn Sidebar and mobile Sheet navigation.

No Codex commit was rewritten, no Shadcn reinitialization occurred, and no dependencies were added.

## Defects found during takeover

- Customer public pages mixed a blue-gray legacy visual system with newer hospitality presentation.
- The landing booking widget retained a desktop grid at 390px, creating `462px` document width and horizontal overflow.
- Catalog/detail and quote/HOLD/customer state surfaces used generic cards and inconsistent hierarchy.
- Landing plan labels initially bypassed the critical i18n boundary.
- The landing catalog fallback used a forbidden non-null assertion.

## Cursor commit chain

- `8e4e9509f946c0314479ad0373e35501394a6ed4` `feat(web): rebuild hospitality booking journey`
- `09347b6030f425e0b9a146b201cf9ced8d3c5703` `fix(web): localize landing plan labels`
- `c81a44689aff43430255cc811ff09294efd1be75` `fix(web): avoid landing catalog assertion`

## Files changed by Cursor

- `apps/web/src/app/globals.css`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/rooms/[roomTypeId]/page.tsx`
- `apps/web/src/components/availability-search-results.tsx`
- `apps/web/src/components/hold-success-panel.tsx`
- `apps/web/src/components/public-landing.tsx`
- `apps/web/src/components/quote-contact-form.tsx`
- `apps/web/src/components/quote-summary.tsx`
- `apps/web/src/components/stay-time-recommendations.tsx`
- `apps/web/src/lib/i18n/messages.ts`
- `apps/web/test/public-homepage.test.tsx`

## Visual system and components

Reused official local shadcn components: `Tabs`, `ToggleGroup`, `Field`, `Input`, `Button`, `Card`, `Badge`, `Alert`, `Empty`, `Skeleton`, `DropdownMenu`, `Avatar`, `Sheet`, and `Sidebar`. No component was added.

The public system now uses a warm off-white surface, restrained deep-green action color, editorial serif headings, simple rule-based grouping, compact segmented mode tabs, local room imagery, and responsive containment. ADMIN remains an operational workspace with its Sidebar and dense table behavior.

Landing is completed with public headbar, editorial hero, compact availability widget, trust strip, catalog-backed rooms, hourly/overnight explanation, rate-plan introduction, story, contact, and footer. Catalog and room detail remain sourced from the public API. Search results, quote, recommendation, contact, HOLD success, and customer account now share the same customer-facing visual hierarchy without moving their authority boundaries.

## Responsive evidence

Landing document-width inspection passed at:

- `360×800`
- `390×844`
- `768×1024`
- `1024×768`
- `1280×720`
- `1366×768`
- `1440×900`
- `1920×1080`

At every inspected viewport, `document.documentElement.scrollWidth` and `document.body.scrollWidth` exactly matched `window.innerWidth`.

Captured Cursor evidence:

- `output/playwright/cursor-ui-takeover/landing-1440-final.png`
- `output/playwright/cursor-ui-takeover/landing-390-final.png`
- `output/playwright/cursor-ui-takeover/landing-390-no-overflow.png`
- `output/playwright/cursor-ui-takeover/rooms-1440-after.png`
- `output/playwright/cursor-ui-takeover/rooms-390-after.png`
- `output/playwright/cursor-ui-takeover/search-1440-no-query.png`
- `output/playwright/cursor-ui-takeover/search-390-no-query.png`
- `output/playwright/cursor-ui-takeover/quote-error-1440.png`
- `output/playwright/cursor-ui-takeover/quote-error-390.png`
- `output/playwright/cursor-ui-takeover/account-bookings-390.png`
- `output/playwright/cursor-ui-takeover/admin-rooms-390.png`

Existing integrated UAT evidence remains under `output/playwright/phase-8i/`, including catalog, customer, and ADMIN desktop/mobile captures.

## Validation ledger

- `pnpm check:providers`: PASS. MoMo sandbox remains blocked by missing merchant credentials; public HTTPS callbacks remain an external deployment blocker; SMTP live acceptance is not configured.
- `pnpm check:features`: PASS.
- `pnpm check:google-oauth`: PASS for local configuration; live acceptance intentionally not run.
- `pnpm check:i18n-critical`: PASS, 108 critical files scanned, `DIRECT_VI_COPY_CRITICAL_SOURCE=0`.
- `pnpm check:endpoints`: PASS, 79 runtime / 75 documented / 4 allowlisted.
- `pnpm check:openapi`: PASS.
- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm test:unit`: PASS. API: 56 files / 308 tests. Web: 38 files / 144 tests. Existing contracts and database packages also passed through Turbo.
- `pnpm build`: PASS.
- `pnpm db:check`, `pnpm db:status`, `pnpm db:test`: PASS. Database: 22 files / 165 integration tests.
- `pnpm demo:preflight`: PASS.
- `pnpm demo:lifecycle-test`: PASS, 15/15 including smoke 22/22, owned-process cleanup, port release, and disposable database removal.
- `pnpm audit --prod --audit-level=high`: PASS. One low and two moderate dependency findings remain; no high findings.
- Playwright run 1: PASS, 73/73 main scenarios and 1/1 unavailable-API safety scenario.
- Playwright run 2: PASS, 73/73 main scenarios and 1/1 unavailable-API safety scenario.

## Intentional deviations and blockers

No new UI primitives, global state library, CMS, browser-side pricing, browser-side availability calculation, browser-side combo eligibility, or browser-side payment settlement was introduced.

The visual result is a deliberate hospitality presentation, not a literal copy of the supplied reference imagery. Existing public image assets and configured public content are used. External production readiness remains NO pending deployed HTTPS callback approval, MoMo merchant credentials, and live SMTP acceptance.

## Rollback boundary

To roll back only Cursor UI work, revert the three Cursor commits listed above. The Codex catalog, booking flow, Shadcn, API, contract, and database deliveries remain before that boundary.
