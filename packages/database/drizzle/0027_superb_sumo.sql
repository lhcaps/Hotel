ALTER TABLE "bookings" ADD COLUMN "cancellation_policy_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_idempotency_key" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_refund_state" text DEFAULT 'NOT_APPLICABLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_refund_amount_vnd" bigint;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_retained_amount_vnd" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_cancellation_idempotency_uq" ON "bookings" USING btree ("cancellation_idempotency_key") WHERE "bookings"."cancellation_idempotency_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_policy_snapshot_ck" CHECK ("bookings"."cancellation_policy_snapshot" IS NULL
          OR (jsonb_typeof("bookings"."cancellation_policy_snapshot") = 'object'
              AND "bookings"."cancellation_policy_snapshot" <> '{}'::jsonb));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_refund_state_ck" CHECK ("bookings"."cancellation_refund_state" IN ('NOT_APPLICABLE', 'NO_REFUND', 'REVIEW_REQUIRED', 'REFUND_PENDING', 'REFUNDED'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_refund_amounts_ck" CHECK (("bookings"."cancellation_refund_amount_vnd" IS NULL OR "bookings"."cancellation_refund_amount_vnd" >= 0)
          AND ("bookings"."cancellation_retained_amount_vnd" IS NULL OR "bookings"."cancellation_retained_amount_vnd" >= 0)
          AND ("bookings"."status" = 'CANCELLED'
               OR ("bookings"."cancellation_refund_amount_vnd" IS NULL AND "bookings"."cancellation_retained_amount_vnd" IS NULL)));