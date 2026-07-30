import { Buffer } from 'node:buffer';

import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import { type DatabasePool } from '@room/database';

export interface GuestSessionRecord {
  readonly sessionId: string;
  readonly bookingId: string;
  readonly expiresAt: Date;
}

interface SessionLookupRow {
  readonly session_id: string;
  readonly booking_id: string;
  readonly expires_at: Date | string;
  readonly revoked_at: Date | string | null;
}

function parseSqlTimestamp(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export function digestSessionToken(sessionSecret: Buffer, token: Buffer): Buffer {
  return computeDigest({
    secretKey: sessionSecret,
    domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
    parts: [token],
  });
}

export class GuestSessionRepository {
  public constructor(private readonly pool: DatabasePool) {}

  public async findActiveSession(
    tokenDigest: Buffer,
    now: Date,
  ): Promise<GuestSessionRecord | null> {
    const result = await this.pool.query<SessionLookupRow>(
      `SELECT id          AS session_id,
              booking_id  AS booking_id,
              expires_at  AS expires_at,
              revoked_at  AS revoked_at
         FROM guest_sessions
        WHERE token_digest = $1
          AND revoked_at IS NULL
          AND expires_at > $2
        LIMIT 1`,
      [tokenDigest, now],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      sessionId: row.session_id,
      bookingId: row.booking_id,
      expiresAt: parseSqlTimestamp(row.expires_at, 'expires_at'),
    };
  }
}