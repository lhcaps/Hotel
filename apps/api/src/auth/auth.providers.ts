import { createRoomAuth, ROLE_PERMISSIONS, type HumanRole } from '@room/auth';
import { fromNodeHeaders } from 'better-auth/node';

import {
  AdminSessionService,
  type AuthUserReader,
  type SessionReader,
} from './admin-session.service.js';
import { DatabaseProvider } from '../database/database.provider.js';

export const ROOM_AUTH = Symbol('ROOM_AUTH');
export const API_ENVIRONMENT = Symbol('API_ENVIRONMENT');

export function createSessionReader(auth: ReturnType<typeof createRoomAuth>): SessionReader {
  return {
    async getSession(input) {
      const result = await auth.api.getSession({ headers: fromNodeHeaders(input.headers) });
      if (result === null) {
        return null;
      }
      return {
        user: { id: result.user.id, email: result.user.email, name: result.user.name },
        session: { id: result.session.id, expiresAt: new Date(result.session.expiresAt) },
      };
    },
  };
}

export function createAuthUserReader(database: DatabaseProvider): AuthUserReader {
  return {
    async findUser(userId) {
      const result = await database.client.query.users.findFirst({
        where: (fields, { eq }) => eq(fields.id, userId),
        columns: { id: true, email: true, name: true, role: true, status: true },
      });
      return result ?? null;
    },
    async findAdminAccess(userId) {
      const memberships = await database.client.query.adminMemberships.findMany({
        where: (fields, { and, eq }) => and(eq(fields.userId, userId), eq(fields.status, 'ACTIVE')),
      });
      if (memberships.length === 0) {
        const legacyUser = await database.client.query.users.findFirst({
          where: (fields, { eq }) => eq(fields.id, userId),
          columns: { role: true },
        });
        if (
          legacyUser?.role === 'ADMIN' ||
          legacyUser?.role === 'SUPER_ADMIN' ||
          legacyUser?.role === 'ROOM_STATUS_VIEWER'
        ) {
          return {
            role: legacyUser.role,
            permissions: ROLE_PERMISSIONS[legacyUser.role],
            departments: [],
          };
        }
        return null;
      }
      const rank = { ROOM_STATUS_VIEWER: 1, ADMIN: 2, SUPER_ADMIN: 3 } as const;
      const role = memberships.reduce<HumanRole>((current, membership) => {
        const candidate = membership.role as HumanRole;
        return (rank[candidate as keyof typeof rank] ?? 0) >
          (rank[current as keyof typeof rank] ?? 0)
          ? candidate
          : current;
      }, 'ROOM_STATUS_VIEWER');
      const departments = await Promise.all(
        memberships.map(async (membership) => {
          const department = await database.client.query.adminDepartments.findFirst({
            where: (fields, { eq }) => eq(fields.id, membership.departmentId),
            columns: { name: true },
          });
          return department?.name;
        }),
      );
      return {
        role,
        permissions: ROLE_PERMISSIONS[role],
        departments: departments.filter((name): name is string => name !== undefined),
      };
    },
  };
}

export function createAdminSessionService(
  auth: ReturnType<typeof createRoomAuth>,
  database: DatabaseProvider,
): AdminSessionService {
  return new AdminSessionService(createSessionReader(auth), createAuthUserReader(database));
}
