/**
 * Booking repository: booking HOLD creation and retrieval
 *
 * Handles transactional booking HOLD insertion, idempotency checks via quote
 * uniqueness, and snapshot field mapping. See design doc §C "Quote consumption"
 * and §D "Allocation transaction".
 */

import {
  auditEvents,
  bookings,
  eq,
  outboxEvents,
  quotes,
  roomInventoryBlocks,
  type DatabaseClient,
} from '@room/database';

type DbTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

export interface QuoteRow {
  readonly id: string;
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly adults: number;
  readonly children: number;
  readonly currency: string;
  readonly baseAmountVnd: bigint;
  readonly extraAmountVnd: bigint;
  readonly totalAmountVnd: bigint;
  readonly pricingSnapshot: unknown;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly couponId: string | null;
  readonly couponSnapshot: unknown;
}

export interface BookingRow {
  readonly id: string;
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly quoteId: string | null;
  readonly bookingCode: string;
  readonly status: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly adults: number;
  readonly children: number;
  readonly currency: string;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
  readonly pricingRuleVersion: string | null;
  readonly priceSnapshot: unknown;
  readonly holdExpiresAt: Date;
  readonly expiredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Lock and retrieve quote row with FOR UPDATE. Returns undefined if quote
 * does not exist.
 */
export async function lockQuote(tx: DbTransaction, quoteId: string): Promise<QuoteRow | undefined> {
  const rows = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1).for('update');

  return rows[0];
}

/**
 * Find existing booking by quote_id. Used for idempotency checks.
 */
export async function findBookingByQuote(
  tx: DbTransaction,
  quoteId: string,
): Promise<BookingRow | undefined> {
  const rows = await tx.select().from(bookings).where(eq(bookings.quoteId, quoteId)).limit(1);

  return rows[0];
}

export interface CreateBookingInput {
  readonly quoteId: string;
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly bookingCode: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly adults: number;
  readonly children: number;
  readonly currency: string;
  readonly grossAmountVnd: bigint;
  readonly discountAmountVnd: bigint;
  readonly finalAmountVnd: bigint;
  readonly pricingRuleVersion: string;
  readonly priceSnapshot: unknown;
  readonly holdExpiresAt: Date;
  readonly correlationId: string;
  readonly customerUserId?: string | null;
}

/**
 * Insert booking HOLD with snapshot fields copied from quote. Returns the
 * created booking ID.
 */
export async function insertBooking(tx: DbTransaction, input: CreateBookingInput): Promise<string> {
  const inserted = await tx
    .insert(bookings)
    .values({
      quoteId: input.quoteId,
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      roomId: input.roomId,
      bookingCode: input.bookingCode,
      status: 'HOLD',
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      currency: input.currency,
      grossAmountVnd: input.grossAmountVnd,
      discountAmountVnd: input.discountAmountVnd,
      finalAmountVnd: input.finalAmountVnd,
      pricingRuleVersion: input.pricingRuleVersion,
      priceSnapshot: input.priceSnapshot,
      holdExpiresAt: input.holdExpiresAt,
      customerUserId: input.customerUserId ?? null,
    })
    .returning({ id: bookings.id });

  const row = inserted[0];
  if (row === undefined) {
    throw new Error('Booking insert returned no rows');
  }

  return row.id;
}

/**
 * Insert ACTIVE inventory block for the booking. This enforces the GiST
 * exclusion constraint. If exclusion fires (SQLSTATE 23P01), the entire
 * transaction is aborted by PostgreSQL.
 */
export async function insertInventoryBlock(
  tx: DbTransaction,
  input: {
    readonly propertyId: string;
    readonly roomId: string;
    readonly bookingId: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
  },
): Promise<void> {
  await tx.insert(roomInventoryBlocks).values({
    propertyId: input.propertyId,
    roomId: input.roomId,
    bookingId: input.bookingId,
    maintenanceBlockId: null,
    blockType: 'BOOKING',
    status: 'ACTIVE',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
}

/**
 * Write HOLD_CREATED audit event. Note: actorType is hardcoded to 'GUEST'
 * because Phase 5 does not yet have a flexible audit.write() signature.
 */
export async function writeHoldCreatedAudit(
  tx: DbTransaction,
  input: {
    readonly propertyId: string;
    readonly bookingId: string;
    readonly bookingCode: string;
    readonly correlationId: string;
  },
): Promise<void> {
  await tx.insert(auditEvents).values({
    propertyId: input.propertyId,
    aggregateType: 'BOOKING',
    aggregateId: input.bookingId,
    eventType: 'HOLD_CREATED',
    actorType: 'GUEST',
    actorId: null,
    payload: {
      bookingCode: input.bookingCode,
      correlationId: input.correlationId,
    },
  });
}

/**
 * Enqueue HOLD confirmation outbox event. Payload contains only IDs and
 * timestamps (no PII). Worker will load booking + contact separately.
 */
export async function enqueueHoldConfirmation(
  tx: DbTransaction,
  input: {
    readonly propertyId: string;
    readonly bookingId: string;
    readonly holdExpiresAt: Date;
  },
): Promise<void> {
  await tx.insert(outboxEvents).values({
    propertyId: input.propertyId,
    aggregateType: 'BOOKING',
    aggregateId: input.bookingId,
    eventType: 'booking.hold.created',
    payload: {
      eventVersion: 1,
      bookingId: input.bookingId,
      holdExpiresAt: input.holdExpiresAt.toISOString(),
    },
    status: 'PENDING',
  });
}
