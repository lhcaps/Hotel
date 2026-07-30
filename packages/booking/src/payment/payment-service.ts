import {
  and,
  bookings,
  createDatabaseClient,
  eq,
  ne,
  payments,
  paymentAttempts,
  paymentProviderEvents,
  paymentProviderSettings,
  roomInventoryBlocks,
  auditEvents,
  bookingCouponApplications,
  outboxEvents,
  type DatabasePool,
} from '@room/database';
import { randomUUID } from 'node:crypto';
import { redeemCouponApplication } from '../repository/coupon-reservation.js';
import { PaymentCoreError } from './errors.js';

export interface PaymentActor {
  readonly type: 'SYSTEM';
  readonly requestId: string;
}

export interface GetOrCreatePaymentForBookingInput {
  readonly pool: DatabasePool;
  readonly propertyId: string;
  readonly bookingId: string;
  readonly actor: PaymentActor;
}

export interface PaymentAggregate {
  readonly id: string;
  readonly amountVnd: bigint;
  readonly status: 'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED';
}

export interface CreatePaymentAttemptInput {
  readonly pool: DatabasePool;
  readonly propertyId: string;
  readonly bookingId: string;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly idempotencyKey: string;
  readonly now?: Date | null;
  readonly providerKnownExpiryAt?: Date | null;
}

export interface PaymentAttempt {
  readonly id: string;
  readonly amountVnd: bigint;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly providerOrderId: string;
}

export interface MarkPaymentAttemptInitiationUnknownInput {
  readonly pool: DatabasePool;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly providerOrderId: string;
  readonly requestId: string;
}

export interface ApplyVerifiedPaymentEventInput {
  readonly pool: DatabasePool;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly eventKey: string;
  readonly providerOrderId: string;
  readonly providerTransactionId: string;
  readonly normalizedOutcome: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  readonly amountVnd: bigint;
  readonly currency: 'VND';
  readonly occurredAt: Date;
  readonly rawBodyDigest: Buffer;
  readonly verificationMarker: 'VERIFIED_BY_ADAPTER';
}

export interface ConfirmNoChargeBookingInput {
  readonly pool: DatabasePool;
  readonly propertyId: string;
  readonly bookingId: string;
  readonly idempotencyKey: string;
  readonly actor: PaymentActor;
}

export async function getOrCreatePaymentForBooking(
  input: GetOrCreatePaymentForBookingInput,
): Promise<PaymentAggregate> {
  const database = createDatabaseClient(input.pool);
  return database.transaction(async (tx) => {
    const booking = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.propertyId, input.propertyId)))
      .limit(1)
      .for('update');
    const lockedBooking = booking[0];
    if (lockedBooking === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');

    const existing = await tx
      .select()
      .from(payments)
      .where(eq(payments.bookingId, input.bookingId))
      .limit(1)
      .for('update');
    const existingPayment = existing[0];
    if (existingPayment !== undefined) {
      return {
        id: existingPayment.id,
        amountVnd: existingPayment.amountVnd,
        status: existingPayment.status,
      };
    }

    const created = await tx
      .insert(payments)
      .values({
        propertyId: lockedBooking.propertyId,
        bookingId: lockedBooking.id,
        amountVnd: lockedBooking.finalAmountVnd,
        currency: lockedBooking.currency,
        status: 'PENDING',
      })
      .returning({ id: payments.id, amountVnd: payments.amountVnd, status: payments.status });
    const payment = created[0];
    if (payment === undefined) throw new PaymentCoreError('PAYMENT_CREATE_FAILED');
    return payment;
  });
}

