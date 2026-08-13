# PeaceNest Customer Experience V2 implementation plan

> **For agentic workers:** Required sub-skill: use `superpowers:executing-plans` task-by-task. Each task is a red-green-refactor slice and must be independently reviewed before advancing.

**Goal:** Deliver the approved PeaceNest Customer V2 vertical with real data, real client media, one server-authoritative interval booking model, secure lifecycle notification/access behavior, and no production deployment.

**Architecture:** Preserve the existing Operations V3 pricing composer, one-room continuous HOLD, signed settlement, BookingAccessPass, and Admin design system. Replace Customer mode coupling with a server flexible-stay boundary; make the public catalog own room facts; make a code-keyed manifest own only local media; then compose Customer routes from shared shadcn-based feature components.

**Tech Stack:** Next.js 16 App Router/RSC, React 19, TypeScript, Base UI shadcn source components, Tailwind v4, NestJS/Fastify, Drizzle/PostgreSQL, Vitest, Playwright, Mailpit.

## Global constraints

- Work in `D:\Study\Project\Room Management` on `main` only. Never create a branch/worktree, stash, reset, clean, rebase, amend, clone, force-push, or broad-stage.
- Preserve all pre-existing untracked artifacts. Stage only exact files created or changed for this plan.
- No production deployment, manual production DDL, real payment test, generated room/property images, invented logo, fake data, or Customer-visible `Room Management` text.
- Customer uses one interval form with check-in, check-out, adults, and children. The frontend has no pricing-mode control or calculation.
- Treat `room_types.code` as the media key, `room_types`/catalog as business authority, and physical-room data as server-only allocation authority.
- Every code behavior begins with a failing focused test, then the smallest passing change. Record actual test output before claiming a task is complete.
- Browser verification uses the Browser integration first. Retain a mismatch ledger against the supplied contact sheet and test 390x844, 430x932, 768x1024, 1024, 1440, and 1920 widths.
- Stop before production. Push only after full local gates, code review, and explicit final integration verification.

## File map

| Responsibility           | Primary files                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public identity contract | `packages/contracts/src/public-room-catalog.ts`, `apps/api/src/public-catalog/public-room-catalog.service.ts`, controller/integration tests                    |
| Client media             | `apps/web/src/content/peace-home-physical-rooms.ts` replacement, `apps/web/src/lib/public-room-catalog.ts`, components and web unit tests                      |
| Flexible stay            | `apps/api/src/pricing/availability.service.ts`, `quote.service.ts`, `multi-night-offer.service.ts`, `pricing-policy/pricing-policy.composer.ts`, pricing tests |
| Customer shell/routes    | `apps/web/src/app/**`, `apps/web/src/components/public-*.tsx`, availability, quote, account components, `globals.css`                                          |
| Email/outbox             | `packages/booking/src/payment/payment-service.ts`, `packages/database/src/schema.ts`, worker templates and `process-outbox.ts`                                 |
| Access/T-30              | database migration/schema, API access config/service/controller, worker access job, booking-detail APIs, Admin property/room pages                             |

### Task 1: Preserve and complete the audit baseline

**Files:**

- Keep: `docs/customer-v2/CUSTOMER_ROUTE_MATRIX.md` (pre-existing untracked artifact, do not overwrite)
- Create/update: `docs/customer-v2/CUSTOMER_DATA_PROVENANCE_MATRIX.md`, `CUSTOMER_INTERACTION_LEDGER.md`, `CUSTOMER_STYLE_CONTRACT.md`, `docs/superpowers/specs/2026-08-13-peacenest-customer-v2-design.md`

**Produces:** immutable design/audit inputs for every subsequent task.

- [ ] Verify `HEAD` equals `origin/main` after fetch and record the SHA.
- [ ] Re-render `/` before product edits, save a desktop screenshot outside the repository, and record page title, visible labels, catalog state, console errors, and disabled controls.
- [ ] Ensure the provenance matrix covers every business field listed in the master brief and marks absent authority as `UNMODELED`, not a synthetic fallback.
- [ ] Keep a one-row-per-control interaction ledger that distinguishes source audit from browser proof.
- [ ] Preserve the contact-sheet-derived visual contract; do not produce a replacement design.

### Task 2: Make stable room type code the public media identity

**Files:**

- Modify: `packages/contracts/src/public-room-catalog.ts`
- Modify: `apps/api/src/public-catalog/public-room-catalog.service.ts`
- Modify: `apps/web/src/lib/public-room-catalog.ts`
- Replace: `apps/web/src/content/peace-home-physical-rooms.ts` with a media-only, code-keyed manifest
- Modify: `apps/web/src/components/public-landing.tsx`, `availability-search-results.tsx`, `apps/web/src/app/rooms/page.tsx`, `apps/web/src/app/rooms/[roomTypeId]/page.tsx`
- Test: public catalog API/integration tests; `apps/web/src/content/*media*.test.ts`; `apps/web/src/lib/public-room-catalog.test.ts`

