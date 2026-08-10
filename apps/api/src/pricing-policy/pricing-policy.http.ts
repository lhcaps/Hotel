import { z } from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';
import type {
  DraftPricingPolicyAggregate,
  PricingPolicyReleaseAggregate,
} from './pricing-policy.domain.js';
import type {
  BootstrapPricingPolicyInput,
  CreateDraftPricingPolicyInput,
  PricingPolicyCommandResult,
  PricingPolicyPreviewResult,
  BootstrapPricingPolicyResult,
  UpdateDraftPricingPolicyInput,
} from './pricing-policy.service.js';
import type { PricingPolicyHeader } from './pricing-policy.repository.js';

const instant = z.string().datetime({ offset: true });
const jsonObject = z.record(z.string(), z.json());
const component = z
  .object({
    id: z.uuid(),
    policyVersionId: z.uuid(),
    componentCode: z.string().regex(/^[A-Z0-9_]{1,64}$/),
    componentKind: z.enum(['BASE_STAY', 'EXTENSION']),
    coverageModel: z.enum(['FIXED_ELAPSED', 'LOCAL_CLOCK_WINDOW', 'REQUEST_BOUNDARY']),
    billingModel: z.enum(['FIXED_OCCURRENCE', 'STARTED_UNIT']),
    fixedDurationMinutes: z.number().int().nullable(),
    localStartMinuteInclusive: z.number().int().nullable(),
    localEndMinuteExclusive: z.number().int().nullable(),
    localEndDayOffset: z.number().int().nullable(),
    boundaryPosition: z.enum(['LEADING', 'TRAILING']).nullable(),
    boundaryMinDurationMinutes: z.number().int().nullable(),
    boundaryMaxDurationMinutes: z.number().int().nullable(),
    billingUnitMinutes: z.number().int().nullable(),
    minimumBillingUnits: z.number().int().nullable(),
    maximumBillingUnits: z.number().int().nullable(),
    maximumOccurrencesPerCandidate: z.number().int(),
    conditionComplexityRank: z.number().int(),
    tieBreakRank: z.number().int(),
    restrictionMetadata: jsonObject,
    displayMetadata: jsonObject,
    legacyProvenance: jsonObject.nullable(),
  })
  .strict();
const price = z
  .object({
    id: z.uuid(),
    propertyId: z.uuid(),
    policyVersionId: z.uuid(),
    componentId: z.uuid(),
    priceTierId: z.uuid(),
    amountVnd: z.string().regex(/^[1-9]\d*$/),
  })
  .strict();
const edge = z
  .object({
    id: z.uuid(),
    policyVersionId: z.uuid(),
    predecessorComponentId: z.uuid(),
    successorComponentId: z.uuid(),
    restrictionMetadata: jsonObject.nullable(),
  })
  .strict();

