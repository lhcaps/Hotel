import { Controller, Get, Inject, Query, UseGuards, Version } from '@nestjs/common';
import type { AdminOperationalReport } from '@room/contracts';

import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PropertyContextService } from '../catalog/property-context.service.js';
import { AdminOperationalReportService } from './admin-operational-report.service.js';

@Controller('admin/operational-report')
@UseGuards(AdminPermissionGuard)
export class AdminOperationalReportController {
  public constructor(
    @Inject(AdminOperationalReportService)
    private readonly service: AdminOperationalReportService,
    @Inject(PropertyContextService)
    private readonly propertyContext: PropertyContextService,
  ) {}

  @Get()
  @Version('1')
  @RequirePermissions('booking.lifecycle.read')
  public async getReport(@Query() query: unknown): Promise<AdminOperationalReport> {
    const property = await this.propertyContext.getCurrent();
    return this.service.getReport(property.id, query, new Date());
  }
}
