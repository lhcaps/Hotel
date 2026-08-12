import { Controller, Get, Inject, Query, Req, UseGuards, Version } from '@nestjs/common';
import {
  adminRoomOperationsResponseSchema,
  type AdminRoomOperationsResponse,
} from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PropertyContextService } from '../catalog/property-context.service.js';
import { RoomOperationsService } from './services/room-operations.service.js';

@Controller('admin/room-operations')
@UseGuards(AdminPermissionGuard)
export class RoomOperationsController {
  public constructor(
    @Inject(RoomOperationsService) private readonly service: RoomOperationsService,
    @Inject(PropertyContextService) private readonly propertyContext: PropertyContextService,
  ) {}

  @Get()
  @Version('1')
  @RequirePermissions('catalog.room.read')
  public async list(
    @Req() request: { actor: ActorContext },
    @Query() query: unknown,
  ): Promise<AdminRoomOperationsResponse> {
    const property = await this.propertyContext.getCurrent(request.actor);
    const response = await this.service.list(property.id, query, new Date(), property.code);
    if (request.actor.profileCode !== 'ROOM_STATUS_VIEWER') return response;
    return adminRoomOperationsResponseSchema.parse({
      ...response,
      items: response.items.map((room) => ({
        ...room,
        bookings: [],
        freeWindows: [],
        activeHousekeepingTask: null,
        latestTurnoverTask: null,
      })),
    });
  }
}
