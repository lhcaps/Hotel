import { randomUUID } from 'node:crypto';

import type { ActorContext } from '../auth/actor-context.js';

import {
  PRICING_POLICY_RULE_SCHEMA_VERSION,
  type DraftPricingPolicyAggregate,
  type DraftPricingPolicyEdge,
  type DraftPricingPolicyPrice,
  type DraftPricingPolicyComponent,
  type DraftPricingPolicyRoot,
  type PricingPolicyApplicabilityBasis,
  type PricingPolicyReleaseAggregate,
  type PricingPolicyValidationResult,
} from './pricing-policy.domain.js';
import {
  PricingPolicyConflictError,
  PricingPolicyNotFoundError,
  PricingPolicyValidationError,
} from './pricing-policy.errors.js';
import { PricingPolicyEventWriter } from './pricing-policy.events.js';
import { PricingPolicyRepository, type PricingPolicyHeader } from './pricing-policy.repository.js';
import { validatePricingPolicyAggregate } from './pricing-policy.validator.js';

export interface PricingPolicyTransactionManager {
  transaction<T>(operation: (transaction: unknown) => Promise<T>): Promise<T>;
}

export type PricingPolicyActor = Pick<ActorContext, 'userId' | 'requestId'> & {
  readonly correlationId?: string;
};

export interface CreateDraftPricingPolicyInput {
  readonly internalName: string;
  readonly effectiveFrom: Date;
  readonly effectiveUntil?: Date | null;
  readonly maximumComponentLines?: number;
  readonly changeNote?: string | null;
}

export interface UpdateDraftPricingPolicyInput {
  readonly internalName: string;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly maximumComponentLines: number;
  readonly changeNote: string | null;
  readonly components: DraftPricingPolicyAggregate['components'];
  readonly prices: readonly DraftPricingPolicyPrice[];
  readonly edges: readonly DraftPricingPolicyEdge[];
  readonly expectedUpdatedAt?: Date;
}

export interface PricingPolicyCommandResult {
  readonly policyId: string;
  readonly propertyId: string;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'RETIRED' | 'CANCELLED';
  readonly versionNumber: bigint;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
}

export interface PricingPolicyPreviewResult extends PricingPolicyValidationResult {
  readonly policyId: string;
  readonly propertyId: string;
}

export interface BootstrapPricingPolicyInput {
  readonly internalName: string;
  readonly effectiveFrom: Date;
  readonly effectiveUntil?: Date | null;
  readonly overnightWindow: '21-09' | '22-10';
  readonly nightPlanCode: string;
  readonly extraHourPlanCode: string;
  readonly idempotencyKey: string;
  readonly dryRun: boolean;
}

export interface BootstrapPricingPolicyResult extends PricingPolicyPreviewResult {
  readonly dryRun: boolean;
  readonly created: boolean;
  readonly idempotent: boolean;
  readonly versionNumber: bigint;
  readonly provenance: Readonly<Record<string, string>>;
}

function correlationId(actor: PricingPolicyActor): string | null {
  return actor.correlationId ?? null;
}

function resultFromDraft(
  aggregate: DraftPricingPolicyAggregate,
  status: PricingPolicyCommandResult['status'],
): PricingPolicyCommandResult {
  return {
    policyId: aggregate.root.id,
    propertyId: aggregate.root.propertyId,
    status,
    versionNumber: aggregate.root.versionNumber,
    effectiveFrom: aggregate.root.effectiveFrom,
    effectiveUntil: aggregate.root.effectiveUntil,
  };
}

function bootstrapComponent(
  rootId: string,
  id: string,
  input: Omit<DraftPricingPolicyComponent, 'id' | 'policyVersionId'>,
): DraftPricingPolicyComponent {
  return { id, policyVersionId: rootId, ...input };
}

