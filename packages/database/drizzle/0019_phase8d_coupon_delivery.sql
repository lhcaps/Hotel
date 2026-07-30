CREATE TABLE "coupon_delivery_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "booking_id" uuid NOT NULL,
  "idempotency_key" text NOT NULL,
  "coupon_codes" jsonb NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "coupon_delivery_requests_property_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "coupon_delivery_requests_booking_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "coupon_delivery_requests_idempotency_ck" CHECK (btrim("idempotency_key") <> ''),
  CONSTRAINT "coupon_delivery_requests_codes_ck" CHECK (jsonb_typeof("coupon_codes") = 'array' AND jsonb_array_length("coupon_codes") BETWEEN 1 AND 10),
  CONSTRAINT "coupon_delivery_requests_status_ck" CHECK (("status" = 'PENDING' AND "sent_at" IS NULL) OR ("status" = 'SENT' AND "sent_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_delivery_requests_property_idempotency_uq" ON "coupon_delivery_requests" USING btree ("property_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX "coupon_delivery_requests_booking_created_idx" ON "coupon_delivery_requests" USING btree ("booking_id", "created_at");
--> statement-breakpoint
UPDATE "schema_metadata"
SET "schema_version" = 'phase-8d-client-acceptance-v1'
WHERE "id" = 1 AND "schema_version" = 'phase-8c-payment-reconciliation-v1';
