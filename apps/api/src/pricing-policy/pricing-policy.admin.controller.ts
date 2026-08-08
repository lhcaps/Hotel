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
import type { ApiEnvironment } from '@room/config';

import type { ActorContext } from '../auth/actor-context.js';
import { AdminPermissionGuard } from '../auth/admin-permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PricingPolicyService } from './pricing-policy.service.js';
import { API_ENVIRONMENT } from '../auth/auth.providers.js';
import {
  OperationsV3PricingCatalogGate,
  PricingPolicyBootstrapDisabledError,
} from './pricing-policy.gate.js';
import {
  actorForRequest,
  bootstrapPricingPolicyHttpSchema,
  cancelPricingPolicyHttpSchema,
  createPricingPolicyDraftHttpSchema,
  parseBootstrap,
  parseCreateDraft,
  parseUpdateDraft,
  publishPricingPolicyHttpSchema,
  serializeAggregate,
  serializeBootstrap,
  serializeCommand,
  serializeHeader,
  serializePreview,
  supersedePricingPolicyHttpSchema,
  updatePricingPolicyDraftHttpSchema,
} from './pricing-policy.http.js';

type AdminRequest = { actor: ActorContext };

@Controller('admin/pricing-policies')
@UseGuards(AdminPermissionGuard)
export class PricingPolicyAdminController {
  public constructor(
    @Inject(PricingPolicyService) private readonly service: PricingPolicyService,
    @Inject(OperationsV3PricingCatalogGate)
    private readonly catalogGate: OperationsV3PricingCatalogGate,
    @Inject(API_ENVIRONMENT)
    private readonly environment: Pick<
      ApiEnvironment,
      | 'NODE_ENV'
      | 'OPERATIONS_V3_B0_BOOTSTRAP_ENABLED'
      | 'OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED'
      | 'OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED'
    >,
  ) {}

  private assertCatalogRuntime(): void {
    this.catalogGate.assertEnabled();
  }

  private assertBootstrapEnabled(): void {
    this.assertCatalogRuntime();
    const isDevelopmentBootstrap =
      this.environment.NODE_ENV === 'development' &&
      this.environment.OPERATIONS_V3_B0_BOOTSTRAP_ENABLED;
    const isProductionRemediation =
      this.environment.NODE_ENV === 'production' &&
      this.environment.OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED;
    if (!isDevelopmentBootstrap && !isProductionRemediation) {
      throw new PricingPolicyBootstrapDisabledError();
    }
    // Production remediation may not run while public multi-night traffic is
    // live: the emergency bootstrap must never race a customer-facing rollout.
    if (isProductionRemediation && this.environment.OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED) {
      throw new PricingPolicyBootstrapDisabledError();
    }
  }

  @Get()
  @Version('1')
  @RequirePermissions('pricing.policy.read')
  public async list() {
    this.assertCatalogRuntime();
    const result = await this.service.listReleases();
    return {
      propertyId: result.propertyId,
      releases: result.releases.map(serializeHeader),
    };
  }

  @Get(':id')
  @Version('1')
  @RequirePermissions('pricing.policy.read')
  public async get(@Param('id') id: string) {
    this.assertCatalogRuntime();
    return serializeAggregate(await this.service.getRelease(id));
  }

  @Post('bootstrap')
  @Version('1')
  @RequirePermissions('pricing.policy.draft.create')
  public async bootstrap(@Req() request: AdminRequest, @Body() body: unknown) {
    this.assertBootstrapEnabled();
    bootstrapPricingPolicyHttpSchema.parse(body);
    return serializeBootstrap(
      await this.service.bootstrapDraft(actorForRequest(request.actor), parseBootstrap(body)),
    );
  }

  @Post()
  @Version('1')
  @RequirePermissions('pricing.policy.draft.create')
  public async create(@Req() request: AdminRequest, @Body() body: unknown) {
    this.assertCatalogRuntime();
    createPricingPolicyDraftHttpSchema.parse(body);
    return serializeCommand(
      await this.service.createDraft(actorForRequest(request.actor), parseCreateDraft(body)),
    );
  }

  @Patch(':id')
  @Version('1')
  @RequirePermissions('pricing.policy.draft.update')
  public async update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    this.assertCatalogRuntime();
    updatePricingPolicyDraftHttpSchema.parse(body);
    return serializeCommand(
      await this.service.updateDraft(actorForRequest(request.actor), id, parseUpdateDraft(body)),
    );
  }

  @Post(':id/preview')
  @Version('1')
  @RequirePermissions('pricing.policy.preview')
  public async preview(@Param('id') id: string) {
    this.assertCatalogRuntime();
    return serializePreview(await this.service.preview(id));
  }

  @Post(':id/cancel')
  @Version('1')
  @RequirePermissions('pricing.policy.draft.update')
  public async cancel(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    this.assertCatalogRuntime();
    const value = cancelPricingPolicyHttpSchema.parse(body);
    return serializeCommand(
      await this.service.cancelDraft(actorForRequest(request.actor), id, value.reason),
    );
  }

  @Post(':id/publish')
  @Version('1')
  @RequirePermissions('pricing.policy.publish')
  public async publish(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    this.assertCatalogRuntime();
    const value = publishPricingPolicyHttpSchema.parse(body);
    return serializeCommand(
      await this.service.publishInitial(actorForRequest(request.actor), id, value.idempotencyKey),
    );
  }

  @Post(':predecessorId/supersede')
  @Version('1')
  @RequirePermissions('pricing.policy.publish')
  public async supersede(
    @Req() request: AdminRequest,
    @Param('predecessorId') predecessorId: string,
    @Body() body: unknown,
  ) {
    this.assertCatalogRuntime();
    const value = supersedePricingPolicyHttpSchema.parse(body);
    return serializeCommand(
      await this.service.scheduleSupersession(
        actorForRequest(request.actor),
        predecessorId,
        value.successorId,
        new Date(value.cutover),
        value.idempotencyKey,
      ),
    );
  }

  @Post(':id/retire')
  @Version('1')
  @RequirePermissions('pricing.policy.retire')
  public async retire(@Req() request: AdminRequest, @Param('id') id: string) {
    this.assertCatalogRuntime();
    return serializeCommand(await this.service.retire(actorForRequest(request.actor), id));
  }
}