export const createPricingPolicyDraftHttpSchema = z
  .object({
    internalName: z.string().trim().min(1).max(200),
    effectiveFrom: instant,
    effectiveUntil: instant.nullable().optional(),
    maximumComponentLines: z.number().int().min(1).max(64).optional(),
    changeNote: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updatePricingPolicyDraftHttpSchema = z
  .object({
    internalName: z.string().trim().min(1).max(200),
    effectiveFrom: instant,
    effectiveUntil: instant.nullable(),
    maximumComponentLines: z.number().int().min(1).max(64),
    changeNote: z.string().trim().max(500).nullable(),
    components: z.array(component).max(64),
    prices: z.array(price).max(4_096),
    edges: z.array(edge).max(4_096),
    expectedUpdatedAt: instant.optional(),
  })
  .strict();

export const bootstrapPricingPolicyHttpSchema = z
  .object({
    internalName: z.string().trim().min(1).max(200),
    effectiveFrom: instant,
    effectiveUntil: instant.nullable().optional(),
    overnightWindow: z.enum(['21-09', '22-10']),
    nightPlanCode: z.string().regex(/^[A-Z0-9_]{1,64}$/),
    extraHourPlanCode: z.literal('EXTRA_HOUR'),
    idempotencyKey: z.string().trim().min(8).max(160),
    dryRun: z.boolean().default(false),
  })
  .strict();

export const cancelPricingPolicyHttpSchema = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();

export const supersedePricingPolicyHttpSchema = z
  .object({
    successorId: z.uuid(),
    cutover: instant,
    idempotencyKey: z.string().trim().min(8).max(160),
  })
  .strict();

export const publishPricingPolicyHttpSchema = z
  .object({ idempotencyKey: z.string().trim().min(8).max(160) })
  .strict();

export function parseCreateDraft(input: unknown): CreateDraftPricingPolicyInput {
  const value = createPricingPolicyDraftHttpSchema.parse(input);
  return {
    internalName: value.internalName,
    effectiveFrom: new Date(value.effectiveFrom),
    effectiveUntil:
      value.effectiveUntil === undefined || value.effectiveUntil === null
        ? null
        : new Date(value.effectiveUntil),
    ...(value.maximumComponentLines === undefined
      ? {}
      : { maximumComponentLines: value.maximumComponentLines }),
    ...(value.changeNote === undefined ? {} : { changeNote: value.changeNote }),
  };
}

export function parseUpdateDraft(input: unknown): UpdateDraftPricingPolicyInput {
  const value = updatePricingPolicyDraftHttpSchema.parse(input);
  return {
    internalName: value.internalName,
    effectiveFrom: new Date(value.effectiveFrom),
    effectiveUntil: value.effectiveUntil === null ? null : new Date(value.effectiveUntil),
    maximumComponentLines: value.maximumComponentLines,
    changeNote: value.changeNote,
    components: value.components,
    prices: value.prices.map((item) => ({ ...item, amountVnd: BigInt(item.amountVnd) })),
    edges: value.edges,
    ...(value.expectedUpdatedAt === undefined
      ? {}
      : { expectedUpdatedAt: new Date(value.expectedUpdatedAt) }),
  };
}

export function parseBootstrap(input: unknown): BootstrapPricingPolicyInput {
  const value = bootstrapPricingPolicyHttpSchema.parse(input);
  return {
    internalName: value.internalName,
    effectiveFrom: new Date(value.effectiveFrom),
    effectiveUntil:
      value.effectiveUntil === undefined || value.effectiveUntil === null
        ? null
        : new Date(value.effectiveUntil),
    overnightWindow: value.overnightWindow,
    nightPlanCode: value.nightPlanCode,
    extraHourPlanCode: value.extraHourPlanCode,
    idempotencyKey: value.idempotencyKey,
    dryRun: value.dryRun,
  };
}

export function serializeCommand(result: PricingPolicyCommandResult) {
  return {
    ...result,
    versionNumber: result.versionNumber.toString(),
    effectiveFrom: result.effectiveFrom.toISOString(),
    effectiveUntil: result.effectiveUntil?.toISOString() ?? null,
  };
}

export function serializeHeader(header: PricingPolicyHeader) {
  return {
    ...header,
    versionNumber: header.versionNumber.toString(),
    effectiveFrom: header.effectiveFrom.toISOString(),
    effectiveUntil: header.effectiveUntil?.toISOString() ?? null,
    createdAt: header.createdAt.toISOString(),
    updatedAt: header.updatedAt.toISOString(),
  };
}

export function serializeAggregate(
  aggregate: PricingPolicyReleaseAggregate | DraftPricingPolicyAggregate,
) {
  return {
    root: {
      ...aggregate.root,
      versionNumber: aggregate.root.versionNumber.toString(),
      effectiveFrom: aggregate.root.effectiveFrom.toISOString(),
      effectiveUntil: aggregate.root.effectiveUntil?.toISOString() ?? null,
      createdAt: aggregate.root.createdAt.toISOString(),
      updatedAt: aggregate.root.updatedAt.toISOString(),
    },
    components: aggregate.components,
    prices: aggregate.prices.map((price) => ({ ...price, amountVnd: price.amountVnd.toString() })),
    edges: aggregate.edges,
  };
}

export function serializePreview(result: PricingPolicyPreviewResult) {
  return {
    ...result,
    normalized: result.normalized === undefined ? undefined : serializeAggregate(result.normalized),
  };
}

export function serializeBootstrap(result: BootstrapPricingPolicyResult) {
  return {
    ...serializePreview(result),
    dryRun: result.dryRun,
    created: result.created,
    idempotent: result.idempotent,
    versionNumber: result.versionNumber.toString(),
    provenance: result.provenance,
  };
}

export function actorForRequest(actor: ActorContext): {
  userId: string;
  requestId: string;
  propertyIds: readonly string[] | 'ALL';
  correlationId?: string;
} {
  return {
    userId: actor.userId,
    requestId: actor.requestId,
    propertyIds: actor.propertyIds ?? [],
    ...(actor.correlationId === undefined ? {} : { correlationId: actor.correlationId }),
  };
}
