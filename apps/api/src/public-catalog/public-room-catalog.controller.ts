import { Controller, Get, Inject, Version } from '@nestjs/common';

import { PublicRoomCatalogService } from './public-room-catalog.service.js';

@Controller('public/room-types')
export class PublicRoomCatalogController {
  public constructor(
    @Inject(PublicRoomCatalogService) private readonly catalog: PublicRoomCatalogService,
  ) {}

  @Get()
  @Version('1')
  public list() {
    return this.catalog.list();
  }
}
