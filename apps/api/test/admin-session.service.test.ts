import { describe, expect, it, vi } from 'vitest';

import { AdminSessionService } from '../src/auth/admin-session.service.js';

describe('AdminSessionService', () => {
  it('returns no actor for an absent or expired session', async () => {
    const absent = new AdminSessionService(
      { getSession: vi.fn().mockResolvedValue(null) },
      { findUser: vi.fn() },
    );
    await expect(absent.getActor({ headers: {}, id: 'request-id' })).resolves.toBeNull();

    const expired = new AdminSessionService(
      {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'user-id', email: 'admin@example.test', name: 'Admin' },
          session: { id: 'session-id', expiresAt: new Date('2020-01-01T00:00:00.000Z') },
        }),
      },
      {
        findUser: vi.fn().mockResolvedValue({
          id: 'user-id',
          email: 'admin@example.test',
          name: 'Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        }),
      },
    );
    await expect(expired.getActor({ headers: {}, id: 'request-id' })).resolves.toBeNull();
  });

  it('derives the scoped profile, label, department, and account status from a valid membership', async () => {
    const service = new AdminSessionService(
      {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'user-id', email: 'admin@example.test', name: 'Admin' },
          session: { id: 'session-id', expiresAt: new Date('2027-01-01T00:00:00.000Z') },
        }),
      },
      {
        findUser: vi.fn().mockResolvedValue({
          id: 'user-id',
          email: 'admin@example.test',
          name: 'Admin',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        }),
        findAdminAccess: vi.fn().mockResolvedValue({
          role: 'SUPER_ADMIN',
          profileCode: 'SUPER_ADMIN',
          profileLabelVi: 'Tổng quản trị',
          permissions: ['admin.account.manage'],
          departments: [{ id: 'department-id', name: 'Vận hành' }],
        }),
      },
    );

    await expect(
      service.getActor({ headers: { 'x-correlation-id': 'correlation-id' }, id: 'request-id' }),
    ).resolves.toMatchObject({
      userId: 'user-id',
      role: 'SUPER_ADMIN',
      profileCode: 'SUPER_ADMIN',
      profileLabelVi: 'Tổng quản trị',
      departments: [{ id: 'department-id', name: 'Vận hành' }],
      accountStatus: 'ACTIVE',
      requestId: 'request-id',
      correlationId: 'correlation-id',
    });
  });

  it('fails closed for an active legacy ADMIN without a membership', async () => {
    const service = new AdminSessionService(
      {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'user-id', email: 'admin@example.test', name: 'Admin' },
          session: { id: 'session-id', expiresAt: new Date('2027-01-01T00:00:00.000Z') },
        }),
      },
      {
        findUser: vi.fn().mockResolvedValue({
          id: 'user-id',
          email: 'admin@example.test',
          name: 'Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        }),
        findAdminAccess: vi.fn().mockResolvedValue(null),
      },
    );

    await expect(service.getActor({ headers: {}, id: 'request-id' })).resolves.toMatchObject({
      role: 'ADMIN',
      permissions: [],
      profileCode: null,
      accountStatus: 'ACTIVE',
    });
  });
});