**Interfaces:**

- `PublicRoomType` gains `roomTypeCode: string` from `room_types.code`.
- Media input is `{ roomTypeCode: string; publicSlug: string; gallery: readonly string[] }` only.
- `mediaForRoomTypeCode(code)` returns only this room gallery or a neutral missing-media result, never a different room gallery.

- [ ] Write a failing contract test that public room catalog entries contain the database room type code.
- [ ] Write failing media tests for all nine active codes, file existence, exact Rose/Nami/Wabi identity, unknown-code neutral state, and absence of UUID-hash mapping.
- [ ] Implement the contract mapping in the public catalog service and parse it in web data loaders.
- [ ] Implement the manifest keyed only by normalized exact `roomTypeCode`; remove hard-coded names, tiers, prices, capacity, fuzzy name match, index match, and UUID hash matching.
- [ ] Make landing, catalog, detail, exact availability, and nearby availability consume the same media resolver.
- [ ] Run focused contract, media, and web tests; then `pnpm check:peace-home-media`.

### Task 3: Make public availability and quote mode-free at the Customer boundary

**Files:**

- Modify: `packages/contracts/src/pricing.ts`
- Create: `apps/api/src/pricing/flexible-stay-resolver.service.ts` and focused tests
- Modify: `apps/api/src/pricing/availability.service.ts`, `quote.service.ts`, `multi-night-offer.service.ts`, `stay-policy.ts`
- Modify: public pricing controllers/OpenAPI tests
- Test: `apps/api/test/pricing-engine.test.ts`, focused availability/quote integration tests, B0 regression tests

**Interfaces:**

- New Customer request accepts `{ propertyId?, checkIn, checkOut, adults, children }`; legacy `mode` remains optional compatibility input.
- Resolver returns one selected, immutable representation or a structured public-safe failure, never an internal graph.
- Resolver preserves current valid composer tie-break sequence: lowest valid complete total, fewer components, lower condition complexity, lower restriction rank, stable candidate identity.

- [ ] Write failing API tests for same-day, overnight, multi-night, leading/trailing extensions, 15-minute boundaries, cross-month/year, leap-day, and every request omitting `mode`.
- [ ] Write failing invariant tests proving selected candidate begins at check-in, ends at check-out, has no gaps/overlap, and does not silently charge unpriced time.
- [ ] Extract the resolver behind availability and quote services. It must enumerate only representations supported by current policy and retain the existing multi-night composer rather than recreate policy rules in the browser.
- [ ] Preserve legacy `mode` parsing only as a compatibility preference where safe; no new Customer request or UI route requires it.
- [ ] Map resolver failures to customer-safe codes and Vietnamese copy. Do not expose `409`, `POLICY_NOT_CONFIGURED`, plan codes, or component labels.
- [ ] Persist the selected resolver snapshot with the quote/HOLD and prove later policy changes cannot rewrite a booking amount.
- [ ] Run `pnpm test:pricing`, `pnpm test:availability`, `pnpm test:quotes`, and the new focused test files.

### Task 4: Prove full-interval availability and one physical room allocation

**Files:**

- Modify: `apps/api/src/pricing/availability.repository.ts`, relevant service/repository tests
- Modify: quote/HOLD allocation service only where the resolver contract requires it
- Test: availability integration, quote integration, continuous-stay and concurrency tests

**Interfaces:** availability receives the exact same half-open `[checkIn, checkOut)` interval the resolver prices; HOLD returns one allocated physical room privately.

- [ ] Write failing tests for a room unavailable or under maintenance only in the middle of an interval, touching intervals, concurrent HOLDs, and multi-night no-stitching.
- [ ] Verify every availability query overlaps `[checkIn, checkOut)` and does not derive a per-night or mode-specific allocation interval.
- [ ] Preserve physical room IDs/numbers as server-only and confirm public responses expose only room type/concept data.
- [ ] Run the focused DB-backed suites with local PostgreSQL, then `pnpm test:availability` and `pnpm test:quotes`.

### Task 5: Establish Customer V2 component primitives and visible branding

**Files:**

- Modify: `apps/web/src/app/layout.tsx`, `globals.css`, metadata/manifest/error/not-found surfaces
- Create: Customer feature components under `apps/web/src/components/customer/`
- Add only required shadcn source components after reviewing dry-run/diff: calendar, carousel, drawer, input-group, input-otp, progress, collapsible
- Test: Customer header/metadata/component tests

**Interfaces:** `CustomerShell`, `CustomerHeader`, `CustomerMobileNav`, `CustomerLoading`, `CustomerEmpty`, and `CustomerError` are Customer-only compositions. They do not import Admin shell/data-table/filter components.

