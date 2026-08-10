CREATE TABLE "admin_property_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid,
	"status" "admin_membership_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_property_memberships_revoked_at_ck" CHECK (("admin_property_memberships"."status" = 'ACTIVE' AND "admin_property_memberships"."revoked_at" IS NULL)
          OR ("admin_property_memberships"."status" = 'REVOKED' AND "admin_property_memberships"."revoked_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "admin_property_memberships" ADD CONSTRAINT "admin_property_memberships_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_property_memberships" ADD CONSTRAINT "admin_property_memberships_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_property_memberships_user_property_active_uq" ON "admin_property_memberships" USING btree ("user_id",COALESCE("property_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "admin_property_memberships"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "admin_property_memberships_user_status_idx" ON "admin_property_memberships" USING btree ("user_id","status");

-- Backfill: give every existing admin/room-status-viewer user a property
-- membership row pointing at the single currently-ACTIVE property.
-- This preserves current access behaviour for every existing admin after the
-- migration and ensures no lockout. Idempotent via ON CONFLICT DO NOTHING.
-- 23 physical rooms are untouched; only membership rows are added here.
DO $$
DECLARE
  active_property_id uuid;
BEGIN
  SELECT id
    INTO active_property_id
    FROM properties
    WHERE status = 'ACTIVE'
    ORDER BY created_at, id
    LIMIT 1;

  IF active_property_id IS NULL THEN
    -- No active property in this environment (e.g. blank test database).
    -- Backfill is a no-op; admins without rows will be handled by migration
    -- logic or environment-specific seeding.
    RETURN;
  END IF;

  INSERT INTO admin_property_memberships (user_id, property_id, status)
  SELECT u.id, active_property_id, 'ACTIVE'
  FROM users u
  WHERE u.role::text IN ('ADMIN', 'SUPER_ADMIN', 'ROOM_STATUS_VIEWER')
    AND u.status = 'ACTIVE'
  ON CONFLICT DO NOTHING;
END $$;