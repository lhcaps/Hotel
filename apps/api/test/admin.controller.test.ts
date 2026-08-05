import { describe, expect, it } from 'vitest';

import { AdminController } from '../src/admin/admin.controller.js';

describe('AdminController', () => {
  it('returns only the safe current Admin identity', () => {
    const controller = new AdminController();
    const result = controller.me({
      actor: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'admin@example.test',
        displayName: 'Administrator',
        role: 'SUPER_ADMIN',
        profileCode: 'SUPER_ADMIN',
        profileLabelVi: 'Tổng quản trị',
        accountStatus: 'ACTIVE',
        departments: [{ id: '72fec1a4-4df0-4c43-a7d4-a4f622d79e0a', name: 'Vận hành' }],
        permissions: ['catalog.property.read'],
        sessionId: 'session-id',
        sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
        requestId: 'request-id',
      },
    });

    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      emailMasked: 'a***n@example.test',
      displayName: 'Administrator',
      role: 'SUPER_ADMIN',
      profileCode: 'SUPER_ADMIN',
      profileLabelVi: 'Tổng quản trị',
      accountStatus: 'ACTIVE',
      permissions: ['catalog.property.read'],
      sessionExpiresAt: '2027-01-01T00:00:00.000Z',
      department: { id: '72fec1a4-4df0-4c43-a7d4-a4f622d79e0a', name: 'Vận hành' },
      departments: ['Vận hành'],
    });
    expect(JSON.stringify(result)).not.toMatch(/session-id|token|password|hash/i);
  });
});
