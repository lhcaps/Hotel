import {
  ratePlanActivationSchema,
  ratePlanCreateCommandSchema,
  ratePlanPriceCommandSchema,
  ratePlanSchema,
  ratePlanSelectionRuleCommandSchema,
  type RatePlanSelectionRuleCommand,
} from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';
import { CatalogConflictError, CatalogNotFoundError } from '../catalog/catalog.errors.js';
import type { AuditRepositoryPort } from '../catalog/catalog.service.js';
import { ruleSetValidationFromCatalog } from './cheapest-eligible-pricing.js';
import type { PricingCatalog } from './pricing-engine.js';

export interface RatePlanRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly includedDurationMinutes: number;
  readonly priority: number;
  readonly isBasePlan: boolean;
  readonly minCheckInMinuteInclusive: number | null;
  readonly maxCheckInMinuteExclusive: number | null;
  readonly minDurationMinutesInclusive: number | null;
  readonly maxDurationMinutesInclusive: number | null;
  readonly prices: readonly { readonly priceTierId: string; readonly amountVnd: bigint | null }[];
}
export interface RatePlanRepositoryPort {
  getCurrentProperty(
    actor: ActorContext,
    transaction?: unknown,
  ): Promise<{ readonly id: string } | undefined>;
  /**
   * Acquire the row-level lock on every rate plan of the given property
   * before reading the tentative active rule set inside a transaction.
   * The lock must remain held until COMMIT.
   */
  lockActiveRuleSet(transaction: unknown, propertyId: string): Promise<readonly RatePlanRecord[]>;
  listRatePlans(propertyId: string): Promise<readonly RatePlanRecord[]>;
  createRatePlan(
    transaction: unknown,
    propertyId: string,
    command: RatePlanCreateCommandInput,
  ): Promise<RatePlanRecord>;
  updatePrice(
    transaction: unknown,
    propertyId: string,
    planId: string,
    priceTierId: string,
    amountVnd: number,
  ): Promise<void>;
  updateSelectionRule(
    transaction: unknown,
    propertyId: string,
    planId: string,
    patch: SelectionRulePatch,
  ): Promise<RatePlanRecord | undefined>;
  setStatus(
    transaction: unknown,
    propertyId: string,
    planId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<RatePlanRecord | undefined>;
  requiredActiveTierIds(propertyId: string): Promise<readonly string[]>;
  missingPrices(
    propertyId: string,
    planId: string,
    tierIds: readonly string[],
  ): Promise<readonly string[]>;
}

export interface RatePlanCreateCommandInput {
  readonly code: string;
  readonly name: string;
  readonly includedDurationMinutes: number;
  readonly priority: number;
  readonly isBasePlan: boolean;
  readonly minCheckInMinuteInclusive: number | null;
  readonly maxCheckInMinuteExclusive: number | null;
  readonly minDurationMinutesInclusive: number | null;
  readonly maxDurationMinutesInclusive: number | null;
}

export interface SelectionRulePatch {
  readonly includedDurationMinutes?: number;
  readonly priority?: number;
  readonly minCheckInMinuteInclusive?: number | null;
  readonly maxCheckInMinuteExclusive?: number | null;
  readonly minDurationMinutesInclusive?: number | null;
  readonly maxDurationMinutesInclusive?: number | null;
}

export interface RatePlanTransactionManager {
  transaction<T>(operation: (transaction: unknown) => Promise<T>): Promise<T>;
}
function toContract(record: RatePlanRecord) {
  return ratePlanSchema.parse({
    id: record.id,
    code: record.code,
    name: record.name,
    status: record.status,
    includedDurationMinutes: record.includedDurationMinutes,
    priority: record.priority,
    isBasePlan: record.isBasePlan,
    minCheckInMinuteInclusive: record.minCheckInMinuteInclusive,
    maxCheckInMinuteExclusive: record.maxCheckInMinuteExclusive,
    minDurationMinutesInclusive: record.minDurationMinutesInclusive,
    maxDurationMinutesInclusive: record.maxDurationMinutesInclusive,
    prices: record.prices.map((price) => ({
      priceTierId: price.priceTierId,
      amountVnd: price.amountVnd === null ? null : Number(price.amountVnd),
    })),
  });
}

function buildCatalog(records: readonly RatePlanRecord[]): PricingCatalog {
  const catalog: Record<string, unknown> = {};
  for (const record of records) {
    const prices: Record<string, number> = {};
    for (const price of record.prices) {
      if (price.amountVnd !== null) prices[price.priceTierId] = Number(price.amountVnd);
    }
    catalog[record.code] = {
      status: record.status,
      isBasePlan: record.isBasePlan,
      includedDurationMinutes: record.includedDurationMinutes,
      priority: record.priority,
      minCheckInMinuteInclusive: record.minCheckInMinuteInclusive,
      maxCheckInMinuteExclusive: record.maxCheckInMinuteExclusive,
      minDurationMinutesInclusive: record.minDurationMinutesInclusive,
      maxDurationMinutesInclusive: record.maxDurationMinutesInclusive,
      prices,
    };
  }
  return catalog as PricingCatalog;
}

function withPrices(
  records: readonly RatePlanRecord[],
  tierIds: readonly string[],
): readonly RatePlanRecord[] {
  if (tierIds.length === 0) return records;
  return records.map((record) => ({
    ...record,
    prices: tierIds.map(
      (priceTierId) =>
        record.prices.find((price) => price.priceTierId === priceTierId) ?? {
          priceTierId,
          amountVnd: null,
        },
    ),
  }));
}

function summarisePatch(patch: SelectionRulePatch): Record<string, string | number> {
  const summarised: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) {
      summarised[key] = 'null';
    } else if (typeof value === 'number') {
      summarised[key] = value;
    } else {
      summarised[key] = String(value);
    }
  }
  return summarised;
}

