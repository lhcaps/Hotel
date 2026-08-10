CREATE TYPE "public"."access_credential_provider" AS ENUM('DEMO');--> statement-breakpoint
CREATE TYPE "public"."access_credential_status" AS ENUM('PENDING', 'ISSUED', 'REVOKED', 'FAILED');--> statement-breakpoint
CREATE TABLE "access_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"provider" "access_credential_provider" NOT NULL,
	"provider_credential_reference" text NOT NULL,
	"status" "access_credential_status" DEFAULT 'PENDING' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"issued_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"failure_code" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_credentials_reference_nonempty_ck" CHECK (btrim("access_credentials"."provider_credential_reference") <> ''),
	CONSTRAINT "access_credentials_idempotency_key_nonempty_ck" CHECK (btrim("access_credentials"."idempotency_key") <> '' AND char_length("access_credentials"."idempotency_key") <= 128),
	CONSTRAINT "access_credentials_valid_interval_ck" CHECK ("access_credentials"."valid_until" > "access_credentials"."valid_from"),
	CONSTRAINT "access_credentials_status_fields_ck" CHECK (("access_credentials"."status" = 'PENDING'
             AND "access_credentials"."issued_at" IS NULL
             AND "access_credentials"."revoked_at" IS NULL
             AND "access_credentials"."failure_code" IS NULL)
          OR ("access_credentials"."status" = 'ISSUED'
              AND "access_credentials"."issued_at" IS NOT NULL
              AND "access_credentials"."revoked_at" IS NULL
              AND "access_credentials"."failure_code" IS NULL)
          OR ("access_credentials"."status" = 'REVOKED'
              AND "access_credentials"."issued_at" IS NOT NULL
              AND "access_credentials"."revoked_at" IS NOT NULL
              AND "access_credentials"."failure_code" IS NULL)
          OR ("access_credentials"."status" = 'FAILED'
              AND "access_credentials"."issued_at" IS NULL
              AND "access_credentials"."revoked_at" IS NULL
              AND "access_credentials"."failure_code" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_property_booking_fk" FOREIGN KEY ("property_id","booking_id") REFERENCES "public"."bookings"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_property_room_fk" FOREIGN KEY ("property_id","room_id") REFERENCES "public"."rooms"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_provider_reference_uq" ON "access_credentials" USING btree ("provider","provider_credential_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_booking_idempotency_uq" ON "access_credentials" USING btree ("booking_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_booking_active_uq" ON "access_credentials" USING btree ("booking_id") WHERE "access_credentials"."status" IN ('PENDING', 'ISSUED');--> statement-breakpoint
CREATE INDEX "access_credentials_issuance_idx" ON "access_credentials" USING btree ("status","valid_from");