import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';

import { CatalogService } from './catalog.service.js';

@Controller('admin')
@UseGuards(AdminPermissionGuard)
export class CatalogController {
  public constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('property')
  @Version('1')
  @RequirePermissions('catalog.property.read')
  public getProperty(@Req() request: { actor: ActorContext }) {
    return this.catalog.getProperty(request.actor);
  }

  @Patch('property')
  @Version('1')
  @RequirePermissions('catalog.property.manage')
  public updateProperty(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.catalog.updateProperty(request.actor, body);
  }

  @Get('price-tiers')
  @Version('1')
  @RequirePermissions('catalog.price_tier.read')
  public listPriceTiers(@Query() query: unknown, @Req() request: { actor: ActorContext }) {
    return this.catalog.listPriceTiers(request.actor, query);
  }

  @Post('price-tiers')
  @Version('1')
  @RequirePermissions('catalog.price_tier.manage')
  public createPriceTier(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.catalog.createPriceTier(request.actor, body);
  }

  @Patch('price-tiers/:id')
  @Version('1')
  @RequirePermissions('catalog.price_tier.manage')
  public updatePriceTier(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updatePriceTier(request.actor, id, body);
  }

  @Post('price-tiers/:id/archive')
  @Version('1')
  @RequirePermissions('catalog.price_tier.manage')
  public archivePriceTier(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.archivePriceTier(request.actor, id, body);
  }

  @Post('room-types')
  @Version('1')
  @RequirePermissions('catalog.room_type.manage')
  public createRoomType(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.catalog.createRoomType(request.actor, body);
  }

  @Get('room-types')
  @Version('1')
  @RequirePermissions('catalog.room_type.read')
  public listRoomTypes(@Query() query: unknown, @Req() request: { actor: ActorContext }) {
    return this.catalog.listRoomTypes(request.actor, query);
  }

  @Post('room-types/:id/archive')
  @Version('1')
  @RequirePermissions('catalog.room_type.manage')
  public archiveRoomType(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.archiveRoomType(request.actor, id, body);
  }

  @Post('room-types/:id/amenities')
  @Version('1')
  @RequirePermissions('catalog.room_type.manage')
  public assignAmenity(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.assignAmenity(request.actor, id, body);
  }

  @Patch('room-types/:id')
  @Version('1')
  @RequirePermissions('catalog.room_type.manage')
  public updateRoomType(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateRoomType(request.actor, id, body);
  }

  @Delete('room-types/:id/amenities/:amenityId')
  @Version('1')
  @RequirePermissions('catalog.room_type.manage')
  public removeRoomTypeAmenity(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Param('amenityId') amenityId: string,
  ) {
    return this.catalog.removeRoomTypeAmenity(request.actor, id, amenityId);
  }

  @Post('amenities')
  @Version('1')
  @RequirePermissions('catalog.amenity.manage')
  public createAmenity(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.catalog.createAmenity(request.actor, body);
  }

  @Get('amenities')
  @Version('1')
  @RequirePermissions('catalog.amenity.read')
  public listAmenities(@Query() query: unknown, @Req() request: { actor: ActorContext }) {
    return this.catalog.listAmenities(request.actor, query);
  }

  @Patch('amenities/:id')
  @Version('1')
  @RequirePermissions('catalog.amenity.manage')
  public updateAmenity(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateAmenity(request.actor, id, body);
  }

  @Post('amenities/:id/archive')
  @Version('1')
  @RequirePermissions('catalog.amenity.manage')
  public archiveAmenity(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.archiveAmenity(request.actor, id, body);
  }

  @Get('rooms')
  @Version('1')
  @RequirePermissions('catalog.room.read')
  public listRooms(@Query() query: unknown, @Req() request: { actor: ActorContext }) {
    return this.catalog.listRooms(request.actor, query);
  }

  @Post('rooms')
  @Version('1')
  @RequirePermissions('catalog.room.manage')
  public createRoom(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.catalog.createRoom(request.actor, body);
  }