export async function createPaymentAttempt(
  input: CreatePaymentAttemptInput,
): Promise<PaymentAttempt> {
  if (input.idempotencyKey.trim() === '')
    throw new PaymentCoreError('PAYMENT_IDEMPOTENCY_CONFLICT');
  const database = createDatabaseClient(input.pool);
  return database.transaction(async (tx) => {
    const databaseNow = new Date();
    const booking = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.propertyId, input.propertyId)))
      .limit(1)
      .for('update');
    const lockedBooking = booking[0];
    if (lockedBooking === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');
    if (lockedBooking.status !== 'HOLD' || lockedBooking.holdExpiresAt <= databaseNow) {
      throw new PaymentCoreError('PAYMENT_BOOKING_STATE');
    }
    if (lockedBooking.finalAmountVnd <= 0n)
      throw new PaymentCoreError('PAYMENT_NO_CHARGE_REQUIRED');

    let payment = (
      await tx
        .select()
        .from(payments)
        .where(eq(payments.bookingId, input.bookingId))
        .limit(1)
        .for('update')
    )[0];
    if (payment === undefined) {
      const created = await tx
        .insert(payments)
        .values({
          propertyId: lockedBooking.propertyId,
          bookingId: lockedBooking.id,
          amountVnd: lockedBooking.finalAmountVnd,
          currency: lockedBooking.currency,
          status: 'PENDING',
        })
        .returning();
      payment = created[0];
    }
    if (payment === undefined) throw new PaymentCoreError('PAYMENT_CREATE_FAILED');
    if (payment.status === 'SUCCEEDED') throw new PaymentCoreError('PAYMENT_ALREADY_SETTLED');

    const existing = await tx
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.paymentId, payment.id),
          eq(paymentAttempts.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1)
      .for('update');
    const existingAttempt = existing[0];
    if (existingAttempt !== undefined) {
      if (existingAttempt.provider !== input.provider)
        throw new PaymentCoreError('PAYMENT_IDEMPOTENCY_CONFLICT');
      return {
        id: existingAttempt.id,
        amountVnd: existingAttempt.amountVnd,
        provider: existingAttempt.provider,
        providerOrderId: existingAttempt.providerOrderId,
      };
    }

    const providerOrderId = `${input.provider}-${randomUUID()}`;
    const providerKnownExpiryAt = input.providerKnownExpiryAt ?? null;
    const settingsRows = await tx
      .select({ checkoutExpiryMinutes: paymentProviderSettings.checkoutExpiryMinutes })
      .from(paymentProviderSettings)
      .where(
        and(
          eq(paymentProviderSettings.propertyId, payment.propertyId),
          eq(paymentProviderSettings.provider, input.provider),
        ),
      )
      .limit(1);
    const providerCheckoutExpiryMinutes = settingsRows[0]?.checkoutExpiryMinutes ?? null;
    const expiryCandidates: Date[] = [lockedBooking.holdExpiresAt];
    if (providerCheckoutExpiryMinutes !== null && providerCheckoutExpiryMinutes > 0) {
      expiryCandidates.push(
        new Date(databaseNow.getTime() + providerCheckoutExpiryMinutes * 60_000),
      );
    }
    if (providerKnownExpiryAt !== null && providerKnownExpiryAt.getTime() > databaseNow.getTime()) {
      expiryCandidates.push(providerKnownExpiryAt);
    }
    const attemptExpiresAt = new Date(Math.min(...expiryCandidates.map((date) => date.getTime())));
    const inserted = await tx
      .insert(paymentAttempts)
      .values({
        propertyId: payment.propertyId,
        paymentId: payment.id,
        provider: input.provider,
        status: 'PENDING',
        idempotencyKey: input.idempotencyKey,
        providerOrderId,
        providerTransactionId: null,
        amountVnd: payment.amountVnd,
        currency: payment.currency,
        initiatedAt: databaseNow,
        expiresAt: attemptExpiresAt,
      })
      .returning({
        id: paymentAttempts.id,
        amountVnd: paymentAttempts.amountVnd,
        provider: paymentAttempts.provider,
        providerOrderId: paymentAttempts.providerOrderId,
      });
    const attempt = inserted[0];
    if (attempt === undefined) throw new PaymentCoreError('PAYMENT_ATTEMPT_CREATE_FAILED');
    return attempt;
  });
}

