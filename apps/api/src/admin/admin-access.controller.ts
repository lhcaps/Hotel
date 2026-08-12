import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { AdminAccessService } from './admin-access.service.js';

@Controller('admin')
@UseGuards(AdminPermissionGuard)
export class AdminAccessController {
  public constructor(@Inject(AdminAccessService) private readonly access: AdminAccessService) {}

  @Get('accounts')
  @Version('1')
  @RequirePermissions('admin.account.read')
  public accounts(@Req() request: { actor: ActorContext }) {
    return this.access.listAccounts(request.actor);
  }

  @Get('account-properties')
  @Version('1')
  @RequirePermissions('admin.account.manage')
  public accountProperties(@Req() request: { actor: ActorContext }) {
    return this.access.listAssignableProperties(request.actor);
  }

  @Get('customer-accounts')
  @Version('1')
  @RequirePermissions('admin.account.read')
  public customerAccounts(@Req() request: { actor: ActorContext }) {
    return this.access.listCustomerAccounts(request.actor);
  }

  @Post('accounts')
  @Version('1')
  @RequirePermissions('admin.account.manage')
  public createAccount(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.access.createAccount(request.actor, body);
  }

  @Patch('customer-accounts/:id')
  @Version('1')
  @RequirePermissions('admin.account.manage')
  public updateCustomerAccount(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.access.updateCustomerAccount(request.actor, id, body);
  }

  @Post('customer-accounts/:id/revoke-sessions')
  @Version('1')
  @RequirePermissions('admin.account.manage')
  public revokeCustomerSessions(@Req() request: { actor: ActorContext }, @Param('id') id: string) {
    return this.access.revokeCustomerSessions(request.actor, id);
  }

  @Patch('accounts/:id')
  @Version('1')
  @RequirePermissions('admin.account.manage')
  public updateAccount(
    @Req() request: { actor: ActorContext },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.access.updateAccount(request.actor, id, body);
  }

  @Post('accounts/:id/revoke-sessions')
  @Version('1')
  @RequirePermissions('admin.account.manage')
  public revokeSessions(@Req() request: { actor: ActorContext }, @Param('id') id: string) {
    return this.access.revokeSessions(request.actor, id);
  }

  @Get('departments')
  @Version('1')
  @RequirePermissions('admin.department.read')
  public departments() {
    return this.access.listDepartments();
  }

  @Post('departments')
  @Version('1')
  @RequirePermissions('admin.department.manage')
  public createDepartment(@Req() request: { actor: ActorContext }, @Body() body: unknown) {
    return this.access.createDepartment(request.actor, body);
  }

  @Get('audit')
  @Version('1')
  @RequirePermissions('admin.audit.read')
  public audit(@Req() request: { actor: ActorContext }) {
    return this.access.listAudit(request.actor);
  }
}
