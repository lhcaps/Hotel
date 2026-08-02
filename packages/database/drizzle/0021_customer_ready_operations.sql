CREATE TYPE "public"."housekeeping_task_status" AS ENUM('SCHEDULED', 'DUE', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_type" AS ENUM('ARRIVAL_PREP', 'TURNOVER');--> statement-breakpoint
CREATE TABLE "housekeeping_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"booking_id" uuid,
	"type" "housekeeping_task_type" NOT NULL,
	"status" "housekeeping_task_status" DEFAULT 'SCHEDULED' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reminder_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housekeeping_tasks_property_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "housekeeping_tasks_reminder_sent_ck" CHECK ("housekeeping_tasks"."reminder_sent_at" IS NULL OR "housekeeping_tasks"."reminder_at" IS NOT NULL),
	CONSTRAINT "housekeeping_tasks_completed_at_ck" CHECK (("housekeeping_tasks"."status" = 'DONE' AND "housekeeping_tasks"."completed_at" IS NOT NULL)
          OR ("housekeeping_tasks"."status" <> 'DONE' AND "housekeeping_tasks"."completed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_property_room_fk" FOREIGN KEY ("property_id","room_id") REFERENCES "public"."rooms"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_property_booking_fk" FOREIGN KEY ("property_id","booking_id") REFERENCES "public"."bookings"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_tasks_booking_type_uq" ON "housekeeping_tasks" USING btree ("booking_id","type") WHERE "housekeeping_tasks"."booking_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_property_status_due_idx" ON "housekeeping_tasks" USING btree ("property_id","status","due_at");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_room_status_due_idx" ON "housekeeping_tasks" USING btree ("room_id","status","due_at");
--> statement-breakpoint
UPDATE "room_types" AS rt
   SET "max_occupancy" = 5,
       "updated_at" = CURRENT_TIMESTAMP
  FROM "price_tiers" AS pt
 WHERE pt."id" = rt."price_tier_id"
   AND pt."code" = 'SIGNATURE'
   AND rt."max_occupancy" <> 5;
--> statement-breakpoint
UPDATE "rate_plan_prices" AS rpp
   SET "amount_vnd" = corrected."amount_vnd",
       "updated_at" = CURRENT_TIMESTAMP
  FROM "rate_plans" AS rp
  JOIN "price_tiers" AS pt
    ON pt."property_id" = rp."property_id"
  JOIN (
    VALUES
      ('LUNCH_COMBO', 'STANDARD', 359000::bigint),
      ('LUNCH_COMBO', 'DELUXE', 419000::bigint),
      ('LUNCH_COMBO', 'SIGNATURE', 489000::bigint),
      ('THREE_HOUR_COMBO', 'STANDARD', 299000::bigint),
      ('THREE_HOUR_COMBO', 'DELUXE', 349000::bigint),
      ('THREE_HOUR_COMBO', 'SIGNATURE', 399000::bigint),
      ('FIVE_HOUR_COMBO', 'STANDARD', 399000::bigint),
      ('FIVE_HOUR_COMBO', 'DELUXE', 469000::bigint),
      ('FIVE_HOUR_COMBO', 'SIGNATURE', 549000::bigint),
      ('NIGHT_COMBO', 'STANDARD', 499000::bigint),
      ('NIGHT_COMBO', 'DELUXE', 589000::bigint),
      ('NIGHT_COMBO', 'SIGNATURE', 689000::bigint),
      ('DAY_COMBO', 'STANDARD', 749000::bigint),
      ('DAY_COMBO', 'DELUXE', 879000::bigint),
      ('DAY_COMBO', 'SIGNATURE', 1029000::bigint),
      ('EXTRA_HOUR', 'STANDARD', 80000::bigint),
      ('EXTRA_HOUR', 'DELUXE', 95000::bigint),
      ('EXTRA_HOUR', 'SIGNATURE', 110000::bigint)
  ) AS corrected("plan_code", "tier_code", "amount_vnd")
    ON corrected."plan_code" = rp."code"
   AND corrected."tier_code" = pt."code"
 WHERE rpp."rate_plan_id" = rp."id"
   AND rpp."price_tier_id" = pt."id"
   AND rpp."amount_vnd" <> corrected."amount_vnd";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "ensure_property_payment_provider_settings"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "payment_provider_settings" (
    "property_id", "provider", "enabled", "display_name", "display_order", "checkout_expiry_minutes"
  )
  VALUES
    (NEW."id", 'MOMO', false, 'MoMo Demo', 10, 15),
    (NEW."id", 'VNPAY', false, 'VNPAY Demo', 20, 15)
  ON CONFLICT ("property_id", "provider") DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "properties_ensure_payment_provider_settings"
AFTER INSERT ON "properties"
FOR EACH ROW
EXECUTE FUNCTION "ensure_property_payment_provider_settings"();
--> statement-breakpoint
INSERT INTO "payment_provider_settings" (
  "property_id", "provider", "enabled", "display_name", "display_order", "checkout_expiry_minutes", "updated_at"
)
SELECT
  p."id",
  defaults."provider"::"payment_provider",
  p."code" = 'PEACE_HOME',
  defaults."display_name",
  defaults."display_order",
  15,
  CURRENT_TIMESTAMP
FROM "properties" AS p
CROSS JOIN (
  VALUES ('MOMO', 'MoMo Demo', 10), ('VNPAY', 'VNPAY Demo', 20)
) AS defaults("provider", "display_name", "display_order")
ON CONFLICT ("property_id", "provider") DO UPDATE
  SET "enabled" = EXCLUDED."enabled",
      "display_name" = EXCLUDED."display_name",
      "display_order" = EXCLUDED."display_order",
      "checkout_expiry_minutes" = EXCLUDED."checkout_expiry_minutes",
      "updated_at" = EXCLUDED."updated_at";
--> statement-breakpoint
UPDATE "schema_metadata"
   SET "schema_version" = 'customer-ready-operations-v1',
       "applied_at" = CURRENT_TIMESTAMP
 WHERE "id" = 1;
