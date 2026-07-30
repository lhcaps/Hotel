CREATE TYPE "public"."operational_review_category" AS ENUM('PAID_CANCELLATION');--> statement-breakpoint
CREATE TYPE "public"."operational_review_status" AS ENUM('OPEN', 'RESOLVED');--> statement-breakpoint
CREATE TABLE "operational_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_id" uuid,
	"category" "operational_review_category" NOT NULL,
	"status" "operational_review_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_reason" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolver_id" uuid,
	"resolved_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_reviews_property_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "operational_reviews_opened_reason_ck" CHECK (btrim("operational_reviews"."opened_reason") <> '' AND char_length("operational_reviews"."opened_reason") <= 1000),
	CONSTRAINT "operational_reviews_resolved_at_ck" CHECK (("operational_reviews"."status" = 'RESOLVED' AND "operational_reviews"."resolved_at" IS NOT NULL)
          OR ("operational_reviews"."status" = 'OPEN' AND "operational_reviews"."resolved_at" IS NULL)),
	CONSTRAINT "operational_reviews_resolver_ck" CHECK (("operational_reviews"."status" = 'RESOLVED' AND "operational_reviews"."resolver_id" IS NOT NULL)
          OR ("operational_reviews"."status" = 'OPEN' AND "operational_reviews"."resolver_id" IS NULL)),
	CONSTRAINT "operational_reviews_resolved_note_ck" CHECK (("operational_reviews"."status" = 'RESOLVED'
            AND "operational_reviews"."resolved_note" IS NOT NULL
            AND btrim("operational_reviews"."resolved_note") <> ''
            AND char_length("operational_reviews"."resolved_note") <= 2000)
          OR ("operational_reviews"."status" = 'OPEN' AND "operational_reviews"."resolved_note" IS NULL)),
	CONSTRAINT "operational_reviews_payment_optional_ck" CHECK ("operational_reviews"."category" <> 'PAID_CANCELLATION' OR "operational_reviews"."payment_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "checked_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "operational_reviews" ADD CONSTRAINT "operational_reviews_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_reviews" ADD CONSTRAINT "operational_reviews_property_booking_fk" FOREIGN KEY ("property_id","booking_id") REFERENCES "public"."bookings"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_reviews" ADD CONSTRAINT "operational_reviews_payment_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_reviews" ADD CONSTRAINT "operational_reviews_resolver_fk" FOREIGN KEY ("resolver_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_reviews_booking_open_uq" ON "operational_reviews" USING btree ("booking_id","category") WHERE "operational_reviews"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "operational_reviews_property_status_idx" ON "operational_reviews" USING btree ("property_id","status","opened_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "operational_reviews_booking_idx" ON "operational_reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_property_status_created_idx" ON "bookings" USING btree ("property_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bookings_property_check_in_idx" ON "bookings" USING btree ("property_id","check_in");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_at_ck" CHECK (("bookings"."status" = 'CANCELLED' AND "bookings"."cancelled_at" IS NOT NULL)
          OR ("bookings"."status" <> 'CANCELLED' AND "bookings"."cancelled_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_checked_in_at_ck";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_in_at_ck" CHECK (("bookings"."status" IN ('CHECKED_IN', 'CHECKED_OUT')
          AND "bookings"."checked_in_at" IS NOT NULL)
        OR ("bookings"."status" NOT IN ('CHECKED_IN', 'CHECKED_OUT')
            AND "bookings"."checked_in_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_out_at_ck" CHECK (("bookings"."status" = 'CHECKED_OUT' AND "bookings"."checked_out_at" IS NOT NULL)
          OR ("bookings"."status" <> 'CHECKED_OUT' AND "bookings"."checked_out_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_at_ck" CHECK (("bookings"."status" = 'NO_SHOW' AND "bookings"."no_show_at" IS NOT NULL)
          OR ("bookings"."status" <> 'NO_SHOW' AND "bookings"."no_show_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_reason_ck" CHECK ("bookings"."cancellation_reason" IS NULL
          OR (btrim("bookings"."cancellation_reason") <> '' AND char_length("bookings"."cancellation_reason") <= 1000));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_reason_present_ck" CHECK ("bookings"."status" <> 'CANCELLED' OR "bookings"."cancellation_reason" IS NOT NULL);--> statement-breakpoint
UPDATE "schema_metadata"
SET "schema_version" = 'phase-7g-admin-booking-operations-v1', "applied_at" = CURRENT_TIMESTAMP
WHERE "id" = 1;