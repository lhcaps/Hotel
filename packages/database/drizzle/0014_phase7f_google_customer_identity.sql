CREATE TABLE "customer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"normalized_phone_e164" text,
	"address_line_1" text,
	"address_line_2" text,
	"ward" text,
	"district" text,
	"province" text,
	"postal_code" text,
	"country_code" text DEFAULT 'VN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profiles_country_code_ck" CHECK ("customer_profiles"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "customer_profiles_phone_format_ck" CHECK ("customer_profiles"."normalized_phone_e164" IS NULL OR "customer_profiles"."normalized_phone_e164" ~ '^\+[1-9][0-9]{6,14}$'),
	CONSTRAINT "customer_profiles_phone_length_ck" CHECK ("customer_profiles"."normalized_phone_e164" IS NULL OR char_length("customer_profiles"."normalized_phone_e164") <= 32),
	CONSTRAINT "customer_profiles_address_line_1_length_ck" CHECK ("customer_profiles"."address_line_1" IS NULL OR (btrim("customer_profiles"."address_line_1") <> '' AND char_length("customer_profiles"."address_line_1") <= 200)),
	CONSTRAINT "customer_profiles_address_line_2_length_ck" CHECK ("customer_profiles"."address_line_2" IS NULL OR char_length("customer_profiles"."address_line_2") <= 200),
	CONSTRAINT "customer_profiles_ward_length_ck" CHECK ("customer_profiles"."ward" IS NULL OR (btrim("customer_profiles"."ward") <> '' AND char_length("customer_profiles"."ward") <= 200)),
	CONSTRAINT "customer_profiles_district_length_ck" CHECK ("customer_profiles"."district" IS NULL OR (btrim("customer_profiles"."district") <> '' AND char_length("customer_profiles"."district") <= 200)),
	CONSTRAINT "customer_profiles_province_length_ck" CHECK ("customer_profiles"."province" IS NULL OR (btrim("customer_profiles"."province") <> '' AND char_length("customer_profiles"."province") <= 200)),
	CONSTRAINT "customer_profiles_postal_code_length_ck" CHECK ("customer_profiles"."postal_code" IS NULL OR char_length("customer_profiles"."postal_code") <= 32),
	CONSTRAINT "customer_profiles_empty_address_ck" CHECK ((
            ("customer_profiles"."address_line_1" IS NULL OR btrim("customer_profiles"."address_line_1") <> '')
         OR ("customer_profiles"."ward" IS NULL OR btrim("customer_profiles"."ward") <> '')
         OR ("customer_profiles"."district" IS NULL OR btrim("customer_profiles"."district") <> '')
         OR ("customer_profiles"."province" IS NULL OR btrim("customer_profiles"."province") <> '')
      ) OR (
         "customer_profiles"."address_line_1" IS NULL AND "customer_profiles"."ward" IS NULL AND "customer_profiles"."district" IS NULL AND "customer_profiles"."province" IS NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "customer_user_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_user_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_customer_user_created_idx" ON "bookings" USING btree ("customer_user_id","created_at" DESC NULLS LAST) WHERE "bookings"."customer_user_id" IS NOT NULL;--> statement-breakpoint
UPDATE "schema_metadata"
SET "schema_version" = 'phase-7f-google-customer-identity-v1', "applied_at" = CURRENT_TIMESTAMP
WHERE "id" = 1;