- [ ] Write failing title/header/footer tests that reject visible `Room Management` and expect `PeaceNest`.
- [ ] Apply the approved style contract as scoped tokens and Customer component classes, retaining the existing actual logo only if valid; otherwise render the text wordmark `PeaceNest`.
- [ ] Add the missing shadcn primitives only after their dry-run/diff has been reviewed. Preserve local custom button/input/textarea code where upstream changes are formatting-only.
- [ ] Implement minimal header/navigation behavior, including a titled accessible mobile Sheet/Drawer and real session-aware account action.
- [ ] Run web unit, lint, typecheck, and a Browser desktop/mobile header smoke.

### Task 6: Build the one unified interval form and race-safe search state

**Files:**

- Modify/replace: `apps/web/src/lib/booking-search-state.ts`, `availability-search-form.tsx`, `landing-availability-search.tsx`
- Create: `apps/web/src/components/customer/unified-booking-form.tsx`, date-time and guest picker compositions
- Test: `booking-search-state.test.ts`, form component tests, public search Playwright spec

**Interfaces:** the URL contains only `checkInAt`, `checkOutAt`, `adults`, `children`, and an optional room filter. A request generation or `AbortController` ensures only the latest result can commit state.

- [ ] Write failing form tests showing no visible mode/package controls, valid 15-minute selection, invalid interval feedback, and serialized mode-free query state.
- [ ] Write a failing stale-response test: resolve request B before request A and assert A cannot overwrite B.
- [ ] Compose date/time and guest controls from Field, Popover, Calendar, ScrollArea/Command or Select as appropriate, with labels/errors/focus and touch target coverage.
- [ ] Replace landing/search duplicate forms with this one feature and preserve direct `/booking/search` URLs.
- [ ] Use geometry-matching Skeleton states and disable duplicate submission only while the current request is pending.
- [ ] Run web unit tests plus the focused browser search flow at desktop and 390px.

### Task 7: Build real catalog rails and room detail from the shared public identity

**Files:**

- Modify: `public-landing.tsx`, `availability-search-results.tsx`, `/rooms/page.tsx`, `/rooms/[roomTypeId]/page.tsx`, `room-detail-quote-action.tsx`
- Create: `customer/public-room-card.tsx`, `room-rail.tsx`, `room-gallery.tsx`, `booking-summary.tsx`
- Test: component tests, catalog API cross-check, Playwright room navigation/media test

**Interfaces:** `PublicRoomCard` consumes catalog/availability facts and a resolved media record; it never receives a physical-room object or frontend-computed price.

- [ ] Write failing tests that assert each visible card’s room name, tier, capacity, amenities, availability, exact offer, and image code equals the source response.
- [ ] Group real availability results by API tier, not a static frontend tier list.
- [ ] Implement Embla-backed shadcn Carousel rails with overflow-aware arrows, swipe, keyboard behavior, and mobile continuation width.
- [ ] Implement gallery-first detail with preserved date/time/guest context, server total, Back preservation, and sticky mobile CTA only when a valid quote action exists.
- [ ] Replace raw `img` use with correctly sized `next/image` where compatible with the current data path; retain honest missing-media behavior.
- [ ] Run focused media/catalog tests and browser cross-check every displayed search result.

### Task 8: Standardize quote, checkout, payment, confirmation, login, and account surfaces

**Files:**

- Modify: quote/contact/view components, payment status/selector, customer login, account routes and clients
- Create: `customer/booking-steps.tsx`, `customer/customer-account-shell.tsx`, `customer/customer-booking-status.tsx`
- Test: quote, payment status, login presentation, account booking/profile/settings tests and public E2E

**Interfaces:** quote shows server room, interval, guests, real coupon outcome, and total; provider return only presents state and settlement APIs remain authoritative.

- [ ] Write failing presentation tests for the five Customer steps, no internal pricing vocabulary, no payment-success inference from browser redirect, and no unsupported auth option.
- [ ] Use Field composition for contact/profile forms, AlertDialog for cancellation confirmation, Sonner/Alert for async feedback, and honest empty/error states.
- [ ] Render only audited login capabilities. Do not add registration unless a full secure Customer-only implementation and governing authorization are established first.
- [ ] Restyle account list/detail/profile/settings as Customer-native surfaces and preserve existing protected API boundaries.
- [ ] Run customer web unit and target E2E routes with payment-demo fixtures only.

### Task 9: Make confirmation notifications semantically idempotent

**Files:**

- Modify: `packages/database/src/schema.ts` and generated Drizzle migration
- Modify: `packages/booking/src/payment/payment-service.ts`
- Modify: worker outbox claim/finalize/process tests and booking confirmation template
- Test: payment settlement race and worker outbox tests

