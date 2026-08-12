import { describe, expect, it, vi } from 'vitest';

import { createAuthUserReader } from '../src/auth/auth.providers.js';
import type { DatabaseProvider } from '../src/database/database.provider.js';

describe('createAuthUserReader', () => {
  it('derives an active operational membership into an authorized, property-scoped profile', async () => {
    const database = {
      client: {
        query: {
          users: { findFirst: vi.fn() },
          adminMemberships: {
            findMany: vi.fn().mockResolvedValue([
              {
                departmentId: '550e8400-e29b-41d4-a716-446655440001',
                role: 'HOUSEKEEPING_STAFF',
              },
            ]),
          },
          adminDepartments: {
            findFirst: vi.fn().mockResolvedValue({ name: 'Housekeeping' }),
          },
          adminPropertyMemberships: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ propertyId: '550e8400-e29b-41d4-a716-446655440002' }]),
          },
        },
      },
    } as unknown as DatabaseProvider;

    const access = await createAuthUserReader(database).findAdminAccess?.('user-id');
    expect(access).toMatchObject({
      role: 'ADMIN',
      profileCode: 'HOUSEKEEPING_STAFF',
      departments: [{ id: '550e8400-e29b-41d4-a716-446655440001', name: 'Housekeeping' }],
      propertyIds: ['550e8400-e29b-41d4-a716-446655440002'],
    });
    expect(access?.permissions).toContain('housekeeping.task.update');
  });
});
