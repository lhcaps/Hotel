import { randomUUID } from 'node:crypto';
import { quotes, sql, type DatabaseClient } from '@room/database';
import type { CreateQuoteRequest } from '@room/contracts';
import type { PricingCatalog, PricingBreakdown } from './pricing-engine.js';
import type { QuoteRepositoryPort } from './quote.service.js';
import type { ProvisionalCouponEvaluation } from './coupon.repository.js';
import { toCouponQuoteSummary } from './coupon.repository.js';
import { isWithinPropertyStayPolicy, propertyStayPolicy } from './stay-policy.js';
import { createCancellationPolicySnapshot } from '@room/booking';
type Database = Pick<DatabaseClient, 'execute' | 'query' | 'insert'>;
function databaseTimestamp(result: { readonly rows: readonly unknown[] }): Date {
  const value = (result.rows[0] as { now?: unknown } | undefined)?.now;
  const timestamp = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error('Database did not return its current timestamp.');
  }
  return timestamp;
}
export interface CatalogSource {
  readonly available: boolean;
  readonly priceTierCode: string;
  readonly propertyTimezone: string;
  readonly catalog: PricingCatalog;
  readonly propertyId: string;
  readonly roomTypeName: string;
}

export class QuoteRepository implements QuoteRepositoryPort {
  public constructor(private readonly database: Database) {}
  public async catalogFor(input: CreateQuoteRequest) {
    // Match the public availability projection: the product currently has one
    // customer-facing property and both paths must resolve it deterministically.
    const property = await this.database.query.properties.findFirst({
      where: (item, operators) => operators.eq(item.status, 'ACTIVE'),
      orderBy: (item, operators) => [operators.asc(item.createdAt), operators.asc(item.id)],
    });
    const roomType = property
      ? await this.database.query.roomTypes.findFirst({
          where: (row, op) =>
            op.and(
              op.eq(row.id, input.roomTypeId),
              op.eq(row.propertyId, property.id),
              op.eq(row.status, 'ACTIVE'),
            ),
        })
      : undefined;
    if (!property || !roomType) return undefined;
    if (
      !isWithinPropertyStayPolicy(
        input.checkIn,
        input.checkOut,
        propertyStayPolicy(property),
        Date.now(),
        input.mode,
        property.timezone,
      )
    ) {
      return undefined;
    }
    const [tier, plans, prices, rooms, blocks] = await Promise.all([
      this.database.query.priceTiers.findFirst({
        where: (row, op) => op.eq(row.id, roomType.priceTierId),
      }),
      this.database.query.ratePlans.findMany({
        where: (row, op) => op.eq(row.propertyId, property.id),
      }),
      this.database.query.ratePlanPrices.findMany({
        where: (row, op) => op.eq(row.propertyId, property.id),
      }),
      this.database.query.rooms.findMany({
        where: (row, op) =>
          op.and(
            op.eq(row.propertyId, property.id),
            op.eq(row.roomTypeId, input.roomTypeId),
            op.eq(row.status, 'ACTIVE'),
          ),
      }),
      this.database.query.roomInventoryBlocks.findMany({
        where: (row, op) =>
          op.and(
            op.eq(row.propertyId, property.id),
            op.eq(row.status, 'ACTIVE'),
            op.lt(row.startsAt, new Date(input.checkOut)),
            op.gt(row.endsAt, new Date(input.checkIn)),
          ),
      }),
    ]);
    const catalog: PricingCatalog = Object.fromEntries(
      plans.map((plan) => [
        plan.code,
        {
          status: plan.status,
          isBasePlan: plan.isBasePlan,
          includedDurationMinutes: plan.includedDurationMinutes,
          priority: plan.priority,
          minCheckInMinuteInclusive: plan.minCheckInMinuteInclusive,
          maxCheckInMinuteExclusive: plan.maxCheckInMinuteExclusive,
          minDurationMinutesInclusive: plan.minDurationMinutesInclusive,
          maxDurationMinutesInclusive: plan.maxDurationMinutesInclusive,
          prices: Object.fromEntries(
            prices
              .filter((price) => price.ratePlanId === plan.id)
              .map((price) => [
                price.priceTierId === roomType.priceTierId && tier ? tier.code : price.priceTierId,
                Number(price.amountVnd),
              ]),
          ),
        },
      ]),
    );
    return {
      available:
        roomType.maxAdults >= input.adults &&
        roomType.maxChildren >= input.children &&
        roomType.maxOccupancy >= input.adults + input.children &&
        rooms.some((room) => !blocks.some((block) => block.roomId === room.id)),
      priceTierCode: tier?.code ?? '',
      propertyTimezone: property.timezone,
      catalog,
      planLabels: Object.fromEntries(plans.map((plan) => [plan.code, plan.name])),
      propertyId: property.id,
      roomTypeName: roomType.name,
    };
  }
  public async issue(
    input: CreateQuoteRequest,
    pricing: PricingBreakdown,
    coupon: ProvisionalCouponEvaluation | undefined,
  ): Promise<unknown> {
    const source = await this.catalogFor(input);
    if (!source) throw new Error('Quote room type disappeared.');
    const current = await this.database.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
    const now = databaseTimestamp(current);
    const expiresAt = new Date(now.getTime() + 900_000);
    const cancellationPolicy = createCancellationPolicySnapshot({
      checkIn: new Date(input.checkIn),
      timezone: source.propertyTimezone,
      capturedAt: now,
    });
    const snapshot: Record<string, unknown> = {
      id: randomUUID(),
      roomTypeId: input.roomTypeId,
      roomTypeName: source.roomTypeName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      expiresAt: expiresAt.toISOString(),
      pricing,
      cancellationPolicy: {
        code: cancellationPolicy.code,
        version: cancellationPolicy.version,
        timezone: cancellationPolicy.timezone,
        refundBasis: cancellationPolicy.refundBasis,
        capturedAt: cancellationPolicy.capturedAt,
        checkIn: cancellationPolicy.checkIn,
        sevenDayDeadline: cancellationPolicy.sevenDayDeadline,
        threeDayDeadline: cancellationPolicy.threeDayDeadline,
      },
      ...(coupon ? { coupon: toCouponQuoteSummary(coupon) } : {}),
    };
    await this.database.insert(quotes).values({
      id: snapshot.id as string,
      propertyId: source.propertyId,
      roomTypeId: input.roomTypeId,
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
      adults: input.adults,
      children: input.children,
      baseAmountVnd: BigInt(pricing.baseAmountVnd),
      extraAmountVnd: BigInt(pricing.extraAmountVnd),
      totalAmountVnd: BigInt(pricing.totalAmountVnd),
      pricingSnapshot: snapshot,
      expiresAt,
      ...(coupon
        ? {
            couponId: coupon.couponId,
            couponSnapshot: {
              couponId: coupon.couponId,
              normalizedCode: coupon.normalizedCode,
              discountType: coupon.discountType,
              fixedAmountVnd:
                coupon.fixedAmountVnd === null ? null : coupon.fixedAmountVnd.toString(),
              percentageBasisPoints: coupon.percentageBasisPoints,
              maximumDiscountVnd:
                coupon.maximumDiscountVnd === null ? null : coupon.maximumDiscountVnd.toString(),
              minimumOrderAmountVnd: coupon.minimumOrderAmountVnd.toString(),
              grossAmountVnd: coupon.grossAmountVnd.toString(),
              discountAmountVnd: coupon.discountAmountVnd.toString(),
              finalAmountVnd: coupon.finalAmountVnd.toString(),
            },
          }
        : {}),
    });
    return snapshot;
  }
  public async get(id: string) {
    const row = await this.database.query.quotes.findFirst({
      where: (item, op) => op.eq(item.id, id),
    });
    if (!row) return undefined;
    const current = await this.database.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
    const now = databaseTimestamp(current);
    return { snapshot: row.pricingSnapshot, expired: row.expiresAt <= now };
  }
}
