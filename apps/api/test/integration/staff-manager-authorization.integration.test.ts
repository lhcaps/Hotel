import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  createDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  adminMemberships,
  adminProfiles,
  adminPropertyMemberships,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { AdminAccessService } from '../../src/admin/admin-access.service.js';
import type { ActorContext } from '../../src/auth/actor-context.js';

const ids = {
  property: '770e8400-e29b-41d4-a716-446655440101',
  otherProperty: '770e8400-e29b-41d4-a716-446655440102',
  department: '770e8400-e29b-41d4-a716-446655440201',
  staffManager: '770e8400-e29b-41d4-a716-446655440301',
  targetStaff: '770e8400-e29b-41d4-a716-446655440302',
  superAdmin: '770e8400-e29b-41d4-a716-446655440303',
  operationsManager: '770e8400-e29b-41d4-a716-446655440304',
};

describe('STAFF_MANAGER authorization', () => {
  let guarded: GuardedTestDatabase;
  let db: DatabaseClient;
  let service: AdminAccessService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) {
      throw new Error('TEST_DATABASE_URL is required for STAFF_MANAGER integration tests');
    }
    guarded = await createPreparedGuardedTestDatabase(url, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    db = createDatabaseClient(guarded.pool);

    // Insert fixture data once using raw SQL
    await guarded.pool.query(
      `INSERT INTO properties (id, code, name) VALUES ($1, 'TEST_PROP', 'Test Property'), ($2, 'OTHER_PROP', 'Other Property')`,
      [ids.property, ids.otherProperty],
    );

    await guarded.pool.query(
      `INSERT INTO admin_departments (id, code, name) VALUES ($1, 'OPS', 'Operations')`,
      [ids.department],
    );

    await guarded.pool.query(
      `INSERT INTO users (id, email, name, role) VALUES 
        ($1, 'staff-manager@test.local', 'Staff Manager', 'ADMIN'),
        ($2, 'target-staff@test.local', 'Target Staff', 'ADMIN'),
        ($3, 'super-admin@test.local', 'Super Admin', 'ADMIN'),
        ($4, 'operations-manager@test.local', 'Operations Manager', 'ADMIN')`,
      [ids.staffManager, ids.targetStaff, ids.superAdmin, ids.operationsManager],
    );

    service = new AdminAccessService(db);
  });

  afterAll(async () => {
    await guarded.dispose();
  });

  beforeEach(async () => {
    // Clean only admin-specific tables that we'll re-populate
    await db.delete(adminPropertyMemberships);
    await db.delete(adminMemberships);
    await db.delete(adminProfiles);

    // Re-insert admin profiles (no 'role' field in adminProfiles table)
    await db
      .insert(adminProfiles)
      .values([
        { userId: ids.staffManager },
        { userId: ids.targetStaff },
        { userId: ids.superAdmin },
        { userId: ids.operationsManager },
      ]);

    await db.insert(adminMemberships).values([
      { userId: ids.staffManager, departmentId: ids.department, role: 'STAFF_MANAGER' },
      { userId: ids.targetStaff, departmentId: ids.department, role: 'HOUSEKEEPING_STAFF' },
      { userId: ids.superAdmin, departmentId: ids.department, role: 'SUPER_ADMIN' },
      { userId: ids.operationsManager, departmentId: ids.department, role: 'OPERATIONS_MANAGER' },
    ]);

    await db.insert(adminPropertyMemberships).values([
      { userId: ids.staffManager, propertyId: ids.property },
      { userId: ids.targetStaff, propertyId: ids.property },
    ]);
  });

  const staffManagerActor: ActorContext = {
    userId: ids.staffManager,
    email: 'staff-manager@test.local',
    displayName: 'Staff Manager',
    role: 'ADMIN',
    profileCode: 'STAFF_MANAGER',
    permissions: [
      'dashboard.read',
      'admin.account.read',
      'admin.account.manage',
      'admin.department.read',
      'admin.department.manage',
      'admin.audit.read',
      'catalog.property.read',
    ],
    propertyIds: [ids.property],
    sessionId: 'test-session-id',
    sessionExpiresAt: new Date(Date.now() + 3600000),
    requestId: 'test-request-id',
  };

  describe('delegation constraints', () => {
    test('ALLOW: STAFF_MANAGER can assign allowed operational profile', async () => {
      await service.updateAccount(staffManagerActor, ids.targetStaff, {
        role: 'HOUSEKEEPING_MANAGER',
        departmentIds: [ids.department],
      });

      const membership = await db.query.adminMemberships.findFirst({
        where: (memberships, { eq }) => eq(memberships.userId, ids.targetStaff),
      });
      expect(membership?.role).toBe('HOUSEKEEPING_MANAGER');
    });

    test('DENY: STAFF_MANAGER cannot grant SUPER_ADMIN', async () => {
      await expect(
        service.updateAccount(staffManagerActor, ids.targetStaff, {
          role: 'SUPER_ADMIN',
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN' },
      });
    });

    test('DENY: STAFF_MANAGER cannot target existing SUPER_ADMIN', async () => {
      await expect(
        service.updateAccount(staffManagerActor, ids.superAdmin, {
          role: 'HOUSEKEEPING_STAFF',
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN' },
      });
    });

    test('DENY: STAFF_MANAGER cannot grant STAFF_MANAGER', async () => {
      await expect(
        service.updateAccount(staffManagerActor, ids.targetStaff, {
          role: 'STAFF_MANAGER',
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'STAFF_MANAGER_GRANT_SELF_FORBIDDEN' },
      });
    });

    test('DENY: STAFF_MANAGER cannot grant OPERATIONS_MANAGER', async () => {
      await expect(
        service.updateAccount(staffManagerActor, ids.targetStaff, {
          role: 'OPERATIONS_MANAGER',
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'STAFF_MANAGER_ESCALATION_FORBIDDEN' },
      });
    });

    test('DENY: STAFF_MANAGER cannot modify profile stronger than allowed set', async () => {
      await expect(
        service.updateAccount(staffManagerActor, ids.operationsManager, {
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'STAFF_MANAGER_PROFILE_NOT_DELEGABLE' },
      });
    });
  });

  describe('self-escalation prevention', () => {
    test('DENY: STAFF_MANAGER cannot change own profile', async () => {
      await expect(
        service.updateAccount(staffManagerActor, ids.staffManager, {
          role: 'OPERATIONS_MANAGER',
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'SELF_PROFILE_CHANGE_FORBIDDEN' },
      });
    });

    test('DENY: STAFF_MANAGER cannot change own membership', async () => {
      await expect(
        service.updateAccount(staffManagerActor, ids.staffManager, {
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'SELF_MEMBERSHIP_CHANGE_FORBIDDEN' },
      });
    });
  });

  describe('allowed profiles', () => {
    const allowedProfiles = [
      'ROOM_STATUS_VIEWER',
      'HOUSEKEEPING_MANAGER',
      'HOUSEKEEPING_STAFF',
      'PAYMENT_STAFF',
      'MAINTENANCE_MANAGER',
      'MAINTENANCE_STAFF',
    ] as const;

    test.each(allowedProfiles)('ALLOW: STAFF_MANAGER can grant %s', async (profileCode) => {
      await service.updateAccount(staffManagerActor, ids.targetStaff, {
        role: profileCode,
        departmentIds: [ids.department],
      });

      const membership = await db.query.adminMemberships.findFirst({
        where: (memberships, { eq }) => eq(memberships.userId, ids.targetStaff),
      });
      expect(membership?.role).toBe(profileCode);
    });
  });

  describe('audit trail', () => {
    test('staff mutation appends audit event', async () => {
      const beforeCount = await db.query.auditEvents.findMany();
      const initialCount = beforeCount.length;

      await service.updateAccount(staffManagerActor, ids.targetStaff, {
        role: 'HOUSEKEEPING_STAFF',
        departmentIds: [ids.department],
      });

      const afterCount = await db.query.auditEvents.findMany();
      expect(afterCount.length).toBeGreaterThan(initialCount);

      const latest = afterCount[afterCount.length - 1];
      if (latest === undefined) {
        throw new Error('Expected at least one audit event');
      }
      expect(latest.actorId).toBe(ids.staffManager);
      expect(latest.eventType).toContain('ADMIN_ACCOUNT');
    });
  });

  describe('property-scoped delegation', () => {
    test('ALLOW: STAFF_MANAGER can manage staff in same property', async () => {
      // Both manager and target have property membership
      await service.updateAccount(staffManagerActor, ids.targetStaff, {
        role: 'HOUSEKEEPING_MANAGER',
        departmentIds: [ids.department],
      });

      const membership = await db.query.adminMemberships.findFirst({
        where: (memberships, { eq }) => eq(memberships.userId, ids.targetStaff),
      });
      expect(membership?.role).toBe('HOUSEKEEPING_MANAGER');
    });

    test('DENY: STAFF_MANAGER cannot manage staff in different property', async () => {
      // Create staff member with different property membership
      const otherStaffId = '770e8400-e29b-41d4-a716-446655440399';
      await guarded.pool.query(
        `INSERT INTO users (id, email, name, role) VALUES ($1, 'other-staff@test.local', 'Other Staff', 'ADMIN')`,
        [otherStaffId],
      );
      await db.insert(adminProfiles).values({ userId: otherStaffId });
      await db.insert(adminMemberships).values({
        userId: otherStaffId,
        departmentId: ids.department,
        role: 'HOUSEKEEPING_STAFF',
      });
      await db.insert(adminPropertyMemberships).values({
        userId: otherStaffId,
        propertyId: ids.otherProperty,
      });

      await expect(
        service.updateAccount(staffManagerActor, otherStaffId, {
          role: 'HOUSEKEEPING_MANAGER',
          departmentIds: [ids.department],
        }),
      ).rejects.toMatchObject({
        response: { code: 'STAFF_MANAGER_PROPERTY_SCOPE_VIOLATION' },
      });
    });

    test('ALLOW: STAFF_MANAGER can manage staff with no property membership', async () => {
      // Create staff member without property membership
      const noPropertyStaffId = '770e8400-e29b-41d4-a716-446655440398';
      await guarded.pool.query(
        `INSERT INTO users (id, email, name, role) VALUES ($1, 'no-prop-staff@test.local', 'No Property Staff', 'ADMIN')`,
        [noPropertyStaffId],
      );
      await db.insert(adminProfiles).values({ userId: noPropertyStaffId });
      await db.insert(adminMemberships).values({
        userId: noPropertyStaffId,
        departmentId: ids.department,
        role: 'PAYMENT_STAFF',
      });

      await service.updateAccount(staffManagerActor, noPropertyStaffId, {
        role: 'HOUSEKEEPING_STAFF',
        departmentIds: [ids.department],
      });

      const membership = await db.query.adminMemberships.findFirst({
        where: (memberships, { eq }) => eq(memberships.userId, noPropertyStaffId),
      });
      expect(membership?.role).toBe('HOUSEKEEPING_STAFF');
    });
  });
});
