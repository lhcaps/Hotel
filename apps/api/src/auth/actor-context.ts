import { ROLE_PERMISSIONS, type HumanRole, type Permission } from '@room/auth';

export interface ActorContext {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: HumanRole;
  readonly permissions: readonly Permission[];
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
  readonly requestId: string;
  readonly correlationId?: string;
}): ActorContext {
  return {
    userId: input.user.id,
    email: input.user.email,
    displayName: input.user.name,
    role: input.user.role,
    permissions: ROLE_PERMISSIONS[input.user.role],
    sessionId: input.session.id,
    sessionExpiresAt: input.session.expiresAt,
    requestId: input.requestId,
    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
  };
}
