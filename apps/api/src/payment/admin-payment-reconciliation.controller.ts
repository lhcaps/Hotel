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

import type {
  AdminPaymentDetail,
  AdminPaymentListQuery,
  AdminPaymentListResponse,
  AdminPaymentReconcileResponse,
} from '@room/contracts';
import { adminPaymentListQuerySchema } from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PropertyContextService } from '../catalog/property-context.service.js';
import { AdminPaymentReconciliationService } from './services/admin-payment-reconciliation.service.js';

type AdminRequest = {
  readonly actor: ActorContext;
  readonly id: string;
};

@Controller('admin/payments')
@UseGuards(AdminPermissionGuard)
export class AdminPaymentReconciliationController {
  public constructor(
    @Inject(AdminPaymentReconciliationService)
    private readonly service: AdminPaymentReconciliationService,
    @Inject(PropertyContextService)
    private readonly propertyContext: PropertyContextService,
  ) {}

  @Get()
  @Version('1')
  @RequirePermissions('payment.reconciliation.read')
  public async listPayments(
    @Query() query: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminPaymentListResponse> {
    const property = await this.propertyContext.getCurrent(request.actor);
    const parsed: AdminPaymentListQuery = adminPaymentListQuerySchema.parse(query);
    return this.service.listPayments(property.id, parsed);
  }

  @Get(':paymentId')
  @Version('1')
  @RequirePermissions('payment.reconciliation.read')
  public async getPaymentDetail(
    @Param('paymentId') paymentId: string,
    @Req() request: AdminRequest,
  ): Promise<AdminPaymentDetail> {
    const property = await this.propertyContext.getCurrent(request.actor);
    return this.service.getDetail(paymentId, property.id, new Date());
  }

  @Post(':paymentId/reconcile')
  @Version('1')
  @RequirePermissions('payment.reconciliation.manage')
  public async reconcilePayment(
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ): Promise<AdminPaymentReconcileResponse> {
    const property = await this.propertyContext.getCurrent(request.actor);
    return this.service.reconcile(request.actor, paymentId, property.id, body, new Date());
  }
}
