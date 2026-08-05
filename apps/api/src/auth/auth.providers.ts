import { ADMIN_PROFILE_LABELS_VI, createRoomAuth, ROLE_PERMISSIONS } from '@room/auth';
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
      const scopedMemberships = memberships.filter(
        (
          membership,
        ): membership is typeof membership & {
          role: 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER';
        } => membership.role === 'SUPER_ADMIN' || membership.role === 'ROOM_STATUS_VIEWER',
      );
      if (scopedMemberships.length === 0) return null;
      const rank = { ROOM_STATUS_VIEWER: 1, SUPER_ADMIN: 2 } as const;
      const role = scopedMemberships.reduce<'ROOM_STATUS_VIEWER' | 'SUPER_ADMIN'>(
        (current, membership) =>
          rank[membership.role] > rank[current] ? membership.role : current,
        'ROOM_STATUS_VIEWER',
      );
      const departments = await Promise.all(
        scopedMemberships.map(async (membership) => {
          const department = await database.client.query.adminDepartments.findFirst({
            where: (fields, { eq }) => eq(fields.id, membership.departmentId),
            columns: { name: true },
          });
          return department === undefined
            ? undefined
            : { id: membership.departmentId, name: department.name };
        }),
      );
      return {
        role,
        profileCode: role,
        profileLabelVi: ADMIN_PROFILE_LABELS_VI[role],
        permissions: ROLE_PERMISSIONS[role],
        departments: departments.filter(
          (department): department is { id: string; name: string } => department !== undefined,
        ),
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
