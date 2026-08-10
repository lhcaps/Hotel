import {
  and,
  auditEvents,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  or,
  sql,
  type DatabaseClient,
  pricingPolicyComponentEdges,
  pricingPolicyComponentPrices,
  pricingPolicyComponents,
  pricingPolicyVersions,
  priceTiers,
  properties,
  ratePlanPrices,
  ratePlans,
} from '@room/database';

import { resolveAuthorizedProperty } from '../catalog/property-context.service.js';

import type {
  DraftPricingPolicyAggregate,
  DraftPricingPolicyComponent,
  DraftPricingPolicyEdge,
  DraftPricingPolicyPrice,
  DraftPricingPolicyRoot,
  PublishedPricingPolicyAggregate,
  PricingPolicyReleaseAggregate,
  PricingPolicyReleaseRoot,
  PricingPolicyApplicabilityBasis,
  PricingPolicyJsonObject,
  PricingPolicyStatus,
} from './pricing-policy.domain.js';
import type { PricingPolicyActor } from './pricing-policy.service.js';

type PolicyDatabase = DatabaseClient;

function databaseFor(transaction: unknown, fallback: PolicyDatabase): PolicyDatabase {
  return transaction === undefined ? fallback : (transaction as PolicyDatabase);
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function asJsonObject(value: unknown): PricingPolicyJsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as PricingPolicyJsonObject;
}

