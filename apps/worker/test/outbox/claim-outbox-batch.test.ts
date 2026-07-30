import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { claimOutboxBatch } from '../../src/outbox/claim-outbox-batch.js';
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

describe('claimOutboxBatch', () => {
  it('claims a single eligible PENDING row and sets lease fields', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        holdExpiresAt: '2027-01-10T03:45:00.000Z',
      },
    });

    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    expect(claims.length).toBe(1);
    const claim = claims[0];
    expect(claim).toBeDefined();
    if (claim === undefined) {
      throw new Error('Expected claim');
    }
    expect(claim.id).toBe(eventId);
    expect(claim.eventType).toBe('booking.hold.created');
    expect(claim.attemptCount).toBe(1);
    expect(claim.leaseId.length).toBeGreaterThan(0);

    const row = await readOutboxEvent(pool, eventId);
    expect(row).toEqual({
      status: 'PENDING',
      attemptCount: 1,
      availableAt: expect.any(Date) as Date,
      publishedAt: null,
      leaseId: expect.any(String) as string,
      claimedAt: expect.any(Date) as Date,
      leaseExpiresAt: expect.any(Date) as Date,
      lastErrorCategory: null,
    });
  });

  it('does not claim future events', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      availableAt: new Date(Date.now() + 60_000),
    });

    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    expect(claims.length).toBe(0);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.leaseId).toBeNull();
  });

  it('does not steal an active unexpired lease', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    const firstLeaseId = randomUUID();
    const futureExpiry = new Date(Date.now() + 60_000);
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      leaseId: firstLeaseId,
      claimedAt: new Date(Date.now() - 1_000),
      leaseExpiresAt: futureExpiry,
    });

    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    expect(claims.length).toBe(0);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.leaseId).toBe(firstLeaseId);
  });

  it('reclaims an expired lease with a new lease_id', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    const expiredLeaseId = randomUUID();
    const expiredExpiry = new Date(Date.now() - 60_000);
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      leaseId: expiredLeaseId,
      claimedAt: new Date(Date.now() - 90_000),
      leaseExpiresAt: expiredExpiry,
      attemptCount: 1,
    });

    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    expect(claims.length).toBe(1);
    const claim = claims[0];
    if (claim === undefined) {
      throw new Error('Expected claim');
    }
    expect(claim.leaseId).not.toBe(expiredLeaseId);
    expect(claim.attemptCount).toBe(2);
  });

  it('distributes rows between two workers without overlap', async () => {
    const fixture = await useFixture();
    const booking = await seedBookingHold(fixture.pool);
    const eventIds = Array.from({ length: 12 }, () => randomUUID());
    for (const id of eventIds) {
      await seedOutboxEvent(fixture.pool, {
        id,
        aggregateId: booking.bookingId,
        eventType: 'booking.hold.created',
      });
    }
    const poolA = fixture.createPool('task6-claim-worker-a');
    const poolB = fixture.createPool('task6-claim-worker-b');

    const drain = async (pool: import('@room/database').DatabasePool) => {
      const claims: import('../../src/outbox/claim-outbox-batch.js').OutboxClaimRow[] = [];
      let safety = 0;
      while (safety < 20) {
        const batch = await claimOutboxBatch({ pool, batchSize: 4, leaseTtlMs: 30_000 });
        claims.push(...batch);
        if (batch.length < 4) {
          break;
        }
        safety += 1;
      }
      return claims;
    };

    const [a, b] = await Promise.all([drain(poolA), drain(poolB)]);

    const claimedIds = new Set([...a.map((row) => row.id), ...b.map((row) => row.id)]);
    expect(claimedIds.size).toBe(a.length + b.length);
    expect(claimedIds.size).toBe(eventIds.length);
    for (const row of a) {
      expect(eventIds).toContain(row.id);
    }
    for (const row of b) {
      expect(eventIds).toContain(row.id);
    }

    const rows = await Promise.all(eventIds.map((id) => readOutboxEvent(fixture.pool, id)));
    const leaseIds = new Set(rows.map((row) => row?.leaseId ?? null));
    expect(leaseIds.size).toBe(eventIds.length);
  });

  it('does not claim PUBLISHED or FAILED rows', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const publishedId = randomUUID();
    const failedId = randomUUID();
    await seedOutboxEvent(pool, {
      id: publishedId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
    await seedOutboxEvent(pool, {
      id: failedId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      status: 'FAILED',
    });

    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    expect(claims.length).toBe(0);
  });

  it('rejects invalid batchSize and leaseTtlMs before any database work', async () => {
    const { pool } = await useFixture();
    let connects = 0;
    const guardedPool = new Proxy(pool, {
      get(target, property, receiver) {
        if (property === 'connect') {
          return async () => {
            connects += 1;
            return target.connect();
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    }) as typeof pool;

    await expect(
      claimOutboxBatch({ pool: guardedPool, batchSize: 0, leaseTtlMs: 30_000 }),
    ).rejects.toThrow(/batchSize/);
    await expect(
      claimOutboxBatch({ pool: guardedPool, batchSize: 10, leaseTtlMs: 5 }),
    ).rejects.toThrow(/leaseTtlMs/);
    await expect(
      claimOutboxBatch({ pool: guardedPool, batchSize: 1, leaseTtlMs: 10 * 60_000 }),
    ).rejects.toThrow(/leaseTtlMs/);
    expect(connects).toBe(0);
  });
});
