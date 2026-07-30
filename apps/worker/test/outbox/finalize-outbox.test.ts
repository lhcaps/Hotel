import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { claimOutboxBatch } from '../../src/outbox/claim-outbox-batch.js';
import {
  calculateBackoffMs,
  finalizeOutboxFailure,
  finalizeOutboxSuccess,
} from '../../src/outbox/finalize-outbox.js';
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

describe('finalizeOutboxSuccess', () => {
  it('marks the row PUBLISHED with matching lease id and clears all lease fields', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
    });
    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    const claim = claims[0];
    if (claim === undefined) {
      throw new Error('Expected claim');
    }

    const result = await finalizeOutboxSuccess({ pool, claim });
    expect(result).toEqual({ updated: true, alreadyPublished: false });
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PUBLISHED');
    expect(row?.publishedAt).toBeInstanceOf(Date);
    expect(row?.leaseId).toBeNull();
    expect(row?.claimedAt).toBeNull();
    expect(row?.leaseExpiresAt).toBeNull();
    expect(row?.lastErrorCategory).toBeNull();
  });

  it('rejects a wrong lease id', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
    });
    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    const claim = claims[0];
    if (claim === undefined) {
      throw new Error('Expected claim');
    }

    const result = await finalizeOutboxSuccess({
      pool,
      claim: { ...claim, leaseId: randomUUID() },
    });
    expect(result).toEqual({ updated: false, alreadyPublished: false });
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PENDING');
    expect(row?.leaseId).toBe(claim.leaseId);
  });

  it('returns alreadyPublished when the row is already PUBLISHED', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
    });
    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    const claim = claims[0];
    if (claim === undefined) {
      throw new Error('Expected claim');
    }
    await finalizeOutboxSuccess({ pool, claim });
    const second = await finalizeOutboxSuccess({ pool, claim });
    expect(second.alreadyPublished).toBe(true);
  });
});

describe('finalizeOutboxFailure', () => {
  it('keeps status PENDING, advances available_at, clears lease, sets safe category', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
    });
    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    const claim = claims[0];
    if (claim === undefined) {
      throw new Error('Expected claim');
    }
    const before = await readOutboxEvent(pool, eventId);
    expect(before?.attemptCount).toBe(1);

    const result = await finalizeOutboxFailure({
      pool,
      claim,
      category: 'SMTP_CONNECT',
      baseBackoffMs: 1_000,
      maxBackoffMs: 5 * 60_000,
    });
    expect(result.updated).toBe(true);

    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PENDING');
    expect(row?.leaseId).toBeNull();
    expect(row?.claimedAt).toBeNull();
    expect(row?.leaseExpiresAt).toBeNull();
    expect(row?.lastErrorCategory).toBe('SMTP_CONNECT');
    expect(row?.attemptCount).toBe(1);
    expect(row?.availableAt.getTime()).toBeGreaterThan(Date.now() - 1_000);
  });

  it('rejects the wrong lease id', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
    });
    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    const claim = claims[0];
    if (claim === undefined) {
      throw new Error('Expected claim');
    }

    const result = await finalizeOutboxFailure({
      pool,
      claim: { ...claim, leaseId: randomUUID() },
      category: 'SMTP_TIMEOUT',
      baseBackoffMs: 1_000,
      maxBackoffMs: 5 * 60_000,
    });
    expect(result.updated).toBe(false);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PENDING');
    expect(row?.leaseId).toBe(claim.leaseId);
    expect(row?.lastErrorCategory).toBeNull();
  });

  it('does not store raw exception text in last_error_category', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool);
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
    });
    const claims = await claimOutboxBatch({ pool, batchSize: 10, leaseTtlMs: 30_000 });
    const claim = claims[0];
    if (claim === undefined) {
      throw new Error('Expected claim');
    }
    await finalizeOutboxFailure({
      pool,
      claim,
      category: 'SMTP_CONNECT',
      baseBackoffMs: 1_000,
      maxBackoffMs: 5 * 60_000,
    });
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.lastErrorCategory).toBe('SMTP_CONNECT');
    expect(row?.lastErrorCategory).not.toMatch(/Error|stack|trace|at /);
  });
});

describe('calculateBackoffMs', () => {
  it('follows bounded exponential growth', () => {
    expect(calculateBackoffMs(1, 1_000, 5 * 60_000)).toBe(1_000);
    expect(calculateBackoffMs(2, 1_000, 5 * 60_000)).toBe(2_000);
    expect(calculateBackoffMs(3, 1_000, 5 * 60_000)).toBe(4_000);
    expect(calculateBackoffMs(4, 1_000, 5 * 60_000)).toBe(8_000);
  });

  it('caps at maxBackoffMs', () => {
    expect(calculateBackoffMs(20, 1_000, 5 * 60_000)).toBe(5 * 60_000);
    expect(calculateBackoffMs(100, 1_000, 5 * 60_000)).toBe(5 * 60_000);
  });

  it('rejects invalid bounds', () => {
    expect(() => calculateBackoffMs(1, 0, 5_000)).toThrow(/baseBackoffMs/);
    expect(() => calculateBackoffMs(1, 1_000, 500)).toThrow(/maxBackoffMs/);
    expect(() => calculateBackoffMs(0, 1_000, 5_000)).toThrow(/attemptCount/);
  });
});