function mapRoot(
  row: typeof pricingPolicyVersions.$inferSelect,
): DraftPricingPolicyRoot | undefined {
  if (row.status !== 'DRAFT') return undefined;
  return {
    id: row.id,
    propertyId: row.propertyId,
    versionNumber: row.versionNumber,
    internalName: row.internalName,
    status: 'DRAFT',
    applicabilityBasis: row.applicabilityBasis,
    effectiveFrom: asDate(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil === null ? null : asDate(row.effectiveUntil),
    timezoneSnapshot: row.timezoneSnapshot,
    ruleSchemaVersion: row.ruleSchemaVersion,
    maximumComponentLines: row.maximumComponentLines,
    createdBy: row.createdBy,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    changeNote: row.changeNote,
    legacyProvenance: row.legacyProvenance === null ? null : asJsonObject(row.legacyProvenance),
  };
}

function mapReleaseRoot(row: typeof pricingPolicyVersions.$inferSelect): PricingPolicyReleaseRoot {
  return {
    id: row.id,
    propertyId: row.propertyId,
    versionNumber: row.versionNumber,
    internalName: row.internalName,
    status: row.status,
    applicabilityBasis: row.applicabilityBasis,
    effectiveFrom: asDate(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil === null ? null : asDate(row.effectiveUntil),
    timezoneSnapshot: row.timezoneSnapshot,
    ruleSchemaVersion: row.ruleSchemaVersion,
    maximumComponentLines: row.maximumComponentLines,
    createdBy: row.createdBy,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    changeNote: row.changeNote,
    legacyProvenance: row.legacyProvenance === null ? null : asJsonObject(row.legacyProvenance),
  };
}

function mapComponent(
  row: typeof pricingPolicyComponents.$inferSelect,
): DraftPricingPolicyComponent {
  return {
    id: row.id,
    policyVersionId: row.policyVersionId,
    componentCode: row.componentCode,
    componentKind: row.componentKind,
    coverageModel: row.coverageModel,
    billingModel: row.billingModel,
    fixedDurationMinutes: row.fixedDurationMinutes,
    localStartMinuteInclusive: row.localStartMinuteInclusive,
    localEndMinuteExclusive: row.localEndMinuteExclusive,
    localEndDayOffset: row.localEndDayOffset,
    boundaryPosition: row.boundaryPosition,
    boundaryMinDurationMinutes: row.boundaryMinDurationMinutes,
    boundaryMaxDurationMinutes: row.boundaryMaxDurationMinutes,
    billingUnitMinutes: row.billingUnitMinutes,
    minimumBillingUnits: row.minimumBillingUnits,
    maximumBillingUnits: row.maximumBillingUnits,
    maximumOccurrencesPerCandidate: row.maximumOccurrencesPerCandidate,
    conditionComplexityRank: row.conditionComplexityRank,
    tieBreakRank: row.tieBreakRank,
    restrictionMetadata: asJsonObject(row.restrictionMetadata),
    displayMetadata: asJsonObject(row.displayMetadata),
    legacyProvenance: row.legacyProvenance === null ? null : asJsonObject(row.legacyProvenance),
  };
}

function mapPrice(row: typeof pricingPolicyComponentPrices.$inferSelect): DraftPricingPolicyPrice {
  return {
    id: row.id,
    propertyId: row.propertyId,
    policyVersionId: row.policyVersionId,
    componentId: row.componentId,
    priceTierId: row.priceTierId,
    amountVnd: row.amountVnd,
  };
}

function mapEdge(row: typeof pricingPolicyComponentEdges.$inferSelect): DraftPricingPolicyEdge {
  return {
    id: row.id,
    policyVersionId: row.policyVersionId,
    predecessorComponentId: row.predecessorComponentId,
    successorComponentId: row.successorComponentId,
    restrictionMetadata:
      row.restrictionMetadata === null ? null : asJsonObject(row.restrictionMetadata),
  };
}

export interface PricingPolicyPropertyContext {
  readonly id: string;
  readonly timezone: string;
}

export interface CreatePricingPolicyRootInput {
  readonly id: string;
  readonly propertyId: string;
  readonly versionNumber: bigint;
  readonly internalName: string;
  readonly applicabilityBasis: PricingPolicyApplicabilityBasis;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly timezoneSnapshot: string;
  readonly ruleSchemaVersion: string;
  readonly maximumComponentLines: number;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly changeNote: string | null;
}

export interface UpdatePricingPolicyRootInput {
  readonly internalName: string;
  readonly applicabilityBasis: PricingPolicyApplicabilityBasis;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly timezoneSnapshot: string;
  readonly ruleSchemaVersion: string;
  readonly maximumComponentLines: number;
  readonly changeNote: string | null;
}

export interface PricingPolicyLineageRow {
  readonly id: string;
  readonly propertyId: string;
  readonly status: Exclude<PricingPolicyStatus, 'DRAFT' | 'CANCELLED'>;
  readonly applicabilityBasis: PricingPolicyApplicabilityBasis;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
}

export interface PricingPolicyHeader {
  readonly versionNumber: bigint;
  readonly internalName: string;
  readonly timezoneSnapshot: string;
  readonly ruleSchemaVersion: string;
  readonly maximumComponentLines: number;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly changeNote: string | null;
  readonly componentCount?: number;
  readonly priceCount?: number;
  readonly requiredPriceTierCount?: number;
  readonly priceComplete?: boolean;
  readonly id: string;
  readonly propertyId: string;
  readonly status: PricingPolicyStatus;
  readonly applicabilityBasis: PricingPolicyApplicabilityBasis;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
}

export interface PricingPolicyV1BootstrapPlan {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly prices: ReadonlyMap<string, bigint>;
}

export interface PricingPolicyV1BootstrapSource {
  readonly tiers: readonly { readonly id: string; readonly code: string; readonly name: string }[];
  readonly night: PricingPolicyV1BootstrapPlan;
  readonly extraHour: PricingPolicyV1BootstrapPlan;
}

export class PricingPolicyRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async getCurrentProperty(
    actor: PricingPolicyActor,
    transaction?: unknown,
  ): Promise<PricingPolicyPropertyContext | undefined> {
    const database = databaseFor(transaction, this.client);
    const rows = await database
      .select({ id: properties.id, timezone: properties.timezone })
      .from(properties)
      .where(eq(properties.status, 'ACTIVE'))
      .orderBy(asc(properties.createdAt), asc(properties.id));
    return resolveAuthorizedProperty(actor, rows);
  }

  public async lockProperty(transaction: unknown, propertyId: string): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database.execute(sql`SELECT id FROM properties WHERE id = ${propertyId} FOR UPDATE`);
  }

  public async lockPolicy(transaction: unknown, policyId: string): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database.execute(
      sql`SELECT id FROM pricing_policy_versions WHERE id = ${policyId} FOR UPDATE`,
    );
  }

  public async getAggregate(
    transaction: unknown,
    policyId: string,
  ): Promise<DraftPricingPolicyAggregate | undefined> {
    const database = databaseFor(transaction, this.client);
    const roots = await database
      .select()
      .from(pricingPolicyVersions)
      .where(eq(pricingPolicyVersions.id, policyId))
      .limit(1);
    const row = roots[0];
    if (row === undefined || row.status !== 'DRAFT') return undefined;
    const [componentRows, priceRows, edgeRows] = await Promise.all([
      database
        .select()
        .from(pricingPolicyComponents)
        .where(eq(pricingPolicyComponents.policyVersionId, policyId))
        .orderBy(asc(pricingPolicyComponents.componentCode), asc(pricingPolicyComponents.id)),
      database
        .select()
        .from(pricingPolicyComponentPrices)
        .where(eq(pricingPolicyComponentPrices.policyVersionId, policyId))
        .orderBy(
          asc(pricingPolicyComponentPrices.componentId),
          asc(pricingPolicyComponentPrices.priceTierId),
          asc(pricingPolicyComponentPrices.id),
        ),
      database
        .select()
        .from(pricingPolicyComponentEdges)
        .where(eq(pricingPolicyComponentEdges.policyVersionId, policyId))
        .orderBy(
          asc(pricingPolicyComponentEdges.predecessorComponentId),
          asc(pricingPolicyComponentEdges.successorComponentId),
          asc(pricingPolicyComponentEdges.id),
        ),
    ]);
    const root = mapRoot(row);
    if (root === undefined) return undefined;
    return {
      root,
      components: componentRows.map(mapComponent),
      prices: priceRows.map(mapPrice),
      edges: edgeRows.map(mapEdge),
    };
  }

  public async getHeader(
    transaction: unknown,
    policyId: string,
  ): Promise<PricingPolicyHeader | undefined> {
    const database = databaseFor(transaction, this.client);
    const rows = await database
      .select()
      .from(pricingPolicyVersions)
      .where(eq(pricingPolicyVersions.id, policyId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return undefined;
    return {
      id: row.id,
      propertyId: row.propertyId,
      status: row.status,
      applicabilityBasis: row.applicabilityBasis,
      effectiveFrom: asDate(row.effectiveFrom),
      effectiveUntil: row.effectiveUntil === null ? null : asDate(row.effectiveUntil),
      versionNumber: row.versionNumber,
      internalName: row.internalName,
      timezoneSnapshot: row.timezoneSnapshot,
      ruleSchemaVersion: row.ruleSchemaVersion,
      maximumComponentLines: row.maximumComponentLines,
      createdBy: row.createdBy,
      createdAt: asDate(row.createdAt),
      updatedAt: asDate(row.updatedAt),
      changeNote: row.changeNote,
    };
  }

  public async listHeaders(
    transaction: unknown,
    propertyId: string,
  ): Promise<readonly PricingPolicyHeader[]> {
    const database = databaseFor(transaction, this.client);
    const rows = await database
      .select()
      .from(pricingPolicyVersions)
      .where(eq(pricingPolicyVersions.propertyId, propertyId))
      .orderBy(asc(pricingPolicyVersions.versionNumber), asc(pricingPolicyVersions.id));
    const countResult = await database.execute(sql`
      SELECT
        v.id,
        COUNT(DISTINCT c.id)::int AS component_count,
        COUNT(DISTINCT cp.id)::int AS price_count,
        (
          SELECT COUNT(*)::int
          FROM price_tiers pt
          WHERE pt.property_id = ${propertyId}
            AND pt.status = 'ACTIVE'
        ) AS required_price_tier_count
      FROM pricing_policy_versions v
      LEFT JOIN pricing_policy_components c ON c.policy_version_id = v.id
      LEFT JOIN pricing_policy_component_prices cp ON cp.policy_version_id = v.id
      WHERE v.property_id = ${propertyId}
      GROUP BY v.id
    `);
    const counts = new Map(
      (countResult.rows as readonly Record<string, unknown>[]).map((row) => {
        const componentCount = Number(row.component_count ?? 0);
        const priceCount = Number(row.price_count ?? 0);
        const requiredPriceTierCount = Number(row.required_price_tier_count ?? 0);
        return [
          String(row.id),
          {
            componentCount,
            priceCount,
            requiredPriceTierCount,
            priceComplete:
              componentCount > 0 &&
              requiredPriceTierCount > 0 &&
              priceCount >= componentCount * requiredPriceTierCount,
          },
        ] as const;
      }),
    );
    return rows.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      status: row.status,
      applicabilityBasis: row.applicabilityBasis,
      effectiveFrom: asDate(row.effectiveFrom),
      effectiveUntil: row.effectiveUntil === null ? null : asDate(row.effectiveUntil),
      versionNumber: row.versionNumber,
      internalName: row.internalName,
      timezoneSnapshot: row.timezoneSnapshot,
      ruleSchemaVersion: row.ruleSchemaVersion,
      maximumComponentLines: row.maximumComponentLines,
      createdBy: row.createdBy,
      createdAt: asDate(row.createdAt),
      updatedAt: asDate(row.updatedAt),
      changeNote: row.changeNote,
      ...counts.get(row.id),
    }));
  }

  public async getReleaseAggregate(
    transaction: unknown,
    policyId: string,
  ): Promise<PricingPolicyReleaseAggregate | undefined> {
    const database = databaseFor(transaction, this.client);
    const roots = await database
      .select()
      .from(pricingPolicyVersions)
      .where(eq(pricingPolicyVersions.id, policyId))
      .limit(1);
    const row = roots[0];
    if (row === undefined) return undefined;
    const [componentRows, priceRows, edgeRows] = await Promise.all([
      database
        .select()
        .from(pricingPolicyComponents)
        .where(eq(pricingPolicyComponents.policyVersionId, policyId))
        .orderBy(asc(pricingPolicyComponents.componentCode), asc(pricingPolicyComponents.id)),
      database
        .select()
        .from(pricingPolicyComponentPrices)
        .where(eq(pricingPolicyComponentPrices.policyVersionId, policyId))
        .orderBy(
          asc(pricingPolicyComponentPrices.componentId),
          asc(pricingPolicyComponentPrices.priceTierId),
          asc(pricingPolicyComponentPrices.id),
        ),
      database
        .select()
        .from(pricingPolicyComponentEdges)
        .where(eq(pricingPolicyComponentEdges.policyVersionId, policyId))
        .orderBy(
          asc(pricingPolicyComponentEdges.predecessorComponentId),
          asc(pricingPolicyComponentEdges.successorComponentId),
          asc(pricingPolicyComponentEdges.id),
        ),
    ]);
    return {
      root: mapReleaseRoot(row),
      components: componentRows.map(mapComponent),
      prices: priceRows.map(mapPrice),
      edges: edgeRows.map(mapEdge),
    };
  }

  public async getV1BootstrapSource(
    transaction: unknown,
    propertyId: string,
    nightPlanCode: string,
    extraHourPlanCode: string,
  ): Promise<PricingPolicyV1BootstrapSource | undefined> {
    const database = databaseFor(transaction, this.client);
    const [tierRows, planRows] = await Promise.all([
      database
        .select({ id: priceTiers.id, code: priceTiers.code, name: priceTiers.name })
        .from(priceTiers)
        .where(and(eq(priceTiers.propertyId, propertyId), eq(priceTiers.status, 'ACTIVE')))
        .orderBy(asc(priceTiers.sortOrder), asc(priceTiers.id)),
      database
        .select({ id: ratePlans.id, code: ratePlans.code, name: ratePlans.name })
        .from(ratePlans)
        .where(
          and(
            eq(ratePlans.propertyId, propertyId),
            eq(ratePlans.status, 'ACTIVE'),
            sql`${ratePlans.code} IN (${nightPlanCode}, ${extraHourPlanCode})`,
          ),
        )
        .orderBy(asc(ratePlans.code), asc(ratePlans.id)),
    ]);
    const nightRows = planRows.filter((row) => row.code === nightPlanCode);
    const extraRows = planRows.filter((row) => row.code === extraHourPlanCode);
    if (nightRows.length !== 1 || extraRows.length !== 1 || tierRows.length === 0) return undefined;
    const priceRows = await database
      .select({
        ratePlanId: ratePlanPrices.ratePlanId,
        priceTierId: ratePlanPrices.priceTierId,
        amountVnd: ratePlanPrices.amountVnd,
      })
      .from(ratePlanPrices)
      .where(
        and(
          eq(ratePlanPrices.propertyId, propertyId),
          sql`${ratePlanPrices.ratePlanId} IN (${nightRows[0]?.id}, ${extraRows[0]?.id})`,
        ),
      );
    const priceMap = (planId: string) => {
      const entries = priceRows.filter((row) => row.ratePlanId === planId);
      if (entries.length !== tierRows.length) return undefined;
      const mapped = new Map(entries.map((row) => [row.priceTierId, row.amountVnd]));
      if (mapped.size !== tierRows.length || tierRows.some((tier) => !mapped.has(tier.id)))
        return undefined;
      return mapped;
    };
    const nightPrices = priceMap(nightRows[0]?.id ?? '');
    const extraPrices = priceMap(extraRows[0]?.id ?? '');
    if (nightPrices === undefined || extraPrices === undefined) return undefined;
    return {
      tiers: tierRows,
      night: {
        id: nightRows[0]?.id as string,
        code: nightPlanCode,
        name: nightRows[0]?.name as string,
        prices: nightPrices,
      },
      extraHour: {
        id: extraRows[0]?.id as string,
        code: extraHourPlanCode,
        name: extraRows[0]?.name as string,
        prices: extraPrices,
      },
    };
  }

  public async findIdempotentEvent(
    transaction: unknown,
    propertyId: string,
    eventType: string,
    idempotencyKey: string,
  ): Promise<string | undefined> {
    const database = databaseFor(transaction, this.client);
    const rows = await database
      .select({ aggregateId: auditEvents.aggregateId })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.propertyId, propertyId),
          eq(auditEvents.eventType, eventType),
          sql`${auditEvents.payload}->>'idempotencyKey' = ${idempotencyKey}`,
        ),
      )
      .limit(1);
    return rows[0]?.aggregateId;
  }

  public async getPublishedAggregate(
    transaction: unknown,
    policyId: string,
  ): Promise<PublishedPricingPolicyAggregate | undefined> {
    const database = databaseFor(transaction, this.client);
    const roots = await database
      .select()
      .from(pricingPolicyVersions)
      .where(
        and(eq(pricingPolicyVersions.id, policyId), eq(pricingPolicyVersions.status, 'PUBLISHED')),
      )
      .limit(1);
    const row = roots[0];
    if (row === undefined) return undefined;
    const [componentRows, priceRows, edgeRows] = await Promise.all([
      database
        .select()
        .from(pricingPolicyComponents)
        .where(eq(pricingPolicyComponents.policyVersionId, policyId))
        .orderBy(asc(pricingPolicyComponents.componentCode), asc(pricingPolicyComponents.id)),
      database
        .select()
        .from(pricingPolicyComponentPrices)
        .where(eq(pricingPolicyComponentPrices.policyVersionId, policyId))
        .orderBy(
          asc(pricingPolicyComponentPrices.componentId),
          asc(pricingPolicyComponentPrices.priceTierId),
          asc(pricingPolicyComponentPrices.id),
        ),
      database
        .select()
        .from(pricingPolicyComponentEdges)
        .where(eq(pricingPolicyComponentEdges.policyVersionId, policyId))
        .orderBy(
          asc(pricingPolicyComponentEdges.predecessorComponentId),
          asc(pricingPolicyComponentEdges.successorComponentId),
          asc(pricingPolicyComponentEdges.id),
        ),
    ]);
    return {
      root: {
        id: row.id,
        propertyId: row.propertyId,
        versionNumber: row.versionNumber,
        internalName: row.internalName,
        status: 'PUBLISHED',
        applicabilityBasis: row.applicabilityBasis,
        effectiveFrom: asDate(row.effectiveFrom),
        effectiveUntil: row.effectiveUntil === null ? null : asDate(row.effectiveUntil),
        timezoneSnapshot: row.timezoneSnapshot,
        ruleSchemaVersion: row.ruleSchemaVersion,
        maximumComponentLines: row.maximumComponentLines,
        createdBy: row.createdBy,
        createdAt: asDate(row.createdAt),
        updatedAt: asDate(row.updatedAt),
        changeNote: row.changeNote,
        legacyProvenance: row.legacyProvenance === null ? null : asJsonObject(row.legacyProvenance),
      },
      components: componentRows.map(mapComponent),
      prices: priceRows.map(mapPrice),
      edges: edgeRows.map(mapEdge),
    };
  }

  public async getLineage(
    transaction: unknown,
    propertyId: string,
  ): Promise<readonly PricingPolicyLineageRow[]> {
    const database = databaseFor(transaction, this.client);
    const rows = await database
      .select()
      .from(pricingPolicyVersions)
      .where(
        and(
          eq(pricingPolicyVersions.propertyId, propertyId),
          inArray(pricingPolicyVersions.status, ['PUBLISHED', 'RETIRED']),
        ),
      )
      .orderBy(asc(pricingPolicyVersions.effectiveFrom), asc(pricingPolicyVersions.id));
    return rows.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      status: row.status as 'PUBLISHED' | 'RETIRED',
      applicabilityBasis: row.applicabilityBasis,
      effectiveFrom: asDate(row.effectiveFrom),
      effectiveUntil: row.effectiveUntil === null ? null : asDate(row.effectiveUntil),
    }));
  }

  public async getPriceTierIds(
    transaction: unknown,
    propertyId: string,
  ): Promise<ReadonlySet<string>> {
    const database = databaseFor(transaction, this.client);
    const rows = await database
      .select({ id: priceTiers.id })
      .from(priceTiers)
      .where(and(eq(priceTiers.propertyId, propertyId), eq(priceTiers.status, 'ACTIVE')))
      .orderBy(asc(priceTiers.sortOrder), asc(priceTiers.id));
    return new Set(rows.map((row) => row.id));
  }

  public async allocateNextVersion(transaction: unknown, propertyId: string): Promise<bigint> {
    const database = databaseFor(transaction, this.client);
    const rows = await database
      .select({ maximum: sql<string>`coalesce(max(${pricingPolicyVersions.versionNumber}), 0)` })
      .from(pricingPolicyVersions)
      .where(eq(pricingPolicyVersions.propertyId, propertyId));
    return BigInt(rows[0]?.maximum ?? 0) + 1n;
  }

  public async insertDraft(
    transaction: unknown,
    input: CreatePricingPolicyRootInput,
  ): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database.insert(pricingPolicyVersions).values({
      id: input.id,
      propertyId: input.propertyId,
      versionNumber: input.versionNumber,
      internalName: input.internalName,
      status: 'DRAFT',
      applicabilityBasis: input.applicabilityBasis,
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: input.effectiveUntil,
      timezoneSnapshot: input.timezoneSnapshot,
      ruleSchemaVersion: input.ruleSchemaVersion,
      maximumComponentLines: input.maximumComponentLines,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      changeNote: input.changeNote,
    });
  }

  public async updateDraftRoot(
    transaction: unknown,
    policyId: string,
    input: UpdatePricingPolicyRootInput,
    updatedAt: Date,
  ): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database
      .update(pricingPolicyVersions)
      .set({ ...input, updatedAt })
      .where(
        and(eq(pricingPolicyVersions.id, policyId), eq(pricingPolicyVersions.status, 'DRAFT')),
      );
  }

  public async replaceDraftContents(
    transaction: unknown,
    aggregate: DraftPricingPolicyAggregate,
  ): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database
      .delete(pricingPolicyComponentEdges)
      .where(eq(pricingPolicyComponentEdges.policyVersionId, aggregate.root.id));
    await database
      .delete(pricingPolicyComponentPrices)
      .where(eq(pricingPolicyComponentPrices.policyVersionId, aggregate.root.id));
    await database
      .delete(pricingPolicyComponents)
      .where(eq(pricingPolicyComponents.policyVersionId, aggregate.root.id));
    if (aggregate.components.length > 0) {
      await database.insert(pricingPolicyComponents).values(
        aggregate.components.map((component) => ({
          id: component.id,
          policyVersionId: component.policyVersionId,
          componentCode: component.componentCode,
          componentKind: component.componentKind,
          coverageModel: component.coverageModel,
          billingModel: component.billingModel,
          fixedDurationMinutes: component.fixedDurationMinutes,
          localStartMinuteInclusive: component.localStartMinuteInclusive,
          localEndMinuteExclusive: component.localEndMinuteExclusive,
          localEndDayOffset: component.localEndDayOffset,
          boundaryPosition: component.boundaryPosition,
          boundaryMinDurationMinutes: component.boundaryMinDurationMinutes,
          boundaryMaxDurationMinutes: component.boundaryMaxDurationMinutes,
          billingUnitMinutes: component.billingUnitMinutes,
          minimumBillingUnits: component.minimumBillingUnits,
          maximumBillingUnits: component.maximumBillingUnits,
          maximumOccurrencesPerCandidate: component.maximumOccurrencesPerCandidate,
          conditionComplexityRank: component.conditionComplexityRank,
          tieBreakRank: component.tieBreakRank,
          restrictionMetadata: component.restrictionMetadata,
          displayMetadata: component.displayMetadata,
          legacyProvenance: component.legacyProvenance,
        })),
      );
    }
    if (aggregate.prices.length > 0)
      await database
        .insert(pricingPolicyComponentPrices)
        .values(aggregate.prices.map((price) => ({ ...price })));
    if (aggregate.edges.length > 0)
      await database
        .insert(pricingPolicyComponentEdges)
        .values(aggregate.edges.map((edge) => ({ ...edge })));
  }

  public async publishDraft(
    transaction: unknown,
    policyId: string,
    actorId: string,
    publishedAt: Date,
  ): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database
      .update(pricingPolicyVersions)
      .set({ status: 'PUBLISHED', publishedBy: actorId, publishedAt, updatedAt: publishedAt })
      .where(
        and(eq(pricingPolicyVersions.id, policyId), eq(pricingPolicyVersions.status, 'DRAFT')),
      );
  }

  public async closePublished(
    transaction: unknown,
    policyId: string,
    effectiveUntil: Date,
    updatedAt: Date,
  ): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database
      .update(pricingPolicyVersions)
      .set({ effectiveUntil, updatedAt })
      .where(
        and(eq(pricingPolicyVersions.id, policyId), eq(pricingPolicyVersions.status, 'PUBLISHED')),
      );
  }

  public async cancelDraft(
    transaction: unknown,
    policyId: string,
    actorId: string,
    cancelledAt: Date,
    reason: string,
  ): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database
      .update(pricingPolicyVersions)
      .set({
        status: 'CANCELLED',
        cancelledBy: actorId,
        cancelledAt,
        cancellationReason: reason,
        updatedAt: cancelledAt,
      })
      .where(
        and(eq(pricingPolicyVersions.id, policyId), eq(pricingPolicyVersions.status, 'DRAFT')),
      );
  }

  public async retirePublished(
    transaction: unknown,
    policyId: string,
    actorId: string,
    retiredAt: Date,
  ): Promise<void> {
    const database = databaseFor(transaction, this.client);
    await database
      .update(pricingPolicyVersions)
      .set({ status: 'RETIRED', retiredBy: actorId, retiredAt, updatedAt: retiredAt })
      .where(
        and(eq(pricingPolicyVersions.id, policyId), eq(pricingPolicyVersions.status, 'PUBLISHED')),
      );
  }

  public async findPublishedAt(
    transaction: unknown,
    propertyId: string,
    basis: PricingPolicyApplicabilityBasis,
    instant: Date,
  ): Promise<readonly { id: string }[]> {
    const database = databaseFor(transaction, this.client);
    return database
      .select({ id: pricingPolicyVersions.id })
      .from(pricingPolicyVersions)
      .where(
        and(
          eq(pricingPolicyVersions.propertyId, propertyId),
          eq(pricingPolicyVersions.status, 'PUBLISHED'),
          eq(pricingPolicyVersions.applicabilityBasis, basis),
          sql`${pricingPolicyVersions.effectiveFrom} <= ${instant}`,
          or(
            isNull(pricingPolicyVersions.effectiveUntil),
            gt(pricingPolicyVersions.effectiveUntil, instant),
          ),
        ),
      )
      .orderBy(asc(pricingPolicyVersions.effectiveFrom), asc(pricingPolicyVersions.id));
  }
}