function selectionRulePatchFrom(
  _target: RatePlanRecord,
  command: RatePlanSelectionRuleCommand,
): SelectionRulePatch {
  // The Zod contract differentiates "omitted" from "explicit null" via
  // .optional(); here we treat every key in the parsed command as
  // authoritative — undefined ⇒ preserve current value, null ⇒ clear.
  const patch: Record<string, unknown> = {};
  const cmdRecord = command as Record<string, unknown>;
  for (const [key, value] of Object.entries(cmdRecord)) {
    if (value === undefined) continue;
    patch[key] = value;
  }
  return patch as SelectionRulePatch;
}

function hasPostgresCode(error: unknown, code: string, depth = 0): boolean {
  if (depth > 3 || typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === code) return true;
  return 'cause' in error && hasPostgresCode(error.cause, code, depth + 1);
}

export class RatePlanService {
  public constructor(
    private readonly database: RatePlanTransactionManager,
    private readonly repository: RatePlanRepositoryPort,
    private readonly audit: AuditRepositoryPort,
  ) {}
  public async list(actor: ActorContext) {
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    const tierIds = await this.repository.requiredActiveTierIds(property.id);
    const records = await this.repository.listRatePlans(property.id);
    return {
      items: withPrices(records, tierIds).map((record) => toContract(record)),
    };
  }
  public async create(actor: ActorContext, input: unknown) {
    const command = ratePlanCreateCommandSchema.parse(input);
    try {
      return await this.database.transaction(async (transaction) => {
        const property = await this.repository.getCurrentProperty(actor, transaction);
        if (property === undefined) throw new CatalogNotFoundError();
        const created = await this.repository.createRatePlan(transaction, property.id, command);
        await this.audit.write(transaction, {
          propertyId: property.id,
          aggregateType: 'RATE_PLAN',
          aggregateId: created.id,
          eventType: 'RATE_PLAN_CREATED',
          actorId: actor.userId,
          payload: {
            code: created.code,
            name: created.name,
            isBasePlan: created.isBasePlan ? 'true' : 'false',
            priority: created.priority,
          },
        });
        const tierIds = await this.repository.requiredActiveTierIds(property.id);
        return toContract({
          ...created,
          prices: tierIds.map((priceTierId) => ({ priceTierId, amountVnd: null })),
        });
      });
    } catch (error) {
      if (hasPostgresCode(error, '23505')) throw new CatalogConflictError();
      throw error;
    }
  }
  public async updatePrice(
    actor: ActorContext,
    planId: string,
    priceTierId: string,
    input: unknown,
  ) {
    const command = ratePlanPriceCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      try {
        await this.repository.updatePrice(
          transaction,
          property.id,
          planId,
          priceTierId,
          command.amountVnd,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'RATE_PLAN_PRICE_NOT_FOUND')
          throw new CatalogNotFoundError();
        throw error;
      }
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'RATE_PLAN',
        aggregateId: planId,
        eventType: 'RATE_PLAN_PRICE_UPDATED',
        actorId: actor.userId,
        payload: { priceTierId, amountVnd: command.amountVnd },
      });
    });
  }
  public async updateSelectionRule(actor: ActorContext, planId: string, input: unknown) {
    const command = ratePlanSelectionRuleCommandSchema.parse(input) as RatePlanSelectionRuleCommand;
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const locked = await this.repository.lockActiveRuleSet(transaction, property.id);
      const target = locked.find((plan) => plan.id === planId);
      if (target === undefined) throw new CatalogNotFoundError();
      const patch = selectionRulePatchFrom(target, command);
      let updated: Awaited<ReturnType<typeof this.repository.updateSelectionRule>>;
      try {
        updated = await this.repository.updateSelectionRule(
          transaction,
          property.id,
          planId,
          patch,
        );
      } catch (error) {
        if (hasPostgresCode(error, '23514') || hasPostgresCode(error, '23505')) {
          throw new CatalogConflictError(
            error instanceof Error ? error.message : 'Selection rule violates catalog invariants.',
          );
        }
        throw error;
      }
      if (updated === undefined) throw new CatalogNotFoundError();
      const tentative = await this.repository.lockActiveRuleSet(transaction, property.id);
      const tierIds = await this.repository.requiredActiveTierIds(property.id);
      const catalog = buildCatalog(withPrices(tentative, tierIds));
      try {
        ruleSetValidationFromCatalog(catalog, tierIds);
      } catch (error) {
        throw new CatalogConflictError(
          error instanceof Error ? error.message : 'Pricing rule set is invalid.',
        );
      }
      const missing = await this.repository.missingPrices(property.id, updated.id, tierIds);
      if (missing.length > 0) {
        throw new CatalogConflictError(
          `Selected plan is missing active tier prices: ${missing.join(', ')}`,
        );
      }
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'RATE_PLAN',
        aggregateId: planId,
        eventType: 'RATE_PLAN_SELECTION_RULE_UPDATED',
        actorId: actor.userId,
        payload: summarisePatch(patch),
      });
      return toContract({ ...updated, prices: updated.prices });
    });
  }
  public async activate(actor: ActorContext, planId: string, input: unknown) {
    ratePlanActivationSchema.parse(input);
    return this.changeStatus(actor, planId, 'ACTIVE');
  }
  public async inactivate(actor: ActorContext, planId: string) {
    return this.changeStatus(actor, planId, 'INACTIVE');
  }
  private async changeStatus(actor: ActorContext, planId: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const locked = await this.repository.lockActiveRuleSet(transaction, property.id);
      const target = locked.find((plan) => plan.id === planId);
      if (target === undefined) throw new CatalogNotFoundError();
      const tierIds = await this.repository.requiredActiveTierIds(property.id);
      if (status === 'ACTIVE') {
        const missing = await this.repository.missingPrices(property.id, planId, tierIds);
        if (missing.length > 0) throw new CatalogConflictError();
        const tentative = locked.map((record) =>
          record.id === planId ? { ...record, status: 'ACTIVE' as const } : record,
        );
        const catalog = buildCatalog(withPrices(tentative, tierIds));
        try {
          ruleSetValidationFromCatalog(catalog, tierIds);
        } catch (error) {
          throw new CatalogConflictError(
            error instanceof Error ? error.message : 'Pricing rule set is invalid.',
          );
        }
      } else {
        const tentative = locked
          .filter((record) => record.id !== planId)
          .map((record) => ({ ...record, status: 'ACTIVE' as const }));
        const catalog = buildCatalog(withPrices(tentative, tierIds));
        try {
          ruleSetValidationFromCatalog(catalog, tierIds);
        } catch (error) {
          throw new CatalogConflictError(
            error instanceof Error ? error.message : 'Pricing rule set is invalid.',
          );
        }
      }
      const plan = await this.repository.setStatus(transaction, property.id, planId, status);
      if (plan === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'RATE_PLAN',
        aggregateId: plan.id,
        eventType: status === 'ACTIVE' ? 'RATE_PLAN_ACTIVATED' : 'RATE_PLAN_INACTIVATED',
        actorId: actor.userId,
        payload: { code: plan.code },
      });
      return toContract(plan);
    });
  }
}
