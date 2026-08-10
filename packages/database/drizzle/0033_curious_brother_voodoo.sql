ALTER TYPE "public"."access_credential_status" ADD VALUE 'DELIVERED' BEFORE 'REVOKED';--> statement-breakpoint
ALTER TABLE "access_credentials" DROP CONSTRAINT "access_credentials_status_fields_ck";--> statement-breakpoint
DROP INDEX "access_credentials_booking_active_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_booking_active_uq" ON "access_credentials" USING btree ("booking_id") WHERE "access_credentials"."status" IN ('PENDING', 'ISSUED', 'DELIVERED');--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_status_fields_ck" CHECK (("access_credentials"."status" = 'PENDING'
             AND "access_credentials"."issued_at" IS NULL
             AND "access_credentials"."delivered_at" IS NULL
             AND "access_credentials"."revoked_at" IS NULL
             AND "access_credentials"."failure_code" IS NULL)
          OR ("access_credentials"."status" = 'ISSUED'
              AND "access_credentials"."issued_at" IS NOT NULL
              AND "access_credentials"."delivered_at" IS NULL
              AND "access_credentials"."revoked_at" IS NULL
              AND "access_credentials"."failure_code" IS NULL)
          OR ("access_credentials"."status" = 'DELIVERED'
              AND "access_credentials"."issued_at" IS NOT NULL
              AND "access_credentials"."delivered_at" IS NOT NULL
              AND "access_credentials"."revoked_at" IS NULL
              AND "access_credentials"."failure_code" IS NULL)
          OR ("access_credentials"."status" = 'REVOKED'
              AND "access_credentials"."issued_at" IS NOT NULL
              AND "access_credentials"."revoked_at" IS NOT NULL
              AND "access_credentials"."failure_code" IS NULL)
          OR ("access_credentials"."status" = 'FAILED'
              AND "access_credentials"."issued_at" IS NULL
              AND "access_credentials"."delivered_at" IS NULL
              AND "access_credentials"."revoked_at" IS NULL
              AND "access_credentials"."failure_code" IS NOT NULL));