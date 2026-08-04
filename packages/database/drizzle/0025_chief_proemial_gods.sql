DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_membership_status') THEN
    CREATE TYPE "public"."admin_membership_status" AS ENUM('ACTIVE', 'REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE "public"."admin_role" AS ENUM('ADMIN', 'SUPER_ADMIN', 'ROOM_STATUS_VIEWER');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'SUPER_ADMIN'
  ) THEN
    ALTER TYPE "public"."user_role" ADD VALUE 'SUPER_ADMIN' BEFORE 'CUSTOMER';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'ROOM_STATUS_VIEWER'
  ) THEN
    ALTER TYPE "public"."user_role" ADD VALUE 'ROOM_STATUS_VIEWER' BEFORE 'CUSTOMER';
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "catalog_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_departments_code_nonempty_ck" CHECK (btrim("admin_departments"."code") <> ''),
	CONSTRAINT "admin_departments_name_nonempty_ck" CHECK (btrim("admin_departments"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"role" "admin_role" NOT NULL,
	"status" "admin_membership_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_memberships_revoked_at_ck" CHECK (("admin_memberships"."status" = 'ACTIVE' AND "admin_memberships"."revoked_at" IS NULL)
          OR ("admin_memberships"."status" = 'REVOKED' AND "admin_memberships"."revoked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"job_title" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_memberships_user_fk') THEN
    ALTER TABLE "admin_memberships" ADD CONSTRAINT "admin_memberships_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_memberships_department_fk') THEN
    ALTER TABLE "admin_memberships" ADD CONSTRAINT "admin_memberships_department_fk" FOREIGN KEY ("department_id") REFERENCES "public"."admin_departments"("id") ON DELETE restrict;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_profiles_user_fk') THEN
    ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_departments_code_uq" ON "admin_departments" USING btree (upper("code"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_memberships_user_department_uq" ON "admin_memberships" USING btree ("user_id","department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_memberships_user_status_idx" ON "admin_memberships" USING btree ("user_id","status");
