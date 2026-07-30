import { Body, Controller, Inject, Post, Version } from '@nestjs/common';
import { AvailabilityService } from './availability.service.js';
@Controller('availability')
export class AvailabilityController {
  public constructor(
    @Inject(AvailabilityService) private readonly availability: AvailabilityService,
  ) {}
  @Post('search') @Version('1') public search(@Body() body: unknown) {
    return this.availability.search(body);
  }
}
