import { type DatabasePool, type DatabasePoolClient } from '@room/database';

export interface OutboxClaimRow {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly attemptCount: number;
  readonly leaseId: string;
  readonly leaseExpiresAt: Date;
}

export interface ClaimOutboxBatchInput {
  readonly pool: DatabasePool;
  readonly batchSize: number;
  readonly leaseTtlMs: number;
}

export interface ClaimOutboxBatchOptions {
  readonly client?: DatabasePoolClient;
}

const MAX_BATCH_SIZE = 100;
const MAX_LEASE_TTL_MS = 5 * 60 * 1000;
const MIN_LEASE_TTL_MS = 1_000;

export function validateClaimOptions(input: ClaimOutboxBatchInput): void {
  if (
    !Number.isInteger(input.batchSize) ||
    input.batchSize < 1 ||
    input.batchSize > MAX_BATCH_SIZE
  ) {
    throw new RangeError(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}`);
  }
  if (
    !Number.isInteger(input.leaseTtlMs) ||
    input.leaseTtlMs < MIN_LEASE_TTL_MS ||
    input.leaseTtlMs > MAX_LEASE_TTL_MS
  ) {
    throw new RangeError(
      `leaseTtlMs must be an integer between ${MIN_LEASE_TTL_MS} and ${MAX_LEASE_TTL_MS}`,
    );
  }
}

interface ClaimedRow {
  readonly id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly payload: Record<string, unknown>;
  readonly attempt_count: number;
  readonly lease_id: string;
  readonly lease_expires_at: Date;
}

export async function claimOutboxBatch(
  input: ClaimOutboxBatchInput,
  options: ClaimOutboxBatchOptions = {},
): Promise<readonly OutboxClaimRow[]> {
  validateClaimOptions(input);

  const run = async (client: DatabasePoolClient): Promise<readonly OutboxClaimRow[]> => {
    await client.query('BEGIN');
    try {
      const timestamp = await client.query<{ database_now: Date }>(
        'SELECT CURRENT_TIMESTAMP AS database_now',
      );
      const databaseNow = timestamp.rows[0]?.database_now;
      if (databaseNow === undefined) {
        throw new Error('PostgreSQL returned no authoritative timestamp');
      }

      const eligible = await client.query<{ id: string }>(
        `SELECT id
           FROM outbox_events
          WHERE status = 'PENDING'
            AND available_at <= $1
            AND (lease_id IS NULL OR lease_expires_at <= $1)
          ORDER BY available_at ASC, created_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $2`,
        [databaseNow, input.batchSize],
      );

      if (eligible.rows.length === 0) {
        await client.query('COMMIT');
        return [];
      }

      const ids = eligible.rows.map((row) => row.id);
      const updated = await client.query<ClaimedRow>(
        `UPDATE outbox_events
            SET lease_id = gen_random_uuid(),
                claimed_at = $2,
                lease_expires_at = $2::timestamptz + ($3::bigint * INTERVAL '1 millisecond'),
                attempt_count = attempt_count + 1
          WHERE id = ANY($1::uuid[])
            AND status = 'PENDING'
            AND (lease_id IS NULL OR lease_expires_at <= $2)
        RETURNING id,
                  aggregate_type,
                  aggregate_id,
                  event_type,
                  payload,
                  attempt_count,
                  lease_id,
                  lease_expires_at`,
        [ids, databaseNow, input.leaseTtlMs],
      );

      await client.query('COMMIT');

      return updated.rows.map((row) => ({
        id: row.id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        payload: row.payload,
        attemptCount: row.attempt_count,
        leaseId: row.lease_id,
        leaseExpiresAt: row.lease_expires_at,
      }));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  };

  if (options.client !== undefined) {
    return run(options.client);
  }
  const client = await input.pool.connect();
  try {
    return await run(client);
  } finally {
    client.release();
  }
}
