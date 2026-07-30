/**
 * Coupon reservation repository (Stage E, F, G).
 *
 * Owns all coupon-row locking, quota counting, and lifecycle transitions
 * for booking coupon applications. The database is the authoritative
 * authority: every quota check, application insert, and lifecycle
 * transition happens inside the booking HOLD transaction with
 * `SELECT ... FOR UPDATE` on the coupon row to serialize concurrent
 * HOLD creation against the same coupon.
 *
 * Callers MUST:
 *  - hold the booking HOLD transaction (`tx`) open while calling any
 *    function that mutates application state;
 *  - call `lockCouponForUpdate` before counting quota, re-evaluating
 *    state, or inserting a new application;
 *  - treat returned errors as safe public error codes only.
 */

import {
  and,
  auditEvents,
  bookingCouponApplications,
  coupons,
  eq,
  inArray,
  ne,
  or,
  sql,
  type DatabaseClient,
} from '@room/database';
import { calculateDiscount } from '../coupon/coupon-calculator.js';
import type { CouponEvaluationSnapshot } from '../coupon/coupon-types.js';
import {
  CouponCustomerLimitReachedError,
  CouponExpiredError,
  CouponHoldWindowIncompatibleError,
  CouponLimitReachedError,
  CouponMinimumNotMetError,
  CouponRequoteRequiredError,
  CouponAlreadyAppliedError,
  CouponApplicationNotRedeemableError,
} from '../coupon/coupon-errors.js';

type DbTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

export interface CouponDefinitionRow {
  readonly id: string;
  readonly propertyId: string;
  readonly normalizedCode: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly fixedAmountVnd: bigint | null;
  readonly percentageBasisPoints: number | null;
  readonly maximumDiscountVnd: bigint | null;
  readonly minimumOrderAmountVnd: bigint;
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly appliesToAllRoomTypes: boolean;
  readonly totalUsageLimit: number | null;
  readonly perCustomerLimit: number | null;
  readonly status: 'ACTIVE' | 'DISABLED';
}

export interface CouponQuotaRow {
  readonly id: string;
  readonly status: 'ACTIVE' | 'DISABLED';
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly totalUsageLimit: number | null;
  readonly perCustomerLimit: number | null;
}

export interface QuotaUsage {
  readonly total: number;
  readonly forCustomer: number;
}

/**
 * Lock the coupon row inside the active transaction. Returns the full
 * definition if found, undefined if no such coupon exists.
 */
export async function lockCouponForUpdate(
  tx: DbTransaction,
  couponId: string,
): Promise<CouponDefinitionRow | undefined> {
  const rows = await tx
    .select()
    .from(coupons)
    .where(eq(coupons.id, couponId))
    .limit(1)
    .for('update');
  return rows[0];
}

/**
 * Find a coupon definition by (propertyId, normalizedCode) without
 * locking. Used during HOLD-time lookup before the row lock.
 */
export async function findActiveCouponByCode(
  tx: DbTransaction,
  propertyId: string,
  normalizedCode: string,
): Promise<CouponDefinitionRow | undefined> {
  const rows = await tx
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.propertyId, propertyId),
        eq(coupons.normalizedCode, normalizedCode),
        eq(coupons.status, 'ACTIVE'),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Count quota-consuming applications for a coupon. Released applications
 * do not count; redeemed applications continue to count.
 */
export async function countQuotaUsage(
  tx: DbTransaction,
  couponId: string,
  customerEmailDigest: Buffer | null,
): Promise<QuotaUsage> {
  const consumed = inArray(bookingCouponApplications.applicationStatus, ['RESERVED', 'REDEEMED']);
  const totalRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingCouponApplications)
    .where(and(eq(bookingCouponApplications.couponId, couponId), consumed));
  const total = totalRow[0]?.count ?? 0;
  let forCustomer = 0;
  if (customerEmailDigest !== null) {
    const customerRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingCouponApplications)
      .where(
        and(
          eq(bookingCouponApplications.couponId, couponId),
          eq(bookingCouponApplications.customerEmailDigest, customerEmailDigest),
          consumed,
        ),
      );
    forCustomer = customerRow[0]?.count ?? 0;
  }
  return { total, forCustomer };
}

