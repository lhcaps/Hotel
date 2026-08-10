import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';

import { CouponService } from './coupon.service.js';

@Controller('admin/coupons')
@UseGuards(AdminPermissionGuard)
export class CouponController {
  public constructor(@Inject(CouponService) private readonly coupons: CouponService) {}

  @Get()
  @Version('1')
  @RequirePermissions('coupon.read')
  public listCoupons(@Query() query: unknown, @Req() request: { actor: ActorContext }) {
    return this.coupons.listCoupons(request.actor, query);
  }

  @Post()
  @Version('1')
  @RequirePermissions('coupon.manage')
  public createCoupon(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.coupons.createCoupon(request.actor, body);
  }

  @Get(':id')
  @Version('1')
  @RequirePermissions('coupon.read')
  public getCoupon(@Param('id') id: string, @Req() request: { actor: ActorContext }) {
    return this.coupons.getCoupon(request.actor, id);
  }

  @Post(':id/disable')
  @Version('1')
  @RequirePermissions('coupon.manage')
  public disableCoupon(@Req() request: { actor: ActorContext }, @Param('id') id: string) {
    return this.coupons.disableCoupon(request.actor, id);
  }
}