**Interfaces:** durable notification identity includes `booking-confirmed:<bookingId>:v1`; one confirmed booking has one logical confirmation event despite repeated/concurrent verified callbacks.

- [ ] Write failing tests for HOLD producing zero normal reservation-summary emails, verified settlement producing one confirmation, repeated callback producing one, and concurrent callback producing one.
- [ ] Locate all two `booking.confirmed` insertion paths and add an explicit database-enforced semantic dedupe key rather than relying on SMTP message IDs or best-effort worker state.
- [ ] Update the Vietnamese-first confirmation template to use current booking/property/room/interval/guests/paid amount and the T-30 expectation without claiming delivery before the outbox succeeds.
- [ ] Keep external SMTP retry semantics honest: effective-once customer behavior, not unprovable exactly-once SMTP delivery.
- [ ] Run payment, worker, and Mailpit-focused test suites.

### Task 10: Add secure property and physical-room arrival configuration

**Files:**

- Modify: `packages/database/src/schema.ts`, migration metadata, configuration/env schema
- Create: narrow API repository/service/controller DTOs for property and room access configuration
- Modify: Admin property and physical-room route components only
- Test: API authorization, encryption, omitted/clear semantics, audit safety tests

**Interfaces:** normal Admin reads return `configured: boolean` for each secret. Updates distinguish omitted=`KEEP`, explicit action=`CLEAR`, and supplied value=`REPLACE`. Property owns gate/Wi-Fi/support/default instructions; room owns room pass/location/overrides.

- [ ] Write failing tests that plaintext access secrets cannot appear in normal GET, outbox payload, audit payload, logs, URL, migration default, or provider reference.
- [ ] Implement the smallest authenticated encryption boundary compatible with current environment config. Validate its key presence through existing release env schema without printing the key.
- [ ] Add least-privilege permission checks and audit events containing only actor, target, timestamp, and field category.
- [ ] Extend `/admin/property` and `/admin/rooms/[id]` with existing Admin primitives and real pending/error/masked-state behavior. Do not redesign unrelated Admin surfaces.
- [ ] Run migration, API authorization, schema, and Admin component checks.

### Task 11: Deliver T-30 customer access by reusing the signed QR model

**Files:**

- Modify: `apps/worker/src/jobs/issue-access-credentials.ts`, access email template, outbox processor
- Modify: booking detail service/controller/repository/contracts and Customer/guest booking detail UI
- Test: worker timing, access email, QR verification/revocation, booking-detail authorization, scanner regression

**Interfaces:** `checkin-ready:<bookingId>:<checkInAt>:v1` is the T-30 semantic identity. The booking-detail response returns a no-secret pre-T-30 state or an authorized, no-store access package after eligibility.

- [ ] Write failing tests for T-31 zero send, exact/inside T-30 one send, repeat sweep zero duplicates, cancellation/maintenance/not-clean/config-incomplete behavior, QR tamper/expiry/revoke rejection, and no provider reference leak.
- [ ] Keep PostgreSQL current time as the worker authority and retain the existing confirmed/active/clean/no-overlap gates.
- [ ] Resolve encrypted configuration only at delivery/authorized response time; generate a mail-safe QR representation from the existing signed pass without embedding secrets or PII in its payload.
- [ ] Implement Vietnamese-first responsive T-30 email plus a plain-text fallback and Customer panel, withholding the package until the allowed window.
- [ ] Re-run scanner check-in, checkout, access revocation, and housekeeping regression suites.

### Task 12: Complete browser, accessibility, performance, review, and release evidence

**Files:**

- Modify/add: focused Playwright specs and required docs/customer-v2 visual mismatch ledger
- Update: route/interaction/provenance matrices only with fresh evidence

- [ ] Exercise the golden journey through real UI/API state: landing, room browsing, mode-free interval search, room detail/context preservation, quote, HOLD, demo settlement callback, confirmation, account/guest detail, T-31, T-30, scanner, check-in, checkout.
- [ ] Click every ledger control and record actual state transition; verify desktop, phone, tablet, and wide desktop layouts with no horizontal accident, focus loss, or relevant console/page error.
- [ ] Capture all required reference comparison screenshots and email previews; eliminate fixable meaningful mismatches, fake controls, raw controls, fake data, room-image mismatches, and AI-slop findings.
- [ ] Run exact current CI-equivalent gates from `.github/workflows/ci.yml`: format, lint, typecheck, unit, catalog, auth, pricing, availability, quote, OpenAPI, DB checks/tests, dependency audit, build, release integrity, Storybook, web unit, and full E2E.
- [ ] Request independent code review. Fix every valid Critical or Important finding, rerun affected tests, then perform a final requirement-by-requirement verification.
- [ ] Stage exact changed paths, commit on `main`, push, verify `HEAD == origin/main`, wait for the exact-SHA hosted CI result, and stop without a production deployment.
