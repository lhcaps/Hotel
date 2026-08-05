import { hashPassword } from 'better-auth/crypto';

import {
  accounts,
  adminDepartments,
  adminMemberships,
  adminProfiles,
  auditEvents,
  sql,
  users,
  type DatabaseClient,
} from '@room/database';

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
        let userId: string;
        let created = false;
        if (known !== undefined) {
          if (known.role !== input.role) {
            throw new Error('The bootstrap email belongs to a different user role.');
          }
          userId = known.id;
        } else {
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
          userId = user.id;
          created = true;
          await transaction.insert(accounts).values({
            accountId: user.id,
            providerId: 'credential',
            userId: user.id,
            password,
          });
        }

        const departments = await transaction
          .select({ id: adminDepartments.id })
          .from(adminDepartments)
          .where(
            sql`upper(${adminDepartments.code}) = 'OPERATIONS'
              AND ${adminDepartments.status} = 'ACTIVE'`,
          )
          .limit(1);
        const existingDepartment = departments[0];
        const department =
          existingDepartment ??
          (
            await transaction
              .insert(adminDepartments)
              .values({ code: 'OPERATIONS', name: 'Vận hành', status: 'ACTIVE' })
              .returning({ id: adminDepartments.id })
          )[0];
        if (department === undefined) {
          throw new Error('ADMIN bootstrap did not resolve an operations department.');
        }
        await transaction.insert(adminProfiles).values({ userId }).onConflictDoNothing();
        await transaction
          .insert(adminMemberships)
          .values({
            userId,
            departmentId: department.id,
            role: input.role,
            status: 'ACTIVE',
          })
          .onConflictDoNothing();

        if (created) {
          await transaction.insert(auditEvents).values({
            aggregateType: 'USER',
            aggregateId: userId,
            eventType: 'ADMIN_BOOTSTRAPPED',
            actorType: 'SYSTEM',
            payload: { email: input.email, role: input.role },
          });
        }
        return { id: userId, created };
      });
    },
  };
}
