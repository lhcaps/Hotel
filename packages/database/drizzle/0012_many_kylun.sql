CREATE TYPE "public"."payment_attempt_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REVIEW_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."payment_confirmation_source" AS ENUM('PROVIDER_EVENT', 'NO_CHARGE');--> statement-breakpoint
CREATE TYPE "public"."payment_event_processing_status" AS ENUM('PROCESSED', 'DUPLICATE', 'REJECTED', 'REVIEW_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."payment_normalized_outcome" AS ENUM('SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('MOMO', 'VNPAY');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'REVIEW_REQUIRED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_transaction_id" text,
	"amount_vnd" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_code" text,
	"review_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "payment_attempts_amount_positive_ck" CHECK ("payment_attempts"."amount_vnd" > 0),
	CONSTRAINT "payment_attempts_currency_vnd_ck" CHECK ("payment_attempts"."currency" = 'VND'),
	CONSTRAINT "payment_attempts_idempotency_key_ck" CHECK (btrim("payment_attempts"."idempotency_key") <> '' AND char_length("payment_attempts"."idempotency_key") <= 128),
	CONSTRAINT "payment_attempts_provider_order_id_ck" CHECK (btrim("payment_attempts"."provider_order_id") <> '' AND char_length("payment_attempts"."provider_order_id") <= 128),
	CONSTRAINT "payment_attempts_provider_transaction_id_ck" CHECK ("payment_attempts"."provider_transaction_id" IS NULL OR (btrim("payment_attempts"."provider_transaction_id") <> '' AND char_length("payment_attempts"."provider_transaction_id") <= 128)),
	CONSTRAINT "payment_attempts_lifecycle_fields_ck" CHECK (("payment_attempts"."status" = 'PENDING'
             AND "payment_attempts"."completed_at" IS NULL
             AND "payment_attempts"."failure_code" IS NULL
             AND "payment_attempts"."review_code" IS NULL)
          OR ("payment_attempts"."status" = 'SUCCEEDED'
              AND "payment_attempts"."completed_at" IS NOT NULL
              AND "payment_attempts"."provider_transaction_id" IS NOT NULL
              AND "payment_attempts"."failure_code" IS NULL
              AND "payment_attempts"."review_code" IS NULL)
          OR ("payment_attempts"."status" = 'FAILED'
              AND "payment_attempts"."completed_at" IS NOT NULL
              AND "payment_attempts"."failure_code" IS NOT NULL
              AND "payment_attempts"."review_code" IS NULL)
          OR ("payment_attempts"."status" IN ('CANCELLED', 'EXPIRED')
              AND "payment_attempts"."completed_at" IS NOT NULL
              AND "payment_attempts"."failure_code" IS NULL
              AND "payment_attempts"."review_code" IS NULL)
          OR ("payment_attempts"."status" = 'REVIEW_REQUIRED'
              AND "payment_attempts"."completed_at" IS NOT NULL
              AND "payment_attempts"."failure_code" IS NULL
              AND "payment_attempts"."review_code" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"payment_attempt_id" uuid,
	"provider" "payment_provider" NOT NULL,
	"event_key" text NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_transaction_id" text,
	"normalized_outcome" "payment_normalized_outcome" NOT NULL,
	"amount_vnd" bigint,
	"currency" text,
	"raw_body_digest" "bytea" NOT NULL,
	"processing_status" "payment_event_processing_status" NOT NULL,
	"rejection_code" text,
	"received_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_events_resolution_pair_ck" CHECK (("payment_provider_events"."property_id" IS NULL AND "payment_provider_events"."payment_attempt_id" IS NULL)
          OR ("payment_provider_events"."property_id" IS NOT NULL AND "payment_provider_events"."payment_attempt_id" IS NOT NULL)),
	CONSTRAINT "payment_provider_events_digest_length_ck" CHECK (octet_length("payment_provider_events"."raw_body_digest") = 32),
	CONSTRAINT "payment_provider_events_amount_ck" CHECK ("payment_provider_events"."amount_vnd" IS NULL OR "payment_provider_events"."amount_vnd" >= 0),
	CONSTRAINT "payment_provider_events_currency_ck" CHECK ("payment_provider_events"."currency" IS NULL OR "payment_provider_events"."currency" = 'VND'),
	CONSTRAINT "payment_provider_events_identifiers_ck" CHECK (btrim("payment_provider_events"."event_key") <> '' AND char_length("payment_provider_events"."event_key") <= 256
          AND btrim("payment_provider_events"."provider_order_id") <> '' AND char_length("payment_provider_events"."provider_order_id") <= 128
          AND ("payment_provider_events"."provider_transaction_id" IS NULL OR (btrim("payment_provider_events"."provider_transaction_id") <> '' AND char_length("payment_provider_events"."provider_transaction_id") <= 128))),
	CONSTRAINT "payment_provider_events_processing_fields_ck" CHECK ("payment_provider_events"."processed_at" IS NOT NULL),
	CONSTRAINT "payment_provider_events_rejection_code_ck" CHECK (("payment_provider_events"."processing_status" IN ('REJECTED', 'REVIEW_REQUIRED') AND "payment_provider_events"."rejection_code" IS NOT NULL)
          OR ("payment_provider_events"."processing_status" IN ('PROCESSED', 'DUPLICATE') AND "payment_provider_events"."rejection_code" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"amount_vnd" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"confirmation_source" "payment_confirmation_source",
	"succeeded_at" timestamp with time zone,
	"review_required_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "payments_amount_nonnegative_ck" CHECK ("payments"."amount_vnd" >= 0),
	CONSTRAINT "payments_currency_vnd_ck" CHECK ("payments"."currency" = 'VND'),
	CONSTRAINT "payments_lifecycle_timestamps_ck" CHECK (("payments"."status" = 'PENDING'
             AND "payments"."confirmation_source" IS NULL
             AND "payments"."succeeded_at" IS NULL
             AND "payments"."review_required_at" IS NULL
             AND "payments"."cancelled_at" IS NULL
             AND "payments"."expired_at" IS NULL)
          OR ("payments"."status" = 'SUCCEEDED'
              AND "payments"."confirmation_source" IS NOT NULL
              AND "payments"."succeeded_at" IS NOT NULL
              AND "payments"."review_required_at" IS NULL
              AND "payments"."cancelled_at" IS NULL
              AND "payments"."expired_at" IS NULL)
          OR ("payments"."status" = 'REVIEW_REQUIRED'
              AND "payments"."confirmation_source" IS NULL
              AND "payments"."succeeded_at" IS NULL
              AND "payments"."review_required_at" IS NOT NULL
              AND "payments"."cancelled_at" IS NULL
              AND "payments"."expired_at" IS NULL)
          OR ("payments"."status" = 'CANCELLED'
              AND "payments"."confirmation_source" IS NULL
              AND "payments"."succeeded_at" IS NULL
              AND "payments"."review_required_at" IS NULL
              AND "payments"."cancelled_at" IS NOT NULL
              AND "payments"."expired_at" IS NULL)
          OR ("payments"."status" = 'EXPIRED'
              AND "payments"."confirmation_source" IS NULL
              AND "payments"."succeeded_at" IS NULL
              AND "payments"."review_required_at" IS NULL
              AND "payments"."cancelled_at" IS NULL
              AND "payments"."expired_at" IS NOT NULL)),
	CONSTRAINT "payments_no_charge_amount_ck" CHECK ("payments"."confirmation_source" <> 'NO_CHARGE' OR "payments"."amount_vnd" = 0)
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_property_payment_fk" FOREIGN KEY ("property_id","payment_id") REFERENCES "public"."payments"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_property_attempt_fk" FOREIGN KEY ("property_id","payment_attempt_id") REFERENCES "public"."payment_attempts"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_property_booking_fk" FOREIGN KEY ("property_id","booking_id") REFERENCES "public"."bookings"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_payment_idempotency_uq" ON "payment_attempts" USING btree ("payment_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_order_uq" ON "payment_attempts" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_transaction_uq" ON "payment_attempts" USING btree ("provider","provider_transaction_id") WHERE "payment_attempts"."provider_transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_events_provider_event_uq" ON "payment_provider_events" USING btree ("provider","event_key");--> statement-breakpoint
CREATE INDEX "payment_provider_events_attempt_received_idx" ON "payment_provider_events" USING btree ("payment_attempt_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_booking_uq" ON "payments" USING btree ("booking_id");
--> statement-breakpoint
-- Phase 7C payment core schema status. Existing booking values remain immutable.
UPDATE schema_metadata
SET schema_version = 'phase-7c-payment-core-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;
