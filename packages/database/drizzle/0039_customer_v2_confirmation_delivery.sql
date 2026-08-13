-- Customer V2: one semantic confirmation delivery record per booking.
-- The record deliberately excludes recipient addresses and rendered content.

CREATE TYPE "public"."booking_confirmation_delivery_status" AS ENUM ('PENDING', 'DELIVERED');
--> statement-breakpoint
CREATE TABLE "booking_confirmation_deliveries" (
  "booking_id" uuid PRIMARY KEY NOT NULL,
  "status" "booking_confirmation_delivery_status" DEFAULT 'PENDING' NOT NULL,
  "message_id" text NOT NULL,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "booking_confirmation_deliveries_message_id_nonempty_ck"
    CHECK (btrim("message_id") <> ''),
  CONSTRAINT "booking_confirmation_deliveries_status_fields_ck"
    CHECK (("status" = 'PENDING' AND "delivered_at" IS NULL)
        OR ("status" = 'DELIVERED' AND "delivered_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "booking_confirmation_deliveries"
  ADD CONSTRAINT "booking_confirmation_deliveries_booking_fk"
  FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_confirmation_deliveries_message_id_uq"
  ON "booking_confirmation_deliveries" USING btree ("message_id");
