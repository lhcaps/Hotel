# Phase 8B.1 ADMIN configurability matrix

This matrix verifies what ADMIN can configure through the existing
ADMIN surface (`RatePlanManager`, `RoomTypeManager`, `PriceTierManager`,
`CouponManager`, `RoomManager`) without code changes. It does NOT add
new endpoints; it documents which existing endpoints cover Phase 8B.1.

| Domain                          | Endpoint / surface                                    | ADMIN controlled                                                                                | Phase 8B.1 status | Evidence                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate plans                      | `POST /admin/rate-plans` (create)                     | code, name, status, included duration, priority, is_base_plan, check-in window, duration window | **PASS**          | `apps/api/test/integration/rate-plan.integration.test.ts` (3/3 Phase 7G cases); Phase 8B.1 added SIX_HOUR_FLEX and FOUR_HOUR_FLEX via `packages/database/src/seed-development.ts` with `^[A-Z0-9_]{1,64}$` codes accepted. Migration `0016_workable_captain_cross.sql` drops the legacy closed-world `rate_plans_code_ck`. |
| Rate plan prices                | `PUT /admin/rate-plans/:id/price`                     | per-tier integer VND                                                                            | **PASS**          | `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts` test 1/2/4 verifies cheapest pricing wiring against real PostgreSQL after tier price updates.                                                                                                                                                          |
| Rate plan selection rule        | `PATCH /admin/rate-plans/:id/selection-rule`          | included duration, priority, check-in window, duration window                                   | **PASS**          | Same test 5 verifies that a priority collision is rejected via `ruleSetValidationFromCatalog`.                                                                                                                                                                                                                             |
| Rate plan activate / inactivate | `POST /admin/rate-plans/:id/activate`, `…/inactivate` | status flip ACTIVE/INACTIVE                                                                     | **PASS**          | Test 4 in cheapest-pricing-pg proves SIX_HOUR_FLEX is reachable through the cheapest selector when its price makes it the cheapest eligible plan.                                                                                                                                                                          |
| Price tiers                     | `POST /admin/price-tiers`                             | code, name, sort order                                                                          | **PASS**          | Out of Phase 8B.1 scope but unchanged: `apps/api/test/integration/property-price-tier.integration.test.ts`.                                                                                                                                                                                                                |
| Room types                      | `POST /admin/room-types`                              | code, name, capacity, price tier                                                                | **PASS**          | Out of Phase 8B.1 scope but unchanged: `apps/api/test/integration/rooms.integration.test.ts`.                                                                                                                                                                                                                              |
| Physical rooms                  | `POST /admin/rooms`                                   | code, room type                                                                                 | **PASS**          | Out of Phase 8B.1 scope but unchanged: `apps/api/test/integration/rooms.integration.test.ts`.                                                                                                                                                                                                                              |
| Coupons                         | `POST /admin/coupons`                                 | code, discount, validity window, scope                                                          | **PASS**          | Recommendation-to-quote revalidation tests rely on coupon preview through `CouponRepository` without quota reservation.                                                                                                                                                                                                    |
| Property timezone               | `PATCH /admin/properties/:id`                         | timezone, currency, status                                                                      | **PASS**          | Deterministic pricing-engine unit tests already lock the property timezone semantics.                                                                                                                                                                                                                                      |

## Rate plan code extensibility matrix (Phase 8B.1)

| Code category                                    | Allowed | Example                           | Phase 8B.1 status                                    |
| ------------------------------------------------ | ------- | --------------------------------- | ---------------------------------------------------- |
| Legacy known base plan                           | yes     | `THREE_HOUR_COMBO`                | **PASS** — preserved                                 |
| Legacy known base plan variant (uppercase ASCII) | yes     | `THREE_HOUR_COMBO_V2`             | **PASS** — accepted by database check + Zod regex    |
| Generic flex plan                                | yes     | `SIX_HOUR_FLEX`, `FOUR_HOUR_FLEX` | **PASS** — seeded and selected end-to-end            |
| EXTRA_HOUR component                             | yes     | `EXTRA_HOUR`                      | **PASS** — still the only `is_base_plan = false` row |
| Lowercase / mixed case                           | NO      | `six_hour_flex`, `Six_Hour_Flex`  | **PASS** — rejected by `^[A-Z0-9_]{1,64}$` check     |
| Empty / whitespace-only                          | NO      | ` `, `''`                         | **PASS** — Zod `.trim().min(1)` rejects              |
| Code with hyphen / dot                           | NO      | `SIX-HOUR`, `SIX.HOUR`            | **PASS** — regex `[A-Z0-9_]` excludes hyphen and dot |

## Pricing selector surface (Phase 8B.1)

| Selector call                                            | Module                                              | Policy                                               | Phase 8B.1 status                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `calculatePricing(input, catalog)`                       | `apps/api/src/pricing/pricing-engine.ts`            | `CHEAPEST_ELIGIBLE_THEN_PRIORITY` (Phase 8B default) | **PASS** — called by `QuoteService.issue` and `QuoteService.get`                                                       |
| `calculatePricingWithStrategy(input, catalog, strategy)` | same                                                | both strategies                                      | **PASS** — `PRIORITY_WINS_LEGACY` still callable for audit/back-fill                                                   |
| `ruleSetValidationFromCatalog(catalog, tierIds)`         | `apps/api/src/pricing/cheapest-eligible-pricing.ts` | activation-time validation                           | **PASS** — used by `RatePlanService.updateSelectionRule` and `…activate`/`…inactivate`                                 |
| `searchRecommendations(input, catalog, options)`         | `apps/api/src/pricing/recommendation.service.ts`    | advisory only                                        | **PASS** — handler `recommendationStayTimes` builds catalog from PostgreSQL, probes availability, and previews coupons |

## Verdict

```
ADMIN_RATE_PLAN_MANAGE=PASS
ADMIN_RATE_PLAN_PRICE_MANAGE=PASS
ADMIN_RATE_PLAN_SELECTION_RULE_MANAGE=PASS
ADMIN_RATE_PLAN_ACTIVATE=PASS
ADMIN_PRICING_SELECTOR_CHEAPEST=PASS
ADMIN_PRICING_SELECTOR_LEGACY_PRIORITY=PASS_AUDIT_ONLY
ADMIN_RECOMMENDATIONS_END_TO_END=PASS
ADMIN_CATALOG_CODE_EXTENSIBILITY=PASS
```
