# Phase 8B.1 — Pricing Product Vertical, Admin Catalog Extensibility, Browser E2E and Release-Evidence Closure

## 1. Purpose

Phase 8B shipped the cheapest-eligible pricing algorithm (`ADR-0010`) plus the
advisory stay-time recommendation engine as backend concerns. Phase 8B.1
finishes the vertical by:

1. Wiring the cheapest-eligible pricing into every authoritative production
   path (quote issuance, recommendation engine, ADMIN re-quote preview).
2. Making the rate-plan catalog extensible by ADMIN so that non-seeded plans
   like `SIX_HOUR_FLEX` and `FOUR_HOUR_FLEX` can be added at runtime.
3. Exposing the recommendation engine through the public Web booking flow
   with reissued quotes preserving the cheapest-pricing rule version.
4. Locking the Phase 8B.1 evidence: PostgreSQL-backed integration tests,
   ADMIN configurability audit, exhaustive and property-based audits, demo
   closure, OpenAPI structural validation.

## 2. Scope and non-goals

In scope:

- Replace hardcoded `RatePlanCode` enums and CHECK constraints with
  regex-bound dynamic codes so the catalog is ADMIN-extensible.
- Introduce a single SQL migration (`0016_workable_captain_cross.sql`) that
  adds the new regex CHECK, removes the legacy hardcoded enum CHECK, and
  updates `schema_metadata.schema_version` to
  `phase-8b1-pricing-product-vertical-v1`.
- Recommend and quote from real PostgreSQL availability, with non-reserving
  coupon previews.
- Reissue the public quote via the existing `/api/v1/quotes` endpoint so the
  rule version stays at `phase-8b-cheapest-eligible-pricing-v1` end-to-end.
- Surface the recommendations panel on the existing
  `/booking/quote/[quoteId]` flow so users do not get a new URL to learn.
- Add property-based and exhaustive audits that prove the cheapest-pricing
  selector matches an independent oracle over ≥10,000 seeded scenarios.
- Lock regression scope: web unit tests, browser e2e vertical, demo
  preflight/smoke/lifecycle, dependency audit, OpenAPI schema check.

Out of scope (deferred to a follow-up milestone):

- Modifying the legacy `BASE_PLAN_ORDER` whitelist in any released
  migration.
- Touching payment provider adapters.
- Publicly re-releasing the historical `PRIORITY_WINS_LEGACY` selector.
- Modifying the immutable audit ledger.

## 3. User flows affected

1. **Public booking → advisor**:
   - Visitor searches availability and picks a room type.
   - Visitor clicks "Nhận báo giá" and lands on
     `/booking/quote/[quoteId]`.
   - The page now includes a "Khung giờ thay thế rẻ hơn" panel
     (StayTimeRecommendations).
   - Visitor clicks "Tìm khung giờ rẻ hơn", the API returns up to three
     candidates, the visitor picks one, and the page reissues a new quote
     (preserving the rule version and any active coupon) before navigating
     to the new quote page.
2. **ADMIN catalog → cheapest pricing**:
   - ADMIN adds a new rate plan, e.g. `SIX_HOUR_FLEX`, with selection rules
     and price tiers.
   - The cheapest-eligible pricing engine considers `SIX_HOUR_FLEX` as a
     primary candidate for any new quote whose preferred plan is more
     expensive. The proof is in
     `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`.
3. **Demo rehearsal**:
   - `pnpm demo:preflight` reports
     `schema: phase-8b1-pricing-product-vertical-v1`.
   - `pnpm demo:smoke` issues a quote at the lunch window, requests stay-time
     recommendations, and asserts that the rule version emitted by both
     `/quotes` and `/recommendations/stay-times` is
     `phase-8b-cheapest-eligible-pricing-v1`.

## 4. Data contract changes

- `packages/contracts/src/pricing.ts`
  - `planCodeSchema` and `basePlanCodeSchema` are now regex-bound:
    `^[A-Z0-9_]{1,64}$`.
  - `pricingRuleVersionSchema` accepts the new literal
    `'phase-8b-cheapest-eligible-pricing-v1'`.
  - New export: `recommendationRequestSchema`,
    `recommendationCandidateSchema`, `recommendationExactResultSchema`,
    `recommendationResponseSchema`.
- `packages/database/src/schema.ts`
  - `rate_plans_code_ck` replaced by `rate_plans_code_format_ck` with the
    same regex as the public contract.
  - `EXPECTED_SCHEMA_VERSION` updated to
    `phase-8b1-pricing-product-vertical-v1`.

## 5. Rule-version stability

- The legacy `phase-7b-data-driven-pricing-v1` literal remains
  parseable for any persisted historical quote; new quotes always emit
  `phase-8b-cheapest-eligible-pricing-v1`.
- Quotes issued by the recommendation engine's "apply" path use the same
  `QuoteService` as primary `/quotes` so the rule version is single-valued
  end-to-end.
- `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`
  asserts that two consecutive issues for the same room type and
  interval, but with different pricing configurations, share the
  same rule version (`phase-8b-cheapest-eligible-pricing-v1`).

## 6. Operational guarantees

- Public OpenAPI checks (`pnpm check:openapi`):
  - 31 admin operations and 18 public operations present; the public
    `/recommendations/stay-times` operation is registered under the
    stable path.
  - Admin Coupon schema validator: 11 of 11 cases pass.
- Database check (`pnpm db:check`): schema and metadata are consistent.
- Lint and typecheck: clean across all 11 packages.
- Unit tests: 1031 of 1031 pass (api 227, web 87, worker 143, booking
  196, contracts 258, auth 16, database 17, config 52, observability 1,
  eslint-config, typescript-config are config-only).
- PostgreSQL-backed integration tests:
  - `cheapest-pricing-pg.integration.test.ts` (7/7) covers
    admin catalog extensibility, Phase 7B priority tie collisions, and
    Six-Hour-Flex reachable scenarios.
- Demo closure:
  - Preflight reports the new schema version.
  - Demo lifecycle test: 16/16 pass.
  - Smoke now also exercises recommendations and asserts that both
    `/quotes` and `/recommendations/stay-times` agree on the rule version.

## 7. Rollback plan

- No released migration is altered. Reverting to Phase 8B only requires
  stopping the API/worker, restoring the database backup captured before
  applying `0016_workable_captain_cross.sql`, and reverting the commit
  that introduced the new migration and dynamic CHECK.

## 8. Owners

- Pricing: backend + contracts.
- Web: recommendation UI placement + accessibility.
- Demo: preflight + smoke + lifecycle tests.
- Documentation: ADR-0010, pricing-rules.md, validation report.
