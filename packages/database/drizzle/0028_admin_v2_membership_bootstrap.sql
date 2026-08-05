DO $$
DECLARE
  default_department_id uuid;
BEGIN
  SELECT id
    INTO default_department_id
    FROM "admin_departments"
    ORDER BY CASE WHEN "status" = 'ACTIVE' THEN 0 ELSE 1 END, "created_at", id
    LIMIT 1;

  IF default_department_id IS NULL THEN
    INSERT INTO "admin_departments" ("code", "name", "status")
    VALUES ('OPERATIONS', 'Vận hành', 'ACTIVE')
    RETURNING id INTO default_department_id;
  END IF;

  INSERT INTO "admin_profiles" ("user_id")
  SELECT id
  FROM "users"
  WHERE "role"::text IN ('SUPER_ADMIN', 'ROOM_STATUS_VIEWER')
  ON CONFLICT ("user_id") DO NOTHING;

  INSERT INTO "admin_memberships" ("user_id", "department_id", "role", "status")
  SELECT
    u.id,
    default_department_id,
    u.role::text::"admin_role",
    'ACTIVE'
  FROM "users" u
  WHERE u.role::text IN ('SUPER_ADMIN', 'ROOM_STATUS_VIEWER')
    AND NOT EXISTS (
      SELECT 1
      FROM "admin_memberships" membership
      WHERE membership.user_id = u.id
    )
  ON CONFLICT ("user_id", "department_id") DO NOTHING;
END $$;
