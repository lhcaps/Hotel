ALTER TABLE "rate_plans" DROP CONSTRAINT "rate_plans_duration_ck";--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "is_base_plan" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "min_check_in_minute_inclusive" integer;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "max_check_in_minute_exclusive" integer;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "min_duration_minutes_inclusive" integer;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "max_duration_minutes_inclusive" integer;--> statement-breakpoint
-- Backfill selection metadata for existing Phase 6 rate-plan rows BEFORE
-- the new CHECK constraints are added. The values below mirror the
-- hardcoded thresholds that the Phase 4 pricing engine used. The
-- idempotency is preserved with guarded WHERE predicates so a re-run is
-- safe. Note that an isolated disposable DB that goes straight to Phase
-- 7B without ever holding a Phase 6 row would have nulls here; the
-- constraints below tolerate nulls only for non-base plans, so the
-- development seed carries the right values for the fixed IDs.
UPDATE rate_plans SET is_base_plan = false, min_check_in_minute_inclusive = NULL,
  max_check_in_minute_exclusive = NULL, min_duration_minutes_inclusive = NULL,
  max_duration_minutes_inclusive = NULL
 WHERE code = 'EXTRA_HOUR';--> statement-breakpoint
UPDATE rate_plans SET is_base_plan = true, min_check_in_minute_inclusive = NULL,
  max_check_in_minute_exclusive = NULL, min_duration_minutes_inclusive = 60,
  max_duration_minutes_inclusive = 240
 WHERE code = 'THREE_HOUR_COMBO';--> statement-breakpoint
UPDATE rate_plans SET is_base_plan = true, min_check_in_minute_inclusive = NULL,
  max_check_in_minute_exclusive = NULL, min_duration_minutes_inclusive = 255,
  max_duration_minutes_inclusive = 960
 WHERE code = 'FIVE_HOUR_COMBO';--> statement-breakpoint
UPDATE rate_plans SET is_base_plan = true, min_check_in_minute_inclusive = 660,
  max_check_in_minute_exclusive = 900, min_duration_minutes_inclusive = 60,
  max_duration_minutes_inclusive = 960
 WHERE code = 'LUNCH_COMBO';--> statement-breakpoint
UPDATE rate_plans SET is_base_plan = true, min_check_in_minute_inclusive = 1080,
  max_check_in_minute_exclusive = 1440, min_duration_minutes_inclusive = 315,
  max_duration_minutes_inclusive = 960
 WHERE code = 'NIGHT_COMBO';--> statement-breakpoint
UPDATE rate_plans SET is_base_plan = true, min_check_in_minute_inclusive = NULL,
  max_check_in_minute_exclusive = NULL, min_duration_minutes_inclusive = 975,
  max_duration_minutes_inclusive = 1440
 WHERE code = 'DAY_COMBO';--> statement-breakpoint
-- For fresh databases the seed-development phase inserts all rate-plans
-- after the migration runs, so a fully-empty rate_plans table is
-- acceptable here. No additional UPDATE is required.
-- Once every existing row carries the correct selection metadata, the
-- new CHECK constraints can be added safely.
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_is_base_plan_ck" CHECK (("rate_plans"."code" = 'EXTRA_HOUR' AND "rate_plans"."is_base_plan" = false)
          OR ("rate_plans"."code" <> 'EXTRA_HOUR' AND "rate_plans"."is_base_plan" = true));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_check_in_window_pair_ck" CHECK (("rate_plans"."min_check_in_minute_inclusive" IS NULL AND "rate_plans"."max_check_in_minute_exclusive" IS NULL)
          OR ("rate_plans"."min_check_in_minute_inclusive" IS NOT NULL AND "rate_plans"."max_check_in_minute_exclusive" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_check_in_window_range_ck" CHECK ("rate_plans"."min_check_in_minute_inclusive" IS NULL
          OR ("rate_plans"."min_check_in_minute_inclusive" >= 0
              AND "rate_plans"."min_check_in_minute_inclusive" <= 1425
              AND "rate_plans"."min_check_in_minute_inclusive" % 15 = 0));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_check_in_window_max_ck" CHECK ("rate_plans"."max_check_in_minute_exclusive" IS NULL
          OR ("rate_plans"."max_check_in_minute_exclusive" >= 15
              AND "rate_plans"."max_check_in_minute_exclusive" <= 1440
              AND "rate_plans"."max_check_in_minute_exclusive" % 15 = 0));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_check_in_window_order_ck" CHECK ("rate_plans"."min_check_in_minute_inclusive" IS NULL
          OR "rate_plans"."max_check_in_minute_exclusive" IS NULL
          OR "rate_plans"."max_check_in_minute_exclusive" > "rate_plans"."min_check_in_minute_inclusive");--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_check_in_window_cross_midnight_ck" CHECK ("rate_plans"."min_check_in_minute_inclusive" IS NULL
          OR "rate_plans"."max_check_in_minute_exclusive" IS NULL
          OR "rate_plans"."min_check_in_minute_inclusive" < 1440);--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_base_plan_duration_window_ck" CHECK ("rate_plans"."is_base_plan" = false
          OR ("rate_plans"."min_duration_minutes_inclusive" IS NOT NULL
              AND "rate_plans"."max_duration_minutes_inclusive" IS NOT NULL
              AND "rate_plans"."min_duration_minutes_inclusive" >= 60
              AND "rate_plans"."min_duration_minutes_inclusive" <= 1440
              AND "rate_plans"."min_duration_minutes_inclusive" % 15 = 0
              AND "rate_plans"."max_duration_minutes_inclusive" >= 60
              AND "rate_plans"."max_duration_minutes_inclusive" <= 1440
              AND "rate_plans"."max_duration_minutes_inclusive" % 15 = 0
              AND "rate_plans"."max_duration_minutes_inclusive" >= "rate_plans"."min_duration_minutes_inclusive"));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_non_base_plan_hidden_ck" CHECK ("rate_plans"."is_base_plan" = true
          OR ("rate_plans"."min_duration_minutes_inclusive" IS NULL
              AND "rate_plans"."max_duration_minutes_inclusive" IS NULL
              AND "rate_plans"."min_check_in_minute_inclusive" IS NULL
              AND "rate_plans"."max_check_in_minute_exclusive" IS NULL));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_priority_safe_int_ck" CHECK ("rate_plans"."priority" >= 0 AND "rate_plans"."priority" <= 1000);--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_duration_ck" CHECK ("rate_plans"."included_duration_minutes" >= 60 AND "rate_plans"."included_duration_minutes" <= 1440
          AND "rate_plans"."included_duration_minutes" % 15 = 0);--> statement-breakpoint
-- Bump schema version. The expected version constant lives in
-- packages/database/src/schema-status.ts and is updated to match.
UPDATE schema_metadata
SET schema_version = 'phase-7b-data-driven-pricing-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;