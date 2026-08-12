import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  applyMigrationsFromFolder,
  buildTrimmedDrizzleFolder,
  createTrimmedMigratedTestDatabase,
  disposeTrimmedDrizzleFolder,
} from './migration-folder.js';

async function supportsStaffManager(database: GuardedTestDatabase): Promise<boolean> {
  const result = await database.pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM pg_enum value
         JOIN pg_type type ON type.oid = value.enumtypid
        WHERE type.typname = 'admin_role'
          AND value.enumlabel = 'STAFF_MANAGER'
     ) AS exists`,
  );
  return result.rows[0]?.exists === true;
}

async function insertsStaffManagerMembership(database: GuardedTestDatabase): Promise<string> {
  const result = await database.pool.query<{ role: string }>(
    `WITH user_row AS (
       INSERT INTO users (id, name, email, email_verified, role, status)
       VALUES ('650e8400-e29b-41d4-a716-446655440001', 'Staff manager', 'staff-manager@test.example', true, 'ADMIN', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'
       RETURNING id
     ), department_row AS (
       INSERT INTO admin_departments (id, code, name, status)
       VALUES ('650e8400-e29b-41d4-a716-446655440002', 'STAFF', 'Staff', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'
       RETURNING id
     )
     INSERT INTO admin_memberships (user_id, department_id, role, status)
     SELECT user_row.id, department_row.id, 'STAFF_MANAGER', 'ACTIVE'
       FROM user_row CROSS JOIN department_row
     ON CONFLICT (user_id, department_id) DO UPDATE
       SET role = EXCLUDED.role, status = EXCLUDED.status
     RETURNING role::text AS role`,
  );
  return result.rows[0]?.role ?? '';
}

describe('migration 0038 STAFF_MANAGER enum', () => {
  let fresh: GuardedTestDatabase;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    fresh = await createTrimmedMigratedTestDatabase(url, 38);
  });

  afterAll(async () => {
    await fresh?.dispose();
  });

  it('fresh 0000..0038 migration includes STAFF_MANAGER', async () => {
    expect(await supportsStaffManager(fresh)).toBe(true);
    expect(await insertsStaffManagerMembership(fresh)).toBe('STAFF_MANAGER');
  });
});

describe('migration 0038 STAFF_MANAGER upgrade', () => {
  let upgraded: GuardedTestDatabase;
  let folder: string;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    upgraded = await createTrimmedMigratedTestDatabase(url, 37);
    folder = buildTrimmedDrizzleFolder(38);
    await applyMigrationsFromFolder(upgraded.databaseUrl, folder);
  });

  afterAll(async () => {
    if (folder !== undefined) disposeTrimmedDrizzleFolder(folder);
    await upgraded?.dispose();
  });

  it('upgrades 0037 databases to accept STAFF_MANAGER memberships', async () => {
    expect(await supportsStaffManager(upgraded)).toBe(true);
    expect(await insertsStaffManagerMembership(upgraded)).toBe('STAFF_MANAGER');
  });
});
