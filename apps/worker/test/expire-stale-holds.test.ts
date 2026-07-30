import { afterEach, describe, expect, it } from 'vitest';

import { expireStaleHolds } from '../src/jobs/expire-stale-holds.js';
import { WorkerLifecycle } from '../src/lifecycle.js';
import {
  createExpirationFixture,
  postgresErrorCode,
  readHoldState,
  seedHold,
  seedMaintenanceBlock,
  synchronizeFirstConnections,
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

describe('expireStaleHolds', () => {
  it('expires one stale HOLD atomically and preserves hold_expires_at', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool);
    const originalDeadline = (await readHoldState(pool, bookingId)).booking.holdExpiresAt;

    const result = await expireStaleHolds({ pool, batchSize: 10, maxBatches: 2 });
    const state = await readHoldState(pool, bookingId);

    expect(result).toEqual({ processed: 1, batches: 1, exhaustedSafetyBound: false });
    expect(state.booking.status).toBe('EXPIRED');
    expect(state.booking.expiredAt).toBeInstanceOf(Date);
    expect(state.booking.holdExpiresAt.getTime()).toBe(originalDeadline.getTime());
    expect(state.block.status).toBe('RELEASED');
    expect(state.block.releasedAt).toBeInstanceOf(Date);
    expect(state.audits).toBe(1);
    expect(state.outbox).toBe(1);
  });

  it('leaves a future HOLD unchanged', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool, { stale: false });

    expect(await expireStaleHolds({ pool, batchSize: 10, maxBatches: 2 })).toEqual({
      processed: 0,
      batches: 1,
      exhaustedSafetyBound: false,
    });
    expect(await readHoldState(pool, bookingId)).toMatchObject({
      booking: { status: 'HOLD', expiredAt: null },
      block: { status: 'ACTIVE', releasedAt: null },
      audits: 0,
      outbox: 0,
    });
  });

  it('processes only stale HOLD rows in a mixed set', async () => {
    const { pool } = await useFixture();
    const stale = await seedHold(pool);
    const future = await seedHold(pool, { stale: false });
    const expired = await seedHold(pool, { status: 'EXPIRED' });
    const confirmed = await seedHold(pool, { status: 'CONFIRMED' });

    expect((await expireStaleHolds({ pool, batchSize: 10, maxBatches: 2 })).processed).toBe(1);
    expect((await readHoldState(pool, stale)).booking.status).toBe('EXPIRED');
    expect((await readHoldState(pool, future)).booking.status).toBe('HOLD');
    expect((await readHoldState(pool, expired)).booking.status).toBe('EXPIRED');
    expect((await readHoldState(pool, confirmed)).booking.status).toBe('CONFIRMED');
  });

  it('is idempotent on a second run', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool);

    expect((await expireStaleHolds({ pool, batchSize: 10, maxBatches: 2 })).processed).toBe(1);
    expect((await expireStaleHolds({ pool, batchSize: 10, maxBatches: 2 })).processed).toBe(0);
    expect(await readHoldState(pool, bookingId)).toMatchObject({
      booking: { status: 'EXPIRED' },
      block: { status: 'RELEASED' },
      audits: 1,
      outbox: 1,
    });
  });

  it.each([
    ['inventory release', 'room_inventory_blocks', 'UPDATE'],
    ['audit insertion', 'audit_events', 'INSERT'],
    ['outbox insertion', 'outbox_events', 'INSERT'],
  ] as const)('rolls back the whole batch when %s fails', async (_label, table, operation) => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool);
    const functionName = `task5_fail_${table}`;
    await pool.query(
      `CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'task5 forced failure' USING ERRCODE = 'P0001'; END; $$`,
    );
    await pool.query(
      `CREATE TRIGGER ${functionName} BEFORE ${operation} ON ${table}
       FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
    );

    let failure: unknown;
    try {
      await expireStaleHolds({ pool, batchSize: 10, maxBatches: 1 });
    } catch (error) {
      failure = error;
    }

    expect(postgresErrorCode(failure)).toBe('P0001');
    expect(await readHoldState(pool, bookingId)).toMatchObject({
      booking: { status: 'HOLD', expiredAt: null },
      block: { status: 'ACTIVE', releasedAt: null },
      audits: 0,
      outbox: 0,
    });
  });

  it('allows two workers to process every eligible row exactly once', async () => {
    const current = await useFixture();
    const bookingIds = await Promise.all(Array.from({ length: 12 }, () => seedHold(current.pool)));
    const workerOne = current.createPool('task5-worker-one');
    const workerTwo = current.createPool('task5-worker-two');
    const [synchronizedOne, synchronizedTwo] = synchronizeFirstConnections(workerOne, workerTwo);

    const [first, second] = await Promise.all([
      expireStaleHolds({ pool: synchronizedOne, batchSize: 2, maxBatches: 6 }),
      expireStaleHolds({ pool: synchronizedTwo, batchSize: 2, maxBatches: 6 }),
    ]);

    expect(first.processed + second.processed).toBe(bookingIds.length);
    for (const bookingId of bookingIds) {
      expect(await readHoldState(current.pool, bookingId)).toMatchObject({
        booking: { status: 'EXPIRED' },
        block: { status: 'RELEASED' },
        audits: 1,
        outbox: 1,
      });
    }
  });

  it('skips a locked stale row and processes it on a later run', async () => {
    const { pool } = await useFixture();
    const lockedBooking = await seedHold(pool);
    const unlockedBooking = await seedHold(pool);
    const lockClient = await pool.connect();
    try {
      await lockClient.query('BEGIN');
      await lockClient.query('SELECT id FROM bookings WHERE id = $1 FOR UPDATE', [lockedBooking]);

      const first = await expireStaleHolds({ pool, batchSize: 10, maxBatches: 1 });
      expect(first.processed).toBe(1);
      expect((await readHoldState(pool, lockedBooking)).booking.status).toBe('HOLD');
      expect((await readHoldState(pool, unlockedBooking)).booking.status).toBe('EXPIRED');
      await lockClient.query('COMMIT');
    } finally {
      lockClient.release();
    }

    expect((await expireStaleHolds({ pool, batchSize: 10, maxBatches: 1 })).processed).toBe(1);
    expect(await readHoldState(pool, lockedBooking)).toMatchObject({ audits: 1, outbox: 1 });
  });

  it('stops at the configured batch bound and reports remaining work', async () => {
    const { pool } = await useFixture();
    await Promise.all(Array.from({ length: 5 }, () => seedHold(pool)));

    expect(await expireStaleHolds({ pool, batchSize: 2, maxBatches: 2 })).toEqual({
      processed: 4,
      batches: 2,
      exhaustedSafetyBound: true,
    });
    expect(await expireStaleHolds({ pool, batchSize: 2, maxBatches: 2 })).toEqual({
      processed: 1,
      batches: 1,
      exhaustedSafetyBound: false,
    });
  });

  it('does not report exhaustion after an exactly full bounded sweep', async () => {
    const { pool } = await useFixture();
    await Promise.all(Array.from({ length: 4 }, () => seedHold(pool)));

    expect(await expireStaleHolds({ pool, batchSize: 2, maxBatches: 2 })).toEqual({
      processed: 4,
      batches: 2,
      exhaustedSafetyBound: false,
    });
  });

  it('never releases a maintenance inventory block', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool);
    const maintenanceId = await seedMaintenanceBlock(pool);

    await expireStaleHolds({ pool, batchSize: 10, maxBatches: 1 });

    expect((await readHoldState(pool, bookingId)).block.status).toBe('RELEASED');
    const maintenance = await pool.query<{ status: string }>(
      'SELECT status FROM room_inventory_blocks WHERE maintenance_block_id = $1',
      [maintenanceId],
    );
    expect(maintenance.rows).toEqual([{ status: 'ACTIVE' }]);
  });

  it('uses the SYSTEM actor and emits minimal non-PII payloads', async () => {
    const { pool } = await useFixture();
    const bookingId = await seedHold(pool);
    await expireStaleHolds({ pool, batchSize: 10, maxBatches: 1 });

    const audit = await pool.query<{ actor_type: string; payload: Record<string, unknown> }>(
      `SELECT actor_type, payload FROM audit_events
       WHERE aggregate_id = $1 AND event_type = 'HOLD_EXPIRED'`,
      [bookingId],
    );
    const outbox = await pool.query<{ event_type: string; payload: Record<string, unknown> }>(
      `SELECT event_type, payload FROM outbox_events
       WHERE aggregate_id = $1 AND event_type = 'booking.hold.expired'`,
      [bookingId],
    );

    expect(audit.rows[0]).toMatchObject({
      actor_type: 'SYSTEM',
      payload: { bookingId, fromStatus: 'HOLD', toStatus: 'EXPIRED' },
    });
    expect(outbox.rows[0]).toMatchObject({
      event_type: 'booking.hold.expired',
      payload: { eventVersion: 1, bookingId },
    });
    expect(JSON.stringify([audit.rows[0], outbox.rows[0]])).not.toMatch(
      /email|phone|contact|token|secret|otp|stack|exception/i,
    );
  });

  it.each([
    { batchSize: 0, maxBatches: 1 },
    { batchSize: -1, maxBatches: 1 },
    { batchSize: 1.5, maxBatches: 1 },
    { batchSize: 101, maxBatches: 1 },
    { batchSize: 1, maxBatches: 0 },
    { batchSize: 1, maxBatches: -1 },
    { batchSize: 1, maxBatches: 1.5 },
    { batchSize: 1, maxBatches: 101 },
    { batchSize: 100, maxBatches: 11 },
  ])(
    'rejects invalid configuration before connecting: $batchSize x $maxBatches',
    async (options) => {
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

      await expect(expireStaleHolds({ pool: guardedPool, ...options })).rejects.toThrow(
        /batchSize|maxBatches/,
      );
      expect(connects).toBe(0);
    },
  );
});

describe('WorkerLifecycle', () => {
  it('drains an active iteration, closes once, and prevents a new iteration', async () => {
    let releaseIteration: (() => void) | undefined;
    const active = new Promise<void>((resolve) => {
      releaseIteration = resolve;
    });
    let closes = 0;
    const lifecycle = new WorkerLifecycle({
      close: async () => {
        closes += 1;
      },
    });

    const iteration = lifecycle.runIteration(async () => active);
    const shutdown = lifecycle.shutdown('SIGTERM');
    await expect(lifecycle.runIteration(async () => undefined)).rejects.toThrow('shutting down');
    expect(closes).toBe(0);
    releaseIteration?.();
    await iteration;
    await shutdown;
    await lifecycle.shutdown('SIGINT');
    expect(closes).toBe(1);
  });
});
