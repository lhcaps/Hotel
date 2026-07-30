CREATE TYPE "public"."audit_actor_type" AS ENUM('GUEST', 'CUSTOMER', 'ADMIN', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('HOLD', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'NO_SHOW', 'CHECKED_IN', 'CHECKED_OUT');--> statement-breakpoint
CREATE TYPE "public"."catalog_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."inventory_block_status" AS ENUM('ACTIVE', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."inventory_block_type" AS ENUM('BOOKING', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."maintenance_block_status" AS ENUM('ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('PENDING', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."rate_plan_status" AS ENUM('DRAFT', 'ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "catalog_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amenities_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "amenities_code_nonempty_ck" CHECK (btrim("amenities"."code") <> ''),
	CONSTRAINT "amenities_name_nonempty_ck" CHECK (btrim("amenities"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_aggregate_type_nonempty_ck" CHECK (btrim("audit_events"."aggregate_type") <> ''),
	CONSTRAINT "audit_events_event_type_nonempty_ck" CHECK (btrim("audit_events"."event_type") <> ''),
	CONSTRAINT "audit_events_payload_object_ck" CHECK (jsonb_typeof("audit_events"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"booking_code" text NOT NULL,
	"status" "booking_status" DEFAULT 'HOLD' NOT NULL,
	"check_in" timestamp with time zone NOT NULL,
	"check_out" timestamp with time zone NOT NULL,
	"adults" integer NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"gross_amount_vnd" bigint NOT NULL,
	"discount_amount_vnd" bigint DEFAULT 0 NOT NULL,
	"final_amount_vnd" bigint NOT NULL,
	"price_snapshot" jsonb NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_property_room_id_uq" UNIQUE("property_id","room_id","id"),
	CONSTRAINT "bookings_duration_ck" CHECK ("bookings"."check_out" >= "bookings"."check_in" + interval '60 minutes'
          AND "bookings"."check_out" <= "bookings"."check_in" + interval '24 hours'),
	CONSTRAINT "bookings_quarter_hour_ck" CHECK (date_trunc('minute', "bookings"."check_in") = "bookings"."check_in"
          AND date_trunc('minute', "bookings"."check_out") = "bookings"."check_out"
          AND mod(extract(epoch FROM "bookings"."check_in")::numeric, 900) = 0
          AND mod(extract(epoch FROM "bookings"."check_out")::numeric, 900) = 0),
	CONSTRAINT "bookings_occupancy_ck" CHECK ("bookings"."adults" >= 1 AND "bookings"."children" >= 0),
	CONSTRAINT "bookings_currency_vnd_ck" CHECK ("bookings"."currency" = 'VND'),
	CONSTRAINT "bookings_money_ck" CHECK ("bookings"."gross_amount_vnd" >= 0
          AND "bookings"."discount_amount_vnd" >= 0
          AND "bookings"."discount_amount_vnd" <= "bookings"."gross_amount_vnd"
          AND "bookings"."final_amount_vnd" = "bookings"."gross_amount_vnd" - "bookings"."discount_amount_vnd"),
	CONSTRAINT "bookings_price_snapshot_ck" CHECK (jsonb_typeof("bookings"."price_snapshot") = 'object' AND "bookings"."price_snapshot" <> '{}'::jsonb),
	CONSTRAINT "bookings_hold_expiry_ck" CHECK ("bookings"."hold_expires_at" > "bookings"."created_at"),
	CONSTRAINT "bookings_expired_at_ck" CHECK (("bookings"."status" = 'EXPIRED' AND "bookings"."expired_at" IS NOT NULL)
          OR ("bookings"."status" <> 'EXPIRED' AND "bookings"."expired_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "maintenance_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"status" "maintenance_block_status" DEFAULT 'ACTIVE' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_blocks_property_room_id_uq" UNIQUE("property_id","room_id","id"),
	CONSTRAINT "maintenance_blocks_interval_ck" CHECK ("maintenance_blocks"."ends_at" > "maintenance_blocks"."starts_at"),
	CONSTRAINT "maintenance_blocks_reason_nonempty_ck" CHECK (btrim("maintenance_blocks"."reason") <> ''),
	CONSTRAINT "maintenance_blocks_cancelled_at_ck" CHECK (("maintenance_blocks"."status" = 'CANCELLED' AND "maintenance_blocks"."cancelled_at" IS NOT NULL)
          OR ("maintenance_blocks"."status" = 'ACTIVE' AND "maintenance_blocks"."cancelled_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_aggregate_type_nonempty_ck" CHECK (btrim("outbox_events"."aggregate_type") <> ''),
	CONSTRAINT "outbox_events_event_type_nonempty_ck" CHECK (btrim("outbox_events"."event_type") <> ''),
	CONSTRAINT "outbox_events_payload_object_ck" CHECK (jsonb_typeof("outbox_events"."payload") = 'object'),
	CONSTRAINT "outbox_events_attempt_count_ck" CHECK ("outbox_events"."attempt_count" >= 0),
	CONSTRAINT "outbox_events_published_at_ck" CHECK (("outbox_events"."status" = 'PUBLISHED' AND "outbox_events"."published_at" IS NOT NULL)
          OR ("outbox_events"."status" <> 'PUBLISHED' AND "outbox_events"."published_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "catalog_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_tiers_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "price_tiers_code_nonempty_ck" CHECK (btrim("price_tiers"."code") <> ''),
	CONSTRAINT "price_tiers_name_nonempty_ck" CHECK (btrim("price_tiers"."name") <> ''),
	CONSTRAINT "price_tiers_sort_order_nonnegative_ck" CHECK ("price_tiers"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"status" "catalog_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_code_nonempty_ck" CHECK (btrim("properties"."code") <> ''),
	CONSTRAINT "properties_name_nonempty_ck" CHECK (btrim("properties"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "rate_plan_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"rate_plan_id" uuid NOT NULL,
	"price_tier_id" uuid NOT NULL,
	"amount_vnd" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_plan_prices_amount_positive_ck" CHECK ("rate_plan_prices"."amount_vnd" > 0),
	CONSTRAINT "rate_plan_prices_currency_vnd_ck" CHECK ("rate_plan_prices"."currency" = 'VND')
);
--> statement-breakpoint
CREATE TABLE "rate_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "rate_plan_status" DEFAULT 'DRAFT' NOT NULL,
	"included_duration_minutes" integer NOT NULL,
	"priority" integer NOT NULL,
	"source_evidence" text DEFAULT 'Phase 0 pricing rules' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_plans_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "rate_plans_code_ck" CHECK ("rate_plans"."code" IN ('THREE_HOUR_COMBO', 'FIVE_HOUR_COMBO', 'LUNCH_COMBO', 'NIGHT_COMBO', 'DAY_COMBO', 'EXTRA_HOUR')),
	CONSTRAINT "rate_plans_duration_ck" CHECK ("rate_plans"."included_duration_minutes" >= 60 AND "rate_plans"."included_duration_minutes" <= 1440),
	CONSTRAINT "rate_plans_priority_ck" CHECK ("rate_plans"."priority" >= 0 AND "rate_plans"."priority" <= 1000)
);
--> statement-breakpoint
CREATE TABLE "room_inventory_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"booking_id" uuid,
	"maintenance_block_id" uuid,
	"block_type" "inventory_block_type" NOT NULL,
	"status" "inventory_block_status" DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_inventory_blocks_interval_ck" CHECK ("room_inventory_blocks"."ends_at" > "room_inventory_blocks"."starts_at"),
	CONSTRAINT "room_inventory_blocks_source_ck" CHECK (("room_inventory_blocks"."block_type" = 'BOOKING' AND "room_inventory_blocks"."booking_id" IS NOT NULL AND "room_inventory_blocks"."maintenance_block_id" IS NULL)
          OR ("room_inventory_blocks"."block_type" = 'MAINTENANCE' AND "room_inventory_blocks"."booking_id" IS NULL AND "room_inventory_blocks"."maintenance_block_id" IS NOT NULL)),
	CONSTRAINT "room_inventory_blocks_released_at_ck" CHECK (("room_inventory_blocks"."status" = 'RELEASED' AND "room_inventory_blocks"."released_at" IS NOT NULL)
          OR ("room_inventory_blocks"."status" = 'ACTIVE' AND "room_inventory_blocks"."released_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "room_type_amenities" (
	"property_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_type_amenities_pk" PRIMARY KEY("property_id","room_type_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"price_tier_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"max_adults" integer NOT NULL,
	"max_children" integer DEFAULT 0 NOT NULL,
	"max_occupancy" integer NOT NULL,
	"status" "catalog_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_types_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "room_types_code_nonempty_ck" CHECK (btrim("room_types"."code") <> ''),
	CONSTRAINT "room_types_capacity_ck" CHECK (
      "room_types"."max_adults" >= 1
      AND "room_types"."max_children" >= 0
      AND "room_types"."max_occupancy" >= "room_types"."max_adults"
      AND "room_types"."max_occupancy" >= "room_types"."max_children"
      AND "room_types"."max_occupancy" <= "room_types"."max_adults" + "room_types"."max_children"
    )
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"room_number" text NOT NULL,
	"status" "room_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_property_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "rooms_property_room_type_id_uq" UNIQUE("property_id","room_type_id","id"),
	CONSTRAINT "rooms_number_nonempty_ck" CHECK (btrim("rooms"."room_number") <> '')
);
--> statement-breakpoint
CREATE TABLE "schema_metadata" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"schema_version" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_metadata_singleton_ck" CHECK ("schema_metadata"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_room_type_fk" FOREIGN KEY ("property_id","room_type_id") REFERENCES "public"."room_types"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_room_fk" FOREIGN KEY ("property_id","room_type_id","room_id") REFERENCES "public"."rooms"("property_id","room_type_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_blocks" ADD CONSTRAINT "maintenance_blocks_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_blocks" ADD CONSTRAINT "maintenance_blocks_property_room_fk" FOREIGN KEY ("property_id","room_id") REFERENCES "public"."rooms"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_prices" ADD CONSTRAINT "rate_plan_prices_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_prices" ADD CONSTRAINT "rate_plan_prices_property_rate_plan_fk" FOREIGN KEY ("property_id","rate_plan_id") REFERENCES "public"."rate_plans"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_prices" ADD CONSTRAINT "rate_plan_prices_property_price_tier_fk" FOREIGN KEY ("property_id","price_tier_id") REFERENCES "public"."price_tiers"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_inventory_blocks" ADD CONSTRAINT "room_inventory_blocks_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_inventory_blocks" ADD CONSTRAINT "room_inventory_blocks_property_room_fk" FOREIGN KEY ("property_id","room_id") REFERENCES "public"."rooms"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_inventory_blocks" ADD CONSTRAINT "room_inventory_blocks_booking_fk" FOREIGN KEY ("property_id","room_id","booking_id") REFERENCES "public"."bookings"("property_id","room_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_inventory_blocks" ADD CONSTRAINT "room_inventory_blocks_maintenance_fk" FOREIGN KEY ("property_id","room_id","maintenance_block_id") REFERENCES "public"."maintenance_blocks"("property_id","room_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_room_type_fk" FOREIGN KEY ("property_id","room_type_id") REFERENCES "public"."room_types"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_amenity_fk" FOREIGN KEY ("property_id","amenity_id") REFERENCES "public"."amenities"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_property_price_tier_fk" FOREIGN KEY ("property_id","price_tier_id") REFERENCES "public"."price_tiers"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_room_type_fk" FOREIGN KEY ("property_id","room_type_id") REFERENCES "public"."room_types"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amenities_property_code_uq" ON "amenities" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "audit_events_aggregate_idx" ON "audit_events" USING btree ("aggregate_type","aggregate_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_property_booking_code_uq" ON "bookings" USING btree ("property_id","booking_code");--> statement-breakpoint
CREATE UNIQUE INDEX "price_tiers_property_code_uq" ON "price_tiers" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_code_uq" ON "properties" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_plan_prices_plan_tier_uq" ON "rate_plan_prices" USING btree ("rate_plan_id","price_tier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_plans_property_code_uq" ON "rate_plans" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "room_inventory_blocks_booking_uq" ON "room_inventory_blocks" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_inventory_blocks_maintenance_uq" ON "room_inventory_blocks" USING btree ("maintenance_block_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_types_property_code_uq" ON "room_types" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_property_room_number_uq" ON "rooms" USING btree ("property_id","room_number");