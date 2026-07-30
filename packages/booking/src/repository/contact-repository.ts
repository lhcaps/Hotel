/**
 * Contact repository: immutable booking contact persistence
 *
 * Booking contacts are write-once, read-many. See design doc §C
 * "Contact normalization and idempotency".
 */

import { bookingContacts, eq, type DatabaseClient } from '@room/database';
import type { NormalizedContact } from '../contact.js';

type DbTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

export interface BookingContact {
  readonly id: string;
  readonly bookingId: string;
  readonly fullName: string;
  readonly normalizedEmail: string;
  readonly normalizedPhoneE164: string;
  readonly emailDigest: Buffer;
  readonly createdAt: Date;
}

/**
 * Insert immutable contact for a booking. Called exactly once per booking
 * during HOLD creation. The unique index on booking_id enforces one contact
 * per booking.
 */
export async function insertBookingContact(
  tx: DbTransaction,
  bookingId: string,
  contact: NormalizedContact,
): Promise<void> {
  await tx.insert(bookingContacts).values({
    bookingId,
    fullName: contact.fullName,
    normalizedEmail: contact.email,
    normalizedPhoneE164: contact.phoneE164,
    emailDigest: contact.emailDigest,
  });
}

/**
 * Load the immutable contact for a booking. Used during idempotency checks
 * to compare normalized fields against incoming requests.
 */
export async function findBookingContact(
  tx: DbTransaction,
  bookingId: string,
): Promise<BookingContact | undefined> {
  const rows = await tx
    .select()
    .from(bookingContacts)
    .where(eq(bookingContacts.bookingId, bookingId))
    .limit(1);

  return rows[0];
}
