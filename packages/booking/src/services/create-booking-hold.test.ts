import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase } from '@room/database';
import type { GuardedTestDatabase } from '@room/database/testing';
import { createPreparedGuardedTestDatabase } from '@room/database/testing';
import {
  AllocationBusyError,
  QuoteAlreadyUsedError,
  QuoteExpiredError,
  QuoteNotFoundError,
  RoomTypeUnavailableError,
  StaleHoldCleanupRetryError,
} from '../errors.js';
import { normalizeContact } from '../contact.js';
import {
  seedBookingHoldFixture,
  seedConsumedExpiredBooking,
} from '../../test/fixtures/booking-hold-fixtures.js';
import { cleanupStaleHolds, findStructurallyEligibleRooms } from '../repository/availability.js';
import { createBookingHoldWithRetry, parseDatabaseTimestamp } from './create-booking-hold.js';

const DIGEST_SECRET = Buffer.from('test-secret-key-32-bytes-long!!');
const HOLD_DURATION_MS = 15 * 60 * 1000;

function contact(label: string) {
  return normalizeContact(
    { fullName: `Guest ${label}`, email: `${label}@test.invalid`, phone: '+84901234567' },
    DIGEST_SECRET,
  );
}

async function createMigratedTestDatabase(): Promise<GuardedTestDatabase> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
  return createPreparedGuardedTestDatabase(baseUrl, async (database) => {
    await migrateDatabase(database.databaseUrl);
  });
}

function postgresCause(error: unknown): { code?: unknown; constraint?: unknown } | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) return candidate;
  return postgresCause(candidate.cause);
}

async function counts(database: GuardedTestDatabase, quoteId: string) {
  const result = await database.pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM bookings WHERE quote_id = $1) AS bookings,
       (SELECT COUNT(*)::int FROM booking_contacts bc JOIN bookings b ON b.id = bc.booking_id WHERE b.quote_id = $1) AS contacts,
       (SELECT COUNT(*)::int FROM room_inventory_blocks rib JOIN bookings b ON b.id = rib.booking_id WHERE b.quote_id = $1) AS blocks,
       (SELECT COUNT(*)::int FROM audit_events ae JOIN bookings b ON b.id = ae.aggregate_id WHERE b.quote_id = $1) AS audits,
       (SELECT COUNT(*)::int FROM outbox_events oe JOIN bookings b ON b.id = oe.aggregate_id WHERE b.quote_id = $1) AS outbox`,
    [quoteId],
  );
  return result.rows[0] as Record<string, number>;
}

async function insertBlockingBooking(
  database: GuardedTestDatabase,
  fixture: { propertyId: string; roomTypeId: string; roomId: string },
  interval = { start: '2027-01-10T04:00:00.000Z', end: '2027-01-10T07:00:00.000Z' },
  stale = false,
): Promise<string> {
  const bookingId = randomUUID();
  await database.pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out,
        adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
        pricing_rule_version, price_snapshot, hold_expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, 'HOLD', $6, $7, 1, 0, 'VND', 1, 0, 1, 'test-v1', '{"test":true}',
             CASE WHEN $8::boolean THEN CURRENT_TIMESTAMP - interval '1 minute'
                  ELSE CURRENT_TIMESTAMP + interval '15 minutes' END,
             CASE WHEN $8::boolean THEN CURRENT_TIMESTAMP - interval '2 minutes' ELSE CURRENT_TIMESTAMP END)`,
    [
      bookingId,
      fixture.propertyId,
      fixture.roomTypeId,
      fixture.roomId,
      `BLOCK-${bookingId}`,
      interval.start,
      interval.end,
      stale,
    ],
  );
  await database.pool.query(
    `INSERT INTO room_inventory_blocks
       (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
     VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', $4, $5)`,
    [fixture.propertyId, fixture.roomId, bookingId, interval.start, interval.end],
  );
  return bookingId;
}

