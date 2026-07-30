import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import {
  bookingHoldStatusRequestSchema,
  bookingHoldStatusResponseSchema,
  type BookingHoldStatusRequest,
  type BookingHoldStatusResponse,
} from '@room/contracts';
import { sql, type DatabaseClient } from '@room/database';

import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';

interface StatusLookupRow {
  booking_id: string;
  status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  hold_expires_at: Date | string | null;
}

function parseSqlTimestamp(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export class BookingHoldStatusService {
  public constructor(
    private readonly database: DatabaseClient,
    private readonly secrets: GuestAccessSecrets,
  ) {}

  public async status(input: unknown, now: Date): Promise<BookingHoldStatusResponse> {
    const request: BookingHoldStatusRequest = bookingHoldStatusRequestSchema.parse(input);

    const emailDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(request.email, 'utf8')],
    });

    const result = await this.database.execute<StatusLookupRow & Record<string, unknown>>(
      sql`SELECT b.id            AS booking_id,
                 b.status        AS status,
                 b.hold_expires_at AS hold_expires_at
            FROM bookings b
            LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
           WHERE b.booking_code = ${request.bookingCode}
             AND (bc.email_digest IS NULL OR bc.email_digest = ${emailDigest})`,
    );
    const row = result.rows[0];
    if (row === undefined) {
      return bookingHoldStatusResponseSchema.parse({
        status: 'UNKNOWN',
        holdExpiresAt: null,
        serverTime: now.toISOString(),
      });
    }
    if (row.status === 'HOLD' && row.hold_expires_at !== null) {
      const expiresAt = parseSqlTimestamp(row.hold_expires_at, 'hold_expires_at');
      if (expiresAt.getTime() <= now.getTime()) {
        return bookingHoldStatusResponseSchema.parse({
          status: 'EXPIRED',
          holdExpiresAt: expiresAt.toISOString(),
          serverTime: now.toISOString(),
        });
      }
      return bookingHoldStatusResponseSchema.parse({
        status: 'HOLD',
        holdExpiresAt: expiresAt.toISOString(),
        serverTime: now.toISOString(),
      });
    }
    return bookingHoldStatusResponseSchema.parse({
      status: 'UNKNOWN',
      holdExpiresAt: null,
      serverTime: now.toISOString(),
    });
  }
}
