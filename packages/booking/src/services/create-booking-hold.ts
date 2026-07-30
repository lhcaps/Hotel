import { randomInt } from 'node:crypto';
import type { Pool } from 'pg';
import { createDatabaseClient, sql, type DatabaseClient } from '@room/database';
import { generateBookingCode, type RandomIndexSource } from '../booking-code.js';
import { contactsAreEquivalent, type NormalizedContact } from '../contact.js';
import {
  AllocationBusyError,
  CouponCustomerLimitReachedError,
  CouponExpiredError,
  CouponHoldWindowIncompatibleError,
  CouponLimitReachedError,
  CouponMinimumNotMetError,
  CouponRequoteRequiredError,
  QuoteAlreadyUsedError,
  QuoteExpiredError,
  QuoteNotFoundError,
  RoomTypeUnavailableError,
  StaleHoldCleanupRetryError,
} from '../errors.js';
import {
  cleanupStaleHolds,
  countFreeRooms,
  countStructurallyEligibleRooms,
  findAllocatableRooms,
  findStructurallyEligibleRooms,
  type AvailabilityProbe,
} from '../repository/availability.js';
import {
  enqueueHoldConfirmation,
  findBookingByQuote,
  insertBooking,
  insertInventoryBlock,
  lockQuote,
  writeHoldCreatedAudit,
  type BookingRow,
} from '../repository/booking-repository.js';
import { findBookingContact, insertBookingContact } from '../repository/contact-repository.js';
import {
  insertBookingCouponApplication,
  lockCouponForUpdate,
  revalidateCouponForHold,
  type CouponDefinitionRow,
} from '../repository/coupon-reservation.js';
import type { CouponEvaluationSnapshot } from '../coupon/coupon-types.js';

export { CouponExpiredError, CouponRequoteRequiredError } from '../errors.js';

export interface CreateBookingHoldInput {
  readonly quoteId: string;
  readonly contact: NormalizedContact;
  readonly holdDurationMs: number;
  readonly correlationId: string;
  readonly customerUserId?: string | undefined;
}

export interface BookingHoldResult {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: 'HOLD';
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly holdExpiresAt: Date;
  readonly amountVnd: number;
  readonly currency: 'VND';
  readonly idempotent: boolean;
  readonly coupon?: BookingHoldCouponSnapshot;
}

export interface BookingHoldCouponSnapshot {
  readonly code: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly grossAmountVnd: number;
  readonly discountAmountVnd: number;
  readonly finalAmountVnd: number;
}

const MAX_HOLD_DURATION_MS = 15 * 60 * 1000;
const defaultRandomIndexSource: RandomIndexSource = (upperExclusive) =>
  randomInt(0, upperExclusive);
type DbTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];
type PostgresError = {
  readonly code?: unknown;
  readonly constraint?: unknown;
  readonly cause?: unknown;
};

export function parseDatabaseTimestamp(value: unknown): Date {
  const timestamp = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error('Failed to fetch current timestamp from database');
  }
  return timestamp;
}

function validateHoldDuration(value: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_HOLD_DURATION_MS) {
    throw new Error('holdDurationMs must be a positive integer no greater than 15 minutes');
  }
}

function extractPricingRuleVersion(pricingSnapshot: unknown): string {
  if (
    typeof pricingSnapshot !== 'object' ||
    pricingSnapshot === null ||
    !('pricing' in pricingSnapshot) ||
    typeof pricingSnapshot.pricing !== 'object' ||
    pricingSnapshot.pricing === null ||
    !('ruleVersion' in pricingSnapshot.pricing) ||
    typeof pricingSnapshot.pricing.ruleVersion !== 'string' ||
    pricingSnapshot.pricing.ruleVersion.trim() === ''
  ) {
    throw new Error('Quote pricing snapshot does not contain a valid ruleVersion');
  }
  return pricingSnapshot.pricing.ruleVersion;
}

function toBookingHoldResult(booking: BookingRow, idempotent: boolean): BookingHoldResult {
  return {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    status: 'HOLD',
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    holdExpiresAt: booking.holdExpiresAt,
    amountVnd: Number(booking.finalAmountVnd),
    currency: 'VND',
    idempotent,
  };
}

