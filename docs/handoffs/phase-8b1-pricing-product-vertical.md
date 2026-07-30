# Phase 8B.1 Handoff

Audience: Project lead, ops, on-call.

## What landed

- Dynamic rate-plan code support (regex-validated).
- New SQL migration `0016_workable_captain_cross.sql` enforcing the regex
  CHECK on `rate_plans.code`.
- `SIX_HOUR_FLEX` and `FOUR_HOUR_FLEX` rate plans in the development seed.
- Cheapest-eligible pricing selector now chooses `SIX_HOUR_FLEX` over
  `FIVE_HOUR_COMBO` when `FIVE_HOUR_COMBO` is priced higher.
- Recommendation engine wired into the existing public Web booking flow.
- Recommendation panel mounted on `/booking/quote/[quoteId]`.
- Updated `apps/web/src/components/quote-view.tsx` to issue a new quote
  via `/api/v1/quotes` when the visitor chooses a candidate.

## What did not change

- Phase 8A booking/payment contracts are untouched.
- Phase 7G ADMIN booking operations are untouched.
- Payment provider adapters are untouched.
- Released migrations are untouched.

## How operators verify

1. `pnpm demo:preflight` reports
   `schema: phase-8b1-pricing-product-vertical-v1`.
2. `pnpm demo:smoke` walks public and ADMIN flows and asserts that
   `/recommendations/stay-times` matches `/quotes` on
   `pricing.ruleVersion`.
3. `pnpm db:check` and `pnpm check:openapi` are clean.

## How on-call reverts

1. Stop the API/worker.
2. Restore the database backup taken before the migration
   `0016_workable_captain_cross.sql` was applied.
3. Revert the commit. Restart the API/worker.
4. The previous selector `phase-7b-data-driven-pricing-v1` will resume.

## What to watch

- `logger.level=error` should not include any PostgreSQL constraint
  violations named `rate_plans_code_format_ck`.
- `/admin/rate-plans` PATCH should accept `SIX_HOUR_FLEX` and
  `FOUR_HOUR_FLEX` codes (no `INVALID_PAYLOAD` problem-details).
- `/recommendations/stay-times` should return 200 for a 1-hour window
  within 11:00–15:00 UTC ±60 minutes.
