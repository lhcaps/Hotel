import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdminPermissionGuard } from '../src/auth/admin-permission.guard.js';

const reflector = {
  getAllAndOverride: vi.fn(),
};

function context(request: { headers: Record<string, string>; id: string }) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('AdminPermissionGuard', () => {
  it('rejects an anonymous request with 401', async () => {
    reflector.getAllAndOverride.mockReturnValue(['catalog.room.read']);
    const guard = new AdminPermissionGuard(reflector as never, {
      getActor: vi.fn().mockResolvedValue(null),
    });

    await expect(
      guard.canActivate(context({ headers: {}, id: 'request-id' }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a session without permission with 403 and stores a permitted actor on request', async () => {
    reflector.getAllAndOverride.mockReturnValue(['catalog.room.manage']);
    const request = { headers: {}, id: 'request-id' };
    const denied = new AdminPermissionGuard(reflector as never, {
      getActor: vi.fn().mockResolvedValue({ role: 'CUSTOMER', permissions: [] }),
    });
    await expect(denied.canActivate(context(request) as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const actor = { role: 'ADMIN', permissions: ['catalog.room.manage'], userId: 'admin-id' };
    const permitted = new AdminPermissionGuard(reflector as never, {
      getActor: vi.fn().mockResolvedValue(actor),
    });
    await expect(permitted.canActivate(context(request) as never)).resolves.toBe(true);
    expect((request as { actor?: unknown }).actor).toBe(actor);
  });
});
