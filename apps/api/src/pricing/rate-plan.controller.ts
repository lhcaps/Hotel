import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { RatePlanService } from './rate-plan.service.js';

@Controller('admin/rate-plans')
@UseGuards(AdminPermissionGuard)
export class RatePlanController {
  public constructor(@Inject(RatePlanService) private readonly ratePlans: RatePlanService) {}
  @Get()
  @Version('1')
  @RequirePermissions('pricing.rate_plan.read')
  public list(@Req() request: { actor: ActorContext }) {
    return this.ratePlans.list(request.actor);
  }
  @Post() @Version('1') @RequirePermissions('pricing.rate_plan.manage') public create(
    @Req() request: { actor: ActorContext },
    @Body() body: unknown,
  ) {
    return this.ratePlans.create(request.actor, body);
  }
  @Patch(':id/prices/:priceTierId')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public updatePrice(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Param('priceTierId') priceTierId: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.updatePrice(request.actor, id, priceTierId, body);
  }
  @Patch(':id/selection-rule')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public updateSelectionRule(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.updateSelectionRule(request.actor, id, body);
  }
  @Put(':id/prices/:priceTierId')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public replacePrice(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Param('priceTierId') priceTierId: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.updatePrice(request.actor, id, priceTierId, body);
  }
  @Post(':id/activate')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public activate(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.ratePlans.activate(request.actor, id, body);
  }
  @Post(':id/inactivate')
  @Version('1')
  @RequirePermissions('pricing.rate_plan.manage')
  public inactivate(@Req() request: { actor: ActorContext }, @Param('id') id: string) {
    return this.ratePlans.inactivate(request.actor, id);
  }
}
