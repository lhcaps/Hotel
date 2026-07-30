import { Controller, Get, Inject, Version } from '@nestjs/common';
import type { ApiEnvironment } from '@room/config';
import { publicProviderReadinessSchema } from '@room/contracts';

import { API_ENVIRONMENT } from './auth.providers.js';

@Controller('public/provider-readiness')
export class ProviderReadinessController {
  public constructor(@Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment) {}

  @Get()
  @Version('1')
  public get() {
    return publicProviderReadinessSchema.parse({
      google: {
        enabled: this.environment.GOOGLE_AUTH_ENABLED,
        unavailableReason: this.environment.GOOGLE_AUTH_ENABLED ? null : 'CONFIGURATION_REQUIRED',
      },
    });
  }
}
