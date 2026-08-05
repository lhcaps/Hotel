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

  it('requires a department when assigning a V2 profile to a legacy ADMIN', async () => {
    const database = {
      query: {
        users: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'legacy-id', role: 'ADMIN', status: 'ACTIVE' }),
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
});
