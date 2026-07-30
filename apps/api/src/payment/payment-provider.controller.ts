import { Controller, Get, Inject, Version } from '@nestjs/common';
import { PaymentProviderSettingsService } from './services/payment-provider-settings.service.js';
@Controller('public/payment-providers')
export class PaymentProviderController {
  public constructor(
    @Inject(PaymentProviderSettingsService)
    private readonly settings: PaymentProviderSettingsService,
  ) {}
  @Get() @Version('1') public list() {
    return this.settings.listPublic();
  }
}
