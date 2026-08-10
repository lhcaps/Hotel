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
  /**
   * Server-derived property authorization scope.
   * 'ALL' = explicit all-property authority (SUPER_ADMIN or explicit null-property row).
   * readonly string[] = the exact property UUIDs this actor is authorized for.
   * undefined/omitted is treated as zero-property (deny) by the property
   * context resolver — never populated from the request.
   */
  readonly propertyIds?: readonly string[] | 'ALL';
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
  readonly propertyIds?: readonly string[] | 'ALL';
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
    propertyIds: input.propertyIds ?? [],
    sessionId: input.session.id,
    sessionExpiresAt: input.session.expiresAt,
    requestId: input.requestId,
    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
  };
}
