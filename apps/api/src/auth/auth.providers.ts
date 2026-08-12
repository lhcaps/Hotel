import {
  ADMIN_PROFILE_CODES,
  ADMIN_PROFILE_LABELS_VI,
  createRoomAuth,
  PROFILE_PERMISSIONS,
  type AdminProfileCode,
} from '@room/auth';
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
        (membership): membership is typeof membership & { role: AdminProfileCode } =>
          (ADMIN_PROFILE_CODES as readonly string[]).includes(membership.role),
      );
      if (scopedMemberships.length === 0) return null;
      const rank: Readonly<Record<AdminProfileCode, number>> = {
        ROOM_STATUS_VIEWER: 1,
        HOUSEKEEPING_STAFF: 2,
        MAINTENANCE_STAFF: 3,
        PAYMENT_STAFF: 4,
        HOUSEKEEPING_MANAGER: 5,
        MAINTENANCE_MANAGER: 6,
        STAFF_MANAGER: 7,
        OPERATIONS_MANAGER: 8,
        SUPER_ADMIN: 9,
      };
      const role = scopedMemberships.reduce<AdminProfileCode>(
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

      // Compute server-derived property authorization scope.
      // SUPER_ADMIN gets 'ALL' without querying the table — global authority is
      // already established by ROLE_PERMISSIONS.SUPER_ADMIN = PERMISSIONS.
      let propertyIds: readonly string[] | 'ALL';
      if (role === 'SUPER_ADMIN') {
        propertyIds = 'ALL';
      } else {
        const propertyMemberships = await database.client.query.adminPropertyMemberships.findMany({
          where: (fields, { and, eq }) =>
            and(eq(fields.userId, userId), eq(fields.status, 'ACTIVE')),
          columns: { propertyId: true },
        });
        // property_id = null means an explicit all-property grant
        const hasAllProperty = propertyMemberships.some((row) => row.propertyId === null);
        if (hasAllProperty) {
          propertyIds = 'ALL';
        } else {
          propertyIds = propertyMemberships
            .map((row) => row.propertyId)
            .filter((id): id is string => id !== null);
        }
      }

      return {
        role:
          role === 'SUPER_ADMIN'
            ? 'SUPER_ADMIN'
            : role === 'ROOM_STATUS_VIEWER'
              ? 'ROOM_STATUS_VIEWER'
              : 'ADMIN',
        profileCode: role,
        profileLabelVi: ADMIN_PROFILE_LABELS_VI[role],
        permissions: PROFILE_PERMISSIONS[role],
        departments: departments.filter(
          (department): department is { id: string; name: string } => department !== undefined,
        ),
        propertyIds,
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
