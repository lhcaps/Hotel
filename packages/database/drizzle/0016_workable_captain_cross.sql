ALTER TABLE "bookings" DROP CONSTRAINT "bookings_expired_at_ck";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_cancelled_at_ck";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_checked_in_at_ck";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_checked_out_at_ck";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_no_show_at_ck";--> statement-breakpoint
ALTER TABLE "rate_plans" DROP CONSTRAINT "rate_plans_code_ck";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_expired_at_ck" CHECK (("bookings"."status" = 'EXPIRED' AND "bookings"."expired_at" IS NOT NULL)
                OR ("bookings"."status" <> 'EXPIRED' AND "bookings"."expired_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_at_ck" CHECK (("bookings"."status" = 'CANCELLED' AND "bookings"."cancelled_at" IS NOT NULL)
                OR ("bookings"."status" <> 'CANCELLED' AND "bookings"."cancelled_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_in_at_ck" CHECK (("bookings"."status" IN ('CHECKED_IN', 'CHECKED_OUT')
                  AND "bookings"."checked_in_at" IS NOT NULL)
                OR ("bookings"."status" NOT IN ('CHECKED_IN', 'CHECKED_OUT')
                    AND "bookings"."checked_in_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_out_at_ck" CHECK (("bookings"."status" = 'CHECKED_OUT' AND "bookings"."checked_out_at" IS NOT NULL)
                OR ("bookings"."status" <> 'CHECKED_OUT' AND "bookings"."checked_out_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_at_ck" CHECK (("bookings"."status" = 'NO_SHOW' AND "bookings"."no_show_at" IS NOT NULL)
                OR ("bookings"."status" <> 'NO_SHOW' AND "bookings"."no_show_at" IS NULL));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_code_format_ck" CHECK ("rate_plans"."code" ~ '^[A-Z0-9_]{1,64}$');--> statement-breakpoint
UPDATE schema_metadata
SET schema_version = 'phase-8b1-pricing-product-vertical-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;