function postgresError(error: unknown, depth = 0): PostgresError | undefined {
  if (depth > 4 || typeof error !== 'object' || error === null) return undefined;
  const candidate = error as PostgresError;
  if (candidate.code !== undefined || candidate.constraint !== undefined) return candidate;
  return candidate.cause === undefined ? undefined : postgresError(candidate.cause, depth + 1);
}

function isConstraintViolation(error: unknown, code: string, constraint: string): boolean {
  const candidate = postgresError(error);
  return candidate?.code === code && candidate.constraint === constraint;
}

function isExclusionViolation(error: unknown): boolean {
  return postgresError(error)?.code === '23P01';
}

async function attemptBookingHold(
  db: DatabaseClient,
  pool: Pool,
  input: CreateBookingHoldInput,
  randomIndexSource: RandomIndexSource,
): Promise<BookingHoldResult> {
  validateHoldDuration(input.holdDurationMs);

  return db.transaction(async (tx: DbTransaction) => {
    const timestampResult = await tx.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
    const nowValue = (timestampResult.rows[0] as { now?: unknown } | undefined)?.now;
    const now = parseDatabaseTimestamp(nowValue);
    const quote = await lockQuote(tx, input.quoteId);
    if (quote === undefined) throw new QuoteNotFoundError('Quote not found');

    const existingBooking = await findBookingByQuote(tx, input.quoteId);
    if (existingBooking !== undefined) {
      const existingContact = await findBookingContact(tx, existingBooking.id);
      if (existingContact === undefined) throw new Error('Existing booking has no contact record');
      const equivalent = contactsAreEquivalent(input.contact, {
        fullName: existingContact.fullName,
        email: existingContact.normalizedEmail,
        phoneE164: existingContact.normalizedPhoneE164,
        emailDigest: existingContact.emailDigest,
      });
      if (!equivalent)
        throw new QuoteAlreadyUsedError('Quote already consumed by a different contact');
      return toBookingHoldResult(existingBooking, true);
    }

    if (quote.expiresAt <= now) throw new QuoteExpiredError('Quote has expired');
    if (quote.currency !== 'VND') throw new Error('Quote currency is not supported');
    const pricingRuleVersion = extractPricingRuleVersion(quote.pricingSnapshot);
    if (typeof quote.pricingSnapshot !== 'object' || quote.pricingSnapshot === null) {
      throw new Error('Quote pricing snapshot is invalid');
    }

    const probe: AvailabilityProbe = {
      propertyId: quote.propertyId,
      roomTypeId: quote.roomTypeId,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
    };
    const structuralCandidates = await findStructurallyEligibleRooms(db, probe, tx);
    if (structuralCandidates.length === 0)
      throw new RoomTypeUnavailableError('No eligible rooms exist');

    const cleanupResult = await cleanupStaleHolds(
      db,
      {
        ...probe,
        candidateRoomIds: structuralCandidates.map((room) => room.id),
        batchSize: 50,
        maxBatches: 4,
      },
      tx,
    );
    if (cleanupResult.exhaustedSafetyBound) {
      throw new StaleHoldCleanupRetryError('Stale HOLD cleanup hit safety bound; retry shortly');
    }

    const selectedRooms = await findAllocatableRooms(db, probe, 1, tx);
    if (selectedRooms.length === 0) {
      const freeCount = await countFreeRooms(pool, probe);
      if (freeCount === 0) throw new RoomTypeUnavailableError('No room is free for this interval');
      const structuralCount = await countStructurallyEligibleRooms(pool, probe);
      if (structuralCount > 0) throw new AllocationBusyError('All free rooms are currently locked');
      throw new RoomTypeUnavailableError('No eligible rooms exist');
    }

    const selectedRoom = selectedRooms[0];
    if (selectedRoom === undefined) throw new Error('Selected room disappeared');
    const holdExpiresAt = new Date(now.getTime() + input.holdDurationMs);

    let grossAmountVnd = quote.totalAmountVnd;
    let discountAmountVnd = BigInt(0);
    let finalAmountVnd = quote.totalAmountVnd;
    let couponApplication:
      | {
          readonly definition: CouponDefinitionRow;
          readonly evaluation: CouponEvaluationSnapshot;
          readonly applicationStatus: 'ASSOCIATED' | 'RESERVED';
          readonly quotaReserved: boolean;
        }
      | undefined;

    if (quote.couponId !== null && quote.couponId !== undefined) {
      const definition = await lockCouponForUpdate(tx, quote.couponId);
      if (definition === undefined) {
        throw new CouponRequoteRequiredError('Coupon is no longer available');
      }
      if (definition.propertyId !== quote.propertyId) {
        throw new CouponRequoteRequiredError('Coupon property mismatch');
      }
      const snapshot = decodeQuoteCouponSnapshot(quote.couponSnapshot, quote.couponId);
      couponApplication = await revalidateCouponForHold(tx, {
        definition,
        quoteCouponId: quote.couponId,
        quoteCouponSnapshot: snapshot,
        grossAmountVnd: quote.totalAmountVnd,
        minimumOrderMet: true,
        holdExpiresAt,
        now,
        customerEmailDigest: input.contact.emailDigest,
      }).catch(mapCouponDomainError);
      grossAmountVnd = couponApplication.evaluation.grossAmountVnd;
      discountAmountVnd = couponApplication.evaluation.discountAmountVnd;
      finalAmountVnd = couponApplication.evaluation.finalAmountVnd;
    }

    const bookingCode = generateBookingCode(randomIndexSource);
    const bookingId = await insertBooking(tx, {
      quoteId: quote.id,
      propertyId: quote.propertyId,
      roomTypeId: quote.roomTypeId,
      roomId: selectedRoom.id,
      bookingCode,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      adults: quote.adults,
      children: quote.children,
      currency: quote.currency,
      grossAmountVnd,
      discountAmountVnd,
      finalAmountVnd,
      pricingRuleVersion,
      priceSnapshot: quote.pricingSnapshot,
      holdExpiresAt,
      correlationId: input.correlationId,
      customerUserId: input.customerUserId ?? null,
    });
    await insertBookingContact(tx, bookingId, input.contact);
    await insertInventoryBlock(tx, {
      propertyId: quote.propertyId,
      roomId: selectedRoom.id,
      bookingId,
      startsAt: quote.checkIn,
      endsAt: quote.checkOut,
    });
    if (couponApplication !== undefined) {
      await insertBookingCouponApplication(tx, {
        propertyId: quote.propertyId,
        bookingId,
        couponId: couponApplication.definition.id,
        customerEmailDigest: input.contact.emailDigest,
        evaluation: couponApplication.evaluation,
        applicationStatus: couponApplication.applicationStatus,
        quotaReserved: couponApplication.quotaReserved,
      });
    }
    await writeHoldCreatedAudit(tx, {
      propertyId: quote.propertyId,
      bookingId,
      bookingCode,
      correlationId: input.correlationId,
    });
    if (couponApplication !== undefined) {
      await writeCouponAudit(tx, {
        propertyId: quote.propertyId,
        bookingId,
        couponId: couponApplication.definition.id,
        eventType:
          couponApplication.applicationStatus === 'RESERVED'
            ? 'COUPON_RESERVED'
            : 'COUPON_ASSOCIATED',
        payload: {
          discountType: couponApplication.evaluation.discountType,
          discountAmountVnd: couponApplication.evaluation.discountAmountVnd.toString(),
          finalAmountVnd: couponApplication.evaluation.finalAmountVnd.toString(),
        },
        correlationId: input.correlationId,
      });
    }
    await enqueueHoldConfirmation(tx, {
      propertyId: quote.propertyId,
      bookingId,
      holdExpiresAt,
    });

    return {
      bookingId,
      bookingCode,
      status: 'HOLD',
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      holdExpiresAt,
      amountVnd: Number(finalAmountVnd),
      currency: 'VND',
      idempotent: false,
      ...(couponApplication !== undefined
        ? {
            coupon: {
              code: couponApplication.definition.normalizedCode,
              discountType: couponApplication.definition.discountType,
              grossAmountVnd: Number(couponApplication.evaluation.grossAmountVnd),
              discountAmountVnd: Number(couponApplication.evaluation.discountAmountVnd),
              finalAmountVnd: Number(couponApplication.evaluation.finalAmountVnd),
            },
          }
        : {}),
    };
  });
}

