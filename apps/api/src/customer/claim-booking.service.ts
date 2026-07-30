import {
  auditEvents,
  bookingContacts,
  bookings,
  guestSessions,
  type DatabaseClient,
  eq,
  sql,
  users,
} from '@room/database';

export class ClaimBookingError extends Error {
  public constructor(
    public readonly code:
      | 'BOOKING_NOT_FOUND'
      | 'GUEST_SESSION_REQUIRED'
      | 'GUEST_SESSION_MISMATCH'
      | 'BOOKING_ALREADY_LINKED'
      | 'CUSTOMER_NOT_FOUND'
      | 'CUSTOMER_DISABLED',
    message: string,
  ) {
    super(message);
    this.name = 'ClaimBookingError';
  }
}

export interface ClaimBookingServiceOptions {
  readonly database: DatabaseClient;
}

export interface ClaimBookingInput {
  readonly bookingCode: string;
  readonly userId: string;
  readonly guestSessionTokenDigest: Buffer | null;
}

export interface ClaimBookingResult {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly wasAlreadyClaimed: boolean;
}

type DbTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

/**
 * Links a guest booking to the CUSTOMER's user id once the CUSTOMER proves
 * possession through the booking-scoped guest session.
 *
 * Rules:
 * - If booking is not yet linked, set customer_user_id.
 * - If already linked to the same CUSTOMER, idempotent success.
 * - If linked to a different customer, BOOKING_ALREADY_LINKED (409).
 * - Email equivalence with booking contact is recorded as audit metadata
 *   only — never sufficient on its own to claim.
 */
export class ClaimBookingService {
  public constructor(private readonly options: ClaimBookingServiceOptions) {}

  public async claim(input: ClaimBookingInput): Promise<ClaimBookingResult> {
    if (input.guestSessionTokenDigest === null) {
      throw new ClaimBookingError(
        'GUEST_SESSION_REQUIRED',
        'A guest session bound to the booking is required to claim',
      );
    }

    const customer = await this.options.database
      .select({ id: users.id, email: users.email, status: users.status })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    const customerRow = customer[0];
    if (customerRow === undefined) {
      throw new ClaimBookingError('CUSTOMER_NOT_FOUND', 'CUSTOMER user not found');
    }
    if (customerRow.status !== 'ACTIVE') {
      throw new ClaimBookingError('CUSTOMER_DISABLED', 'CUSTOMER account is not ACTIVE');
    }

    return this.options.database.transaction(async (tx: DbTransaction) => {
      const bookingRows = await tx
        .select({
          id: bookings.id,
          propertyId: bookings.propertyId,
          bookingCode: bookings.bookingCode,
          customerUserId: bookings.customerUserId,
        })
        .from(bookings)
        .where(eq(bookings.bookingCode, input.bookingCode))
        .limit(1)
        .for('update');
      const booking = bookingRows[0];
      if (booking === undefined) {
        throw new ClaimBookingError('BOOKING_NOT_FOUND', 'Booking not found');
      }

      const sessionRows = await tx
        .select({ bookingId: guestSessions.bookingId })
        .from(guestSessions)
        .where(
          input.guestSessionTokenDigest === null
            ? sql`false`
            : eq(guestSessions.tokenDigest, input.guestSessionTokenDigest),
        )
        .limit(1);
      const sessionRow = sessionRows[0];
      if (sessionRow === undefined || sessionRow.bookingId !== booking.id) {
        throw new ClaimBookingError(
          'GUEST_SESSION_MISMATCH',
          'Guest session does not bound the requested booking',
        );
      }

      let wasAlreadyClaimed = false;
      if (booking.customerUserId === null) {
        await tx
          .update(bookings)
          .set({ customerUserId: input.userId, updatedAt: new Date() })
          .where(eq(bookings.id, booking.id));
      } else if (booking.customerUserId === input.userId) {
        wasAlreadyClaimed = true;
      } else {
        throw new ClaimBookingError(
          'BOOKING_ALREADY_LINKED',
          'Booking is already linked to another CUSTOMER account',
        );
      }

      const supportingMatch = await this.checkSupportingEmailMatch(
        tx,
        booking.id,
        customerRow.email,
      );

      await tx.insert(auditEvents).values({
        propertyId: booking.propertyId,
        aggregateType: 'BOOKING',
        aggregateId: booking.id,
        eventType: 'BOOKING_CLAIMED',
        actorType: 'CUSTOMER',
        actorId: input.userId,
        payload: {
          bookingCode: booking.bookingCode,
          supportingMatch,
          idempotent: wasAlreadyClaimed,
        },
      });

      return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        wasAlreadyClaimed,
      };
    });
  }

  private async checkSupportingEmailMatch(
    tx: DbTransaction,
    bookingId: string,
    normalizedEmail: string,
  ): Promise<boolean> {
    const normalized = normalizedEmail.trim().toLowerCase();
    if (normalized.length === 0) return false;
    const matches = await tx
      .select({ id: bookingContacts.id })
      .from(bookingContacts)
      .where(
        sql`${bookingContacts.bookingId} = ${bookingId} AND lower(${bookingContacts.normalizedEmail}) = ${normalized}`,
      )
      .limit(1);
    return matches.length > 0;
  }
}
