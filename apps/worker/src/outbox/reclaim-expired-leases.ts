import { type DatabasePool, type DatabasePoolClient } from '@room/database';

export interface ReclaimExpiredOutboxLeasesInput {
  readonly pool: DatabasePool;
  readonly batchSize: number;
}

export interface ReclaimExpiredOutboxLeasesOptions {
  readonly client?: DatabasePoolClient;
}

const MAX_BATCH_SIZE = 500;

export function validateReclaimOptions(input: ReclaimExpiredOutboxLeasesInput): void {
  if (
    !Number.isInteger(input.batchSize) ||
    input.batchSize < 1 ||
    input.batchSize > MAX_BATCH_SIZE
  ) {
    throw new RangeError(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}`);
  }
}

export async function reclaimExpiredOutboxLeases(
  input: ReclaimExpiredOutboxLeasesInput,
  options: ReclaimExpiredOutboxLeasesOptions = {},
): Promise<number> {
  validateReclaimOptions(input);

  const run = async (client: DatabasePoolClient): Promise<number> => {
    const result = await client.query(
      `UPDATE outbox_events
          SET lease_id = NULL,
              claimed_at = NULL,
              lease_expires_at = NULL
        WHERE id IN (
          SELECT id
            FROM outbox_events
           WHERE status = 'PENDING'
             AND lease_id IS NOT NULL
             AND lease_expires_at <= CURRENT_TIMESTAMP
          ORDER BY lease_expires_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )`,
      [input.batchSize],
    );
    return result.rowCount ?? 0;
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
