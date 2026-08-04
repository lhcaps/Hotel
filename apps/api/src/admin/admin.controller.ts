import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { adminMeSchema } from '@room/contracts';
import { maskEmailForDisplay } from '@room/booking';

import { type ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';

@Controller('admin')
@UseGuards(AdminPermissionGuard)
export class AdminController {
  @Get('me')
  @Version('1')
  @RequirePermissions('catalog.property.read')
  public me(@Req() request: { actor: ActorContext }) {
    const actor = request.actor;
    return adminMeSchema.parse({
      id: actor.userId,
      emailMasked: maskEmailForDisplay(actor.email),
      displayName: actor.displayName,
      role: actor.role,
      permissions: actor.permissions,
      sessionExpiresAt: actor.sessionExpiresAt.toISOString(),
      departments: actor.departments,
    });
  }
}
