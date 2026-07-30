import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { reclaimExpiredOutboxLeases } from '../../src/outbox/reclaim-expired-leases.js';
import {
  createOutboxFixture,
  readOutboxEvent,
  seedBookingHold,
  seedOutboxEvent,
  type OutboxFixture,
} from '../fixtures/outbox-fixtures.js';

let fixture: OutboxFixture | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

async function useFixture(): Promise<OutboxFixture> {
  fixture = await createOutboxFixture();
  return fixture;
}

describe('reclaimExpiredOutboxLeases', () => {
  it('clears expired leases but leaves PENDING status and future leases intact', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const expiredId = randomUUID();
    const activeId = randomUUID();
    await seedOutboxEvent(pool, {
      id: expiredId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      leaseId: randomUUID(),
      claimedAt: new Date(Date.now() - 90_000),
      leaseExpiresAt: new Date(Date.now() - 60_000),
    });
    await seedOutboxEvent(pool, {
      id: activeId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      leaseId: randomUUID(),
      claimedAt: new Date(Date.now() - 1_000),
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    const count = await reclaimExpiredOutboxLeases({ pool, batchSize: 10 });
    expect(count).toBe(1);

    const expiredRow = await readOutboxEvent(pool, expiredId);
    expect(expiredRow?.status).toBe('PENDING');
    expect(expiredRow?.leaseId).toBeNull();
    expect(expiredRow?.claimedAt).toBeNull();
    expect(expiredRow?.leaseExpiresAt).toBeNull();

    const activeRow = await readOutboxEvent(pool, activeId);
    expect(activeRow?.leaseId).not.toBeNull();
  });

  it('does not reclaim rows that were lost to another worker', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      leaseId: randomUUID(),
      claimedAt: new Date(Date.now() - 60_000),
      leaseExpiresAt: new Date(Date.now() - 30_000),
    });

    const lockClient = await pool.connect();
    try {
      await lockClient.query('BEGIN');
      await lockClient.query(`SELECT id FROM outbox_events WHERE id = $1 FOR UPDATE`, [eventId]);

      const count = await reclaimExpiredOutboxLeases({ pool, batchSize: 10 });
      expect(count).toBe(0);
      await lockClient.query('ROLLBACK');
    } finally {
      lockClient.release();
    }

    const row = await readOutboxEvent(pool, eventId);
    expect(row?.leaseId).not.toBeNull();
  });

  it('rejects invalid batchSize', async () => {
    const { pool } = await useFixture();
    await expect(reclaimExpiredOutboxLeases({ pool, batchSize: 0 })).rejects.toThrow(/batchSize/);
  });
});
