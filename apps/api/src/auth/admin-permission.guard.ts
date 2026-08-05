import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Permission } from '@room/auth';
import { Reflector } from '@nestjs/core';

import { AdminSessionService } from './admin-session.service.js';
import { REQUIRED_PERMISSIONS } from './permissions.decorator.js';

type RequestWithActor = {
  headers: Record<string, string | string[] | undefined>;
  id: string;
  actor?: unknown;
};

type ActorResolver = Pick<AdminSessionService, 'getActor'>;

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AdminSessionService) private readonly sessions: ActorResolver,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<readonly Permission[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const actor = await this.sessions.getActor(request);
    if (actor === null) {
      throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
    }
    if (actor.accountStatus === 'DISABLED' || actor.profileCode == null) {
      throw new ForbiddenException({ code: 'ADMIN_PROFILE_REQUIRED' });
    }
    if (!required.every((permission) => actor.permissions.includes(permission))) {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED' });
    }
    request.actor = actor;
    return true;
  }
}
