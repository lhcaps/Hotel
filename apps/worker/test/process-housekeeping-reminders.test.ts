import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { processHousekeepingReminders } from '../src/jobs/process-housekeeping-reminders.js';
import { issueAccessCredentials } from '../src/jobs/issue-access-credentials.js';
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

describe('issueAccessCredentials', () => {
  it('issues one Demo reference at T-30 with masked audit and transactional outbox evidence', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 30,
      durationMinutes: 4 * 60,
    });

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 1,
      batches: 1,
      exhaustedSafetyBound: false,
    });

    const credential = await pool.query<{
      id: string;
      status: string;
      provider: string;
      provider_credential_reference: string;
      issued_at: Date | null;
      audit_payload: Record<string, unknown>;
      outbox_count: number;
    }>(
      `SELECT ac.id, ac.status, ac.provider, ac.provider_credential_reference, ac.issued_at,
              ae.payload AS audit_payload,
              (SELECT count(*)::int FROM outbox_events oe
                WHERE oe.aggregate_id = ac.id
                  AND oe.event_type = 'access.credential.issued') AS outbox_count
         FROM access_credentials ac
         JOIN audit_events ae
           ON ae.aggregate_id = ac.id
          AND ae.event_type = 'ACCESS_CREDENTIAL_ISSUED'
        WHERE ac.booking_id = $1`,
      [bookingId],
    );
    expect(credential.rows[0]).toMatchObject({
      status: 'ISSUED',
      provider: 'DEMO',
      outbox_count: 1,
    });
    expect(credential.rows[0]?.issued_at).toBeInstanceOf(Date);
    expect(credential.rows[0]?.audit_payload).toMatchObject({
      bookingId,
      provider: 'DEMO',
    });
    expect(String(credential.rows[0]?.audit_payload.referenceMasked)).toMatch(/^…/);
    expect(credential.rows[0]?.audit_payload.referenceMasked).not.toContain(
      credential.rows[0]?.provider_credential_reference,
    );

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
  });

  it('does not issue before T-30 or when the Demo provider is unhealthy', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 31,
      durationMinutes: 4 * 60,
    });

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
    await expect(
      issueAccessCredentials({
        pool,
        batchSize: 10,
        maxBatches: 2,
        provider: {
          provider: 'DEMO',
          isHealthy: async () => false,
          createCredential: async () => ({ providerCredentialReference: 'must-not-be-created' }),
        },
      }),
    ).rejects.toThrow('Access credential provider is unavailable');
    expect(
      (
        await pool.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM access_credentials WHERE booking_id = $1',
          [bookingId],
        )
      ).rows[0]?.count,
    ).toBe(0);
  });

  it('refuses a dirty or maintenance-blocked assigned room without creating a credential', async () => {
    const { pool } = await useFixture();
    const dirtyBooking = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 30,
    });
    await pool.query(
      `UPDATE rooms SET housekeeping_status = 'DIRTY'
        WHERE id = (SELECT room_id FROM bookings WHERE id = $1)`,
      [dirtyBooking],
    );
    const maintenanceBooking = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 30,
    });
    await pool.query(
      `INSERT INTO maintenance_blocks (property_id, room_id, starts_at, ends_at, reason)
       SELECT property_id, room_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '4 hours', 'T-30 test'
         FROM bookings WHERE id = $1`,
      [maintenanceBooking],
    );

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
    expect(
      (
        await pool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM access_credentials
            WHERE booking_id = ANY($1::uuid[])`,
          [[dirtyBooking, maintenanceBooking]],
        )
      ).rows[0]?.count,
    ).toBe(0);
  });

  it('does not report a maintenance-blocked booking as remaining eligible work', async () => {
    const { pool } = await useFixture();
    await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 29,
    });
    const maintenanceBooking = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 30,
    });
    await pool.query(
      `INSERT INTO maintenance_blocks (property_id, room_id, starts_at, ends_at, reason)
       SELECT property_id, room_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '4 hours', 'T-30 bound'
         FROM bookings WHERE id = $1`,
      [maintenanceBooking],
    );

    await expect(issueAccessCredentials({ pool, batchSize: 1, maxBatches: 1 })).resolves.toEqual({
      processed: 1,
      batches: 1,
      exhaustedSafetyBound: false,
    });
  });
});