export async function createBookingHoldWithRetry(
  pool: Pool,
  input: CreateBookingHoldInput,
  options?: {
    readonly maxAttempts?: number;
    readonly randomIndexSource?: RandomIndexSource;
  },
): Promise<BookingHoldResult> {
  const maxAttempts = options?.maxAttempts ?? 5;
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0)
    throw new Error('maxAttempts must be positive');
  const randomIndexSource = options?.randomIndexSource ?? defaultRandomIndexSource;
  const db = createDatabaseClient(pool);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await attemptBookingHold(db, pool, input, randomIndexSource);
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new AllocationBusyError('Room allocation was busy', { cause: error });
      }
      if (isConstraintViolation(error, '23505', 'bookings_property_booking_code_uq')) {
        if (attempt < maxAttempts) continue;
        throw new Error(`Booking code collision persisted after ${maxAttempts} attempts`);
      }
      throw error;
    }
  }
  throw new Error('Booking HOLD creation exhausted retry attempts');
}

function decodeQuoteCouponSnapshot(
  raw: unknown,
  fallbackCouponId: string,
): CouponEvaluationSnapshot {
  if (typeof raw !== 'object' || raw === null) {
    throw new CouponRequoteRequiredError('Quote coupon snapshot is missing');
  }
  const data = raw as Record<string, unknown>;
  return {
    couponId: String(data.couponId ?? fallbackCouponId),
    normalizedCode: String(data.normalizedCode ?? ''),
    discountType: data.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
    fixedAmountVnd:
      data.fixedAmountVnd === null || data.fixedAmountVnd === undefined
        ? null
        : BigInt(String(data.fixedAmountVnd)),
    percentageBasisPoints:
      data.percentageBasisPoints === null || data.percentageBasisPoints === undefined
        ? null
        : Number(data.percentageBasisPoints),
    maximumDiscountVnd:
      data.maximumDiscountVnd === null || data.maximumDiscountVnd === undefined
        ? null
        : BigInt(String(data.maximumDiscountVnd)),
    minimumOrderAmountVnd: BigInt(String(data.minimumOrderAmountVnd ?? 0)),
    grossAmountVnd: BigInt(String(data.grossAmountVnd ?? 0)),
    discountAmountVnd: BigInt(String(data.discountAmountVnd ?? 0)),
    finalAmountVnd: BigInt(String(data.finalAmountVnd ?? 0)),
  };
}

