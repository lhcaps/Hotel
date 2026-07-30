import { and, eq, ratePlanPrices, ratePlans, sql, type DatabaseClient } from '@room/database';

import type {
  RatePlanCreateCommandInput,
  RatePlanRecord,
  RatePlanRepositoryPort,
  SelectionRulePatch,
} from './rate-plan.service.js';

type RatePlanDatabase = Pick<DatabaseClient, 'execute' | 'insert' | 'query' | 'update'>;
type TransactionalPool = Pick<DatabaseClient, 'execute' | 'insert' | 'query' | 'update'> & {
  transaction?: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

type RatePlanRow = {
  readonly id: string;
  readonly property_id: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly included_duration_minutes: number;
  readonly priority: number;
  readonly is_base_plan: boolean;
  readonly min_check_in_minute_inclusive: number | null;
  readonly max_check_in_minute_exclusive: number | null;
  readonly min_duration_minutes_inclusive: number | null;
  readonly max_duration_minutes_inclusive: number | null;
  readonly created_at: Date;
  readonly updated_at: Date;
};

type RatePlanPriceRow = {
  readonly price_tier_id: string;
  readonly amount_vnd: bigint | null;
};

type StoredRatePlan = typeof ratePlans.$inferSelect;
type StoredRatePlanPrice = typeof ratePlanPrices.$inferSelect;

function databaseFor(transaction: unknown, fallback: RatePlanDatabase): TransactionalPool {
  return transaction === undefined ? fallback : (transaction as TransactionalPool);
}

function rowToRecord(row: RatePlanRow, priceRows: readonly RatePlanPriceRow[]): RatePlanRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    code: row.code as RatePlanRecord['code'],
    name: row.name,
    status: row.status,
    includedDurationMinutes: row.included_duration_minutes,
    priority: row.priority,
    isBasePlan: row.is_base_plan,
    minCheckInMinuteInclusive: row.min_check_in_minute_inclusive,
    maxCheckInMinuteExclusive: row.max_check_in_minute_exclusive,
    minDurationMinutesInclusive: row.min_duration_minutes_inclusive,
    maxDurationMinutesInclusive: row.max_duration_minutes_inclusive,
    prices: priceRows.map((price) => ({
      priceTierId: price.price_tier_id,
      amountVnd: price.amount_vnd,
    })),
  };
}

function storedRowToRecord(
  row: StoredRatePlan,
  priceRows: readonly StoredRatePlanPrice[],
): RatePlanRecord {
  return {
    id: row.id,
    propertyId: row.propertyId,
    code: row.code as RatePlanRecord['code'],
    name: row.name,
    status: row.status,
    includedDurationMinutes: row.includedDurationMinutes,
    priority: row.priority,
    isBasePlan: row.isBasePlan,
    minCheckInMinuteInclusive: row.minCheckInMinuteInclusive,
    maxCheckInMinuteExclusive: row.maxCheckInMinuteExclusive,
    minDurationMinutesInclusive: row.minDurationMinutesInclusive,
    maxDurationMinutesInclusive: row.maxDurationMinutesInclusive,
    prices: priceRows.map((price) => ({
      priceTierId: price.priceTierId,
      amountVnd: price.amountVnd,
    })),
  };
}

export class RatePlanRepository implements RatePlanRepositoryPort {
  public constructor(private readonly database: RatePlanDatabase) {}

  public async getCurrentProperty(transaction?: unknown): Promise<{ id: string } | undefined> {
    return databaseFor(transaction, this.database).query.properties.findFirst({
      orderBy: (property, operators) => [
        operators.asc(property.createdAt),
        operators.asc(property.id),
      ],
    });
  }

  public async lockActiveRuleSet(
    transaction: unknown,
    propertyId: string,
  ): Promise<readonly RatePlanRecord[]> {
    const tx = databaseFor(transaction, this.database);
    // Acquire the row-level lock with FOR UPDATE so concurrent ADMIN
    // updates serialize through this transaction. The query is bound to
    // the same connection as the transaction so the lock is held until
    // COMMIT/ROLLBACK.
    const rawRows = await tx.execute(
      sql`SELECT id, property_id, code, name, status,
                 included_duration_minutes, priority, is_base_plan,
                 min_check_in_minute_inclusive, max_check_in_minute_exclusive,
                 min_duration_minutes_inclusive, max_duration_minutes_inclusive,
                 created_at, updated_at
            FROM rate_plans
           WHERE property_id = ${propertyId}
           ORDER BY priority ASC, code ASC
             FOR UPDATE`,
    );
    const rows = (rawRows as unknown as { rows: readonly RatePlanRow[] }).rows;
    const prices = await tx.query.ratePlanPrices.findMany({
      where: (price, operators) => operators.eq(price.propertyId, propertyId),
    });
    const grouped = new Map<string, RatePlanPriceRow[]>();
    for (const price of prices) {
      const list = grouped.get(price.ratePlanId) ?? [];
      list.push({ price_tier_id: price.priceTierId, amount_vnd: price.amountVnd });
      grouped.set(price.ratePlanId, list);
    }
    return rows.map((row) => rowToRecord(row, grouped.get(row.id) ?? []));
  }

  public async listRatePlans(propertyId: string): Promise<readonly RatePlanRecord[]> {
    const plans = await this.database.query.ratePlans.findMany({
      where: (plan, operators) => operators.eq(plan.propertyId, propertyId),
      orderBy: (plan, operators) => [operators.asc(plan.priority), operators.asc(plan.code)],
    });
    const prices = await this.database.query.ratePlanPrices.findMany({
      where: (price, operators) => operators.eq(price.propertyId, propertyId),
    });
    return plans.map((plan) =>
      storedRowToRecord(
        plan,
        prices.filter((price) => price.ratePlanId === plan.id),
      ),
    );
  }

