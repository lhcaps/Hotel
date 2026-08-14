import {
  Controller,
  Get,
  Param,
  Inject,
  Patch,
  Body,
  UseGuards,
  Req,
  Version,
} from '@nestjs/common';
import { publicContactSchema, type PublicContact } from '@room/contracts';

import { PublicContactService } from './public-contact.service.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { ActorContext } from '../auth/actor-context.js';

@Controller()
export class PublicContactController {
  public constructor(
    @Inject(PublicContactService) private readonly service: PublicContactService,
  ) {}

  @Get('public/properties/:code/contact')
  @Version('1')
  public async get(@Param('code') code: string): Promise<PublicContact> {
    return this.service.getByCode(code);
  }

  @Patch('admin/properties/:id/contact')
  @Version('1')
  @UseGuards(AdminPermissionGuard)
  @RequirePermissions('catalog.property.manage')
  public async update(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<PublicContact> {
    const parsed = publicContactSchema.parse(body);
    return this.service.setById(request.actor, id, parsed);
  }
}