export interface RevalidateCouponInput {
  readonly definition: CouponDefinitionRow;
  readonly quoteCouponId: string;
  readonly quoteCouponSnapshot: CouponEvaluationSnapshot;
  readonly grossAmountVnd: bigint;
  readonly minimumOrderMet: boolean;
  readonly holdExpiresAt: Date;
  readonly now: Date;
  readonly customerEmailDigest: Buffer;
}

export interface RevalidateCouponOk {
  readonly definition: CouponDefinitionRow;
  readonly evaluation: CouponEvaluationSnapshot;
  readonly applicationStatus: 'ASSOCIATED' | 'RESERVED';
  readonly quotaReserved: boolean;
}

/**
 * Revalidate a coupon inside the booking HOLD transaction after the row
 * lock has been taken. Recomputes the discount from the authoritative
 * definition and compares against the immutable quote snapshot.
 */
export async function revalidateCouponForHold(
  tx: DbTransaction,
  input: RevalidateCouponInput,
): Promise<RevalidateCouponOk> {
  const { definition, quoteCouponId, quoteCouponSnapshot, grossAmountVnd, holdExpiresAt, now } =
    input;
  if (definition.id !== quoteCouponId) {
    throw new CouponRequoteRequiredError('Coupon identity drifted from quote');
  }
  if (definition.status !== 'ACTIVE') {
    throw new CouponExpiredError('Coupon is no longer active');
  }
  if (definition.validFrom > now || definition.validUntil <= now) {
    throw new CouponExpiredError('Coupon is outside its validity window');
  }
  if (definition.validUntil < holdExpiresAt) {
    throw new CouponHoldWindowIncompatibleError('Coupon expires before HOLD window');
  }
  if (grossAmountVnd < BigInt(definition.minimumOrderAmountVnd)) {
    throw new CouponMinimumNotMetError('Gross amount is below coupon minimum order');
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
    grossAmountVnd,
    minimumOrderAmountVnd: BigInt(definition.minimumOrderAmountVnd),
  });
  if (result.discountAmountVnd !== BigInt(quoteCouponSnapshot.discountAmountVnd)) {
    throw new CouponRequoteRequiredError('Discount drifted from quote');
  }
  if (result.finalAmountVnd !== BigInt(quoteCouponSnapshot.finalAmountVnd)) {
    throw new CouponRequoteRequiredError('Final amount drifted from quote');
  }

  const hasLimits = definition.totalUsageLimit !== null || definition.perCustomerLimit !== null;
  const usage = await countQuotaUsage(tx, definition.id, input.customerEmailDigest);
  if (definition.totalUsageLimit !== null && usage.total >= definition.totalUsageLimit) {
    throw new CouponLimitReachedError('Coupon total usage limit reached');
  }
  if (definition.perCustomerLimit !== null && usage.forCustomer >= definition.perCustomerLimit) {
    throw new CouponCustomerLimitReachedError('Coupon per-customer limit reached');
  }

  const evaluation: CouponEvaluationSnapshot = {
    couponId: definition.id,
    normalizedCode: definition.normalizedCode,
    discountType: definition.discountType,
    fixedAmountVnd: definition.fixedAmountVnd,
    percentageBasisPoints: definition.percentageBasisPoints,
    maximumDiscountVnd: definition.maximumDiscountVnd,
    minimumOrderAmountVnd: BigInt(definition.minimumOrderAmountVnd),
    grossAmountVnd,
    discountAmountVnd: result.discountAmountVnd,
    finalAmountVnd: result.finalAmountVnd,
  };
  return {
    definition,
    evaluation,
    applicationStatus: hasLimits ? 'RESERVED' : 'ASSOCIATED',
    quotaReserved: hasLimits,
  };
}

export interface InsertApplicationInput {
  readonly propertyId: string;
  readonly bookingId: string;
  readonly couponId: string;
  readonly customerEmailDigest: Buffer;
  readonly evaluation: CouponEvaluationSnapshot;
  readonly applicationStatus: 'ASSOCIATED' | 'RESERVED';
  readonly quotaReserved: boolean;
}