function bootstrapAggregate(input: {
  readonly root: DraftPricingPolicyRoot;
  readonly nightPlan: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly prices: ReadonlyMap<string, bigint>;
  };
  readonly extraPlan: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly prices: ReadonlyMap<string, bigint>;
  };
  readonly tierIds: readonly string[];
  readonly overnightWindow: '21-09' | '22-10';
}): DraftPricingPolicyAggregate {
  const window =
    input.overnightWindow === '21-09' ? { start: 1_260, end: 540 } : { start: 1_320, end: 600 };
  const leadingId = randomUUID();
  const continuationId = randomUUID();
  const finalId = randomUUID();
  const trailingId = randomUUID();
  const common = {
    conditionComplexityRank: 0,
    tieBreakRank: 0,
    restrictionMetadata: {},
    displayMetadata: {},
  } as const;
  const leading = bootstrapComponent(input.root.id, leadingId, {
    ...common,
    componentCode: 'B0_LEADING',
    componentKind: 'EXTENSION',
    coverageModel: 'REQUEST_BOUNDARY',
    billingModel: 'STARTED_UNIT',
    fixedDurationMinutes: null,
    localStartMinuteInclusive: null,
    localEndMinuteExclusive: null,
    localEndDayOffset: null,
    boundaryPosition: 'LEADING',
    boundaryMinDurationMinutes: 15,
    boundaryMaxDurationMinutes: 300,
    billingUnitMinutes: 60,
    minimumBillingUnits: 1,
    maximumBillingUnits: 5,
    maximumOccurrencesPerCandidate: 1,
    legacyProvenance: {
      sourceKind: 'V1_RATE_PLAN',
      ratePlanId: input.extraPlan.id,
      technicalPlanCode: input.extraPlan.code,
      technicalPlanName: input.extraPlan.name,
      boundaryPosition: 'LEADING',
    },
  });
  const continuation = bootstrapComponent(input.root.id, continuationId, {
    ...common,
    componentCode: 'B0_CONTINUATION',
    componentKind: 'BASE_STAY',
    coverageModel: 'FIXED_ELAPSED',
    billingModel: 'FIXED_OCCURRENCE',
    fixedDurationMinutes: 1_440,
    localStartMinuteInclusive: null,
    localEndMinuteExclusive: null,
    localEndDayOffset: null,
    boundaryPosition: null,
    boundaryMinDurationMinutes: null,
    boundaryMaxDurationMinutes: null,
    billingUnitMinutes: null,
    minimumBillingUnits: null,
    maximumBillingUnits: null,
    maximumOccurrencesPerCandidate: 31,
    legacyProvenance: {
      sourceKind: 'V1_RATE_PLAN',
      ratePlanId: input.nightPlan.id,
      technicalPlanCode: input.nightPlan.code,
      technicalPlanName: input.nightPlan.name,
      componentRole: 'CONTINUATION',
    },
  });
  const finalNight = bootstrapComponent(input.root.id, finalId, {
    ...common,
    componentCode: 'B0_FINAL_NIGHT',
    componentKind: 'BASE_STAY',
    coverageModel: 'LOCAL_CLOCK_WINDOW',
    billingModel: 'FIXED_OCCURRENCE',
    fixedDurationMinutes: null,
    localStartMinuteInclusive: window.start,
    localEndMinuteExclusive: window.end,
    localEndDayOffset: 1,
    boundaryPosition: null,
    boundaryMinDurationMinutes: null,
    boundaryMaxDurationMinutes: null,
    billingUnitMinutes: null,
    minimumBillingUnits: null,
    maximumBillingUnits: null,
    maximumOccurrencesPerCandidate: 1,
    legacyProvenance: {
      sourceKind: 'V1_RATE_PLAN',
      ratePlanId: input.nightPlan.id,
      technicalPlanCode: input.nightPlan.code,
      technicalPlanName: input.nightPlan.name,
      componentRole: 'FINAL_NIGHT',
      overnightWindow: input.overnightWindow,
    },
  });
  const trailing = bootstrapComponent(input.root.id, trailingId, {
    ...common,
    componentCode: 'B0_TRAILING',
    componentKind: 'EXTENSION',
    coverageModel: 'REQUEST_BOUNDARY',
    billingModel: 'STARTED_UNIT',
    fixedDurationMinutes: null,
    localStartMinuteInclusive: null,
    localEndMinuteExclusive: null,
    localEndDayOffset: null,
    boundaryPosition: 'TRAILING',
    boundaryMinDurationMinutes: 15,
    boundaryMaxDurationMinutes: 300,
    billingUnitMinutes: 60,
    minimumBillingUnits: 1,
    maximumBillingUnits: 5,
    maximumOccurrencesPerCandidate: 1,
    legacyProvenance: {
      sourceKind: 'V1_RATE_PLAN',
      ratePlanId: input.extraPlan.id,
      technicalPlanCode: input.extraPlan.code,
      technicalPlanName: input.extraPlan.name,
      boundaryPosition: 'TRAILING',
    },
  });
  const components = [leading, continuation, finalNight, trailing];
  const prices = components.flatMap((component) => {
    const source =
      component.componentCode === 'B0_LEADING' || component.componentCode === 'B0_TRAILING'
        ? input.extraPlan.prices
        : input.nightPlan.prices;
    return input.tierIds.map((priceTierId) => ({
      id: randomUUID(),
      propertyId: input.root.propertyId,
      policyVersionId: input.root.id,
      componentId: component.id,
      priceTierId,
      amountVnd: source.get(priceTierId) as bigint,
    }));
  });
  const edge = (predecessorComponentId: string, successorComponentId: string) => ({
    id: randomUUID(),
    policyVersionId: input.root.id,
    predecessorComponentId,
    successorComponentId,
    restrictionMetadata: null,
  });
  return {
    root: input.root,
    components,
    prices,
    edges: [
      edge(leadingId, continuationId),
      edge(leadingId, finalId),
      edge(continuationId, continuationId),
      edge(continuationId, finalId),
      edge(finalId, trailingId),
    ],
  };
}