/**
 * A provider create-checkout timeout is not a failed payment: MoMo can have
 * accepted the stable requestId. Preserve that attempt/order identity for a
 * later signed IPN or reconciliation without confirming the booking.
 */
export async function markPaymentAttemptInitiationUnknown(
  input: MarkPaymentAttemptInitiationUnknownInput,
): Promise<void> {
  const database = createDatabaseClient(input.pool);
  await database.transaction(async (tx) => {
    const identified = await tx
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.provider, input.provider),
          eq(paymentAttempts.providerOrderId, input.providerOrderId),
        ),
      )
      .limit(1);
    const identifiedAttempt = identified[0];
    if (identifiedAttempt === undefined) throw new PaymentCoreError('PAYMENT_ATTEMPT_NOT_FOUND');
    const paymentRows = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, identifiedAttempt.paymentId))
      .limit(1);
    const identifiedPayment = paymentRows[0];
    if (identifiedPayment === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');
    const bookingRows = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, identifiedPayment.bookingId))
      .limit(1)
      .for('update');
    const booking = bookingRows[0];
    if (booking === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');
    const payment = (
      await tx
        .select()
        .from(payments)
        .where(eq(payments.id, identifiedPayment.id))
        .limit(1)
        .for('update')
    )[0];
    const attempt = (
      await tx
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.id, identifiedAttempt.id))
        .limit(1)
        .for('update')
    )[0];
    if (payment === undefined || attempt === undefined)
      throw new PaymentCoreError('PAYMENT_NOT_FOUND');
    if (attempt.status !== 'PENDING') return;
    const now = new Date();
    await tx
      .update(paymentAttempts)
      .set({
        status: 'REVIEW_REQUIRED',
        completedAt: now,
        reviewCode: 'MOMO_INITIATION_OUTCOME_UNKNOWN',
        updatedAt: now,
      })
      .where(eq(paymentAttempts.id, attempt.id));
    if (payment.status !== 'SUCCEEDED') {
      await tx
        .update(payments)
        .set({
          status: 'REVIEW_REQUIRED',
          reviewRequiredAt: now,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));
    }
    await tx.insert(auditEvents).values({
      propertyId: payment.propertyId,
      aggregateType: 'PAYMENT',
      aggregateId: payment.id,
      eventType: 'payment.initiation.outcome_unknown',
      actorType: 'SYSTEM',
      actorId: null,
      payload: {
        paymentId: payment.id,
        attemptId: attempt.id,
        requestId: input.requestId,
        provider: input.provider,
        providerOrderId: input.providerOrderId,
        code: 'MOMO_INITIATION_OUTCOME_UNKNOWN',
      },
    });
  });
}

