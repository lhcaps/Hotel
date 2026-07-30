import { Body, Controller, Inject, Post, Version } from '@nestjs/common';

import { NearbyAvailabilityService } from './nearby-availability.service.js';

@Controller('public/availability')
export class NearbyAvailabilityController {
  public constructor(
    @Inject(NearbyAvailabilityService) private readonly service: NearbyAvailabilityService,
  ) {}

  @Post('nearby')
  @Version('1')
  public searchNearby(@Body() body: unknown) {
    return this.service.search(body);
  }
}
