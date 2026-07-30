import { createRoomAuth } from '@room/auth';
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
  };
}

export function createAdminSessionService(
  auth: ReturnType<typeof createRoomAuth>,
  database: DatabaseProvider,
): AdminSessionService {
  return new AdminSessionService(createSessionReader(auth), createAuthUserReader(database));
}
