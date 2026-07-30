/**
 * Coupon repository (provisional, quote-time only).
 *
 * Phase 6C forbids quote-time quota reservation: a quote is allowed to load
 * a coupon definition, validate it provisionally, and calculate a discount
 * snapshot — but it must never insert a booking_coupon_application row or
 * hold a quota slot. Per-customer quota and the authoritative reservation
 * are deferred to the booking HOLD transaction.
 */
import { sql, type DatabaseClient } from '@room/database';
import { normalizeCouponCode } from '@room/booking/coupon';
import { calculateDiscount } from '@room/booking/coupon';
import type { CouponQuoteSummary } from '@room/contracts';

export interface CouponQuoteContext {
  readonly database: Pick<DatabaseClient, 'execute' | 'query'>;
}

export interface CouponQuoteProbe {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly grossAmountVnd: number;
  readonly couponCode: string;
}

export interface ProvisionalCouponEvaluation {
  readonly couponId: string;
  readonly normalizedCode: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly fixedAmountVnd: bigint | null;
  readonly percentageBasisPoints: number | null;
  readonly maximumDiscountVnd: bigint | null;
  readonly minimumOrderAmountVnd: bigint;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
}

export class CouponNotApplicableError extends Error {
  override readonly name = 'CouponNotApplicableError';
  readonly code = 'COUPON_NOT_APPLICABLE';
}

export class CouponExpiredError extends Error {
  override readonly name = 'CouponExpiredError';
  readonly code = 'COUPON_EXPIRED';
}

export class CouponMinimumNotMetError extends Error {
  override readonly name = 'CouponMinimumNotMetError';
  readonly code = 'COUPON_MINIMUM_NOT_MET';
}

export class CouponRepository {
  public constructor(private readonly database: Pick<DatabaseClient, 'execute' | 'query'>) {}

  /**
   * Provisional evaluation: no quota consumption, no application row.
   * Throws domain errors if the coupon cannot be applied to the given
   * probe so the API layer can return a Problem Details response.
   */
  public async evaluateForQuote(probe: CouponQuoteProbe): Promise<ProvisionalCouponEvaluation> {
    const normalized = normalizeCouponCode(probe.couponCode);
    const nowResult = await this.database.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
    const nowValue = (nowResult.rows[0] as { now?: unknown } | undefined)?.now;
    const now =
      nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(String(nowValue));
    if (!Number.isFinite(now.getTime())) {
      throw new Error('Database did not return its current timestamp.');
    }

    const definition = await this.database.query.coupons.findFirst({
      where: (row, op) =>
        op.and(
          op.eq(row.propertyId, probe.propertyId),
          op.eq(row.normalizedCode, normalized),
          op.eq(row.status, 'ACTIVE'),
        ),
    });
    if (!definition) {
      throw new CouponNotApplicableError('Coupon is not available for this property');
    }

    if (definition.validFrom > now || definition.validUntil <= now) {
      throw new CouponExpiredError('Coupon is outside its validity window');
    }

    if (!definition.appliesToAllRoomTypes) {
      const scoped = await this.database.query.couponRoomTypes.findFirst({
        where: (row, op) =>
          op.and(op.eq(row.couponId, definition.id), op.eq(row.roomTypeId, probe.roomTypeId)),
      });
      if (!scoped) {
        throw new CouponNotApplicableError('Coupon does not apply to this room type');
      }
    }

    const gross = BigInt(Math.trunc(probe.grossAmountVnd));
    if (gross < BigInt(definition.minimumOrderAmountVnd)) {
      throw new CouponMinimumNotMetError('Gross amount is below the coupon minimum order');
    }

    const shape =
      definition.discountType === 'FIXED'
        ? {
            kind: 'FIXED' as const,
            fixedAmountVnd: definition.fixedAmountVnd ?? 0n,
          }
        : {
            kind: 'PERCENTAGE' as const,
            percentageBasisPoints: definition.percentageBasisPoints ?? 0,
            maximumDiscountVnd: definition.maximumDiscountVnd,
          };

    const result = calculateDiscount({
      shape,
      grossAmountVnd: gross,
      minimumOrderAmountVnd: BigInt(definition.minimumOrderAmountVnd),
    });

    return {
      couponId: definition.id,
      normalizedCode: definition.normalizedCode,
      discountType: definition.discountType,
      fixedAmountVnd: definition.fixedAmountVnd,
      percentageBasisPoints: definition.percentageBasisPoints,
      maximumDiscountVnd: definition.maximumDiscountVnd,
      minimumOrderAmountVnd: BigInt(definition.minimumOrderAmountVnd),
      grossAmountVnd: gross,
      discountAmountVnd: result.discountAmountVnd,
      finalAmountVnd: result.finalAmountVnd,
    };
  }
}

const REVALIDATION_NOTICE =
  'Coupon discount is provisional; remaining quota and per-customer limit are revalidated when creating the booking HOLD.';

export function toCouponQuoteSummary(evaluation: ProvisionalCouponEvaluation): CouponQuoteSummary {
  return {
    code: evaluation.normalizedCode,
    discountType: evaluation.discountType,
    grossAmountVnd: Number(evaluation.grossAmountVnd),
    discountAmountVnd: Number(evaluation.discountAmountVnd),
    finalAmountVnd: Number(evaluation.finalAmountVnd),
    revalidationNotice: REVALIDATION_NOTICE,
  };
}