export async function insertBookingCouponApplication(
  tx: DbTransaction,
  input: InsertApplicationInput,
): Promise<string> {
  const inserted = await tx
    .insert(bookingCouponApplications)
    .values({
      propertyId: input.propertyId,
      bookingId: input.bookingId,
      couponId: input.couponId,
      customerEmailDigest: input.customerEmailDigest,
      applicationStatus: input.applicationStatus,
      quotaReserved: input.quotaReserved,
      discountType: input.evaluation.discountType,
      fixedAmountVnd: input.evaluation.fixedAmountVnd,
      percentageBasisPoints: input.evaluation.percentageBasisPoints,
      maximumDiscountVnd: input.evaluation.maximumDiscountVnd,
      minimumOrderAmountVnd: input.evaluation.minimumOrderAmountVnd,
      grossAmountVnd: input.evaluation.grossAmountVnd,
      discountAmountVnd: input.evaluation.discountAmountVnd,
      finalAmountVnd: input.evaluation.finalAmountVnd,
      couponCodeSnapshot: input.evaluation.normalizedCode,
      reservedAt: input.quotaReserved ? new Date() : null,
      redeemedAt: null,
      releasedAt: null,
      redemptionEventKey: null,
    })
    .returning({ id: bookingCouponApplications.id });
  const row = inserted[0];
  if (row === undefined) throw new Error('Coupon application insert returned no rows');
  return row.id;
}

export interface ReleaseApplicationInput {
  readonly bookingId: string;
  readonly releasedAt: Date;
}

export async function releaseCouponApplicationForBooking(
  tx: DbTransaction,
  input: ReleaseApplicationInput,
): Promise<number> {
  // Only release applications that are not terminal. Idempotent: a second
  // invocation matches no rows and returns zero.
  const result = await tx
    .update(bookingCouponApplications)
    .set({
      applicationStatus: 'RELEASED',
      quotaReserved: false,
      releasedAt: input.releasedAt,
    })
    .where(
      and(
        eq(bookingCouponApplications.bookingId, input.bookingId),
        or(
          eq(bookingCouponApplications.applicationStatus, 'ASSOCIATED'),
          eq(bookingCouponApplications.applicationStatus, 'RESERVED'),
        ),
      ),
    )
    .returning({ id: bookingCouponApplications.id });
  return result.length;
}

export type RedeemApplicationInput =
  RedeemApplicationInputForBooking | RedeemApplicationInputNoApplication;

interface RedeemApplicationInputForBooking {
  readonly bookingId: string;
  readonly verifiedPaymentEventKey: string;
}

interface RedeemApplicationInputNoApplication {
  readonly bookingId: null;
  readonly verifiedPaymentEventKey: null;
}

export type RedeemApplicationResult =
  RedeemApplicationResultRedeemed | RedeemApplicationResultNoApplication;

interface RedeemApplicationResultRedeemed {
  readonly status: 'redeemed';
  readonly applicationId: string;
  readonly alreadyRedeemed: boolean;
}

interface RedeemApplicationResultNoApplication {
  readonly status: 'no_application';
  readonly applicationId: null;
  readonly alreadyRedeemed: false;
}

/**
 * Idempotent redemption primitive. Mark RESERVED/ASSOCIATED application
 * as REDEEMED using a unique verifiedPaymentEventKey. Calling twice with
 * the same event key returns the existing result with no side effect.
 *
 * The `redeemed_at` column is set inside PostgreSQL via `CURRENT_TIMESTAMP`;
 * callers must NOT supply their own clock so the timestamp is database-
 * authoritative and lies between the database `now()` values captured
 * immediately before and after the call.
 */
