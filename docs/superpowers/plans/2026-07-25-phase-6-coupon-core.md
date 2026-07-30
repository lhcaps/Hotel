# Phase 6C: Authoritative Coupon Core — Execution Plan

**Date:** 2026-07-25  
**Design:** [Phase 6C design](../specs/2026-07-25-phase-6-coupon-core-design.md)  
**Starting HEAD:** `fa6726283da3772f117b63c4c8380ee2cda3ba3f`

## Success criteria

Phase 6C is complete only when quote evaluation is provisional and creates no application, HOLD revalidates/reserves under a coupon-row lock, two independent PostgreSQL connections prove quota races, keyed normalized-email digest enforces customer limits independently of IP, expiry releases atomically, redemption is internal/idempotent, ADMIN APIs and public UI/contracts are safe, old migrations remain unchanged, and Phase 6B remains green.

## Task 1 — Lock design and plan

Files:

- `docs/superpowers/specs/2026-07-25-phase-6-coupon-core-design.md`
- `docs/superpowers/plans/2026-07-25-phase-6-coupon-core.md`

Verification:

- no unresolved schema, lifecycle, locking, quote, or API decision;
- no payment behavior;
- review Markdown and `git diff --check`.

Commit: `docs: lock phase 6 coupon core design`

## Task 2 — Forward-only database schema

Files:

- `packages/database/src/schema.ts`
- `packages/database/src/schema-status.ts`
- generated `packages/database/drizzle/0007_*.sql` and metadata;
- custom `packages/database/drizzle/0008_phase6_coupon_invariants.sql` and metadata/journal;
- focused Phase 6 migration and constraint integration tests.

RED:

- fresh/upgrade migration expects coupon tables, quote references, indexes, checks, triggers, and schema version;
- constraint tests cover code uniqueness, economic shape, validity/limits, scope consistency, application lifecycle/money/digest, event-key uniqueness, and immutability.

GREEN:

- add schema and generated migration;
- add custom triggers and schema-version migration;
- run guarded disposable PostgreSQL tests.

Regression:

- database lint/typecheck/unit/build;
- `db:check`, `db:test`;
- byte identity for `0000..0006`.

Commit: `feat(database): add coupon definitions and booking applications`

## Task 3 — Pure coupon primitives

Files:

- `packages/booking/src/coupon/coupon-code.ts`
- `packages/booking/src/coupon/coupon-types.ts`
- `packages/booking/src/coupon/coupon-errors.ts`
- `packages/booking/src/coupon/coupon-calculator.ts`
- focused tests and package export.

RED covers all 18 required pure cases: fixed boundaries, percentage floor/cap/gross clamp, minimum boundary, basis-point boundaries, invalid values, bigint multiplication, VND-only, normalization/confusable rejection, stacking, and determinism.

GREEN uses explicit ASCII normalization and bigint arithmetic, with no time/database dependency.

Regression: booking lint/typecheck/unit/build.

Commit: `feat(coupon): add deterministic coupon pricing primitives`

## Task 4 — Transactional booking lifecycle

Files:

- coupon application repository/domain functions;
- `create-booking-hold.ts` and repository seams;
- targeted stale cleanup;
- worker expiration job;
- booking fixtures/unit/integration/concurrency tests.

RED first:

- coupon-disabled/expired/scope/minimum/hold-window/drift failures;
- both-null limits create ASSOCIATED; either limit creates RESERVED;
- same quote equivalent/different contact idempotency;
- allocation/outbox/audit rollback;
- expiration release/idempotency/two-worker behavior;
- internal redemption once/same-event/different-event/released/missing cases;
- total quota=1 and customer quota races using two independent one-connection Pools;
- different coupons and unlimited coupons avoid global blocking.

GREEN transaction lock order is database time → quote → existing booking check → coupon → targeted stale cleanup → room → writes. Counts include only RESERVED/REDEEMED. Redis is not involved.

Regression: booking and worker lint/typecheck/test/build.

Commit: `feat(booking): reserve and release coupons transactionally`

## Task 5 — Quote and ADMIN APIs, contracts, OpenAPI

Files:

- coupon contracts and exports;
- quote request/response/repository/service/controller tests;
- ADMIN coupon controller/service/repository/module wiring;
- booking HOLD/detail safe response extensions;
- errors documentation;
- authoritative OpenAPI generation source/scripts and generated artifacts;
- contract/API unit/integration tests.

RED first:

- strict schemas reject client authority fields;
- quote code validation/calculation and repeated quote no-reservation proof;
- ADMIN create/list/detail/disable/RBAC/audit;
- public response excludes digest/internal UUID/quota;
- unique operation IDs, route security, reproducibility.

GREEN preserves gross `quotes.total_amount_vnd`, stores nullable immutable coupon snapshot/reference, exposes safe computed totals, and does not add a redemption route.

Regression: contracts and API lint/typecheck/test/build; OpenAPI checks.

Commit: `feat(api): expose coupon-aware quote and admin endpoints`

## Task 6 — Public coupon web flow

Files:

- quote search/request state and API client;
- quote/coupon entry, summary, HOLD success/detail components;
- focused component tests and Playwright scenario.

RED first:

- optional accessible coupon input;
- browser request contains only `couponCode`;
- loading, invalid, clear, and requote states;
- gross/discount/final and provisional note;
- HOLD requote-required recovery;
- no URL/Web Storage/digest/internal ID.

GREEN performs coupon changes by issuing a new immutable quote and displays only server response values.

Regression: web lint/typecheck/unit/build and desktop/mobile focused E2E.

Commit: `feat(web): add coupon-aware quote and hold flow`

## Task 7 — Final validation and report

Run focused tests first, then:

- contracts lint/typecheck/test/build;
- database lint/typecheck/test/build, `db:check`, `db:test`;
- booking lint/typecheck/test/build;
- worker lint/typecheck/test/build;
- API lint/typecheck/unit/integration/build;
- web lint/typecheck/unit/build;
- OpenAPI generation/check;
- focused coupon desktop/mobile vertical E2E;
- full `scripts/run-playwright.mjs` with Playwright-owned continuous worker;
- root lint/typecheck/test/build;
- `pnpm audit --prod --audit-level=high`;
- targeted Prettier and `git diff --check`;
- TODO/skip, secret/PII/log, raw coupon code, authority-field, route, and port scans;
- migration `0000..0006` identity;
- process ownership/cleanup after E2E.

Produce a final report with verdict, commit chain, schema/model/calculation/lifecycle evidence, two-connection race proof, quote-zero-application proof, package/E2E/security results, deferred scope, and newest-first `git revert` rollback commands. Stop before payment work. Do not push, open a PR, deploy, delete Docker volumes, or touch persistent/production data.
