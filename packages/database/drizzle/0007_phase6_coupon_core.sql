CREATE TYPE "public"."coupon_application_status" AS ENUM('ASSOCIATED', 'RESERVED', 'REDEEMED', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."coupon_discount_type" AS ENUM('FIXED', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."coupon_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TABLE "booking_coupon_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"coupon_id" uuid NOT NULL,
	"customer_email_digest" "bytea" NOT NULL,
	"application_status" "coupon_application_status" NOT NULL,
	"quota_reserved" boolean NOT NULL,
	"discount_type" "coupon_discount_type" NOT NULL,
	"fixed_amount_vnd" bigint,
	"percentage_basis_points" integer,
	"maximum_discount_vnd" bigint,
	"minimum_order_amount_vnd" bigint NOT NULL,
	"gross_amount_vnd" bigint NOT NULL,
	"discount_amount_vnd" bigint NOT NULL,
	"final_amount_vnd" bigint NOT NULL,
	"coupon_code_snapshot" text NOT NULL,
	"reserved_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"redemption_event_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_coupon_applications_email_digest_length_ck" CHECK (octet_length("booking_coupon_applications"."customer_email_digest") = 32),
	CONSTRAINT "booking_coupon_applications_code_ck" CHECK ("booking_coupon_applications"."coupon_code_snapshot" ~ '^[A-Z0-9-]{4,32}$'),
	CONSTRAINT "booking_coupon_applications_discount_shape_ck" CHECK (("booking_coupon_applications"."discount_type" = 'FIXED'
             AND "booking_coupon_applications"."fixed_amount_vnd" IS NOT NULL
             AND "booking_coupon_applications"."fixed_amount_vnd" > 0
             AND "booking_coupon_applications"."percentage_basis_points" IS NULL
             AND "booking_coupon_applications"."maximum_discount_vnd" IS NULL)
          OR ("booking_coupon_applications"."discount_type" = 'PERCENTAGE'
             AND "booking_coupon_applications"."fixed_amount_vnd" IS NULL
             AND "booking_coupon_applications"."percentage_basis_points" IS NOT NULL
             AND "booking_coupon_applications"."percentage_basis_points" BETWEEN 1 AND 10000
             AND ("booking_coupon_applications"."maximum_discount_vnd" IS NULL OR "booking_coupon_applications"."maximum_discount_vnd" > 0))),
	CONSTRAINT "booking_coupon_applications_amounts_ck" CHECK ("booking_coupon_applications"."minimum_order_amount_vnd" >= 0
          AND "booking_coupon_applications"."gross_amount_vnd" >= 0
          AND "booking_coupon_applications"."discount_amount_vnd" >= 0
          AND "booking_coupon_applications"."discount_amount_vnd" <= "booking_coupon_applications"."gross_amount_vnd"
          AND "booking_coupon_applications"."final_amount_vnd" = "booking_coupon_applications"."gross_amount_vnd" - "booking_coupon_applications"."discount_amount_vnd"),
	CONSTRAINT "booking_coupon_applications_lifecycle_ck" CHECK (("booking_coupon_applications"."application_status" = 'ASSOCIATED'
             AND "booking_coupon_applications"."quota_reserved" = false
             AND "booking_coupon_applications"."reserved_at" IS NULL
             AND "booking_coupon_applications"."redeemed_at" IS NULL
             AND "booking_coupon_applications"."released_at" IS NULL
             AND "booking_coupon_applications"."redemption_event_key" IS NULL)
          OR ("booking_coupon_applications"."application_status" = 'RESERVED'
             AND "booking_coupon_applications"."quota_reserved" = true
             AND "booking_coupon_applications"."reserved_at" IS NOT NULL
             AND "booking_coupon_applications"."redeemed_at" IS NULL
             AND "booking_coupon_applications"."released_at" IS NULL
             AND "booking_coupon_applications"."redemption_event_key" IS NULL)
          OR ("booking_coupon_applications"."application_status" = 'REDEEMED'
             AND "booking_coupon_applications"."redeemed_at" IS NOT NULL
             AND "booking_coupon_applications"."released_at" IS NULL
             AND "booking_coupon_applications"."redemption_event_key" IS NOT NULL
             AND (("booking_coupon_applications"."quota_reserved" = true AND "booking_coupon_applications"."reserved_at" IS NOT NULL)
                  OR ("booking_coupon_applications"."quota_reserved" = false AND "booking_coupon_applications"."reserved_at" IS NULL)))
          OR ("booking_coupon_applications"."application_status" = 'RELEASED'
             AND "booking_coupon_applications"."quota_reserved" = false
             AND "booking_coupon_applications"."redeemed_at" IS NULL
             AND "booking_coupon_applications"."released_at" IS NOT NULL
             AND "booking_coupon_applications"."redemption_event_key" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "coupon_room_types" (
	"property_id" uuid NOT NULL,
	"coupon_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_room_types_pk" PRIMARY KEY("coupon_id","room_type_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"normalized_code" text NOT NULL,
	"status" "coupon_status" DEFAULT 'ACTIVE' NOT NULL,
	"discount_type" "coupon_discount_type" NOT NULL,
	"fixed_amount_vnd" bigint,
	"percentage_basis_points" integer,
	"maximum_discount_vnd" bigint,
	"minimum_order_amount_vnd" bigint DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"applies_to_all_room_types" boolean NOT NULL,
	"total_usage_limit" integer,
	"per_customer_limit" integer,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "coupons_normalized_code_ck" CHECK ("coupons"."normalized_code" ~ '^[A-Z0-9-]{4,32}$' AND "coupons"."normalized_code" = upper("coupons"."normalized_code")),
	CONSTRAINT "coupons_validity_ck" CHECK ("coupons"."valid_until" > "coupons"."valid_from"),
	CONSTRAINT "coupons_discount_shape_ck" CHECK (("coupons"."discount_type" = 'FIXED'
             AND "coupons"."fixed_amount_vnd" IS NOT NULL
             AND "coupons"."fixed_amount_vnd" > 0
             AND "coupons"."percentage_basis_points" IS NULL
             AND "coupons"."maximum_discount_vnd" IS NULL)
          OR ("coupons"."discount_type" = 'PERCENTAGE'
             AND "coupons"."fixed_amount_vnd" IS NULL
             AND "coupons"."percentage_basis_points" IS NOT NULL
             AND "coupons"."percentage_basis_points" BETWEEN 1 AND 10000
             AND ("coupons"."maximum_discount_vnd" IS NULL OR "coupons"."maximum_discount_vnd" > 0))),
	CONSTRAINT "coupons_minimum_order_ck" CHECK ("coupons"."minimum_order_amount_vnd" >= 0),
	CONSTRAINT "coupons_limits_ck" CHECK (("coupons"."total_usage_limit" IS NULL OR "coupons"."total_usage_limit" > 0)
          AND ("coupons"."per_customer_limit" IS NULL OR "coupons"."per_customer_limit" > 0)),
	CONSTRAINT "coupons_disabled_at_ck" CHECK (("coupons"."status" = 'ACTIVE' AND "coupons"."disabled_at" IS NULL)
          OR ("coupons"."status" = 'DISABLED' AND "coupons"."disabled_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "coupon_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "coupon_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_uq" UNIQUE("property_id","id");--> statement-breakpoint
ALTER TABLE "booking_coupon_applications" ADD CONSTRAINT "booking_coupon_applications_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_coupon_applications" ADD CONSTRAINT "booking_coupon_applications_booking_fk" FOREIGN KEY ("property_id","booking_id") REFERENCES "public"."bookings"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_coupon_applications" ADD CONSTRAINT "booking_coupon_applications_coupon_fk" FOREIGN KEY ("property_id","coupon_id") REFERENCES "public"."coupons"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_room_types" ADD CONSTRAINT "coupon_room_types_coupon_fk" FOREIGN KEY ("property_id","coupon_id") REFERENCES "public"."coupons"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_room_types" ADD CONSTRAINT "coupon_room_types_room_type_fk" FOREIGN KEY ("property_id","room_type_id") REFERENCES "public"."room_types"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_coupon_applications_booking_uq" ON "booking_coupon_applications" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_coupon_applications_redemption_event_uq" ON "booking_coupon_applications" USING btree ("redemption_event_key") WHERE "booking_coupon_applications"."redemption_event_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "booking_coupon_applications_quota_idx" ON "booking_coupon_applications" USING btree ("coupon_id","application_status");--> statement-breakpoint
CREATE INDEX "booking_coupon_applications_customer_quota_idx" ON "booking_coupon_applications" USING btree ("coupon_id","customer_email_digest","application_status");--> statement-breakpoint
CREATE INDEX "coupon_room_types_room_type_idx" ON "coupon_room_types" USING btree ("room_type_id","coupon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_property_code_uq" ON "coupons" USING btree ("property_id","normalized_code");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_property_coupon_fk" FOREIGN KEY ("property_id","coupon_id") REFERENCES "public"."coupons"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_coupon_snapshot_ck" CHECK (("quotes"."coupon_id" IS NULL AND "quotes"."coupon_snapshot" IS NULL)
          OR ("quotes"."coupon_id" IS NOT NULL
              AND "quotes"."coupon_snapshot" IS NOT NULL
              AND jsonb_typeof("quotes"."coupon_snapshot") = 'object'
              AND "quotes"."coupon_snapshot" <> '{}'::jsonb));