export async function applyVerifiedPaymentEvent(
  input: ApplyVerifiedPaymentEventInput,
): Promise<{ processingStatus: 'PROCESSED' | 'DUPLICATE' | 'REVIEW_REQUIRED' }> {
  if (input.verificationMarker !== 'VERIFIED_BY_ADAPTER') {
    throw new PaymentCoreError('PAYMENT_EVENT_UNVERIFIED');
  }
  if (input.currency !== 'VND' || input.amountVnd < 0n) {
    throw new PaymentCoreError('PAYMENT_EVENT_INVALID');
  }
  if (
    input.eventKey.trim() === '' ||
    input.providerOrderId.trim() === '' ||
    input.providerTransactionId.trim() === ''
  ) {
    throw new PaymentCoreError('PAYMENT_EVENT_INVALID');
  }
  if (input.rawBodyDigest.length !== 32) throw new PaymentCoreError('PAYMENT_EVENT_INVALID');
  const database = createDatabaseClient(input.pool);
  return database.transaction(async (tx) => {
    const databaseNow = new Date();
    const existingEvent = await tx
      .select({ id: paymentProviderEvents.id })
      .from(paymentProviderEvents)
      .where(
        and(
          eq(paymentProviderEvents.provider, input.provider),
          eq(paymentProviderEvents.eventKey, input.eventKey),
        ),
      )
      .limit(1);
    if (existingEvent[0] !== undefined) return { processingStatus: 'DUPLICATE' };

    const identified = await tx
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.provider, input.provider),
          eq(paymentAttempts.providerOrderId, input.providerOrderId),
        ),
      )
      .limit(1);
    const identifiedAttempt = identified[0];
    if (identifiedAttempt === undefined) throw new PaymentCoreError('PAYMENT_ATTEMPT_NOT_FOUND');
    const paymentRows = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, identifiedAttempt.paymentId))
      .limit(1);
    const identifiedPayment = paymentRows[0];
    if (identifiedPayment === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');

    const bookingRows = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, identifiedPayment.bookingId))
      .limit(1)
      .for('update');
    const lockedBooking = bookingRows[0];
    if (lockedBooking === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');
    const paymentRowsLocked = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, identifiedPayment.id))
      .limit(1)
      .for('update');
    const lockedPayment = paymentRowsLocked[0];
    if (lockedPayment === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');
    const attemptRowsLocked = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, identifiedAttempt.id))
      .limit(1)
      .for('update');
    const lockedAttempt = attemptRowsLocked[0];
    if (lockedAttempt === undefined) throw new PaymentCoreError('PAYMENT_ATTEMPT_NOT_FOUND');

    // A concurrent delivery can pass the optimistic receipt lookup above
    // before waiting on the booking lock. Re-check after the global lock
    // order has been acquired so only the winning transaction transitions.
    const eventAfterLocks = await tx
      .select({ id: paymentProviderEvents.id })
      .from(paymentProviderEvents)
      .where(
        and(
          eq(paymentProviderEvents.provider, input.provider),
          eq(paymentProviderEvents.eventKey, input.eventKey),
        ),
      )
      .limit(1);
    if (eventAfterLocks[0] !== undefined) return { processingStatus: 'DUPLICATE' };

    const inventoryRows = await tx
      .select({ status: roomInventoryBlocks.status })
      .from(roomInventoryBlocks)
      .where(
        and(
          eq(roomInventoryBlocks.bookingId, lockedBooking.id),
          eq(roomInventoryBlocks.blockType, 'BOOKING'),
        ),
      )
      .limit(1)
      .for('update');
    const inventory = inventoryRows[0];
    const couponRows = await tx
      .select({ applicationStatus: bookingCouponApplications.applicationStatus })
      .from(bookingCouponApplications)
      .where(eq(bookingCouponApplications.bookingId, lockedBooking.id))
      .limit(1)
      .for('update');
    const couponApplication = couponRows[0];

    if (input.normalizedOutcome !== 'SUCCEEDED') {
      // Stale failure protection: if the attempt has already reached a
      // terminal state (SUCCEEDED, REVIEW_REQUIRED, EXPIRED or
      // CANCELLED) then a later FAILED / EXPIRED / CANCELLED delivery
      // is a stale out-of-order event. Record the provider event for
      // audit but do not mutate the attempt status or audit event
      // classification.
      if (
        lockedAttempt.status === 'SUCCEEDED' ||
        lockedAttempt.status === 'REVIEW_REQUIRED' ||
        lockedAttempt.status === 'EXPIRED' ||
        lockedAttempt.status === 'CANCELLED'
      ) {
        // Stale failure protection: terminal attempts absorb a new
        // event by recording the provider event plus the latest
        // provider transaction id, but do not regress the attempt
        // status and do not emit a state-transition audit event.
        await tx
          .update(paymentAttempts)
          .set({
            providerTransactionId: input.providerTransactionId,
            updatedAt: input.occurredAt,
          })
          .where(eq(paymentAttempts.id, lockedAttempt.id));
        await tx.insert(paymentProviderEvents).values({
          propertyId: lockedPayment.propertyId,
          paymentAttemptId: lockedAttempt.id,
          provider: input.provider,
          eventKey: input.eventKey,
          providerOrderId: input.providerOrderId,
          providerTransactionId: input.providerTransactionId,
          normalizedOutcome: input.normalizedOutcome,
          amountVnd: input.amountVnd,
          currency: input.currency,
          rawBodyDigest: input.rawBodyDigest,
          processingStatus: 'PROCESSED',
          rejectionCode: null,
          receivedAt: input.occurredAt,
          processedAt: input.occurredAt,
        });
        return { processingStatus: 'PROCESSED' };
      }
      const attemptStatus = input.normalizedOutcome;
      await tx
        .update(paymentAttempts)
        .set({
          status: attemptStatus,
          providerTransactionId: input.providerTransactionId,
          completedAt: input.occurredAt,
          failureCode: input.normalizedOutcome === 'FAILED' ? 'PROVIDER_FAILED' : null,
          reviewCode: null,
          updatedAt: input.occurredAt,
        })
        .where(eq(paymentAttempts.id, lockedAttempt.id));
      await tx.insert(paymentProviderEvents).values({
        propertyId: lockedPayment.propertyId,
        paymentAttemptId: lockedAttempt.id,
        provider: input.provider,
        eventKey: input.eventKey,
        providerOrderId: input.providerOrderId,
        providerTransactionId: input.providerTransactionId,
        normalizedOutcome: input.normalizedOutcome,
        amountVnd: input.amountVnd,
        currency: input.currency,
        rawBodyDigest: input.rawBodyDigest,
        processingStatus: 'PROCESSED',
        rejectionCode: null,
        receivedAt: input.occurredAt,
        processedAt: input.occurredAt,
      });
      await tx.insert(auditEvents).values({
        propertyId: lockedPayment.propertyId,
        aggregateType: 'PAYMENT',
        aggregateId: lockedPayment.id,
        eventType:
          input.normalizedOutcome === 'FAILED'
            ? 'payment.attempt.failed'
            : 'payment.attempt.closed',
        actorType: 'SYSTEM',
        actorId: null,
        payload: {
          paymentId: lockedPayment.id,
          attemptId: lockedAttempt.id,
          eventKey: input.eventKey,
          outcome: input.normalizedOutcome,
        },
      });
      return { processingStatus: 'PROCESSED' };
    }

    const transactionConflict = await tx
      .select({ id: paymentAttempts.id })
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.provider, input.provider),
          eq(paymentAttempts.providerTransactionId, input.providerTransactionId),
          ne(paymentAttempts.id, lockedAttempt.id),
        ),
      )
      .limit(1);
    let reviewCode: string | undefined;
    if (transactionConflict[0] !== undefined) reviewCode = 'TRANSACTION_CONFLICT';
    else if (lockedBooking.status === 'EXPIRED' || lockedBooking.holdExpiresAt <= databaseNow) {
      reviewCode = 'BOOKING_EXPIRED';
    } else if (lockedBooking.status === 'CANCELLED') reviewCode = 'BOOKING_CANCELLED';
    else if (inventory?.status !== 'ACTIVE') reviewCode = 'INVENTORY_RELEASED';
    else if (couponApplication?.applicationStatus === 'RELEASED') reviewCode = 'COUPON_RELEASED';
    else if (lockedBooking.status !== 'HOLD') reviewCode = 'PAYMENT_BOOKING_STATE';
    else if (
      lockedPayment.amountVnd !== input.amountVnd ||
      lockedBooking.finalAmountVnd !== input.amountVnd
    ) {
      reviewCode = 'AMOUNT_MISMATCH';
    } else if (lockedPayment.currency !== 'VND' || lockedBooking.currency !== 'VND') {
      reviewCode = 'CURRENCY_MISMATCH';
    }
    if (reviewCode !== undefined) {
      await tx
        .update(paymentAttempts)
        .set({
          status: 'REVIEW_REQUIRED',
          completedAt: input.occurredAt,
          reviewCode,
          updatedAt: input.occurredAt,
        })
        .where(eq(paymentAttempts.id, lockedAttempt.id));
      if (lockedPayment.status !== 'SUCCEEDED') {
        await tx
          .update(payments)
          .set({
            status: 'REVIEW_REQUIRED',
            reviewRequiredAt: input.occurredAt,
            updatedAt: input.occurredAt,
          })
          .where(eq(payments.id, lockedPayment.id));
      }
      await tx.insert(paymentProviderEvents).values({
        propertyId: lockedPayment.propertyId,
        paymentAttemptId: lockedAttempt.id,
        provider: input.provider,
        eventKey: input.eventKey,
        providerOrderId: input.providerOrderId,
        providerTransactionId: input.providerTransactionId,
        normalizedOutcome: input.normalizedOutcome,
        amountVnd: input.amountVnd,
        currency: input.currency,
        rawBodyDigest: input.rawBodyDigest,
        processingStatus: 'REVIEW_REQUIRED',
        rejectionCode: reviewCode,
        receivedAt: input.occurredAt,
        processedAt: input.occurredAt,
      });
      await tx.insert(auditEvents).values({
        propertyId: lockedPayment.propertyId,
        aggregateType: 'PAYMENT',
        aggregateId: lockedPayment.id,
        eventType: 'payment.review_required',
        actorType: 'SYSTEM',
        actorId: null,
        payload: {
          paymentId: lockedPayment.id,
          attemptId: lockedAttempt.id,
          eventKey: input.eventKey,
          reviewCode,
        },
      });
      return { processingStatus: 'REVIEW_REQUIRED' };
    }

    const couponRedemption = await redeemCouponApplication(tx, {
      bookingId: lockedBooking.id,
      verifiedPaymentEventKey: input.eventKey,
    });

    await tx
      .update(paymentAttempts)
      .set({
        status: 'SUCCEEDED',
        providerTransactionId: input.providerTransactionId,
        completedAt: input.occurredAt,
        failureCode: null,
        reviewCode: null,
        updatedAt: input.occurredAt,
      })
      .where(eq(paymentAttempts.id, lockedAttempt.id));
    await tx
      .update(payments)
      .set({
        status: 'SUCCEEDED',
        confirmationSource: 'PROVIDER_EVENT',
        succeededAt: input.occurredAt,
        reviewRequiredAt: null,
        updatedAt: input.occurredAt,
      })
      .where(eq(payments.id, lockedPayment.id));
    await tx
      .update(bookings)
      .set({ status: 'CONFIRMED', updatedAt: input.occurredAt })
      .where(eq(bookings.id, lockedBooking.id));
    await tx.insert(paymentProviderEvents).values({
      propertyId: lockedPayment.propertyId,
      paymentAttemptId: lockedAttempt.id,
      provider: input.provider,
      eventKey: input.eventKey,
      providerOrderId: input.providerOrderId,
      providerTransactionId: input.providerTransactionId,
      normalizedOutcome: input.normalizedOutcome,
      amountVnd: input.amountVnd,
      currency: input.currency,
      rawBodyDigest: input.rawBodyDigest,
      processingStatus: 'PROCESSED',
      rejectionCode: null,
      receivedAt: input.occurredAt,
      processedAt: input.occurredAt,
    });
    await tx.insert(auditEvents).values([
      {
        propertyId: lockedPayment.propertyId,
        aggregateType: 'PAYMENT',
        aggregateId: lockedPayment.id,
        eventType: 'payment.succeeded',
        actorType: 'SYSTEM',
        actorId: null,
        payload: {
          paymentId: lockedPayment.id,
          attemptId: lockedAttempt.id,
          eventKey: input.eventKey,
        },
      },
      {
        propertyId: lockedPayment.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: lockedBooking.id,
        eventType: 'booking.confirmed_by_payment',
        actorType: 'SYSTEM',
        actorId: null,
        payload: { paymentId: lockedPayment.id, bookingId: lockedBooking.id },
      },
      ...(couponRedemption.status === 'redeemed' && !couponRedemption.alreadyRedeemed
        ? [
            {
              propertyId: lockedPayment.propertyId,
              aggregateType: 'BOOKING_COUPON_APPLICATION',
              aggregateId: lockedBooking.id,
              eventType: 'coupon.redeemed_by_payment',
              actorType: 'SYSTEM' as const,
              actorId: null,
              payload: {
                paymentId: lockedPayment.id,
                bookingId: lockedBooking.id,
                eventKey: input.eventKey,
              },
            },
          ]
        : []),
    ]);
    await tx.insert(outboxEvents).values([
      {
        propertyId: lockedPayment.propertyId,
        aggregateType: 'PAYMENT',
        aggregateId: lockedPayment.id,
        eventType: 'payment.succeeded',
        payload: { eventVersion: 1, paymentId: lockedPayment.id, bookingId: lockedBooking.id },
        status: 'PENDING',
      },
      {
        propertyId: lockedPayment.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: lockedBooking.id,
        eventType: 'booking.confirmed',
        payload: { eventVersion: 1, paymentId: lockedPayment.id, bookingId: lockedBooking.id },
        status: 'PENDING',
      },
    ]);
    return { processingStatus: 'PROCESSED' };
  });
}