  @Post('rooms/:id/archive')
  @Version('1')
  @RequirePermissions('catalog.room.manage')
  public archiveRoom(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.archiveRoom(request.actor, id, body);
  }

  @Patch('rooms/:id/housekeeping')
  @Version('1')
  @RequirePermissions('housekeeping.task.update')
  public updateRoomHousekeeping(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateRoomHousekeeping(request.actor, id, body);
  }

  @Patch('rooms/:id/housekeeping/assignment')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public assignRoomHousekeeping(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.assignRoomHousekeeping(request.actor, id, body);
  }

  @Get('housekeeping/assignees')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public housekeepingAssignees(@Req() request: { actor: ActorContext }) {
    return this.catalog.listHousekeepingAssignees(request.actor);
  }

  @Get('housekeeping/tasks')
  @Version('1')
  @RequirePermissions('housekeeping.task.read')
  public housekeepingTasks(@Req() request: { actor: ActorContext }) {
    return this.catalog.listHousekeepingTasks(request.actor);
  }

  @Patch('housekeeping/tasks/:taskId/assignment')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public assignHousekeepingTask(
    @Req() request: { actor: ActorContext },
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.catalog.assignHousekeepingTask(request.actor, taskId, body);
  }

  @Patch('housekeeping/tasks/:taskId/start')
  @Version('1')
  @RequirePermissions('housekeeping.task.update')
  public startHousekeepingTask(
    @Req() request: { actor: ActorContext },
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.catalog.startHousekeepingTask(request.actor, taskId, body);
  }

  @Patch('housekeeping/tasks/:taskId/complete')
  @Version('1')
  @RequirePermissions('housekeeping.task.update')
  public completeHousekeepingTask(
    @Req() request: { actor: ActorContext },
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.catalog.completeHousekeepingTask(request.actor, taskId, body);
  }

  @Patch('housekeeping/tasks/:taskId/verification')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public verifyHousekeepingTask(
    @Req() request: { actor: ActorContext },
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.catalog.verifyHousekeepingTask(request.actor, taskId, body);
  }

  @Patch('housekeeping/tasks/:taskId/reopen')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public reopenHousekeepingTask(
    @Req() request: { actor: ActorContext },
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.catalog.reopenHousekeepingTask(request.actor, taskId, body);
  }

  @Patch('housekeeping/tasks/:taskId/cancel')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public cancelHousekeepingTask(
    @Req() request: { actor: ActorContext },
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.catalog.cancelHousekeepingTask(request.actor, taskId, body);
  }

  @Patch('rooms/:id/housekeeping/override')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public overrideRoomHousekeeping(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.overrideRoomHousekeeping(request.actor, id, body);
  }

  @Patch('rooms/:id/housekeeping/verification')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public verifyRoomHousekeeping(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.verifyRoomHousekeeping(request.actor, id, body);
  }

  @Patch('rooms/:id/housekeeping/reopen')
  @Version('1')
  @RequirePermissions('housekeeping.task.manage')
  public reopenRoomHousekeeping(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.reopenRoomHousekeeping(request.actor, id, body);
  }

  @Patch('rooms/:id')
  @Version('1')
  @RequirePermissions('catalog.room.manage')
  public updateRoom(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateRoom(request.actor, id, body);
  }

  @Post('maintenance-blocks')
  @Version('1')
  @RequirePermissions('catalog.maintenance.manage')
  public createMaintenance(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.catalog.createMaintenanceBlock(request.actor, body);
  }

  @Get('maintenance-blocks')
  @Version('1')
  @RequirePermissions('catalog.maintenance.read')
  public listMaintenanceBlocks(@Query() query: unknown, @Req() request: { actor: ActorContext }) {
    return this.catalog.listMaintenanceBlocks(request.actor, query);
  }

  @Post('maintenance-blocks/:id/cancel')
  @Version('1')
  @RequirePermissions('catalog.maintenance.manage')
  public cancelMaintenance(@Req() request: { actor: ActorContext }, @Param('id') id: string) {
    return this.catalog.cancelMaintenanceBlock(request.actor, id);
  }
}
