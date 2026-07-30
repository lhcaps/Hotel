import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Req,
  UnauthorizedException,
  Version,
} from '@nestjs/common';

import { parseCustomerProfilePatch } from './customer-profile.schema.js';
import { CustomerProfileValidationError } from './customer-profile.schema.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { CustomerSessionService } from '../auth/customer-session.service.js';

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly id: string;
}

@Controller('customer/profile')
export class CustomerProfileController {
  public constructor(
    @Inject(CustomerProfileService) private readonly profiles: CustomerProfileService,
    @Inject(CustomerSessionService) private readonly sessions: CustomerSessionService,
  ) {}

  @Get('session')
  @Version('1')
  public async getSession(@Req() request: RequestLike) {
    return { authenticated: (await this.sessions.getCustomer(request)) !== null };
  }

  @Get()
  @Version('1')
  public async get(@Req() request: RequestLike) {
    const actor = await this.sessions.requireCustomer(request);
    const profile = await this.profiles.getProfile(actor.userId);
    if (profile === null) {
      throw new UnauthorizedException({ code: 'CUSTOMER_PROFILE_NOT_FOUND' });
    }
    return profile;
  }

  @Patch()
  @Version('1')
  @HttpCode(HttpStatus.OK)
  public async patch(
    @Req() request: RequestLike,
    @Body() body: unknown,
  ) {
    const actor = await this.sessions.requireCustomer(request);
    let patch;
    try {
      patch = parseCustomerProfilePatch(body);
    } catch (error) {
      if (error instanceof CustomerProfileValidationError) {
        throw new UnauthorizedException({
          code: 'CUSTOMER_PROFILE_INVALID',
          issues: error.issues,
        });
      }
      throw error;
    }
    return this.profiles.patchProfile(actor.userId, patch, {
      actorId: actor.userId,
      requestId: actor.requestId,
    });
  }
}