function mapCouponDomainError(error: unknown): never {
  if (error instanceof Error) {
    if (error.name === 'CouponExpiredError') throw new CouponExpiredError(error.message);
    if (error.name === 'CouponRequoteRequiredError')
      throw new CouponRequoteRequiredError(error.message);
    if (error.name === 'CouponHoldWindowIncompatibleError') {
      throw new CouponHoldWindowIncompatibleError(error.message);
    }
    if (error.name === 'CouponMinimumNotMetError')
      throw new CouponMinimumNotMetError(error.message);
    if (error.name === 'CouponLimitReachedError') throw new CouponLimitReachedError(error.message);
    if (error.name === 'CouponCustomerLimitReachedError') {
      throw new CouponCustomerLimitReachedError(error.message);
    }
  }
  throw error;
}

async function writeCouponAudit(
  tx: DbTransaction,
  input: {
    readonly propertyId: string;
    readonly bookingId: string;
    readonly couponId: string;
    readonly eventType:
      'COUPON_ASSOCIATED' | 'COUPON_RESERVED' | 'COUPON_RELEASED' | 'COUPON_REDEEMED';
    readonly payload: Record<string, unknown>;
    readonly correlationId: string;
  },
): Promise<void> {
  const { auditEvents } = await import('@room/database');
  await tx.insert(auditEvents).values({
    propertyId: input.propertyId,
    aggregateType: 'BOOKING_COUPON_APPLICATION',
    aggregateId: input.bookingId,
    eventType: input.eventType,
    actorType: 'SYSTEM',
    actorId: null,
    payload: {
      couponId: input.couponId,
      bookingId: input.bookingId,
      correlationId: input.correlationId,
      ...input.payload,
    },
  });
}
