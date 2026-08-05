import { randomBytes } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { bootstrapAdmin, BootstrapAdminError } from '../src/bootstrap.js';

const testPassword = `Aa1-${randomBytes(32).toString('base64url')}`;

describe('bootstrapAdmin', () => {
  it('creates an active SUPER_ADMIN by default and never includes the password in output', async () => {
    const createAdmin = vi.fn().mockResolvedValue({ id: 'admin-id', created: true });

    const result = await bootstrapAdmin(
      {
        email: ' Admin@Example.Test ',
        password: testPassword,
        environment: 'development',
      },
      { createAdmin },
    );

    expect(createAdmin).toHaveBeenCalledWith({
      email: 'admin@example.test',
      password: testPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    expect(result).toEqual({ email: 'admin@example.test', created: true });
    expect(JSON.stringify(result)).not.toContain(testPassword);
  });

  it('creates an explicitly requested room-status viewer', async () => {
    const createAdmin = vi.fn().mockResolvedValue({ id: 'viewer-id', created: true });

    await bootstrapAdmin(
      {
        email: 'viewer@example.test',
        password: testPassword,
        role: 'ROOM_STATUS_VIEWER',
        environment: 'development',
      },
      { createAdmin },
    );

    expect(createAdmin).toHaveBeenCalledWith({
      email: 'viewer@example.test',
      password: testPassword,
      role: 'ROOM_STATUS_VIEWER',
      status: 'ACTIVE',
    });
  });

  it('is idempotent and rejects weak passwords and unsafe production execution', async () => {
    const dependencies = {
      createAdmin: vi.fn().mockResolvedValue({ id: 'existing-id', created: false }),
    };

    await expect(
      bootstrapAdmin(
        { email: 'admin@example.test', password: 'short', environment: 'development' },
        dependencies,
      ),
    ).rejects.toBeInstanceOf(BootstrapAdminError);
    await expect(
      bootstrapAdmin(
        {
          email: 'admin@example.test',
          password: testPassword,
          environment: 'production',
        },
        dependencies,
      ),
    ).rejects.toBeInstanceOf(BootstrapAdminError);
    await expect(
      bootstrapAdmin(
        {
          email: 'admin@example.test',
          password: testPassword,
          environment: 'production',
          productionAcknowledged: true,
        },
        dependencies,
      ),
    ).resolves.toEqual({ email: 'admin@example.test', created: false });
    expect(dependencies.createAdmin).toHaveBeenCalledTimes(1);
  });
});
