import type { DatabasePool, DatabasePoolClient } from '@room/database';

import {
  DemoAccessCredentialProvider,
  type AccessCredentialProvider,
} from '../access/demo-access-credential-provider.js';

const MAX_BATCH_SIZE = 100;
const MAX_BATCHES = 100;
const MAX_SWEEP_SIZE = 1_000;

export interface IssueAccessCredentialsOptions {
  readonly pool: DatabasePool;
  readonly batchSize: number;
  readonly maxBatches: number;
  readonly provider?: AccessCredentialProvider;
}

export interface IssueAccessCredentialsResult {
  readonly processed: number;
  readonly batches: number;
  readonly exhaustedSafetyBound: boolean;
}

interface ClaimedBooking {
  readonly id: string;
  readonly property_id: string;
  readonly room_id: string;
  readonly check_in: Date;
  readonly check_out: Date;
}

function validateOptions(options: IssueAccessCredentialsOptions): void {
  if (
    !Number.isInteger(options.batchSize) ||
    options.batchSize < 1 ||
    options.batchSize > MAX_BATCH_SIZE
  ) {
    throw new RangeError(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}`);
  }
  if (
    !Number.isInteger(options.maxBatches) ||
    options.maxBatches < 1 ||
    options.maxBatches > MAX_BATCHES
  ) {
    throw new RangeError(`maxBatches must be an integer between 1 and ${MAX_BATCHES}`);
  }
  if (options.batchSize * options.maxBatches > MAX_SWEEP_SIZE) {
    throw new RangeError(`batchSize multiplied by maxBatches must not exceed ${MAX_SWEEP_SIZE}`);
  }
}

function maskedReference(reference: string): string {
  return `…${reference.slice(-8)}`;
}

async function processBatch(
  client: DatabasePoolClient,
  batchSize: number,
  provider: AccessCredentialProvider,
): Promise<number> {
  await client.query('BEGIN');
  try {
    const timestamp = await client.query<{ database_now: Date }>(
      'SELECT CURRENT_TIMESTAMP AS database_now',
    );
    const databaseNow = timestamp.rows[0]?.database_now;
    if (databaseNow === undefined)
      throw new Error('PostgreSQL returned no authoritative timestamp');

    const claimed = await client.query<ClaimedBooking>(
      `SELECT b.id, b.property_id, b.room_id, b.check_in, b.check_out
         FROM bookings b
         JOIN rooms r ON r.id = b.room_id AND r.property_id = b.property_id
        WHERE b.status = 'CONFIRMED'
          AND b.check_in <= $1::timestamptz + interval '30 minutes'
          AND b.check_out > $1::timestamptz
          AND r.status = 'ACTIVE'
          AND r.housekeeping_status = 'CLEAN'
          AND NOT EXISTS (
            SELECT 1
              FROM maintenance_blocks mb
             WHERE mb.property_id = b.property_id
               AND mb.room_id = b.room_id
               AND mb.status = 'ACTIVE'
               AND mb.starts_at < b.check_out
               AND mb.ends_at > b.check_in
          )
          AND NOT EXISTS (
            SELECT 1
              FROM access_credentials ac
             WHERE ac.booking_id = b.id
               AND ac.status IN ('PENDING', 'ISSUED')
          )
        ORDER BY b.check_in ASC, b.id ASC
        FOR UPDATE OF b SKIP LOCKED
        LIMIT $2`,
      [databaseNow, batchSize],
    );

    let processed = 0;
    for (const booking of claimed.rows) {
      const validFrom = booking.check_in > databaseNow ? booking.check_in : databaseNow;
      const created = await provider.createCredential({ bookingId: booking.id, validFrom });
      const idempotencyKey = `access-credential:${booking.id}:${booking.check_in.toISOString()}`;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO access_credentials
           (property_id, booking_id, room_id, provider, provider_credential_reference,
            status, valid_from, valid_until, issued_at, idempotency_key, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'ISSUED', $6, $7, $8, $9, $8, $8)
         ON CONFLICT (booking_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [
          booking.property_id,
          booking.id,
          booking.room_id,
          provider.provider,
          created.providerCredentialReference,
          validFrom,
          booking.check_out,
          databaseNow,
          idempotencyKey,
        ],
      );
      const credentialId = inserted.rows[0]?.id;
      if (credentialId === undefined) continue;

      await client.query(
        `INSERT INTO audit_events
           (property_id, aggregate_type, aggregate_id, event_type, actor_type, payload, occurred_at)
         VALUES ($1, 'ACCESS_CREDENTIAL', $2, 'ACCESS_CREDENTIAL_ISSUED', 'SYSTEM',
                 jsonb_build_object(
                   'eventVersion', 1,
                   'bookingId', $3::uuid,
                   'provider', $4::text,
                   'referenceMasked', $5::text,
                   'validFrom', $6::timestamptz,
                   'validUntil', $7::timestamptz
                 ),
                 $8)`,
        [
          booking.property_id,
          credentialId,
          booking.id,
          provider.provider,
          maskedReference(created.providerCredentialReference),
          validFrom,
          booking.check_out,
          databaseNow,
        ],
      );
      await client.query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload, status, available_at, created_at)
         VALUES ($1, 'ACCESS_CREDENTIAL', $2, 'access.credential.issued',
                 jsonb_build_object(
                   'eventVersion', 1,
                   'credentialId', $2::uuid,
                   'bookingId', $3::uuid,
                   'provider', $4::text,
                   'validFrom', $5::timestamptz,
                   'validUntil', $6::timestamptz
                 ),
                 'PENDING', $7, $7)`,
        [
          booking.property_id,
          credentialId,
          booking.id,
          provider.provider,
          validFrom,
          booking.check_out,
          databaseNow,
        ],
      );
      processed += 1;
    }
    await client.query('COMMIT');
    return processed;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function hasUnlockedEligibleBooking(pool: DatabasePool): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT b.id
         FROM bookings b
         JOIN rooms r ON r.id = b.room_id AND r.property_id = b.property_id
        WHERE b.status = 'CONFIRMED'
          AND b.check_in <= CURRENT_TIMESTAMP + interval '30 minutes'
          AND b.check_out > CURRENT_TIMESTAMP
          AND r.status = 'ACTIVE'
          AND r.housekeeping_status = 'CLEAN'
          AND NOT EXISTS (
            SELECT 1
              FROM maintenance_blocks mb
             WHERE mb.property_id = b.property_id
               AND mb.room_id = b.room_id
               AND mb.status = 'ACTIVE'
               AND mb.starts_at < b.check_out
               AND mb.ends_at > b.check_in
          )
          AND NOT EXISTS (
            SELECT 1 FROM access_credentials ac
             WHERE ac.booking_id = b.id AND ac.status IN ('PENDING', 'ISSUED')
          )
        ORDER BY b.check_in ASC, b.id ASC
        FOR UPDATE OF b SKIP LOCKED
        LIMIT 1`,
    );
    await client.query('ROLLBACK');
    return result.rows.length > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function issueAccessCredentials(
  options: IssueAccessCredentialsOptions,
): Promise<IssueAccessCredentialsResult> {
  validateOptions(options);
  const provider = options.provider ?? new DemoAccessCredentialProvider();
  if (!(await provider.isHealthy())) throw new Error('Access credential provider is unavailable');

  let processed = 0;
  let batches = 0;
  for (let batchIndex = 0; batchIndex < options.maxBatches; batchIndex += 1) {
    const client = await options.pool.connect();
    let batchProcessed: number;
    try {
      batchProcessed = await processBatch(client, options.batchSize, provider);
    } finally {
      client.release();
    }
    batches += 1;
    processed += batchProcessed;
    if (batchProcessed < options.batchSize) {
      return { processed, batches, exhaustedSafetyBound: false };
    }
  }
  return {
    processed,
    batches,
    exhaustedSafetyBound: await hasUnlockedEligibleBooking(options.pool),
  };
}
