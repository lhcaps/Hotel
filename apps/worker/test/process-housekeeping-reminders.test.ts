import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { processHousekeepingReminders } from '../src/jobs/process-housekeeping-reminders.js';
import {
  createExpirationFixture,
  seedHold,
  type ExpirationFixture,
} from './fixtures/hold-expiration-fixtures.js';

let fixture: ExpirationFixture | undefined;

async function useFixture(): Promise<ExpirationFixture> {
  fixture = await createExpirationFixture();
  return fixture;
}

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

describe('processHousekeepingReminders', () => {
  it('marks a due arrival preparation reminder once and emits one operational event', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool);
    const taskId = randomUUID();
    const task = await pool.query<{ property_id: string; room_id: string }>(
      'SELECT property_id, room_id FROM bookings WHERE id = $1',
      [bookingId],
    );
    const row = task.rows[0];
    if (row === undefined) throw new Error('Fixture booking is missing');

    await pool.query(
      `INSERT INTO housekeeping_tasks
         (id, property_id, room_id, booking_id, type, status, due_at, reminder_at)
       VALUES ($1, $2, $3, $4, 'ARRIVAL_PREP', 'SCHEDULED',
               CURRENT_TIMESTAMP + interval '1 hour', CURRENT_TIMESTAMP - interval '1 minute')`,
      [taskId, row.property_id, row.room_id, bookingId],
    );

    await expect(
      processHousekeepingReminders({ pool, batchSize: 10, maxBatches: 2 }),
    ).resolves.toEqual({ processed: 1, batches: 1, exhaustedSafetyBound: false });

    const state = await pool.query<{
      status: string;
      reminder_sent_at: Date | null;
      outbox_count: number;
    }>(
      `SELECT ht.status, ht.reminder_sent_at,
              (SELECT count(*)::int FROM outbox_events oe
                WHERE oe.aggregate_id = ht.id
                  AND oe.event_type = 'housekeeping.reminder.due') AS outbox_count
         FROM housekeeping_tasks ht
        WHERE ht.id = $1`,
      [taskId],
    );
    expect(state.rows[0]).toMatchObject({ status: 'DUE', outbox_count: 1 });
    expect(state.rows[0]?.reminder_sent_at).toBeInstanceOf(Date);

    await expect(
      processHousekeepingReminders({ pool, batchSize: 10, maxBatches: 2 }),
    ).resolves.toEqual({ processed: 0, batches: 1, exhaustedSafetyBound: false });
    expect(
      (
        await pool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM outbox_events
          WHERE aggregate_id = $1 AND event_type = 'housekeeping.reminder.due'`,
          [taskId],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });
});
