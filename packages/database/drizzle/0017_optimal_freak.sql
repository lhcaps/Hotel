ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_property_payment_fk";--> statement-breakpoint
ALTER TABLE "operational_reviews" DROP CONSTRAINT "operational_reviews_payment_fk";
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "reconciliation_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "next_reconciliation_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "last_reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "last_error_code" text;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_property_booking_id_id_uq" UNIQUE("property_id","booking_id","id");--> statement-breakpoint
ALTER TABLE "operational_reviews" ADD CONSTRAINT "operational_reviews_payment_fk" FOREIGN KEY ("property_id","booking_id","payment_id") REFERENCES "public"."payments"("property_id","booking_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operational_reviews_payment_review_idx" ON "operational_reviews" USING btree ("payment_id") WHERE "operational_reviews"."payment_id" IS NOT NULL AND "operational_reviews"."category" = 'PAID_CANCELLATION';--> statement-breakpoint
CREATE INDEX "payment_attempts_reconciliation_eligible_idx" ON "payment_attempts" USING btree ("status","next_reconciliation_at","lease_expires_at");--> statement-breakpoint
CREATE INDEX "payment_provider_events_provider_received_idx" ON "payment_provider_events" USING btree ("provider","received_at");--> statement-breakpoint
CREATE INDEX "payments_property_status_updated_idx" ON "payments" USING btree ("property_id","status","updated_at");--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_property_payment_fk" FOREIGN KEY ("property_id","payment_id") REFERENCES "public"."payments"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_property_booking_uq" ON "payments" USING btree ("property_id","booking_id");--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_reconciliation_attempt_count_ck" CHECK ("payment_attempts"."reconciliation_attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_reconciliation_lease_ck" CHECK (("payment_attempts"."lease_owner" IS NULL AND "payment_attempts"."lease_expires_at" IS NULL)
          OR ("payment_attempts"."lease_owner" IS NOT NULL AND btrim("payment_attempts"."lease_owner") <> '' AND "payment_attempts"."lease_expires_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_reconciliation_error_ck" CHECK ("payment_attempts"."last_error_code" IS NULL OR btrim("payment_attempts"."last_error_code") <> '');
--> statement-breakpoint
UPDATE schema_metadata
SET schema_version = 'phase-8c-payment-reconciliation-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;
