import type { DatabasePool, DatabasePoolClient } from '@room/database';

const MAX_BATCH_SIZE = 100;
const MAX_BATCHES = 100;
const MAX_SWEEP_SIZE = 1_000;

export interface ExpireStaleHoldsOptions {
  readonly pool: DatabasePool;
  readonly batchSize: number;
  readonly maxBatches: number;
}

export interface ExpireStaleHoldsResult {
  readonly processed: number;
  readonly batches: number;
  readonly exhaustedSafetyBound: boolean;
}

interface ClaimedHold {
  readonly id: string;
  readonly property_id: string;
}

function validateOptions(options: ExpireStaleHoldsOptions): void {
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

async function processBatch(client: DatabasePoolClient, batchSize: number): Promise<number> {
  await client.query('BEGIN');
  try {
    const timestamp = await client.query<{ database_now: Date }>(
      'SELECT CURRENT_TIMESTAMP AS database_now',
    );
    const databaseNow = timestamp.rows[0]?.database_now;
    if (databaseNow === undefined)
      throw new Error('PostgreSQL returned no authoritative timestamp');

    const claimed = await client.query<ClaimedHold>(
      `SELECT b.id, b.property_id
         FROM bookings b
        WHERE b.status = 'HOLD'
          AND b.hold_expires_at <= $1
        ORDER BY b.hold_expires_at ASC, b.id ASC
        FOR UPDATE OF b SKIP LOCKED
        LIMIT $2`,
      [databaseNow, batchSize],
    );

    if (claimed.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    const bookingIds = claimed.rows.map((row) => row.id);
    const transitioned = await client.query<ClaimedHold>(
      `UPDATE bookings
          SET status = 'EXPIRED', expired_at = $2, updated_at = $2
        WHERE id = ANY($1::uuid[])
          AND status = 'HOLD'
      RETURNING id, property_id`,
      [bookingIds, databaseNow],
    );
    const transitionedIds = transitioned.rows.map((row) => row.id);

    await client.query(
      `UPDATE room_inventory_blocks
          SET status = 'RELEASED', released_at = $2
        WHERE booking_id = ANY($1::uuid[])
          AND block_type = 'BOOKING'
          AND status = 'ACTIVE'`,
      [transitionedIds, databaseNow],
    );

    await client.query(
      `UPDATE booking_coupon_applications
          SET application_status = 'RELEASED', quota_reserved = false, released_at = $2
        WHERE booking_id = ANY($1::uuid[])
          AND application_status IN ('ASSOCIATED', 'RESERVED')`,
      [transitionedIds, databaseNow],
    );

    await client.query(
      `INSERT INTO audit_events
         (property_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, payload, occurred_at)
       SELECT b.property_id, 'BOOKING', claimed.booking_id, 'HOLD_EXPIRED', 'SYSTEM', NULL,
              jsonb_build_object(
                'bookingId', claimed.booking_id,
                'fromStatus', 'HOLD',
                'toStatus', 'EXPIRED',
                'expiredAt', $2::timestamptz
              ),
              $2
         FROM unnest($1::uuid[]) AS claimed(booking_id)
         JOIN bookings b ON b.id = claimed.booking_id`,
      [transitionedIds, databaseNow],
    );

    await client.query(
      `INSERT INTO audit_events
         (property_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, payload, occurred_at)
       SELECT b.property_id, 'BOOKING_COUPON_APPLICATION', claimed.booking_id, 'COUPON_RELEASED', 'SYSTEM', NULL,
              jsonb_build_object(
                'bookingId', claimed.booking_id,
                'releasedAt', $2::timestamptz
              ),
              $2
         FROM unnest($1::uuid[]) AS claimed(booking_id)
         JOIN bookings b ON b.id = claimed.booking_id
        WHERE EXISTS (
          SELECT 1 FROM booking_coupon_applications bca
           WHERE bca.booking_id = claimed.booking_id
             AND bca.application_status = 'RELEASED'
             AND bca.released_at = $2
        )`,
      [transitionedIds, databaseNow],
    );

    await client.query(
      `INSERT INTO outbox_events
         (property_id, aggregate_type, aggregate_id, event_type, payload, status, available_at, created_at)
       SELECT b.property_id, 'BOOKING', claimed.booking_id, 'booking.hold.expired',
              jsonb_build_object(
                'eventVersion', 1,
                'bookingId', claimed.booking_id,
                'expiredAt', $2::timestamptz
              ),
              'PENDING', $2, $2
         FROM unnest($1::uuid[]) AS claimed(booking_id)
         JOIN bookings b ON b.id = claimed.booking_id`,
      [transitionedIds, databaseNow],
    );

    await client.query('COMMIT');
    return transitioned.rows.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function hasUnlockedEligibleHold(pool: DatabasePool): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT b.id
         FROM bookings b
        WHERE b.status = 'HOLD'
          AND b.hold_expires_at <= CURRENT_TIMESTAMP
        ORDER BY b.hold_expires_at ASC, b.id ASC
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

export async function expireStaleHolds(
  options: ExpireStaleHoldsOptions,
): Promise<ExpireStaleHoldsResult> {
  validateOptions(options);

  let processed = 0;
  let batches = 0;
  for (let batchIndex = 0; batchIndex < options.maxBatches; batchIndex += 1) {
    const client = await options.pool.connect();
    let batchProcessed: number;
    try {
      batchProcessed = await processBatch(client, options.batchSize);
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
    exhaustedSafetyBound: await hasUnlockedEligibleHold(options.pool),
  };
}
