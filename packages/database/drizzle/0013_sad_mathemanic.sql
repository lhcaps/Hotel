CREATE TABLE "payment_provider_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"display_name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"checkout_expiry_minutes" integer DEFAULT 15 NOT NULL,
	"maintenance_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_settings_property_provider_uq" UNIQUE("property_id","provider"),
	CONSTRAINT "payment_provider_settings_display_name_ck" CHECK (btrim("payment_provider_settings"."display_name") <> ''),
	CONSTRAINT "payment_provider_settings_display_order_ck" CHECK ("payment_provider_settings"."display_order" >= 0),
	CONSTRAINT "payment_provider_settings_expiry_ck" CHECK ("payment_provider_settings"."checkout_expiry_minutes" BETWEEN 1 AND 60),
	CONSTRAINT "payment_provider_settings_maintenance_message_ck" CHECK ("payment_provider_settings"."maintenance_message" IS NULL OR char_length("payment_provider_settings"."maintenance_message") <= 500)
);
--> statement-breakpoint
ALTER TABLE "payment_provider_settings" ADD CONSTRAINT "payment_provider_settings_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "payment_provider_settings" ("property_id", "provider", "display_name", "display_order")
SELECT p."id", provider_defaults."provider"::"payment_provider", provider_defaults."display_name", provider_defaults."display_order"
FROM "properties" p
CROSS JOIN (
  VALUES ('MOMO', 'MoMo', 10), ('VNPAY', 'VNPAY', 20)
) AS provider_defaults("provider", "display_name", "display_order")
ON CONFLICT ("property_id", "provider") DO NOTHING;
--> statement-breakpoint
UPDATE "schema_metadata"
SET "schema_version" = 'phase-7e-dual-provider-delivery-v1', "applied_at" = CURRENT_TIMESTAMP
WHERE "id" = 1;