export class PricingPolicyService {
  public constructor(
    private readonly database: PricingPolicyTransactionManager,
    private readonly repository: PricingPolicyRepository,
    private readonly events: PricingPolicyEventWriter,
    private readonly defaultBasis: PricingPolicyApplicabilityBasis = 'STAY_START',
  ) {}

  public async listReleases(): Promise<{
    readonly propertyId: string;
    readonly releases: readonly PricingPolicyHeader[];
  }> {
    const property = await this.repository.getCurrentProperty();
    if (property === undefined) throw new PricingPolicyNotFoundError();
    return {
      propertyId: property.id,
      releases: await this.repository.listHeaders(undefined, property.id),
    };
  }

  public async getRelease(policyId: string): Promise<PricingPolicyReleaseAggregate> {
    const property = await this.repository.getCurrentProperty();
    const release = await this.repository.getReleaseAggregate(undefined, policyId);
    if (
      property === undefined ||
      release === undefined ||
      release.root.propertyId !== property.id
    ) {
      throw new PricingPolicyNotFoundError();
    }
    return release;
  }

  public async createDraft(
    actor: PricingPolicyActor,
    input: CreateDraftPricingPolicyInput,
  ): Promise<PricingPolicyCommandResult> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      if (property === undefined) throw new PricingPolicyNotFoundError();
      await this.repository.lockProperty(transaction, property.id);
      const createdAt = new Date();
      const policyId = randomUUID();
      const versionNumber = await this.repository.allocateNextVersion(transaction, property.id);
      await this.repository.insertDraft(transaction, {
        id: policyId,
        propertyId: property.id,
        versionNumber,
        internalName: input.internalName.trim(),
        applicabilityBasis: this.defaultBasis,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
        timezoneSnapshot: property.timezone,
        ruleSchemaVersion: PRICING_POLICY_RULE_SCHEMA_VERSION,
        maximumComponentLines: input.maximumComponentLines ?? 64,
        createdBy: actor.userId,
        createdAt,
        changeNote: input.changeNote ?? null,
      });
      await this.events.write(transaction, {
        propertyId: property.id,
        policyId,
        eventType: 'PRICING_POLICY_DRAFT_CREATED',
        actorId: actor.userId,
        requestId: actor.requestId,
        correlationId: correlationId(actor),
        payload: { versionNumber: String(versionNumber), basis: this.defaultBasis },
      });
      return {
        policyId,
        propertyId: property.id,
        status: 'DRAFT',
        versionNumber,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
      };
    });
  }

  public async bootstrapDraft(
    actor: PricingPolicyActor,
    input: BootstrapPricingPolicyInput,
  ): Promise<BootstrapPricingPolicyResult> {
    const normalizedKey = input.idempotencyKey.trim();
    if (normalizedKey.length < 8 || normalizedKey.length > 160)
      throw new PricingPolicyConflictError(
        'A valid idempotency key is required.',
        'INVALID_IDEMPOTENCY_KEY',
      );
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      if (property === undefined) throw new PricingPolicyNotFoundError();
      if (!input.dryRun) {
        const existingId = await this.repository.findIdempotentEvent(
          transaction,
          property.id,
          'PRICING_POLICY_DRAFT_BOOTSTRAPPED',
          normalizedKey,
        );
        if (existingId !== undefined) {
          const existing = await this.repository.getReleaseAggregate(transaction, existingId);
          if (existing === undefined)
            throw new PricingPolicyConflictError(
              'Bootstrap idempotency record is inconsistent.',
              'IDEMPOTENCY_INCONSISTENT',
            );
          const preview = validatePricingPolicyAggregate(existing as DraftPricingPolicyAggregate, {
            propertyId: property.id,
            propertyTimezone: property.timezone,
            priceTierIds: await this.repository.getPriceTierIds(transaction, property.id),
            requiredPriceTierIds: await this.repository.getPriceTierIds(transaction, property.id),
          });
          return {
            ...preview,
            policyId: existing.root.id,
            propertyId: property.id,
            dryRun: false,
            created: false,
            idempotent: true,
            versionNumber: existing.root.versionNumber,
            provenance: { idempotencyKey: normalizedKey, source: 'V1_RATE_PLAN' },
          };
        }
      }
      await this.repository.lockProperty(transaction, property.id);
      const source = await this.repository.getV1BootstrapSource(
        transaction,
        property.id,
        input.nightPlanCode,
        input.extraHourPlanCode,
      );
      if (source === undefined)
        throw new PricingPolicyConflictError(
          'Active V1 technical plan types and complete tier prices are required.',
          'BOOTSTRAP_SOURCE_INVALID',
        );
      const versionNumber = await this.repository.allocateNextVersion(transaction, property.id);
      const policyId = randomUUID();
      const provenance = {
        source: 'V1_RATE_PLAN',
        nightPlanId: source.night.id,
        nightPlanCode: source.night.code,
        extraHourPlanId: source.extraHour.id,
        extraHourPlanCode: source.extraHour.code,
        overnightWindow: input.overnightWindow,
        idempotencyKey: normalizedKey,
      } as const;
      const root: DraftPricingPolicyRoot = {
        id: policyId,
        propertyId: property.id,
        versionNumber,
        internalName: input.internalName.trim(),
        status: 'DRAFT',
        applicabilityBasis: 'STAY_START',
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
        timezoneSnapshot: property.timezone,
        ruleSchemaVersion: PRICING_POLICY_RULE_SCHEMA_VERSION,
        maximumComponentLines: 64,
        createdBy: actor.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        changeNote: 'B0 explicit V1 technical-plan bootstrap',
        legacyProvenance: provenance,
      };
      const aggregate = bootstrapAggregate({
        root,
        nightPlan: source.night,
        extraPlan: source.extraHour,
        tierIds: source.tiers.map((tier) => tier.id),
        overnightWindow: input.overnightWindow,
      });
      const tiers = new Set(source.tiers.map((tier) => tier.id));
      const preview = validatePricingPolicyAggregate(aggregate, {
        propertyId: property.id,
        propertyTimezone: property.timezone,
        priceTierIds: tiers,
        requiredPriceTierIds: tiers,
      });
      if (!input.dryRun) {
        await this.repository.insertDraft(transaction, {
          id: root.id,
          propertyId: root.propertyId,
          versionNumber: root.versionNumber,
          internalName: root.internalName,
          applicabilityBasis: root.applicabilityBasis,
          effectiveFrom: root.effectiveFrom,
          effectiveUntil: root.effectiveUntil,
          timezoneSnapshot: root.timezoneSnapshot,
          ruleSchemaVersion: root.ruleSchemaVersion,
          maximumComponentLines: root.maximumComponentLines,
          createdBy: root.createdBy,
          createdAt: root.createdAt,
          changeNote: root.changeNote,
        });
        await this.repository.replaceDraftContents(transaction, aggregate);
        await this.events.write(transaction, {
          propertyId: property.id,
          policyId,
          eventType: 'PRICING_POLICY_DRAFT_BOOTSTRAPPED',
          actorId: actor.userId,
          requestId: actor.requestId,
          correlationId: correlationId(actor),
          payload: {
            idempotencyKey: normalizedKey,
            nightPlanCode: source.night.code,
            extraHourPlanCode: source.extraHour.code,
            overnightWindow: input.overnightWindow,
            tierCount: source.tiers.length,
          },
        });
      }
      return {
        ...preview,
        policyId,
        propertyId: property.id,
        dryRun: input.dryRun,
        created: !input.dryRun,
        idempotent: false,
        versionNumber,
        provenance,
      };
    });
  }

  public async updateDraft(
    actor: PricingPolicyActor,
    policyId: string,
    input: UpdateDraftPricingPolicyInput,
  ): Promise<PricingPolicyCommandResult> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      const existing = await this.repository.getAggregate(transaction, policyId);
      if (
        property === undefined ||
        existing === undefined ||
        existing.root.propertyId !== property.id
      )
        throw new PricingPolicyNotFoundError();
      await this.repository.lockProperty(transaction, property.id);
      await this.repository.lockPolicy(transaction, policyId);
      const locked = await this.repository.getAggregate(transaction, policyId);
      if (locked === undefined)
        throw new PricingPolicyConflictError(
          'Only a DRAFT policy can be updated.',
          'PRICING_POLICY_NOT_DRAFT',
        );
      if (
        input.expectedUpdatedAt !== undefined &&
        locked.root.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
      )
        throw new PricingPolicyConflictError(
          'Draft was changed by another operation.',
          'PRICING_POLICY_STALE',
        );
      const updatedAt = new Date();
      const root = {
        ...locked.root,
        internalName: input.internalName.trim(),
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil,
        maximumComponentLines: input.maximumComponentLines,
        changeNote: input.changeNote,
        updatedAt,
      };
      const aggregate: DraftPricingPolicyAggregate = {
        root,
        components: input.components,
        prices: input.prices,
        edges: input.edges,
      };
      await this.repository.updateDraftRoot(
        transaction,
        policyId,
        {
          internalName: root.internalName,
          applicabilityBasis: root.applicabilityBasis,
          effectiveFrom: root.effectiveFrom,
          effectiveUntil: root.effectiveUntil,
          timezoneSnapshot: root.timezoneSnapshot,
          ruleSchemaVersion: root.ruleSchemaVersion,
          maximumComponentLines: root.maximumComponentLines,
          changeNote: root.changeNote,
        },
        updatedAt,
      );
      await this.repository.replaceDraftContents(transaction, aggregate);
      await this.events.write(transaction, {
        propertyId: property.id,
        policyId,
        eventType: 'PRICING_POLICY_DRAFT_UPDATED',
        actorId: actor.userId,
        requestId: actor.requestId,
        correlationId: correlationId(actor),
        payload: {
          componentCount: aggregate.components.length,
          priceCount: aggregate.prices.length,
          edgeCount: aggregate.edges.length,
        },
      });
      return resultFromDraft(aggregate, 'DRAFT');
    });
  }

  public async cancelDraft(
    actor: PricingPolicyActor,
    policyId: string,
    reason: string,
  ): Promise<PricingPolicyCommandResult> {
    const normalizedReason = reason.trim();
    if (normalizedReason.length === 0 || normalizedReason.length > 500)
      throw new PricingPolicyConflictError(
        'Cancellation reason must be 1-500 characters.',
        'INVALID_CANCELLATION_REASON',
      );
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      const header = await this.repository.getHeader(transaction, policyId);
      if (property === undefined || header === undefined || header.propertyId !== property.id)
        throw new PricingPolicyNotFoundError();
      await this.repository.lockProperty(transaction, property.id);
      await this.repository.lockPolicy(transaction, policyId);
      const lockedHeader = await this.repository.getHeader(transaction, policyId);
      if (lockedHeader === undefined || lockedHeader.propertyId !== property.id)
        throw new PricingPolicyNotFoundError();
      if (lockedHeader.status !== 'DRAFT')
        throw new PricingPolicyConflictError(
          'Only a DRAFT policy can be cancelled.',
          'PUBLISHED_CANCELLATION_FORBIDDEN',
        );
      const cancelledAt = new Date();
      await this.repository.cancelDraft(
        transaction,
        policyId,
        actor.userId,
        cancelledAt,
        normalizedReason,
      );
      await this.events.write(transaction, {
        propertyId: property.id,
        policyId,
        eventType: 'PRICING_POLICY_DRAFT_CANCELLED',
        actorId: actor.userId,
        requestId: actor.requestId,
        correlationId: correlationId(actor),
        payload: { reasonCategory: 'OPERATOR_CANCELLED' },
      });
      return {
        ...resultFromHeader(lockedHeader, 'CANCELLED'),
        effectiveUntil: lockedHeader.effectiveUntil,
      };
    });
  }

  public async preview(policyId: string): Promise<PricingPolicyPreviewResult> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      const aggregate = await this.repository.getAggregate(transaction, policyId);
      if (
        property === undefined ||
        aggregate === undefined ||
        aggregate.root.propertyId !== property.id
      )
        throw new PricingPolicyNotFoundError();
      const lineage = await this.repository.getLineage(transaction, property.id);
      const tiers = await this.repository.getPriceTierIds(transaction, property.id);
      const validation = validatePricingPolicyAggregate(aggregate, {
        propertyId: property.id,
        propertyTimezone: property.timezone,
        ...(lineage[0] === undefined ? {} : { establishedBasis: lineage[0].applicabilityBasis }),
        priceTierIds: tiers,
        requiredPriceTierIds: tiers,
      });
      return { ...validation, policyId, propertyId: property.id };
    });
  }

  public async publishInitial(
    actor: PricingPolicyActor,
    policyId: string,
    idempotencyKey?: string,
  ): Promise<PricingPolicyCommandResult> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      if (property === undefined) throw new PricingPolicyNotFoundError();
      if (idempotencyKey !== undefined) {
        const existingId = await this.repository.findIdempotentEvent(
          transaction,
          property.id,
          'PRICING_POLICY_PUBLISHED',
          idempotencyKey,
        );
        if (existingId !== undefined) {
          const existing = await this.repository.getHeader(transaction, existingId);
          if (existing === undefined)
            throw new PricingPolicyConflictError(
              'Publication idempotency record is inconsistent.',
              'IDEMPOTENCY_INCONSISTENT',
            );
          return resultFromHeader(existing, 'PUBLISHED');
        }
      }
      await this.repository.lockProperty(transaction, property.id);
      await this.repository.lockPolicy(transaction, policyId);
      const aggregate = await this.repository.getAggregate(transaction, policyId);
      if (aggregate === undefined || aggregate.root.propertyId !== property.id)
        throw new PricingPolicyNotFoundError();
      const lineage = await this.repository.getLineage(transaction, property.id);
      if (lineage.length > 0)
        throw new PricingPolicyConflictError(
          'Initial publication is only allowed before a property has a published lineage.',
          'INITIAL_PUBLICATION_NOT_AVAILABLE',
        );
      const validated = await this.validateForPublication(
        transaction,
        property.id,
        property.timezone,
        aggregate,
      );
      const publishedAt = new Date();
      await this.repository.publishDraft(transaction, policyId, actor.userId, publishedAt);
      await this.events.write(transaction, {
        propertyId: property.id,
        policyId,
        eventType: 'PRICING_POLICY_PUBLISHED',
        actorId: actor.userId,
        requestId: actor.requestId,
        correlationId: correlationId(actor),
        payload: {
          publication: 'INITIAL',
          basis: validated.normalized.root.applicabilityBasis,
          versionNumber: String(aggregate.root.versionNumber),
          ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
        },
      });
      return resultFromDraft(
        { ...validated.normalized, root: { ...validated.normalized.root, status: 'DRAFT' } },
        'PUBLISHED',
      );
    });
  }

  public async scheduleSupersession(
    actor: PricingPolicyActor,
    predecessorId: string,
    successorId: string,
    cutover: Date,
    idempotencyKey?: string,
  ): Promise<PricingPolicyCommandResult> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      if (property === undefined) throw new PricingPolicyNotFoundError();
      if (idempotencyKey !== undefined) {
        const existingId = await this.repository.findIdempotentEvent(
          transaction,
          property.id,
          'PRICING_POLICY_SUPERSEDED',
          idempotencyKey,
        );
        if (existingId !== undefined) {
          const existing = await this.repository.getHeader(transaction, existingId);
          if (existing === undefined)
            throw new PricingPolicyConflictError(
              'Supersession idempotency record is inconsistent.',
              'IDEMPOTENCY_INCONSISTENT',
            );
          return resultFromHeader(existing, 'PUBLISHED');
        }
      }
      await this.repository.lockProperty(transaction, property.id);
      await this.repository.lockPolicy(transaction, predecessorId);
      await this.repository.lockPolicy(transaction, successorId);
      const predecessor = await this.repository.getHeader(transaction, predecessorId);
      const successor = await this.repository.getAggregate(transaction, successorId);
      if (
        predecessor === undefined ||
        successor === undefined ||
        predecessor.propertyId !== property.id ||
        successor.root.propertyId !== property.id
      )
        throw new PricingPolicyNotFoundError();
      if (predecessor.status !== 'PUBLISHED')
        throw new PricingPolicyConflictError(
          'Supersession predecessor must be PUBLISHED.',
          'INVALID_SUPERSESSION_PREDECESSOR',
        );
      if (
        cutover < predecessor.effectiveFrom ||
        (predecessor.effectiveUntil !== null && cutover >= predecessor.effectiveUntil)
      )
        throw new PricingPolicyConflictError(
          'Cutover must be inside the predecessor interval.',
          'INVALID_CUTOVER',
        );
      if (cutover < new Date())
        throw new PricingPolicyConflictError('Cutover cannot be in the past.', 'INVALID_CUTOVER');
      const candidate: DraftPricingPolicyAggregate = {
        root: { ...successor.root, effectiveFrom: cutover },
        components: successor.components,
        prices: successor.prices,
        edges: successor.edges,
      };
      const validated = await this.validateForPublication(
        transaction,
        property.id,
        property.timezone,
        candidate,
        predecessor.applicabilityBasis,
      );
      const changedAt = new Date();
      await this.repository.closePublished(transaction, predecessorId, cutover, changedAt);
      await this.repository.updateDraftRoot(
        transaction,
        successorId,
        {
          internalName: candidate.root.internalName,
          applicabilityBasis: candidate.root.applicabilityBasis,
          effectiveFrom: candidate.root.effectiveFrom,
          effectiveUntil: candidate.root.effectiveUntil,
          timezoneSnapshot: candidate.root.timezoneSnapshot,
          ruleSchemaVersion: candidate.root.ruleSchemaVersion,
          maximumComponentLines: candidate.root.maximumComponentLines,
          changeNote: candidate.root.changeNote,
        },
        changedAt,
      );
      await this.repository.publishDraft(transaction, successorId, actor.userId, changedAt);
      await this.events.write(transaction, {
        propertyId: property.id,
        policyId: successorId,
        eventType: 'PRICING_POLICY_SUPERSEDED',
        actorId: actor.userId,
        requestId: actor.requestId,
        correlationId: correlationId(actor),
        payload: {
          predecessorPolicyId: predecessorId,
          successorPolicyId: successorId,
          basis: validated.normalized.root.applicabilityBasis,
          cutover: cutover.toISOString(),
          ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
        },
      });
      return resultFromDraft(candidate, 'PUBLISHED');
    });
  }

  public async retire(
    actor: PricingPolicyActor,
    policyId: string,
  ): Promise<PricingPolicyCommandResult> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(transaction);
      const header = await this.repository.getHeader(transaction, policyId);
      if (property === undefined || header === undefined || header.propertyId !== property.id)
        throw new PricingPolicyNotFoundError();
      await this.repository.lockProperty(transaction, property.id);
      await this.repository.lockPolicy(transaction, policyId);
      const lockedHeader = await this.repository.getHeader(transaction, policyId);
      if (lockedHeader === undefined || lockedHeader.propertyId !== property.id)
        throw new PricingPolicyNotFoundError();
      if (lockedHeader.status !== 'PUBLISHED')
        throw new PricingPolicyConflictError(
          'Only a PUBLISHED policy can be retired.',
          'INVALID_RETIREMENT_STATUS',
        );
      if (lockedHeader.effectiveUntil === null || lockedHeader.effectiveUntil > new Date())
        throw new PricingPolicyConflictError(
          'A policy may be retired only after its effective interval has ended.',
          'PREMATURE_RETIREMENT',
        );
      const retiredAt = new Date();
      await this.repository.retirePublished(transaction, policyId, actor.userId, retiredAt);
      await this.events.write(transaction, {
        propertyId: property.id,
        policyId,
        eventType: 'PRICING_POLICY_RETIRED',
        actorId: actor.userId,
        requestId: actor.requestId,
        correlationId: correlationId(actor),
        payload: { basis: lockedHeader.applicabilityBasis },
      });
      return resultFromHeader(lockedHeader, 'RETIRED');
    });
  }

  private async validateForPublication(
    transaction: unknown,
    propertyId: string,
    propertyTimezone: string,
    aggregate: DraftPricingPolicyAggregate,
    establishedBasis?: PricingPolicyApplicabilityBasis,
  ): Promise<PricingPolicyValidationResult & { readonly normalized: DraftPricingPolicyAggregate }> {
    const tiers = await this.repository.getPriceTierIds(transaction, propertyId);
    const result = validatePricingPolicyAggregate(aggregate, {
      propertyId,
      propertyTimezone,
      ...(establishedBasis === undefined ? {} : { establishedBasis }),
      priceTierIds: tiers,
      requiredPriceTierIds: tiers,
    });
    if (!result.publicationReady || result.normalized === undefined)
      throw new PricingPolicyValidationError(result.errors);
    return { ...result, normalized: result.normalized };
  }
}

function resultFromHeader(
  header: {
    readonly id: string;
    readonly propertyId: string;
    readonly versionNumber: bigint;
    readonly effectiveFrom: Date;
    readonly effectiveUntil: Date | null;
  },
  status: PricingPolicyCommandResult['status'],
): PricingPolicyCommandResult {
  return {
    policyId: header.id,
    propertyId: header.propertyId,
    status,
    versionNumber: header.versionNumber,
    effectiveFrom: header.effectiveFrom,
    effectiveUntil: header.effectiveUntil,
  };
}