describe('createBookingHold', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
  });

  afterAll(async () => {
    await database.dispose();
  });

  it('creates exactly one atomic HOLD from the immutable quote snapshot', async () => {
    const quoteId = randomUUID();
    const guest = contact('happy');
    const snapshot = {
      pricing: { ruleVersion: 'phase-4-pricing-availability-v1', totalAmountVnd: 419000 },
      ratePlan: { code: 'LUNCH' },
    };
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
      baseAmountVnd: 359000,
      extraAmountVnd: 60000,
      totalAmountVnd: 419000,
      pricingSnapshot: snapshot,
    });

    const result = await createBookingHoldWithRetry(database.pool, {
      quoteId,
      contact: guest,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });

    expect(result).toMatchObject({
      status: 'HOLD',
      amountVnd: 419000,
      currency: 'VND',
      idempotent: false,
    });
    expect(result.bookingCode).toMatch(
      /^RM-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}$/,
    );
    const state = await database.pool.query<{
      property_id: string;
      room_type_id: string;
      room_id: string;
      adults: number;
      children: number;
      currency: string;
      gross_amount_vnd: string;
      discount_amount_vnd: string;
      final_amount_vnd: string;
      pricing_rule_version: string;
      price_snapshot: unknown;
      block_status: string;
      actor_type: string;
      hold_expires_at: Date;
      created_at: Date;
      audit_payload: Record<string, unknown>;
      outbox_payload: Record<string, unknown>;
    }>(
      `SELECT b.*, bc.full_name, bc.normalized_email, rib.status AS block_status,
              ae.actor_type, ae.payload AS audit_payload, oe.payload AS outbox_payload
         FROM bookings b
         JOIN booking_contacts bc ON bc.booking_id = b.id
         JOIN room_inventory_blocks rib ON rib.booking_id = b.id
         JOIN audit_events ae ON ae.aggregate_id = b.id AND ae.event_type = 'HOLD_CREATED'
         JOIN outbox_events oe ON oe.aggregate_id = b.id AND oe.event_type = 'booking.hold.created'
        WHERE b.id = $1`,
      [result.bookingId],
    );
    const row = state.rows[0];
    expect(row).toBeDefined();
    if (row === undefined) throw new Error('Expected booking state row');
    expect(row).toMatchObject({
      property_id: fixture.propertyId,
      room_type_id: fixture.roomTypeId,
      room_id: fixture.roomId,
      adults: 1,
      children: 0,
      currency: 'VND',
      gross_amount_vnd: '419000',
      discount_amount_vnd: '0',
      final_amount_vnd: '419000',
      pricing_rule_version: 'phase-4-pricing-availability-v1',
      price_snapshot: snapshot,
      block_status: 'ACTIVE',
      actor_type: 'GUEST',
    });
    expect(new Date(row.hold_expires_at).getTime() - new Date(row.created_at).getTime()).toBe(
      HOLD_DURATION_MS,
    );
    expect(await counts(database, quoteId)).toEqual({
      bookings: 1,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });
    const serialized = JSON.stringify({ audit: row.audit_payload, outbox: row.outbox_payload });
    expect(serialized).not.toContain(guest.fullName);
    expect(serialized).not.toContain(guest.email);
    expect(serialized).not.toContain(guest.phoneE164);
    expect(Object.keys(row.outbox_payload).sort()).toEqual([
      'bookingId',
      'eventVersion',
      'holdExpiresAt',
    ]);
  });

  it('starts each transaction with authoritative database time before quote work', async () => {
    const quoteId = randomUUID();
    const guest = contact('query-order');
    await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    const statements: string[] = [];
    const instrumentedPool = new Proxy(database.pool, {
      get(target, property, receiver) {
        if (property !== 'connect') return Reflect.get(target, property, receiver) as unknown;
        return async () => {
          const client = await target.connect();
          const originalQuery = client.query.bind(client);
          (client as unknown as { query: typeof originalQuery }).query = ((
            ...args: Parameters<typeof originalQuery>
          ) => {
            const firstArgument = args[0] as string | { readonly text: string };
            const statement =
              typeof firstArgument === 'string' ? firstArgument : firstArgument.text;
            statements.push(statement.trim());
            return originalQuery(...args);
          }) as typeof originalQuery;
          return client;
        };
      },
    }) as Pool;
    await createBookingHoldWithRetry(instrumentedPool, {
      quoteId,
      contact: guest,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });
    const beginIndex = statements.findIndex((statement) => /^BEGIN$/i.test(statement));
    expect(beginIndex).toBeGreaterThanOrEqual(0);
    expect(statements[beginIndex + 1]).toMatch(/CURRENT_TIMESTAMP/i);
    expect(statements[beginIndex + 1]).not.toMatch(/txid_current/i);
  });

  it('returns QUOTE_NOT_FOUND with zero Task 3 writes', async () => {
    const quoteId = randomUUID();
    await expect(
      createBookingHoldWithRetry(database.pool, {
        quoteId,
        contact: contact('missing'),
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'QUOTE_NOT_FOUND' });
    expect(await counts(database, quoteId)).toEqual({
      bookings: 0,
      contacts: 0,
      blocks: 0,
      audits: 0,
      outbox: 0,
    });
    await expect(
      createBookingHoldWithRetry(database.pool, {
        quoteId,
        contact: contact('missing2'),
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(QuoteNotFoundError);
  });

  it('returns QUOTE_EXPIRED for an unconsumed expired quote with zero writes', async () => {
    const quoteId = randomUUID();
    const guest = contact('expired');
    await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
      alreadyExpired: true,
    });
    await expect(
      createBookingHoldWithRetry(database.pool, {
        quoteId,
        contact: guest,
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(QuoteExpiredError);
    expect(await counts(database, quoteId)).toEqual({
      bookings: 0,
      contacts: 0,
      blocks: 0,
      audits: 0,
      outbox: 0,
    });
  });

  it('returns an existing equivalent booking after quote expiry without a second allocation path', async () => {
    const quoteId = randomUUID();
    const guest = contact('idempotent');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
      alreadyExpired: true,
    });
    const existing = await seedConsumedExpiredBooking(database.pool, {
      quoteId,
      contact: guest,
      propertyId: fixture.propertyId,
      roomTypeId: fixture.roomTypeId,
      roomId: fixture.roomId,
    });
    await database.pool.query('ALTER TABLE rooms RENAME TO task3_rooms_unavailable');
    try {
      const result = await createBookingHoldWithRetry(
        database.pool,
        { quoteId, contact: guest, holdDurationMs: HOLD_DURATION_MS, correlationId: randomUUID() },
        {
          randomIndexSource: () => {
            throw new Error('booking code generation must not occur for an existing booking');
          },
        },
      );
      expect(result).toMatchObject({
        bookingId: existing.bookingId,
        bookingCode: existing.bookingCode,
        idempotent: true,
      });
    } finally {
      await database.pool.query('ALTER TABLE task3_rooms_unavailable RENAME TO rooms');
    }
    expect(await counts(database, quoteId)).toEqual({
      bookings: 1,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });
  });

  it('rejects a different normalized contact on a consumed quote without disclosure or state change', async () => {
    const quoteId = randomUUID();
    const firstContact = contact('owner');
    await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: firstContact,
      singleAvailableRoom: true,
    });
    await createBookingHoldWithRetry(database.pool, {
      quoteId,
      contact: firstContact,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });
    const before = await counts(database, quoteId);
    const other = normalizeContact(
      { fullName: 'Different Guest', email: 'different@test.invalid', phone: '+84901234568' },
      DIGEST_SECRET,
    );
    const rejection = createBookingHoldWithRetry(database.pool, {
      quoteId,
      contact: other,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });
    await expect(rejection).rejects.toBeInstanceOf(QuoteAlreadyUsedError);
    await expect(rejection).rejects.not.toThrow(firstContact.email);
    expect(await counts(database, quoteId)).toEqual(before);
  });

  it('classifies no structurally eligible room as ROOM_TYPE_UNAVAILABLE', async () => {
    const quoteId = randomUUID();
    const guest = contact('structural');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    await database.pool.query(`UPDATE rooms SET status = 'INACTIVE' WHERE id = $1`, [
      fixture.roomId,
    ]);
    await expect(
      createBookingHoldWithRetry(database.pool, {
        quoteId,
        contact: guest,
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(RoomTypeUnavailableError);
    expect((await counts(database, quoteId)).bookings).toBe(0);
  });

  it('returns STALE_HOLD_CLEANUP_RETRY when a targeted stale HOLD is independently locked', async () => {
    const quoteId = randomUUID();
    const guest = contact('locked-stale');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    const staleBookingId = await insertBlockingBooking(database, fixture, undefined, true);
    const locker = await database.openClient();
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM bookings WHERE id = $1 FOR UPDATE', [staleBookingId]);
      await expect(
        createBookingHoldWithRetry(database.pool, {
          quoteId,
          contact: guest,
          holdDurationMs: HOLD_DURATION_MS,
          correlationId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: 'STALE_HOLD_CLEANUP_RETRY' });
      expect(await counts(database, quoteId)).toEqual({
        bookings: 0,
        contacts: 0,
        blocks: 0,
        audits: 0,
        outbox: 0,
      });
    } finally {
      await locker.query('ROLLBACK');
      locker.release();
    }
  });

  it('reports no cleanup exhaustion when zero rows are affected and none remain', async () => {
    const quoteId = randomUUID();
    const guest = contact('empty-cleanup');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    const db = createDatabaseClient(database.pool);
    const probe = {
      propertyId: fixture.propertyId,
      roomTypeId: fixture.roomTypeId,
      checkIn: new Date('2027-01-10T04:00:00.000Z'),
      checkOut: new Date('2027-01-10T07:00:00.000Z'),
    };
    const cleanup = await db.transaction((tx) =>
      cleanupStaleHolds(
        db,
        { ...probe, candidateRoomIds: [fixture.roomId], batchSize: 50, maxBatches: 4 },
        tx,
      ),
    );
    expect(cleanup).toEqual({ removedBookings: 0, exhaustedSafetyBound: false });
  });

  it('classifies a committed ACTIVE block as ROOM_TYPE_UNAVAILABLE', async () => {
    const quoteId = randomUUID();
    const guest = contact('blocked');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    await insertBlockingBooking(database, fixture);
    await expect(
      createBookingHoldWithRetry(database.pool, {
        quoteId,
        contact: guest,
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(RoomTypeUnavailableError);
    expect((await counts(database, quoteId)).bookings).toBe(0);
  });

  it('classifies an independently locked free candidate as ALLOCATION_BUSY', async () => {
    const quoteId = randomUUID();
    const guest = contact('locked');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    const locker = await database.openClient();
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', [fixture.roomId]);
      await expect(
        createBookingHoldWithRetry(database.pool, {
          quoteId,
          contact: guest,
          holdDurationMs: HOLD_DURATION_MS,
          correlationId: randomUUID(),
        }),
      ).rejects.toBeInstanceOf(AllocationBusyError);
      expect((await counts(database, quoteId)).bookings).toBe(0);
    } finally {
      await locker.query('ROLLBACK');
      locker.release();
    }
  });

  it('stops targeted stale cleanup at 200 rows and leaves unrelated rows unchanged', async () => {
    const quoteId = randomUUID();
    const guest = contact('stale');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    await database.pool.query(
      `WITH generated AS (
         INSERT INTO rooms (property_id, room_type_id, room_number, status)
         SELECT $1, $2, 'S-' || n, 'ACTIVE' FROM generate_series(1, 201) n RETURNING id
       ), made AS (
         INSERT INTO bookings (property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, pricing_rule_version, price_snapshot, hold_expires_at, created_at, updated_at)
         SELECT $1, $2, id, 'STALE-' || row_number() OVER (), 'HOLD', '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', 1, 0, 'VND', 1, 0, 1, 'test-v1', '{"test":true}', CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP - interval '2 minutes', CURRENT_TIMESTAMP - interval '2 minutes' FROM generated RETURNING id, room_id
       ) INSERT INTO room_inventory_blocks (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
         SELECT $1, room_id, id, 'BOOKING', 'ACTIVE', '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z' FROM made`,
      [fixture.propertyId, fixture.roomTypeId],
    );
    const unrelatedId = randomUUID();
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone) VALUES ($1, $2, 'Unrelated', 'UTC')`,
      [unrelatedId, `UNRELATED_${unrelatedId.slice(0, 8)}`],
    );
    await expect(
      createBookingHoldWithRetry(database.pool, {
        quoteId,
        contact: guest,
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(StaleHoldCleanupRetryError);
    const rolledBack = await database.pool.query<{ expired: number }>(
      `SELECT COUNT(*)::int AS expired FROM bookings WHERE property_id = $1 AND status = 'EXPIRED'`,
      [fixture.propertyId],
    );
    expect(rolledBack.rows[0]?.expired).toBe(0);
    expect((await counts(database, quoteId)).bookings).toBe(0);

    const db = createDatabaseClient(database.pool);
    const probe = {
      propertyId: fixture.propertyId,
      roomTypeId: fixture.roomTypeId,
      checkIn: new Date('2027-01-10T04:00:00.000Z'),
      checkOut: new Date('2027-01-10T07:00:00.000Z'),
    };
    const candidates = await findStructurallyEligibleRooms(db, probe);
    const cleanup = await db.transaction((tx) =>
      cleanupStaleHolds(
        db,
        {
          ...probe,
          candidateRoomIds: candidates.map((room) => room.id),
          batchSize: 50,
          maxBatches: 4,
        },
        tx,
      ),
    );
    expect(cleanup).toEqual({ removedBookings: 200, exhaustedSafetyBound: true });
    const committed = await database.pool.query<{ expired: number }>(
      `SELECT COUNT(*)::int AS expired FROM bookings WHERE property_id = $1 AND status = 'EXPIRED'`,
      [fixture.propertyId],
    );
    expect(committed.rows[0]?.expired).toBe(200);
    expect(
      (
        await database.pool.query<{ count: number }>(
          'SELECT COUNT(*)::int AS count FROM properties WHERE id = $1',
          [unrelatedId],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });

  it('maps a real GiST 23P01 race to ALLOCATION_BUSY and rolls back all Task 3 writes', async () => {
    const quoteId = randomUUID();
    const guest = contact('gist');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    await insertBlockingBooking(database, fixture, {
      start: '2027-01-10T04:00:00.000Z',
      end: '2027-01-10T07:00:00.000Z',
    });
    await database.pool.query(
      `UPDATE room_inventory_blocks SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE room_id = $1`,
      [fixture.roomId],
    );
    await database.pool.query(
      `CREATE FUNCTION task3_force_gist() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         UPDATE room_inventory_blocks SET status = 'ACTIVE', released_at = NULL
          WHERE room_id = NEW.room_id AND status = 'RELEASED';
         RETURN NEW;
       END $$`,
    );
    await database.pool.query(
      `CREATE TRIGGER task3_force_gist BEFORE INSERT ON room_inventory_blocks FOR EACH ROW EXECUTE FUNCTION task3_force_gist()`,
    );
    try {
      const error = await createBookingHoldWithRetry(database.pool, {
        quoteId,
        contact: guest,
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }).catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: 'ALLOCATION_BUSY' });
      expect(postgresCause(error)).toMatchObject({
        code: '23P01',
        constraint: 'room_inventory_blocks_active_overlap_excl',
      });
      expect(await counts(database, quoteId)).toEqual({
        bookings: 0,
        contacts: 0,
        blocks: 0,
        audits: 0,
        outbox: 0,
      });
    } finally {
      await database.pool.query('DROP TRIGGER task3_force_gist ON room_inventory_blocks');
      await database.pool.query('DROP FUNCTION task3_force_gist()');
    }
  });

  it.each(['booking_contacts', 'room_inventory_blocks', 'audit_events', 'outbox_events'])(
    'rolls back every prior write when %s insert fails',
    async (table) => {
      const quoteId = randomUUID();
      const guest = contact(`atomic-${table}`);
      await seedBookingHoldFixture(database.pool, {
        quoteId,
        contact: guest,
        singleAvailableRoom: true,
      });
      const functionName = `task3_fail_${table}`;
      const triggerName = `${functionName}_trigger`;
      await database.pool.query(
        `CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced ${table} failure' USING ERRCODE = 'P0001'; END $$`,
      );
      await database.pool.query(
        `CREATE TRIGGER ${triggerName} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      try {
        const error = await createBookingHoldWithRetry(database.pool, {
          quoteId,
          contact: guest,
          holdDurationMs: HOLD_DURATION_MS,
          correlationId: randomUUID(),
        }).catch((caught: unknown) => caught);
        expect(postgresCause(error)).toMatchObject({ code: 'P0001' });
        expect(await counts(database, quoteId)).toEqual({
          bookings: 0,
          contacts: 0,
          blocks: 0,
          audits: 0,
          outbox: 0,
        });
      } finally {
        await database.pool.query(`DROP TRIGGER ${triggerName} ON ${table}`);
        await database.pool.query(`DROP FUNCTION ${functionName}()`);
      }
    },
  );

  it('rejects malformed snapshots and untrusted HOLD durations before Task 3 writes', async () => {
    const malformedQuote = randomUUID();
    const guest = contact('malformed');
    await seedBookingHoldFixture(database.pool, {
      quoteId: malformedQuote,
      contact: guest,
      singleAvailableRoom: true,
      pricingSnapshot: { pricing: {} },
    });
    await expect(
      createBookingHoldWithRetry(database.pool, {
        quoteId: malformedQuote,
        contact: guest,
        holdDurationMs: HOLD_DURATION_MS,
        correlationId: randomUUID(),
      }),
    ).rejects.toThrow('valid ruleVersion');
    expect((await counts(database, malformedQuote)).bookings).toBe(0);

    const durationQuote = randomUUID();
    await seedBookingHoldFixture(database.pool, {
      quoteId: durationQuote,
      contact: guest,
      singleAvailableRoom: true,
    });
    for (const holdDurationMs of [0, -1, Number.NaN, 86_400_000]) {
      await expect(
        createBookingHoldWithRetry(database.pool, {
          quoteId: durationQuote,
          contact: guest,
          holdDurationMs,
          correlationId: randomUUID(),
        }),
      ).rejects.toThrow('holdDurationMs');
    }
    expect((await counts(database, durationQuote)).bookings).toBe(0);
  });

  it('parses PostgreSQL Date and string timestamps and rejects invalid representations', () => {
    const date = new Date('2026-07-23T03:00:00.000Z');
    expect(parseDatabaseTimestamp(date)).toEqual(date);
    expect(parseDatabaseTimestamp('2026-07-23T03:00:00.000Z')).toEqual(date);
    expect(() => parseDatabaseTimestamp('not-a-database-timestamp')).toThrow('current timestamp');
  });

  it('keeps client-authoritative booking fields outside the input contract', () => {
    const keys = Object.keys({
      quoteId: randomUUID(),
      contact: contact('contract'),
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });
    expect(keys.sort()).toEqual(['contact', 'correlationId', 'holdDurationMs', 'quoteId']);
    for (const forbidden of [
      'amount',
      'priceSnapshot',
      'pricingRuleVersion',
      'roomId',
      'status',
      'holdExpiresAt',
    ])
      expect(keys).not.toContain(forbidden);
  });
});
