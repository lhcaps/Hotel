# Phase 8B.1 Plan — Pricing Product Vertical, Admin Catalog Extensibility, Browser E2E and Release-Evidence Closure

Date: 2026-07-28
Status: EXECUTED

## Phases

1. **Phase 8B.1.A — Gate 0: Repository Truth**
   - Confirm git branch and clean worktree.
   - Verify ports 3100/3101 and reserved 3001 are free.
   - Confirm working tree state.
   - **Verify**: `git status --short` shows only the intended artifact set.

2. **Phase 8B.1.B — Mandatory Reading**
   - Re-read ADR-0010, Phase 8A audit, Phase 8B validation report and
     Phase 8B handoff documentation before making any code change.
   - **Verify**: memory snapshot recorded.

3. **Phase 8B.1.C — Gate A: Documentation and Evidence Reconciliation**
   - Correct `ADR-0010` `Supersedes` and activation validation wording.
   - Update `docs/domain/pricing-rules.md` for Phase 8B.1.
   - Fix `ruleSetValidationFromCatalog` semantics so it returns
     `IS_VALID` only when every rule satisfies both
     selection constraints **and** the rule set is internally
     consistent.
   - Update Phase 8B validation report and verdict report to
     reflect `FULL_REGRESSION=PASS_SCOPED_TO_PHASE_8B_DELTA`.
   - **Verify**: ADR text, pricing-rules text, and verdict report
     text agree on Phase 8B.1 supersession; rule-set validation tests
     pass.

4. **Phase 8B.1.D — Gate B: Authoritative Pricing Call Graph**
   - Trace every production code path that selects a rate plan.
   - Document the trace in
     `docs/audit/api-source-map-pricing-availability-booking-customer.md`.
   - **Verify**: every entry point routes through
     `quoteService.priceQuote` or the recommendation engine's
     `priceQuote` (which delegates to `cheapest-eligible-pricing`).

5. **Phase 8B.1.E — Rate Plan Catalog Extensibility**
   - Replace hardcoded `RatePlanCode` enums with generic `string`.
   - Add regex validation in contracts and database CHECK.
   - Migration `0016_workable_captain_cross.sql` introduces
     `rate_plans_code_format_ck`.
   - Seed `SIX_HOUR_FLEX` and `FOUR_HOUR_FLEX` rate plans.
   - **Verify**: integration tests prove SIX_HOUR_FLEX is the
     cheapest when FIVE_HOUR_COMBO is priced higher.

6. **Phase 8B.1.F — Recommendation Wiring**
   - Refactor recommendation controller to use a new functional
     `recommendationStayTimes` handler in `recommendation.routes.ts`.
   - Wire `QuoteRepository` and `RecommendationRepository` so the
     panel:
     - Builds the catalog from PostgreSQL.
     - Probes real availability (no reservation).
     - Previews the coupon without committing it.
   - **Verify**: integration tests pass; demo smoke verifies rule
     version agreement.

7. **Phase 8B.1.G — Public Web UI**
   - Add `apps/web/src/components/stay-time-recommendations.tsx`.
   - Mount the panel inside the existing
     `apps/web/src/components/quote-view.tsx` so users land on
     `/booking/quote/[quoteId]` and see recommendations without
     learning a new URL.
   - "Chọn khung giờ này" reissues a quote (same endpoint as the
     primary path) and navigates to the new quote page.
   - **Verify**: web unit tests pass; browser e2e vertical passes;
     prettier check on touched files passes.

8. **Phase 8B.1.H — Evidence**
   - **Verify**: full regression (lint, typecheck, unit, build, OpenAPI,
     database check, dependency audit) all green; cheat sheet under
     `docs/audit/phase-8b1/`.

## Success criteria

- `pnpm lint` succeeds across all 11 packages.
- `pnpm typecheck` succeeds across all 11 packages.
- `pnpm test:unit` succeeds for every package (1031+ tests pass).
- `pnpm build` succeeds across all 11 packages.
- `pnpm check:openapi` succeeds (admin + public artifacts, 11/11 coupon
  schema cases).
- `pnpm db:check` succeeds.
- `pnpm audit --prod --audit-level=high` reports zero high or critical
  vulnerabilities.
- `node scripts/demo/lifecycle.test.mjs` reports 16/16 passes.
- `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts` is
  7/7 green.

## Risks

- A historical quote issued under `PRIORITY_WINS_LEGACY` continues to
  parse but no new quote uses it. We document this in
  `pricing-rules.md` so consumers know.
- A legacy runtime DB that lacks migration 0016 cannot load the new
  cheapest selector. Migrations are additive and the runtime is pinned
  through `EXPECTED_SCHEMA_VERSION`.
