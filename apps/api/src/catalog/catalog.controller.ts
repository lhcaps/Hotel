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
  public getProperty() {
    return this.catalog.getProperty();
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
  public listPriceTiers(@Query() query: unknown) {
    return this.catalog.listPriceTiers(query);
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
  public listRoomTypes(@Query() query: unknown) {
    return this.catalog.listRoomTypes(query);
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
  public listAmenities(@Query() query: unknown) {
    return this.catalog.listAmenities(query);
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
  public listRooms(@Query() query: unknown) {
    return this.catalog.listRooms(query);
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
  @RequirePermissions('catalog.room.manage')
  public updateRoomHousekeeping(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateRoomHousekeeping(request.actor, id, body);
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
  public listMaintenanceBlocks(@Query() query: unknown) {
    return this.catalog.listMaintenanceBlocks(query);
  }

  @Post('maintenance-blocks/:id/cancel')
  @Version('1')
  @RequirePermissions('catalog.maintenance.manage')
  public cancelMaintenance(@Req() request: { actor: ActorContext }, @Param('id') id: string) {
    return this.catalog.cancelMaintenanceBlock(request.actor, id);
  }
}