export async function confirmNoChargeBooking(
  input: ConfirmNoChargeBookingInput,
): Promise<{ paymentId: string; confirmationSource: 'NO_CHARGE' }> {
  if (input.idempotencyKey.trim() === '')
    throw new PaymentCoreError('PAYMENT_IDEMPOTENCY_CONFLICT');
  const database = createDatabaseClient(input.pool);
  return database.transaction(async (tx) => {
    const databaseNow = new Date();
    const bookingRows = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.propertyId, input.propertyId)))
      .limit(1)
      .for('update');
    const lockedBooking = bookingRows[0];
    if (lockedBooking === undefined) throw new PaymentCoreError('PAYMENT_NOT_FOUND');

    let payment = (
      await tx
        .select()
        .from(payments)
        .where(eq(payments.bookingId, lockedBooking.id))
        .limit(1)
        .for('update')
    )[0];
    if (payment?.status === 'SUCCEEDED') {
      if (payment.confirmationSource !== 'NO_CHARGE')
        throw new PaymentCoreError('PAYMENT_ALREADY_SETTLED');
      const confirmation = await tx
        .select({ payload: auditEvents.payload })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.aggregateId, lockedBooking.id),
            eq(auditEvents.eventType, 'booking.confirmed_no_charge'),
          ),
        )
        .limit(1);
      const existingPayload = confirmation[0]?.payload;
      const existingIdempotencyKey =
        typeof existingPayload === 'object' && existingPayload !== null
          ? (existingPayload as Record<string, unknown>).idempotencyKey
          : undefined;
      if (existingIdempotencyKey !== input.idempotencyKey) {
        throw new PaymentCoreError('PAYMENT_IDEMPOTENCY_CONFLICT');
      }
      return { paymentId: payment.id, confirmationSource: 'NO_CHARGE' };
    }
    if (lockedBooking.status !== 'HOLD' || lockedBooking.holdExpiresAt <= databaseNow) {
      throw new PaymentCoreError('PAYMENT_BOOKING_STATE');
    }
    if (lockedBooking.finalAmountVnd !== 0n)
      throw new PaymentCoreError('PAYMENT_POSITIVE_AMOUNT_REQUIRED');
    if (payment === undefined) {
      const inserted = await tx
        .insert(payments)
        .values({
          propertyId: lockedBooking.propertyId,
          bookingId: lockedBooking.id,
          amountVnd: 0n,
          currency: 'VND',
          status: 'PENDING',
        })
        .returning();
      payment = inserted[0];
    }
    if (payment === undefined) throw new PaymentCoreError('PAYMENT_CREATE_FAILED');
    const inventoryRows = await tx
      .select({ status: roomInventoryBlocks.status })
      .from(roomInventoryBlocks)
      .where(
        and(
          eq(roomInventoryBlocks.bookingId, lockedBooking.id),
          eq(roomInventoryBlocks.blockType, 'BOOKING'),
        ),
      )
      .limit(1)
      .for('update');
    if (inventoryRows[0]?.status !== 'ACTIVE')
      throw new PaymentCoreError('PAYMENT_INVENTORY_RELEASED');
    const couponRows = await tx
      .select({ applicationStatus: bookingCouponApplications.applicationStatus })
      .from(bookingCouponApplications)
      .where(eq(bookingCouponApplications.bookingId, lockedBooking.id))
      .limit(1)
      .for('update');
    if (couponRows[0]?.applicationStatus === 'RELEASED')
      throw new PaymentCoreError('PAYMENT_COUPON_RELEASED');
    const couponRedemption = await redeemCouponApplication(tx, {
      bookingId: lockedBooking.id,
      verifiedPaymentEventKey: `NO_CHARGE:${input.idempotencyKey}`,
    });
    await tx
      .update(payments)
      .set({
        status: 'SUCCEEDED',
        confirmationSource: 'NO_CHARGE',
        succeededAt: databaseNow,
        updatedAt: databaseNow,
      })
      .where(eq(payments.id, payment.id));
    await tx
      .update(bookings)
      .set({ status: 'CONFIRMED', updatedAt: databaseNow })
      .where(eq(bookings.id, lockedBooking.id));
    await tx.insert(auditEvents).values([
      {
        propertyId: payment.propertyId,
        aggregateType: 'PAYMENT',
        aggregateId: payment.id,
        eventType: 'payment.succeeded',
        actorType: 'SYSTEM',
        actorId: null,
        payload: {
          paymentId: payment.id,
          bookingId: lockedBooking.id,
          confirmationSource: 'NO_CHARGE',
        },
      },
      {
        propertyId: payment.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: lockedBooking.id,
        eventType: 'booking.confirmed_no_charge',
        actorType: 'SYSTEM',
        actorId: null,
        payload: {
          paymentId: payment.id,
          bookingId: lockedBooking.id,
          requestId: input.actor.requestId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      ...(couponRedemption.status === 'redeemed' && !couponRedemption.alreadyRedeemed
        ? [
            {
              propertyId: payment.propertyId,
              aggregateType: 'BOOKING_COUPON_APPLICATION',
              aggregateId: lockedBooking.id,
              eventType: 'coupon.redeemed_by_payment',
              actorType: 'SYSTEM' as const,
              actorId: null,
              payload: {
                paymentId: payment.id,
                bookingId: lockedBooking.id,
                confirmationSource: 'NO_CHARGE',
              },
            },
          ]
        : []),
    ]);
    await tx.insert(outboxEvents).values([
      {
        propertyId: payment.propertyId,
        aggregateType: 'PAYMENT',
        aggregateId: payment.id,
        eventType: 'payment.succeeded',
        payload: { eventVersion: 1, paymentId: payment.id, bookingId: lockedBooking.id },
        status: 'PENDING',
      },
      {
        propertyId: payment.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: lockedBooking.id,
        eventType: 'booking.confirmed',
        payload: { eventVersion: 1, paymentId: payment.id, bookingId: lockedBooking.id },
        status: 'PENDING',
      },
    ]);
    return { paymentId: payment.id, confirmationSource: 'NO_CHARGE' };
  });
}
