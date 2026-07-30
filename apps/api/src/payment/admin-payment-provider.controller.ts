import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PaymentProviderSettingsService } from './services/payment-provider-settings.service.js';
import { PaymentProviderSettingsError } from './payment-provider-settings.errors.js';

@Controller('admin/payment-providers')
@UseGuards(AdminPermissionGuard)
export class AdminPaymentProviderController {
  public constructor(
    @Inject(PaymentProviderSettingsService)
    private readonly settings: PaymentProviderSettingsService,
  ) {}
  @Get() @Version('1') @RequirePermissions('catalog.property.manage') public list() {
    return this.settings.listAdmin();
  }

  @Patch(':provider')
  @Version('1')
  @RequirePermissions('catalog.property.manage')
  public update(
    @Param('provider') provider: 'MOMO' | 'VNPAY',
    @Req() request: { actor: ActorContext },
    @Body() body: unknown,
  ) {
    if (provider !== 'MOMO' && provider !== 'VNPAY') {
      throw new PaymentProviderSettingsError('PAYMENT_PROVIDER_NOT_FOUND');
    }
    return this.settings.update(provider, body, request.actor.userId);
  }
}
