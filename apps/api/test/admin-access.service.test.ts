import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdminAccessService } from '../src/admin/admin-access.service.js';

describe('AdminAccessService', () => {
  it('does not promote a customer through the admin-account endpoint', async () => {
    const customerId = 'customer-id';
    const database = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ id: customerId, role: 'CUSTOMER' }),
        },
      },
    };
    const service = new AdminAccessService(database as never);
    const actor = {
      userId: 'super-admin-id',
      email: 'admin@example.test',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN' as const,
      permissions: [],
      departments: [],
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
    };

    await expect(
      service.updateAccount(actor, customerId, { role: 'SUPER_ADMIN' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restricts Better Auth administrator creation to SUPER_ADMIN', async () => {
    const service = new AdminAccessService({} as never);
    const actor = {
      userId: 'admin-id',
      email: 'admin@example.test',
      displayName: 'Admin',
      role: 'ADMIN' as const,
      permissions: [],
      departments: [],
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
    };

    await expect(
      service.createAccount(actor, {
        displayName: 'New admin',
        email: 'new-admin@example.test',
        password: 'Aa1-strong-password',
        role: 'ADMIN',
      }),
    ).rejects.toMatchObject({ response: { code: 'SUPER_ADMIN_REQUIRED' } });
  });

  it('does not expose customer-account mutations to STAFF_MANAGER', async () => {
    const service = new AdminAccessService({} as never);
    const actor = {
      userId: 'staff-manager-id',
      email: 'staff-manager@example.test',
      displayName: 'Staff Manager',
      role: 'ADMIN' as const,
      profileCode: 'STAFF_MANAGER' as const,
      permissions: [],
      departments: [],
      propertyIds: ['550e8400-e29b-41d4-a716-446655440001'],
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
    };

    await expect(service.listCustomerAccounts(actor)).rejects.toMatchObject({
      response: { code: 'SUPER_ADMIN_REQUIRED' },
    });
    await expect(service.revokeCustomerSessions(actor, 'customer-id')).rejects.toMatchObject({
      response: { code: 'SUPER_ADMIN_REQUIRED' },
    });
  });

  it('requires a department when assigning a V2 profile to a legacy ADMIN', async () => {
    const database = {
      query: {
        users: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'legacy-id', role: 'ADMIN', status: 'ACTIVE' }),
        },
        adminMemberships: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adminPropertyMemberships: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    const service = new AdminAccessService(database as never);
    const actor = {
      userId: 'super-admin-id',
      email: 'admin@example.test',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN' as const,
      profileCode: 'SUPER_ADMIN' as const,
      permissions: [],
      departments: [],
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
    };

    await expect(
      service.updateAccount(actor, 'legacy-id', { role: 'ROOM_STATUS_VIEWER' }),
    ).rejects.toMatchObject({
      response: { code: 'DEPARTMENT_REQUIRED' },
    });
  });
  it('persists active property membership when creating an operational account', async () => {
    const propertyId = '550e8400-e29b-41d4-a716-446655440010';
    const departmentId = '550e8400-e29b-41d4-a716-446655440011';
    const createdId = '550e8400-e29b-41d4-a716-446655440012';
    const inserted: unknown[] = [];
    const createdUser = {
      id: createdId,
      name: 'Housekeeping staff',
      email: 'housekeeping@example.test',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date('2027-01-01T00:00:00.000Z'),
    };
    const database = {
      query: {
        adminDepartments: {
          findMany: vi.fn().mockResolvedValue([{ id: departmentId }]),
          findFirst: vi.fn().mockResolvedValue({ name: 'Housekeeping' }),
        },
        properties: { findMany: vi.fn().mockResolvedValue([{ id: propertyId }]) },
        users: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(createdUser)
            .mockResolvedValueOnce(createdUser),
        },
        adminMemberships: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ departmentId, role: 'HOUSEKEEPING_STAFF', status: 'ACTIVE' }]),
        },
        adminPropertyMemberships: {
          findMany: vi.fn().mockResolvedValue([{ propertyId, status: 'ACTIVE' }]),
        },
        sessions: { findMany: vi.fn().mockResolvedValue([]) },
      },
      transaction: async (operation: (transaction: unknown) => Promise<unknown>) =>
        operation({
          insert: vi.fn(() => ({
            values: (value: unknown) => {
              inserted.push(value);
              return Promise.resolve();
            },
          })),
        }),
    };
    const service = new AdminAccessService(
      database as never,
      {
        api: {
          createUser: vi.fn().mockResolvedValue({ user: { id: createdId } }),
        },
      } as never,
    );
    const actor = {
      userId: 'super-admin-id',
      email: 'admin@example.test',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN' as const,
      profileCode: 'SUPER_ADMIN' as const,
      permissions: [],
      departments: [],
      propertyIds: 'ALL' as const,
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
    };

    await expect(
      service.createAccount(actor, {
        displayName: 'Housekeeping staff',
        email: 'housekeeping@example.test',
        password: 'Aa1-strong-password',
        role: 'HOUSEKEEPING_STAFF',
        departmentIds: [departmentId],
        propertyIds: [propertyId],
      }),
    ).resolves.toMatchObject({ id: createdId, propertyIds: [propertyId] });
    expect(inserted).toContainEqual([{ userId: createdId, propertyId, status: 'ACTIVE' }]);
  });

  it('rejects duplicate admin emails with ADMIN_EMAIL_CONFLICT before calling Better Auth', async () => {
    const departmentId = '550e8400-e29b-41d4-a716-446655440020';
    const database = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing-id' }),
        },
        adminDepartments: { findMany: vi.fn().mockResolvedValue([]) },
        properties: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };
    const createUser = vi.fn();
    const service = new AdminAccessService(database as never, { api: { createUser } } as never);
    const actor = {
      userId: 'super-admin-id',
      email: 'admin@example.test',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN' as const,
      profileCode: 'SUPER_ADMIN' as const,
      permissions: [],
      departments: [],
      propertyIds: 'ALL' as const,
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
    };

    await expect(
      service.createAccount(actor, {
        displayName: 'Duplicate',
        email: 'dup@example.test',
        password: 'Aa1-strong-password',
        role: 'SUPER_ADMIN',
        departmentIds: [departmentId],
      }),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_EMAIL_CONFLICT' } });
    expect(createUser).not.toHaveBeenCalled();
  });

  it('translates Better Auth USER_ALREADY_EXISTS into ADMIN_EMAIL_CONFLICT without orphan rows', async () => {
    const departmentId = '550e8400-e29b-41d4-a716-446655440021';
    const database = {
      query: {
        users: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ id: 'racer-id' }),
        },
        adminDepartments: {
          findMany: vi.fn().mockResolvedValue([{ id: departmentId }]),
        },
        properties: { findMany: vi.fn().mockResolvedValue([]) },
      },
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    };
    const createUser = vi.fn().mockRejectedValue({
      code: 'USER_ALREADY_EXISTS',
      message: 'email in use',
    });
    const service = new AdminAccessService(database as never, { api: { createUser } } as never);
    const actor = {
      userId: 'super-admin-id',
      email: 'admin@example.test',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN' as const,
      profileCode: 'SUPER_ADMIN' as const,
      permissions: [],
      departments: [],
      propertyIds: 'ALL' as const,
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
    };

    await expect(
      service.createAccount(actor, {
        displayName: 'Race',
        email: 'race@example.test',
        password: 'Aa1-strong-password',
        role: 'SUPER_ADMIN',
        departmentIds: [departmentId],
      }),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_EMAIL_CONFLICT' } });
  });
});