  public async createRatePlan(
    transaction: unknown,
    propertyId: string,
    command: RatePlanCreateCommandInput,
  ): Promise<RatePlanRecord> {
    const tx = databaseFor(transaction, this.database);
    const [inserted] = await tx
      .insert(ratePlans)
      .values({
        propertyId,
        code: command.code,
        name: command.name,
        status: 'DRAFT',
        includedDurationMinutes: command.includedDurationMinutes,
        priority: command.priority,
        isBasePlan: command.isBasePlan,
        minCheckInMinuteInclusive: command.minCheckInMinuteInclusive,
        maxCheckInMinuteExclusive: command.maxCheckInMinuteExclusive,
        minDurationMinutesInclusive: command.minDurationMinutesInclusive,
        maxDurationMinutesInclusive: command.maxDurationMinutesInclusive,
      })
      .returning();
    if (inserted === undefined) throw new Error('RATE_PLAN_INSERT_FAILED');
    return storedRowToRecord(inserted, []);
  }

  public async updatePrice(
    transaction: unknown,
    propertyId: string,
    planId: string,
    priceTierId: string,
    amountVnd: number,
  ): Promise<void> {
    const tx = databaseFor(transaction, this.database);
    const [updated] = await tx
      .update(ratePlanPrices)
      .set({ amountVnd: BigInt(amountVnd), updatedAt: new Date() })
      .where(
        and(
          eq(ratePlanPrices.propertyId, propertyId),
          eq(ratePlanPrices.ratePlanId, planId),
          eq(ratePlanPrices.priceTierId, priceTierId),
        ),
      )
      .returning({ id: ratePlanPrices.id });
    if (updated !== undefined) return;
    const plan = await tx.query.ratePlans.findFirst({
      where: (ratePlan, operators) =>
        operators.and(
          operators.eq(ratePlan.id, planId),
          operators.eq(ratePlan.propertyId, propertyId),
        ),
    });
    const tier = await tx.query.priceTiers.findFirst({
      where: (priceTier, operators) =>
        operators.and(
          operators.eq(priceTier.id, priceTierId),
          operators.eq(priceTier.propertyId, propertyId),
        ),
    });
    if (plan === undefined || tier === undefined) throw new Error('RATE_PLAN_PRICE_NOT_FOUND');
    await tx.insert(ratePlanPrices).values({
      propertyId,
      ratePlanId: planId,
      priceTierId,
      amountVnd: BigInt(amountVnd),
    });
  }

  public async updateSelectionRule(
    transaction: unknown,
    propertyId: string,
    planId: string,
    patch: SelectionRulePatch,
  ): Promise<RatePlanRecord | undefined> {
    const tx = databaseFor(transaction, this.database);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.includedDurationMinutes !== undefined) {
      updates['includedDurationMinutes'] = patch.includedDurationMinutes;
    }
    if (patch.priority !== undefined) {
      updates['priority'] = patch.priority;
    }
    if (patch.minCheckInMinuteInclusive !== undefined) {
      updates['minCheckInMinuteInclusive'] = patch.minCheckInMinuteInclusive;
    }
    if (patch.maxCheckInMinuteExclusive !== undefined) {
      updates['maxCheckInMinuteExclusive'] = patch.maxCheckInMinuteExclusive;
    }
    if (patch.minDurationMinutesInclusive !== undefined) {
      updates['minDurationMinutesInclusive'] = patch.minDurationMinutesInclusive;
    }
    if (patch.maxDurationMinutesInclusive !== undefined) {
      updates['maxDurationMinutesInclusive'] = patch.maxDurationMinutesInclusive;
    }
    const [updated] = await tx
      .update(ratePlans)
      .set(updates)
      .where(and(eq(ratePlans.propertyId, propertyId), eq(ratePlans.id, planId)))
      .returning();
    if (updated === undefined) return undefined;
    const prices = await tx.query.ratePlanPrices.findMany({
      where: (price, operators) =>
        operators.and(
          operators.eq(price.propertyId, propertyId),
          operators.eq(price.ratePlanId, planId),
        ),
    });
    return storedRowToRecord(updated, prices);
  }

  public async setStatus(
    transaction: unknown,
    propertyId: string,
    planId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<RatePlanRecord | undefined> {
    const tx = databaseFor(transaction, this.database);
    const [plan] = await tx
      .update(ratePlans)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(ratePlans.propertyId, propertyId), eq(ratePlans.id, planId)))
      .returning();
    if (plan === undefined) return undefined;
    const prices = await tx.query.ratePlanPrices.findMany({
      where: (price, operators) => operators.eq(price.ratePlanId, plan.id),
    });
    return storedRowToRecord(plan, prices);
  }

  public async requiredActiveTierIds(propertyId: string): Promise<readonly string[]> {
    const activeTypes = await this.database.query.roomTypes.findMany({
      where: (roomType, operators) =>
        operators.and(
          operators.eq(roomType.propertyId, propertyId),
          operators.eq(roomType.status, 'ACTIVE'),
        ),
    });
    return [...new Set(activeTypes.map((roomType) => roomType.priceTierId))];
  }

  public async missingPrices(
    propertyId: string,
    planId: string,
    tierIds: readonly string[],
  ): Promise<readonly string[]> {
    if (tierIds.length === 0) return [];
    const prices = await this.database.query.ratePlanPrices.findMany({
      where: (price, operators) =>
        operators.and(
          operators.eq(price.propertyId, propertyId),
          operators.eq(price.ratePlanId, planId),
        ),
    });
    const priced = new Set(prices.map((price) => price.priceTierId));
    return tierIds.filter((tierId) => !priced.has(tierId));
  }
}
