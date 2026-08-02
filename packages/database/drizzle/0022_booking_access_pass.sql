ALTER TABLE "bookings" ADD COLUMN "access_pass_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "access_pass_revoked_at" timestamp with time zone;--> statement-breakpoint
UPDATE "schema_metadata"
   SET "schema_version" = 'booking-access-pass-v1',
       "applied_at" = CURRENT_TIMESTAMP
 WHERE "id" = 1;
