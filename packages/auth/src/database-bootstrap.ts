import { hashPassword } from 'better-auth/crypto';

import { accounts, auditEvents, sql, users, type DatabaseClient } from '@room/database';

import type { BootstrapAdminDependencies } from './bootstrap.js';

export function createDatabaseBootstrapDependencies(
  database: DatabaseClient,
): BootstrapAdminDependencies {
  return {
    async createAdmin(input) {
      return database.transaction(async (transaction) => {
        const existing = await transaction
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(sql`lower(${users.email}) = lower(${input.email})`)
          .limit(1);
        const known = existing[0];
        if (known !== undefined) {
          if (known.role !== input.role) {
            throw new Error('The bootstrap email belongs to a different user role.');
          }
          return { id: known.id, created: false };
        }

        const password = await hashPassword(input.password);
        const inserted = await transaction
          .insert(users)
          .values({
            name: 'Administrator',
            email: input.email,
            role: input.role,
            status: input.status,
          })
          .returning({ id: users.id });
        const user = inserted[0];
        if (user === undefined) {
          throw new Error('ADMIN bootstrap did not create a user.');
        }
        await transaction.insert(accounts).values({
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password,
        });
        await transaction.insert(auditEvents).values({
          aggregateType: 'USER',
          aggregateId: user.id,
          eventType: 'ADMIN_BOOTSTRAPPED',
          actorType: 'SYSTEM',
          payload: { email: input.email, role: input.role },
        });
        return { id: user.id, created: true };
      });
    },
  };
}
