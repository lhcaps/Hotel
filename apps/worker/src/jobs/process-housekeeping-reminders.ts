import type { DatabasePool, DatabasePoolClient } from '@room/database';

const MAX_BATCH_SIZE = 100;
const MAX_BATCHES = 100;
const MAX_SWEEP_SIZE = 1_000;

export interface ProcessHousekeepingRemindersOptions {
  readonly pool: DatabasePool;
  readonly batchSize: number;
  readonly maxBatches: number;
}

export interface ProcessHousekeepingRemindersResult {
  readonly processed: number;
  readonly batches: number;
  readonly exhaustedSafetyBound: boolean;
}

interface ClaimedTask {
  readonly id: string;
  readonly property_id: string;
  readonly room_id: string;
  readonly room_number: string;
  readonly type: 'ARRIVAL_PREP' | 'TURNOVER';
  readonly due_at: Date;
}

function validateOptions(options: ProcessHousekeepingRemindersOptions): void {
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
    if (databaseNow === undefined) {
      throw new Error('PostgreSQL returned no authoritative timestamp');
    }

    const claimed = await client.query<ClaimedTask>(
      `SELECT ht.id, ht.property_id, ht.room_id, r.room_number, ht.type, ht.due_at
         FROM housekeeping_tasks ht
         JOIN rooms r ON r.id = ht.room_id AND r.property_id = ht.property_id
        WHERE ht.status = 'SCHEDULED'
          AND ht.reminder_at <= $1
          AND ht.reminder_sent_at IS NULL
        ORDER BY ht.reminder_at ASC, ht.id ASC
        FOR UPDATE OF ht SKIP LOCKED
        LIMIT $2`,
      [databaseNow, batchSize],
    );
    if (claimed.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    const taskIds = claimed.rows.map((row) => row.id);
    const transitioned = await client.query<{ id: string }>(
      `UPDATE housekeeping_tasks
          SET status = 'DUE', reminder_sent_at = $2, updated_at = $2
        WHERE id = ANY($1::uuid[])
          AND status = 'SCHEDULED'
          AND reminder_sent_at IS NULL
      RETURNING id`,
      [taskIds, databaseNow],
    );
    const transitionedIds = new Set(transitioned.rows.map((row) => row.id));
    const transitionedTasks = claimed.rows.filter((row) => transitionedIds.has(row.id));
    if (transitionedTasks.length > 0) {
      await client.query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload, status, available_at, created_at)
         SELECT task.property_id, 'HOUSEKEEPING_TASK', task.id, 'housekeeping.reminder.due',
                jsonb_build_object(
                  'eventVersion', 1,
                  'taskId', task.id,
                  'roomId', task.room_id,
                  'roomNumber', room.room_number,
                  'taskType', task.type,
                  'dueAt', task.due_at
                ),
                'PENDING', $2, $2
           FROM housekeeping_tasks task
           JOIN rooms room ON room.id = task.room_id AND room.property_id = task.property_id
          WHERE task.id = ANY($1::uuid[])
            AND task.reminder_sent_at = $2`,
        [transitionedTasks.map((row) => row.id), databaseNow],
      );
    }

    await client.query('COMMIT');
    return transitionedTasks.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function hasUnlockedEligibleTask(pool: DatabasePool): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT ht.id
         FROM housekeeping_tasks ht
        WHERE ht.status = 'SCHEDULED'
          AND ht.reminder_at <= CURRENT_TIMESTAMP
          AND ht.reminder_sent_at IS NULL
        ORDER BY ht.reminder_at ASC, ht.id ASC
        FOR UPDATE OF ht SKIP LOCKED
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

export async function processHousekeepingReminders(
  options: ProcessHousekeepingRemindersOptions,
): Promise<ProcessHousekeepingRemindersResult> {
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
    exhaustedSafetyBound: await hasUnlockedEligibleTask(options.pool),
  };
}
