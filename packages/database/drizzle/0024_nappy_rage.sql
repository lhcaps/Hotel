ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_quarter_hour_ck";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_duration_ck";--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_quarter_hour_ck";--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_duration_ck";--> statement-breakpoint
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_stay_policy_ck";--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "minimum_stay_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "maximum_stay_minutes" integer DEFAULT 10080 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "minimum_lead_time_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "maximum_advance_booking_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "default_overnight_duration_minutes" integer DEFAULT 720 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_duration_ck" CHECK ("bookings"."check_out" > "bookings"."check_in"
          AND "bookings"."check_out" <= "bookings"."check_in" + interval '31 days');--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_stay_policy_ck" CHECK ("properties"."minimum_stay_minutes" >= 1
        AND "properties"."maximum_stay_minutes" >= "properties"."minimum_stay_minutes"
        AND "properties"."maximum_stay_minutes" <= 44640
        AND "properties"."minimum_lead_time_minutes" >= 0
        AND "properties"."maximum_advance_booking_days" >= 0
        AND "properties"."default_overnight_duration_minutes" >= 1
        AND "properties"."default_overnight_duration_minutes" <= "properties"."maximum_stay_minutes");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_duration_ck" CHECK ("quotes"."check_out" > "quotes"."check_in"
          AND "quotes"."check_out" <= "quotes"."check_in" + interval '31 days');
