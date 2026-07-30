# Phase 8B.1 Runbook

Audience: on-call engineers running the demo or supporting live trial.

## Trigger

This runbook is invoked when:

1. The recommendation endpoint `/api/v1/recommendations/stay-times`
   returns 5xx or the integration test
   `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`
   fails.
2. ADMIN reports that newly added rate plan codes (e.g. `SIX_HOUR_FLEX`)
   cannot be saved or quoted against.
3. Public smoke (`pnpm demo:smoke`) reports
   `public.recommendations.shape` or `public.pricing.rule-version`
   failure.

## Step 1 — Confirm the schema version

```bash
node scripts/demo/preflight.mjs | jq .schema
# expected output: "phase-8b1-pricing-product-vertical-v1"
```

If the output does not contain the expected version, stop. The migration
`0016_workable_captain_cross.sql` has not been applied. Apply the
migration with `pnpm db:migrate`.

## Step 2 — Confirm the database constraint

```bash
psql "$TEST_DATABASE_URL" \
  -c "select conname from pg_constraint where conname = 'rate_plans_code_format_ck'"
# expected output:  rate_plans_code_format_ck
```

If the constraint is missing, the migration has regressed. Restore from
backup, then re-apply the migration in a maintenance window.

## Step 3 — Confirm the API health

```bash
curl http://127.0.0.1:3101/api/v1/health/live
curl http://127.0.0.1:3101/api/v1/health/ready
```

Both must return 200. If `/health/ready` fails with a `DATABASE_*`
error, check the database pool and restart the API.

## Step 4 — Confirm the recommendation shape

```bash
curl -X POST -H 'content-type: application/json' \
  http://127.0.0.1:3101/api/v1/recommendations/stay-times \
  -d '{"roomTypeId":"10000000-0000-4000-8000-000000000202","checkIn":"2027-01-10T03:00:00.000Z","checkOut":"2027-01-10T06:00:00.000Z","adults":2,"children":0}'
```

The response must include:

- `exactResult.pricing.ruleVersion == "phase-8b-cheapest-eligible-pricing-v1"`
- `recommendations` ≤ 3 items
- `advisoryExpiresAt` and `generatedAt` ISO strings

## Step 5 — Roll back

1. Stop the API/worker.
2. Restore the database from the pre-migration snapshot.
3. Revert the Phase 8B.1 commits.
4. Restart the API/worker; pre-flight must report the previous schema
   version.

## Step 6 — Communication

Notify the project lead with the runbook step that failed and the captured
output. Do not attempt further remediations without coordinating with the
pricing squad.
