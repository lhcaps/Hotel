import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
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

describe('issueAccessCredentials - T-30 timing semantics', () => {
  it('T-31: does NOT issue credential', async () => {
    const { pool } = await useFixture();
    await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 31,
      durationMinutes: 4 * 60,
    });

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });

    const credentialCount = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM access_credentials',
    );
    expect(credentialCount.rows[0]?.count).toBe(0);
  });

  it('T-30 exact: issues ONE credential', async () => {
    const { pool } = await useFixture();
    await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 30,
      durationMinutes: 4 * 60,
    });

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 1,
      batches: 1,
      exhaustedSafetyBound: false,
    });

    const credentialCount = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM access_credentials WHERE status = \'ISSUED\'',
    );
    expect(credentialCount.rows[0]?.count).toBe(1);
  });

  it('inside T-30: issues idempotently', async () => {
    const { pool } = await useFixture();
    await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 15,
      durationMinutes: 4 * 60,
    });

    await issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 });
    await issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 });

    const credentialCount = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM access_credentials WHERE status IN (\'ISSUED\', \'DELIVERED\')',
    );
    expect(credentialCount.rows[0]?.count).toBe(1);
  });

  it('not CONFIRMED: does NOT issue', async () => {
    const { pool } = await useFixture();
    await seedHold(pool, {
      status: 'HOLD',
      checkInOffsetMinutes: 15,
      durationMinutes: 4 * 60,
    });

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
  });

  it('room not ACTIVE: does NOT issue', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 15,
      durationMinutes: 4 * 60,
    });

    await pool.query(
      'UPDATE rooms SET status = \'INACTIVE\' WHERE id = (SELECT room_id FROM bookings WHERE id = $1)',
      [bookingId],
    );

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
  });

  it('room not CLEAN: does NOT issue', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 15,
      durationMinutes: 4 * 60,
    });

    await pool.query(
      'UPDATE rooms SET housekeeping_status = \'DIRTY\' WHERE id = (SELECT room_id FROM bookings WHERE id = $1)',
      [bookingId],
    );

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
  });

  it('active maintenance overlap: does NOT issue', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 15,
      durationMinutes: 4 * 60,
    });

    const booking = await pool.query<{ property_id: string; room_id: string; check_in: Date; check_out: Date }>(
      'SELECT property_id, room_id, check_in, check_out FROM bookings WHERE id = $1',
      [bookingId],
    );
    const row = booking.rows[0];
    if (!row) throw new Error('Booking not found');

    await pool.query(
      `INSERT INTO maintenance_blocks (property_id, room_id, starts_at, ends_at, status, reason)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'Emergency repair')`,
      [row.property_id, row.room_id, row.check_in, row.check_out],
    );

    await expect(issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 })).resolves.toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
  });

  it('masked audit event contains no plaintext credential', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 15,
      durationMinutes: 4 * 60,
    });

    await issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 });

    const credential = await pool.query<{ provider_credential_reference: string }>(
      'SELECT provider_credential_reference FROM access_credentials WHERE booking_id = $1',
      [bookingId],
    );
    const fullReference = credential.rows[0]?.provider_credential_reference;
    expect(fullReference).toBeTruthy();

    const audit = await pool.query<{ payload: any }>(
      'SELECT payload FROM audit_events WHERE event_type = \'ACCESS_CREDENTIAL_ISSUED\' ORDER BY occurred_at DESC LIMIT 1',
    );
    const payload = audit.rows[0]?.payload;
    expect(payload).toBeTruthy();
    expect(payload.referenceMasked).toBeTruthy();
    expect(payload.referenceMasked).not.toBe(fullReference);
    expect(payload.referenceMasked).toMatch(/^…/);
    expect(fullReference).toContain(payload.referenceMasked.slice(1));
  });

  it('outbox contains no plaintext credential', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, {
      status: 'CONFIRMED',
      checkInOffsetMinutes: 15,
      durationMinutes: 4 * 60,
    });

    await issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 });

    const credential = await pool.query<{ provider_credential_reference: string }>(
      'SELECT provider_credential_reference FROM access_credentials WHERE booking_id = $1',
      [bookingId],
    );
    const fullReference = credential.rows[0]?.provider_credential_reference;
    expect(fullReference).toBeTruthy();

    const outbox = await pool.query<{ payload: any }>(
      'SELECT payload FROM outbox_events WHERE event_type = \'access.credential.issued\' ORDER BY created_at DESC LIMIT 1',
    );
    const payload = outbox.rows[0]?.payload;
    expect(payload).toBeTruthy();
    expect(payload).not.toHaveProperty('providerCredentialReference');
    expect(JSON.stringify(payload)).not.toContain(fullReference);
  });
});