export async function redeemCouponApplication(
  tx: DbTransaction,
  input: RedeemApplicationInput,
): Promise<RedeemApplicationResult> {
  if (input.bookingId === null) {
    return { status: 'no_application', applicationId: null, alreadyRedeemed: false };
  }
  const existing = await tx
    .select()
    .from(bookingCouponApplications)
    .where(eq(bookingCouponApplications.bookingId, input.bookingId))
    .limit(1)
    .for('update');
  if (existing.length === 0) {
    return { status: 'no_application', applicationId: null, alreadyRedeemed: false };
  }
  const application = existing[0];
  if (application === undefined) {
    return { status: 'no_application', applicationId: null, alreadyRedeemed: false };
  }
  if (application.applicationStatus === 'RELEASED') {
    throw new CouponApplicationNotRedeemableError('Released application cannot be redeemed');
  }
  if (application.applicationStatus === 'REDEEMED') {
    if (application.redemptionEventKey === input.verifiedPaymentEventKey) {
      return {
        status: 'redeemed',
        applicationId: application.id,
        alreadyRedeemed: true,
      };
    }
    throw new CouponAlreadyAppliedError('Application already redeemed with a different key');
  }
  const wasReservingQuota = application.quotaReserved;
  const updated = await tx
    .update(bookingCouponApplications)
    .set({
      applicationStatus: 'REDEEMED',
      quotaReserved: wasReservingQuota,
      reservedAt: wasReservingQuota
        ? sql`COALESCE(${bookingCouponApplications.reservedAt}, CURRENT_TIMESTAMP)`
        : null,
      redeemedAt: sql`CURRENT_TIMESTAMP`,
      redemptionEventKey: input.verifiedPaymentEventKey,
    })
    .where(
      and(
        eq(bookingCouponApplications.bookingId, input.bookingId),
        ne(bookingCouponApplications.applicationStatus, 'RELEASED'),
        ne(bookingCouponApplications.applicationStatus, 'REDEEMED'),
      ),
    )
    .returning({ id: bookingCouponApplications.id });
  if (updated.length === 0) {
    throw new CouponApplicationNotRedeemableError('Application could not be redeemed');
  }
  const updatedRow = updated[0];
  if (updatedRow === undefined) {
    throw new CouponApplicationNotRedeemableError('Application could not be redeemed');
  }
  await tx.insert(auditEvents).values({
    propertyId: application.propertyId,
    aggregateType: 'BOOKING_COUPON_APPLICATION',
    aggregateId: application.bookingId,
    eventType: 'COUPON_REDEEMED',
    actorType: 'SYSTEM',
    actorId: null,
    payload: {
      couponId: application.couponId,
      bookingId: application.bookingId,
      applicationId: application.id,
      verifiedPaymentEventKey: input.verifiedPaymentEventKey,
    },
  });
  return {
    status: 'redeemed',
    applicationId: updatedRow.id,
    alreadyRedeemed: false,
  };
}

export async function readQuoteCouponSnapshot(
  tx: DbTransaction,
  quoteId: string,
): Promise<{ couponId: string; snapshot: CouponEvaluationSnapshot } | undefined> {
  return readQuoteCouponReference(tx, quoteId);
}

/**
 * Read the quote's coupon reference and decode the immutable snapshot to
 * the strongly-typed evaluation shape used by the booking HOLD service.
 */
export async function readQuoteCouponReference(
  tx: DbTransaction,
  quoteId: string,
): Promise<{ couponId: string; snapshot: CouponEvaluationSnapshot } | undefined> {
  const { quotes } = await import('@room/database');
  const rows = await tx
    .select({ couponId: quotes.couponId, snapshot: quotes.couponSnapshot })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  const row = rows[0];
  if (row?.couponId === null || row?.couponId === undefined) return undefined;
  if (row.snapshot === null || row.snapshot === undefined) {
    throw new CouponRequoteRequiredError('Quote references a coupon without a snapshot');
  }
  const snapshot = row.snapshot as Record<string, unknown>;
  return {
    couponId: row.couponId,
    snapshot: {
      couponId: String(snapshot.couponId ?? row.couponId),
      normalizedCode: String(snapshot.normalizedCode ?? ''),
      discountType: snapshot.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
      fixedAmountVnd:
        snapshot.fixedAmountVnd === null || snapshot.fixedAmountVnd === undefined
          ? null
          : BigInt(String(snapshot.fixedAmountVnd)),
      percentageBasisPoints:
        snapshot.percentageBasisPoints === null || snapshot.percentageBasisPoints === undefined
          ? null
          : Number(snapshot.percentageBasisPoints),
      maximumDiscountVnd:
        snapshot.maximumDiscountVnd === null || snapshot.maximumDiscountVnd === undefined
          ? null
          : BigInt(String(snapshot.maximumDiscountVnd)),
      minimumOrderAmountVnd: BigInt(String(snapshot.minimumOrderAmountVnd ?? 0)),
      grossAmountVnd: BigInt(String(snapshot.grossAmountVnd ?? 0)),
      discountAmountVnd: BigInt(String(snapshot.discountAmountVnd ?? 0)),
      finalAmountVnd: BigInt(String(snapshot.finalAmountVnd ?? 0)),
    },
  };
}
