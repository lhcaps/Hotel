import type { AdminProfileCode, HumanRole, Permission } from '@room/auth';

export interface AdminAccess {
  readonly role: Extract<HumanRole, 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER'>;
  readonly profileCode: AdminProfileCode;
  readonly profileLabelVi: string;
  readonly permissions: readonly Permission[];
  readonly departments: readonly { readonly id: string; readonly name: string }[];
  /**
   * Server-derived property authorization scope.
   * 'ALL' means explicit all-property authority (SUPER_ADMIN role or an
   * explicit property_id=NULL row in admin_property_memberships).
   * An empty array means the actor has a profile but no property scope yet.
   * Never derived from the request — always loaded from the database.
   */
  readonly propertyIds: readonly string[] | 'ALL';
}

import { createActorContext, type ActorContext } from './actor-context.js';

export interface SessionReader {
  getSession(input: { headers: Record<string, string | string[] | undefined> }): Promise<{
    user: { id: string; email: string; name: string };
    session: { id: string; expiresAt: Date };
  } | null>;
}

export interface AuthUserReader {
  findUser(userId: string): Promise<{
    id: string;
    email: string;
    name: string;
    role: HumanRole;
    status: 'ACTIVE' | 'DISABLED';
  } | null>;
  findAdminAccess?(userId: string): Promise<AdminAccess | null>;
}

export class AdminSessionService {
  public constructor(
    private readonly sessions: SessionReader,
    private readonly users: AuthUserReader,
  ) {}

  public async getActor(request: {
    readonly headers: Record<string, string | string[] | undefined>;
    readonly id: string;
  }): Promise<ActorContext | null> {
    const session = await this.sessions.getSession({ headers: request.headers });
    if (session === null || session.session.expiresAt <= new Date()) {
      return null;
    }
    const user = await this.users.findUser(session.user.id);
    if (user === null || user.status !== 'ACTIVE') {
      return null;
    }
    const access = await this.users.findAdminAccess?.(user.id);
    const effectiveRole = access?.role ?? user.role;
    const correlation = request.headers['x-correlation-id'];
    return createActorContext({
      user: { ...user, role: effectiveRole },
      session: session.session,
      permissions: user.status === 'ACTIVE' ? (access?.permissions ?? []) : [],
      profileCode: access?.profileCode ?? null,
      profileLabelVi: access?.profileLabelVi ?? null,
      departments: access?.departments ?? [],
      propertyIds: access?.propertyIds ?? [],
      requestId: request.id,
      ...(typeof correlation === 'string' ? { correlationId: correlation } : {}),
    });
  }
}
