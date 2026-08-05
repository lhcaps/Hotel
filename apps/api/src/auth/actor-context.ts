import type { AdminProfileCode, HumanRole, Permission } from '@room/auth';

export interface ActorDepartment {
  readonly id: string;
  readonly name: string;
}

export interface ActorContext {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: HumanRole;
  readonly profileCode?: AdminProfileCode | null;
  readonly profileLabelVi?: string | null;
  readonly accountStatus?: 'ACTIVE' | 'DISABLED';
  readonly permissions: readonly Permission[];
  readonly departments?: readonly ActorDepartment[];
  readonly sessionId: string;
  readonly sessionExpiresAt: Date;
  readonly requestId: string;
  readonly correlationId?: string;
}

export function createActorContext(input: {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly role: HumanRole;
    readonly status: 'ACTIVE' | 'DISABLED';
  };
  readonly session: { readonly id: string; readonly expiresAt: Date };
  readonly permissions?: readonly Permission[];
  readonly profileCode?: AdminProfileCode | null;
  readonly profileLabelVi?: string | null;
  readonly departments?: readonly ActorDepartment[];
  readonly requestId: string;
  readonly correlationId?: string;
}): ActorContext {
  return {
    userId: input.user.id,
    email: input.user.email,
    displayName: input.user.name,
    role: input.user.role,
    profileCode: input.profileCode ?? null,
    profileLabelVi: input.profileLabelVi ?? null,
    accountStatus: input.user.status,
    permissions: input.permissions ?? [],
    departments: input.departments ?? [],
    sessionId: input.session.id,
    sessionExpiresAt: input.session.expiresAt,
    requestId: input.requestId,
    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
  };
}
