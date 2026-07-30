import { Controller, Get, Inject, Query, UseGuards, Version } from '@nestjs/common';
import type { AdminRoomOperationsResponse } from '@room/contracts';

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
  public async list(@Query() query: unknown): Promise<AdminRoomOperationsResponse> {
    const property = await this.propertyContext.getCurrent();
    return this.service.list(property.id, query, new Date());
  }
}
