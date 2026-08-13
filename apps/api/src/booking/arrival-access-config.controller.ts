import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ArrivalAccessConfigService } from './services/arrival-access-config.service.js';

@Controller('admin/arrival-access-config')
@UseGuards(AdminPermissionGuard)
export class ArrivalAccessConfigController {
  public constructor(
    @Inject(ArrivalAccessConfigService) private readonly access: ArrivalAccessConfigService,
  ) {}

  @Get('property')
  @Version('1')
  @RequirePermissions('arrival.access.read')
  public property(@Req() request: { actor: ActorContext }) {
    return this.access.getPropertyForAdmin(request.actor);
  }

  @Patch('property')
  @Version('1')
  @RequirePermissions('arrival.access.manage')
  public updateProperty(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.access.updatePropertyForAdmin(request.actor, body);
  }

  @Get('rooms/:roomId')
  @Version('1')
  @RequirePermissions('arrival.access.read')
  public room(@Req() request: { actor: ActorContext }, @Param('roomId') roomId: string) {
    return this.access.getRoomForAdmin(request.actor, roomId);
  }

  @Patch('rooms/:roomId')
  @Version('1')
  @RequirePermissions('arrival.access.manage')
  public updateRoom(
    @Req() request: { actor: ActorContext },
    @Param('roomId') roomId: string,
    @Body() body: unknown,
  ) {
    return this.access.updateRoomForAdmin(request.actor, roomId, body);
  }
}
