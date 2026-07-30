import { Controller, Get, Inject, Req, ServiceUnavailableException, Version } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { HealthService, ReadinessError } from './health.service.js';

@Controller('health')
export class HealthController {
  public constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('live')
  @Version('1')
  public async live() {
    return this.healthService.live();
  }

  @Get('ready')
  @Version('1')
  public async ready(@Req() request: FastifyRequest) {
    try {
      const correlationId = request.headers['x-correlation-id'];
      return await this.healthService.ready({
        requestId: request.id,
        ...(typeof correlationId === 'string' ? { correlationId } : {}),
      });
    } catch (error) {
      if (error instanceof ReadinessError) {
        throw new ServiceUnavailableException({
          service: 'api',
          status: 'not_ready',
          checks: error.checks,
          requestId: request.id,
        });
      }
      throw error;
    }
  }
}
