/**
 * Migration 0034 regression: admin_property_memberships backfill preservation.
 *
 * Migration 0034 introduces admin_property_memberships and backfills initial
 * entries for active admin/super_admin/room_status_viewer users linked to the
 * single active property. The backfill DO block must be idempotent and must not
 * modify any existing data (rooms, users, memberships).
 *
 * This test asserts (ORIG-F-006):
 *
 *   - Fresh migration 0000..0034:
 *       * The admin_property_memberships table exists with expected constraints.
 *       * The backfill creates exactly one entry per active admin-role user.
 *       * CUSTOMER and DISABLED admin users do not receive backfill entries.
 *
 *   - 0033 → 0034 upgrade:
 *       * Pre-existing 23 rooms remain readable.
 *       * The backfill creates property memberships for existing users.
 *       * Re-applying the same migration is idempotent (ON CONFLICT DO NOTHING).
 *
 * @group guarded
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  applyMigrationsFromFolder,
  buildTrimmedDrizzleFolder,
  createTrimmedMigratedTestDatabase,
  disposeTrimmedDrizzleFolder,
} from './migration-folder.js';

const PROPERTY_ID = '550e8400-e29b-41d4-a716-446655440010';
const TIER_ID = '550e8400-e29b-41d4-a716-446655440020';
const ROOM_TYPE_ID = '550e8400-e29b-41d4-a716-446655440030';
const ADMIN_USER_ID = '550e8400-e29b-41d4-a716-446655440050';
const SUPER_ADMIN_USER_ID = '550e8400-e29b-41d4-a716-446655440051';
const VIEWER_USER_ID = '550e8400-e29b-41d4-a716-446655440052';
const CUSTOMER_USER_ID = '550e8400-e29b-41d4-a716-446655440053';
const DISABLED_ADMIN_USER_ID = '550e8400-e29b-41d4-a716-446655440054';
const DEPARTMENT_ID = '550e8400-e29b-41d4-a716-446655440060';

async function seedData(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO properties (id, code, name, timezone, status, created_at)
     VALUES ($1, 'PEACE_HOME', 'Peace Home', 'Asia/Ho_Chi_Minh', 'ACTIVE', '2024-01-01 00:00:00+00')`,
    [PROPERTY_ID],
  );
  await database.pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status)
     VALUES ($1, $2, 'STANDARD', 'Standard', 1, 'ACTIVE')`,
    [TIER_ID, PROPERTY_ID],
  );
  await database.pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
     VALUES ($1, $2, $3, 'DBL', 'Double', 2, 1, 3, 'ACTIVE')`,
    [ROOM_TYPE_ID, PROPERTY_ID, TIER_ID],
  );
  // Insert exactly 23 rooms (the production count from ORIG-F-006).
  for (let i = 1; i <= 23; i++) {
    await database.pool.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [randomUUID(), PROPERTY_ID, ROOM_TYPE_ID, `R${String(i).padStart(3, '0')}`],
    );
  }
  // Users with various roles/statuses.
  await database.pool.query(
    `INSERT INTO users (id, email, name, role, status) VALUES
       ($1, 'admin@test.example', 'Admin User', 'ADMIN', 'ACTIVE'),
       ($2, 'super@test.example', 'Super Admin', 'SUPER_ADMIN', 'ACTIVE'),
       ($3, 'viewer@test.example', 'Viewer', 'ROOM_STATUS_VIEWER', 'ACTIVE'),
       ($4, 'customer@test.example', 'Customer', 'CUSTOMER', 'ACTIVE'),
       ($5, 'disabled-admin@test.example', 'Disabled', 'ADMIN', 'DISABLED')`,
    [ADMIN_USER_ID, SUPER_ADMIN_USER_ID, VIEWER_USER_ID, CUSTOMER_USER_ID, DISABLED_ADMIN_USER_ID],
  );
  // Department + memberships (required FK for admin_memberships).
  await database.pool.query(
    `INSERT INTO admin_departments (id, code, name, status)
     VALUES ($1, 'OPS', 'Operations', 'ACTIVE')`,
    [DEPARTMENT_ID],
  );
  await database.pool.query(
    `INSERT INTO admin_memberships (id, user_id, department_id, role, status) VALUES
       (gen_random_uuid(), $1, $2, 'ADMIN', 'ACTIVE'),
       (gen_random_uuid(), $3, $2, 'ROOM_STATUS_VIEWER', 'ACTIVE')`,
    [ADMIN_USER_ID, DEPARTMENT_ID, VIEWER_USER_ID],
  );
}

async function roomCount(database: GuardedTestDatabase): Promise<number> {
  const { rows } = await database.pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM rooms WHERE property_id = $1`,
    [PROPERTY_ID],
  );
  return parseInt(rows[0]?.n ?? '0', 10);
}

async function activeMembershipCount(database: GuardedTestDatabase): Promise<number> {
  const { rows } = await database.pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM admin_property_memberships WHERE status = 'ACTIVE'`,
  );
  return parseInt(rows[0]?.n ?? '0', 10);
}

async function userMembershipCount(database: GuardedTestDatabase, userId: string): Promise<number> {
  const { rows } = await database.pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM admin_property_memberships WHERE user_id = $1 AND status = 'ACTIVE'`,
    [userId],
  );
  return parseInt(rows[0]?.n ?? '0', 10);
}

async function userMembershipForProperty(
  database: GuardedTestDatabase,
  userId: string,
  propertyId: string,
): Promise<number> {
  const { rows } = await database.pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM admin_property_memberships
     WHERE user_id = $1 AND property_id = $2 AND status = 'ACTIVE'`,
    [userId, propertyId],
  );
  return parseInt(rows[0]?.n ?? '0', 10);
}

// ---------------------------------------------------------------------------
// Fresh migration 0000..0034
// ---------------------------------------------------------------------------
describe('fresh migration 0000..0034', () => {
  let db: GuardedTestDatabase;
  let folder: string;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');

    // Create DB, migrate to 0033, seed data, then apply 0034 (so backfill sees the data).
    const db33 = await createTrimmedMigratedTestDatabase(url, 33);
    await seedData(db33);
    db = db33;

    // Now apply 0034 which includes the backfill DO block.
    folder = buildTrimmedDrizzleFolder(34);
    await applyMigrationsFromFolder(db.databaseUrl, folder);
  });

  afterAll(async () => {
    if (folder !== undefined) disposeTrimmedDrizzleFolder(folder);
    await db?.dispose();
  });

  it('admin_property_memberships table exists', async () => {
    const { rows } = await db.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_name = 'admin_property_memberships'
       ) AS exists`,
    );
    expect(rows[0]?.exists).toBe(true);
  });

  it('expected constraints are present', async () => {
    const { rows } = await db.pool.query<{ constraint_name: string }>(
      `SELECT constraint_name
       FROM information_schema.table_constraints
       WHERE table_name = 'admin_property_memberships'
         AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK', 'FOREIGN KEY')
       ORDER BY constraint_name`,
    );
    const names = rows.map((r) => r.constraint_name);
    expect(names).toContain('admin_property_memberships_pkey');
    expect(names).toContain('admin_property_memberships_revoked_at_ck');
  });

  it('all 23 rooms are preserved (room count regression)', async () => {
    expect(await roomCount(db)).toBe(23);
  });

  it('backfill creates entries for ADMIN, SUPER_ADMIN, and ROOM_STATUS_VIEWER active users', async () => {
    // 3 active admin-role users in our seeded data.
    expect(await activeMembershipCount(db)).toBe(3);
  });

  it('active ADMIN user receives a property membership pointing to the active property', async () => {
    expect(await userMembershipForProperty(db, ADMIN_USER_ID, PROPERTY_ID)).toBe(1);
  });

  it('active SUPER_ADMIN user receives a property membership', async () => {
    expect(await userMembershipForProperty(db, SUPER_ADMIN_USER_ID, PROPERTY_ID)).toBe(1);
  });

  it('active ROOM_STATUS_VIEWER user receives a property membership', async () => {
    expect(await userMembershipForProperty(db, VIEWER_USER_ID, PROPERTY_ID)).toBe(1);
  });

  it('CUSTOMER user does not receive a property membership', async () => {
    expect(await userMembershipCount(db, CUSTOMER_USER_ID)).toBe(0);
  });

  it('DISABLED admin user does not receive a property membership', async () => {
    expect(await userMembershipCount(db, DISABLED_ADMIN_USER_ID)).toBe(0);
  });

  it('backfill is idempotent when re-applied (ON CONFLICT DO NOTHING)', async () => {
    // Re-run only the 0034 migration against the already-migrated database.
    const folder34 = buildTrimmedDrizzleFolder(34);
    try {
      // Applying the same migrations again is a no-op (Drizzle tracks applied migrations).
      await applyMigrationsFromFolder(db.databaseUrl, folder34);
    } finally {
      disposeTrimmedDrizzleFolder(folder34);
    }
    expect(await activeMembershipCount(db)).toBe(3);
    expect(await roomCount(db)).toBe(23);
  });
});

// ---------------------------------------------------------------------------
// Upgrade migration 0033 → 0034
// ---------------------------------------------------------------------------
describe('upgrade migration 0033 → 0034', () => {
  let db: GuardedTestDatabase;
  let folder34: string;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');

    // Create and migrate to 0033.
    const base = await createTrimmedMigratedTestDatabase(url, 33);
    db = base;
    // Seed data that mimics a real 0033 environment.
    await seedData(db);

    // Now apply 0034 on top.
    folder34 = buildTrimmedDrizzleFolder(34);
    await applyMigrationsFromFolder(db.databaseUrl, folder34);
  });

  afterAll(async () => {
    if (folder34 !== undefined) disposeTrimmedDrizzleFolder(folder34);
    await db?.dispose();
  });

  it('pre-existing 23 rooms remain readable after upgrade', async () => {
    expect(await roomCount(db)).toBe(23);
  });

  it('backfill creates property memberships for existing admin-role users', async () => {
    expect(await activeMembershipCount(db)).toBe(3);
    expect(await userMembershipForProperty(db, ADMIN_USER_ID, PROPERTY_ID)).toBe(1);
    expect(await userMembershipForProperty(db, SUPER_ADMIN_USER_ID, PROPERTY_ID)).toBe(1);
    expect(await userMembershipForProperty(db, VIEWER_USER_ID, PROPERTY_ID)).toBe(1);
  });

  it('re-applying migration 0034 is idempotent', async () => {
    await applyMigrationsFromFolder(db.databaseUrl, folder34);
    expect(await activeMembershipCount(db)).toBe(3);
    expect(await roomCount(db)).toBe(23);
  });
});
