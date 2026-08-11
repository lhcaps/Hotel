import { AdminAccessService } from '../../src/admin/admin-access.service.js';
import { type ActorContext } from '../../src/auth/actor-context.js';
import { createTestDatabase } from '../test-database.js';
import {
  adminDepartments,
  adminMemberships,
  adminPropertyMemberships,
  properties,
  users,
  type DatabaseClient,
} from '@room/database';
import { BadRequestException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

describe('STAFF_MANAGER authorization', () => {
  let database: DatabaseClient;
  let service: AdminAccessService;
  let cleanup: () => Promise<void>;

  let propertyId: string;
  let departmentId: string;
  let staffManagerUserId: string;
  let ordinaryStaffUserId: string;
  let superAdminUserId: string;
  let operationsManagerUserId: string;

  beforeAll(async () => {
    ({ database, cleanup } = await createTestDatabase());
    service = new AdminAccessService(database);
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await database.delete(adminPropertyMemberships);
    await database.delete(adminMemberships);
    await database.delete(users).where(sql`${users.role}::text != 'CUSTOMER'`);
    await database.delete(adminDepartments);
    await database.delete(properties);

    const [property] = await database
      .insert(properties)
      .values({ code: 'TEST', name: 'Test Property', status: 'ACTIVE' })
      .returning();
    propertyId = property!.id;

    const [department] = await database
      .insert(adminDepartments)
      .values({ code: 'HOUSEKEEPING', name: 'Housekeeping Department', status: 'ACTIVE' })
      .returning();
    departmentId = department!.id;

    const [staffManager] = await database
      .insert(users)
      .values({
        email: 'staff-manager@test.local',
        name: 'Staff Manager',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      .returning();
    staffManagerUserId = staffManager!.id;
    await database.insert(adminMemberships).values({
      userId: staffManagerUserId,
      departmentId,
      role: 'STAFF_MANAGER',
      status: 'ACTIVE',
    });
    await database.insert(adminPropertyMemberships).values({
      userId: staffManagerUserId,
      propertyId,
      status: 'ACTIVE',
    });

    const [staff] = await database
      .insert(users)
      .values({
        email: 'staff@test.local',
        name: 'Ordinary Staff',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      .returning();
    ordinaryStaffUserId = staff!.id;
    await database.insert(adminMemberships).values({
      userId: ordinaryStaffUserId,
      departmentId,
      role: 'HOUSEKEEPING_STAFF',
      status: 'ACTIVE',
    });
    await database.insert(adminPropertyMemberships).values({
      userId: ordinaryStaffUserId,
      propertyId,
      status: 'ACTIVE',
    });

    const [superAdmin] = await database
      .insert(users)
      .values({
        email: 'super@test.local',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      })
      .returning();
    superAdminUserId = superAdmin!.id;
    await database.insert(adminPropertyMemberships).values({
      userId: superAdminUserId,
      propertyId: null,
      status: 'ACTIVE',
    });

    const [opsManager] = await database
      .insert(users)
      .values({
        email: 'ops@test.local',
        name: 'Operations Manager',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      .returning();
    operationsManagerUserId = opsManager!.id;
    await database.insert(adminMemberships).values({
      userId: operationsManagerUserId,
      departmentId,
      role: 'OPERATIONS_MANAGER',
      status: 'ACTIVE',
    });
    await database.insert(adminPropertyMemberships).values({
      userId: operationsManagerUserId,
      propertyId,
      status: 'ACTIVE',
    });
  });

  function staffManagerActor(): ActorContext {
    return {
      userId: staffManagerUserId,
      profileCode: 'STAFF_MANAGER',
      propertyIds: [propertyId],
    };
  }

  describe('delegation constraints', () => {
    test('ALLOW: STAFF_MANAGER can assign allowed operational profile', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
          role: 'HOUSEKEEPING_MANAGER',
        }),
      ).resolves.toMatchObject({ profileCode: 'HOUSEKEEPING_MANAGER' });
    });

    test('DENY: STAFF_MANAGER cannot grant SUPER_ADMIN', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
          role: 'SUPER_ADMIN',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
          role: 'SUPER_ADMIN',
        }),
      ).rejects.toMatchObject({ response: { code: 'STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN' } });
    });

    test('DENY: STAFF_MANAGER cannot target existing SUPER_ADMIN', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), superAdminUserId, {
          status: 'DISABLED',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAccount(staffManagerActor(), superAdminUserId, {
          status: 'DISABLED',
        }),
      ).rejects.toMatchObject({ response: { code: 'STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN' } });
    });

    test('DENY: STAFF_MANAGER cannot grant STAFF_MANAGER', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
          role: 'STAFF_MANAGER',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
          role: 'STAFF_MANAGER',
        }),
      ).rejects.toMatchObject({ response: { code: 'STAFF_MANAGER_GRANT_SELF_FORBIDDEN' } });
    });

    test('DENY: STAFF_MANAGER cannot grant OPERATIONS_MANAGER', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
          role: 'OPERATIONS_MANAGER',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
          role: 'OPERATIONS_MANAGER',
        }),
      ).rejects.toMatchObject({ response: { code: 'STAFF_MANAGER_ESCALATION_FORBIDDEN' } });
    });

    test('DENY: STAFF_MANAGER cannot modify profile stronger than allowed set', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), operationsManagerUserId, {
          status: 'DISABLED',
        }),
      ).resolves.toBeTruthy();
    });
  });

  describe('self-escalation prevention', () => {
    test('DENY: STAFF_MANAGER cannot change own profile', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), staffManagerUserId, {
          role: 'SUPER_ADMIN',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAccount(staffManagerActor(), staffManagerUserId, {
          role: 'SUPER_ADMIN',
        }),
      ).rejects.toMatchObject({ response: { code: 'SELF_PROFILE_CHANGE_FORBIDDEN' } });
    });

    test('DENY: STAFF_MANAGER cannot change own membership', async () => {
      await expect(
        service.updateAccount(staffManagerActor(), staffManagerUserId, {
          departmentIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAccount(staffManagerActor(), staffManagerUserId, {
          departmentIds: [],
        }),
      ).rejects.toMatchObject({ response: { code: 'SELF_MEMBERSHIP_CHANGE_FORBIDDEN' } });
    });
  });

  describe('allowed profiles', () => {
    const allowedProfiles: Array<
      | 'ROOM_STATUS_VIEWER'
      | 'HOUSEKEEPING_MANAGER'
      | 'HOUSEKEEPING_STAFF'
      | 'PAYMENT_STAFF'
      | 'MAINTENANCE_MANAGER'
      | 'MAINTENANCE_STAFF'
    > = [
      'ROOM_STATUS_VIEWER',
      'HOUSEKEEPING_MANAGER',
      'HOUSEKEEPING_STAFF',
      'PAYMENT_STAFF',
      'MAINTENANCE_MANAGER',
      'MAINTENANCE_STAFF',
    ];

    test.each(allowedProfiles)('ALLOW: STAFF_MANAGER can grant %s', async (profile) => {
      await expect(
        service.updateAccount(staffManagerActor(), ordinaryStaffUserId, { role: profile }),
      ).resolves.toMatchObject({ profileCode: profile });
    });
  });

  describe('audit trail', () => {
    test('staff mutation appends audit event', async () => {
      const auditBefore = await service.listAudit();
      await service.updateAccount(staffManagerActor(), ordinaryStaffUserId, {
        role: 'PAYMENT_STAFF',
      });
      const auditAfter = await service.listAudit();
      expect(auditAfter.items.length).toBeGreaterThan(auditBefore.items.length);
      const recentEvent = auditAfter.items[0];
      expect(recentEvent?.eventType).toBe('ADMIN_ACCOUNT_UPDATED');
      expect(recentEvent?.actorId).toBe(staffManagerUserId);
    });
  });
});
