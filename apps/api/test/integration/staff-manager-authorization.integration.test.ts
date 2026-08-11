import { beforeEach, describe, expect, test } from 'vitest';
import { db } from '@room/database';
import { adminMemberships, adminProfiles, adminPropertyMemberships } from '@room/database/schema';
import { eq } from 'drizzle-orm';
import { AdminAccessService } from '../../src/admin/admin-access.service';
import type { ActorContext } from '../../src/admin/admin-access.service';

describe('STAFF_MANAGER authorization', () => {
  let service: AdminAccessService;
  let staffManagerId: string;
  let targetStaffId: string;
  let superAdminId: string;
  let operationsManagerId: string;
  let propertyId: string;
  let otherPropertyId: string;
  let departmentId: string;

  beforeEach(async () => {
    service = new AdminAccessService(db);

    const property = await db.query.properties.findFirst({
      where: (properties, { eq }) => eq(properties.name, 'Playwright'),
    });
    if (!property) throw new Error('Playwright property not found');
    propertyId = property.id;

    const otherProperty = await db.query.properties.findFirst({
      where: (properties, { ne }) => ne(properties.id, propertyId),
    });
    if (!otherProperty) throw new Error('Second property not found');
    otherPropertyId = otherProperty.id;

    const department = await db.query.adminDepartments.findFirst({
      where: (departments, { eq }) => eq(departments.name, 'Operations'),
    });
    if (!department) throw new Error('Operations department not found');
    departmentId = department.id;

    const staffManagerUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'staff-manager@test.local'),
    });
    if (!staffManagerUser) throw new Error('STAFF_MANAGER user not found');
    staffManagerId = staffManagerUser.id;

    const targetStaffUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'housekeeping-staff@test.local'),
    });
    if (!targetStaffUser) throw new Error('Target staff user not found');
    targetStaffId = targetStaffUser.id;

    const superAdminUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'super-admin@test.local'),
    });
    if (!superAdminUser) throw new Error('SUPER_ADMIN user not found');
    superAdminId = superAdminUser.id;

    const opsManagerUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'operations-manager@test.local'),
    });
    if (!opsManagerUser) throw new Error('OPERATIONS_MANAGER user not found');
    operationsManagerId = opsManagerUser.id;

    await db.delete(adminPropertyMemberships).where(eq(adminPropertyMemberships.userId, staffManagerId));
    await db.delete(adminMemberships).where(eq(adminMemberships.userId, staffManagerId));
    await db.delete(adminProfiles).where(eq(adminProfiles.userId, staffManagerId));

    await db.insert(adminProfiles).values({
      userId: staffManagerId,
      role: 'STAFF_MANAGER',
    });
    await db.insert(adminMemberships).values({
      userId: staffManagerId,
      departmentId,
    });
    await db.insert(adminPropertyMemberships).values({
      userId: staffManagerId,
      propertyId,
    });
  });

  const staffManagerActor: ActorContext = {
    userId: '',
    profileCode: 'STAFF_MANAGER',
    propertyIds: [],
    permissions: [
      'dashboard.read',
      'admin.account.read',
      'admin.account.manage',
      'admin.department.read',
      'admin.department.manage',
      'admin.audit.read',
      'catalog.property.read',
    ],
  };

  describe('delegation constraints', () => {
    test('ALLOW: STAFF_MANAGER can assign allowed operational profile', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await service.updateAccount(actor, targetStaffId, {
        role: 'HOUSEKEEPING_MANAGER',
        departmentIds: [departmentId],
      });

      const profile = await db.query.adminProfiles.findFirst({
        where: (profiles, { eq }) => eq(profiles.userId, targetStaffId),
      });
      expect(profile?.role).toBe('HOUSEKEEPING_MANAGER');
    });

    test('DENY: STAFF_MANAGER cannot grant SUPER_ADMIN', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await expect(
        service.updateAccount(actor, targetStaffId, {
          role: 'SUPER_ADMIN',
          departmentIds: [departmentId],
        }),
      ).rejects.toThrow('STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN');
    });

    test('DENY: STAFF_MANAGER cannot target existing SUPER_ADMIN', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await expect(
        service.updateAccount(actor, superAdminId, {
          role: 'HOUSEKEEPING_STAFF',
          departmentIds: [departmentId],
        }),
      ).rejects.toThrow('STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN');
    });

    test('DENY: STAFF_MANAGER cannot grant STAFF_MANAGER', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await expect(
        service.updateAccount(actor, targetStaffId, {
          role: 'STAFF_MANAGER',
          departmentIds: [departmentId],
        }),
      ).rejects.toThrow('STAFF_MANAGER_GRANT_SELF_FORBIDDEN');
    });

    test('DENY: STAFF_MANAGER cannot grant OPERATIONS_MANAGER', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await expect(
        service.updateAccount(actor, targetStaffId, {
          role: 'OPERATIONS_MANAGER',
          departmentIds: [departmentId],
        }),
      ).rejects.toThrow('STAFF_MANAGER_ESCALATION_FORBIDDEN');
    });

    test('DENY: STAFF_MANAGER cannot modify profile stronger than allowed set', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await expect(
        service.updateAccount(actor, operationsManagerId, {
          departmentIds: [departmentId],
        }),
      ).rejects.toThrow('STAFF_MANAGER_PROFILE_NOT_DELEGABLE');
    });
  });

  describe('self-escalation prevention', () => {
    test('DENY: STAFF_MANAGER cannot change own profile', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await expect(
        service.updateAccount(actor, staffManagerId, {
          role: 'OPERATIONS_MANAGER',
          departmentIds: [departmentId],
        }),
      ).rejects.toThrow('STAFF_MANAGER_ESCALATION_FORBIDDEN');
    });

    test('DENY: STAFF_MANAGER cannot change own membership', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await expect(
        service.updateAccount(actor, staffManagerId, {
          departmentIds: [departmentId],
        }),
      ).rejects.toThrow('SELF_MEMBERSHIP_CHANGE_FORBIDDEN');
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
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      await service.updateAccount(actor, targetStaffId, {
        role: profileCode,
        departmentIds: [departmentId],
      });

      const profile = await db.query.adminProfiles.findFirst({
        where: (profiles, { eq }) => eq(profiles.userId, targetStaffId),
      });
      expect(profile?.role).toBe(profileCode);
    });
  });

  describe('audit trail', () => {
    test('staff mutation appends audit event', async () => {
      const actor = {
        ...staffManagerActor,
        userId: staffManagerId,
        propertyIds: [propertyId],
      };

      const beforeCount = await db.query.auditEvents.findMany();
      const initialCount = beforeCount.length;

      await service.updateAccount(actor, targetStaffId, {
        role: 'HOUSEKEEPING_STAFF',
        departmentIds: [departmentId],
      });

      const afterCount = await db.query.auditEvents.findMany();
      expect(afterCount.length).toBeGreaterThan(initialCount);

      const latest = afterCount[afterCount.length - 1];
      expect(latest.actorId).toBe(staffManagerId);
      expect(latest.action).toContain('admin.account');
    });
  });
});

