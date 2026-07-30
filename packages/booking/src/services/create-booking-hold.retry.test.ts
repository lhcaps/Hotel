import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateDatabase } from '@room/database';
import type { GuardedTestDatabase } from '@room/database/testing';
import { createPreparedGuardedTestDatabase } from '@room/database/testing';
import type { RandomIndexSource } from '../booking-code.js';
import { normalizeContact } from '../contact.js';
import { QuoteAlreadyUsedError } from '../errors.js';
import { seedBookingHoldFixture } from '../../test/fixtures/booking-hold-fixtures.js';
import { createBookingHoldWithRetry } from './create-booking-hold.js';

const DIGEST_SECRET = Buffer.from('test-secret-key-32-bytes-long!!');
const HOLD_DURATION_MS = 15 * 60 * 1000;
const ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ';

function contact(label: string) {
  return normalizeContact(
    { fullName: `Retry ${label}`, email: `${label}@test.invalid`, phone: '+84901234567' },
    DIGEST_SECRET,
  );
}

function scriptedCodes(codes: readonly string[]): RandomIndexSource {
  const indexes = codes.flatMap((code) =>
    code
      .replaceAll('RM-', '')
      .replaceAll('-', '')
      .split('')
      .map((char) => ALPHABET.indexOf(char)),
  );
  let cursor = 0;
  return (upperExclusive) => {
    const index = indexes[cursor++];
    if (index === undefined || index >= upperExclusive)
      throw new Error('scripted booking code source exhausted');
    return index;
  };
}

async function createMigratedTestDatabase(): Promise<GuardedTestDatabase> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
  return createPreparedGuardedTestDatabase(baseUrl, async (database) =>
    migrateDatabase(database.databaseUrl),
  );
}

async function seedCollision(
  database: GuardedTestDatabase,
  propertyId: string,
  roomTypeId: string,
  code: string,
  roomNumber: string,
) {
  const roomId = randomUUID();
  const bookingId = randomUUID();
  await database.pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [roomId, propertyId, roomTypeId, roomNumber],
  );
  await database.pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children,
        currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, pricing_rule_version, price_snapshot, hold_expires_at)
     VALUES ($1, $2, $3, $4, $5, 'HOLD', '2027-02-10T04:00:00Z', '2027-02-10T07:00:00Z', 1, 0,
             'VND', 1, 0, 1, 'test-v1', '{"test":true}', CURRENT_TIMESTAMP + interval '15 minutes')`,
    [bookingId, propertyId, roomTypeId, roomId, code],
  );
}

function postgresCause(error: unknown): { code?: unknown; constraint?: unknown } | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code !== undefined) return candidate;
  return postgresCause(candidate.cause);
}

async function task3Count(database: GuardedTestDatabase, quoteId: string) {
  const result = await database.pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE quote_id = $1`,
    [quoteId],
  );
  return result.rows[0]?.count ?? 0;
}

describe('createBookingHoldWithRetry', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
  });

  afterAll(async () => {
    await database.dispose();
  });

  it('retries the exact booking-code constraint twice and succeeds in a third fresh transaction', async () => {
    const quoteId = randomUUID();
    const guest = contact('collision');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    const codes = ['RM-1111-1111-1111', 'RM-2222-2222-2222', 'RM-3333-3333-3333'] as const;
    await seedCollision(database, fixture.propertyId, fixture.roomTypeId, codes[0], 'C-101');
    await seedCollision(database, fixture.propertyId, fixture.roomTypeId, codes[1], 'C-102');
    const transactionIds: string[] = [];
    const instrumentedClients = new WeakSet<object>();
    const instrumentedPool = new Proxy(database.pool, {
      get(target, property, receiver) {
        if (property !== 'connect') return Reflect.get(target, property, receiver) as unknown;
        return async () => {
          const client = await target.connect();
          if (!instrumentedClients.has(client)) {
            instrumentedClients.add(client);
            (
              client as unknown as {
                on(event: string, listener: (notice: { readonly message: string }) => void): void;
              }
            ).on('notice', (notice: { readonly message: string }) => {
              const match = /^task3_txid:(\d+)$/.exec(notice.message);
              if (match?.[1] !== undefined) transactionIds.push(match[1]);
            });
          }
          return client;
        };
      },
    }) as Pool;
    await database.pool.query(
      `CREATE FUNCTION task3_notice_txid() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE NOTICE 'task3_txid:%', txid_current(); RETURN NEW; END $$`,
    );
    await database.pool.query(
      `CREATE TRIGGER task3_notice_txid_trigger BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION task3_notice_txid()`,
    );

    const result = await createBookingHoldWithRetry(
      instrumentedPool,
      { quoteId, contact: guest, holdDurationMs: HOLD_DURATION_MS, correlationId: randomUUID() },
      {
        maxAttempts: 3,
        randomIndexSource: scriptedCodes(codes),
      },
    );

    expect(result.bookingCode).toBe(codes[2]);
    expect(transactionIds).toHaveLength(3);
    expect(new Set(transactionIds).size).toBe(3);
    expect(await task3Count(database, quoteId)).toBe(1);
    await database.pool.query('DROP TRIGGER task3_notice_txid_trigger ON bookings');
    await database.pool.query('DROP FUNCTION task3_notice_txid()');
  });

  it('exhausts bounded retries deterministically with no partial quote-bound row', async () => {
    const quoteId = randomUUID();
    const guest = contact('exhaustion');
    const fixture = await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    const code = 'RM-4444-4444-4444';
    await seedCollision(database, fixture.propertyId, fixture.roomTypeId, code, 'E-101');
    await expect(
      createBookingHoldWithRetry(
        database.pool,
        { quoteId, contact: guest, holdDurationMs: HOLD_DURATION_MS, correlationId: randomUUID() },
        {
          maxAttempts: 2,
          randomIndexSource: scriptedCodes([code, code]),
        },
      ),
    ).rejects.toThrow('Booking code collision persisted after 2 attempts');
    expect(await task3Count(database, quoteId)).toBe(0);
  });

  it('does not retry a 23505 from the quote uniqueness constraint', async () => {
    const quoteId = randomUUID();
    const guest = contact('wrong-unique');
    await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    await database.pool.query(
      `CREATE FUNCTION task3_wrong_unique() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE unique_violation USING CONSTRAINT = 'bookings_quote_id_uq'; END $$`,
    );
    await database.pool.query(
      `CREATE TRIGGER task3_wrong_unique_trigger BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION task3_wrong_unique()`,
    );
    try {
      const rejection = createBookingHoldWithRetry(
        database.pool,
        { quoteId, contact: guest, holdDurationMs: HOLD_DURATION_MS, correlationId: randomUUID() },
        { maxAttempts: 3 },
      );
      const error = await rejection.catch((caught: unknown) => caught);
      expect(postgresCause(error)).toMatchObject({
        code: '23505',
        constraint: 'bookings_quote_id_uq',
      });
      expect(await task3Count(database, quoteId)).toBe(0);
    } finally {
      await database.pool.query('DROP TRIGGER task3_wrong_unique_trigger ON bookings');
      await database.pool.query('DROP FUNCTION task3_wrong_unique()');
    }
  });

  it('does not retry contact mismatch or validation failures', async () => {
    const quoteId = randomUUID();
    const owner = contact('owner');
    await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: owner,
      singleAvailableRoom: true,
    });
    await createBookingHoldWithRetry(database.pool, {
      quoteId,
      contact: owner,
      holdDurationMs: HOLD_DURATION_MS,
      correlationId: randomUUID(),
    });
    await expect(
      createBookingHoldWithRetry(
        database.pool,
        {
          quoteId,
          contact: contact('intruder'),
          holdDurationMs: HOLD_DURATION_MS,
          correlationId: randomUUID(),
        },
        { maxAttempts: 3 },
      ),
    ).rejects.toBeInstanceOf(QuoteAlreadyUsedError);

    await expect(
      createBookingHoldWithRetry(
        database.pool,
        {
          quoteId: randomUUID(),
          contact: owner,
          holdDurationMs: Number.NaN,
          correlationId: randomUUID(),
        },
        { maxAttempts: 3 },
      ),
    ).rejects.toThrow('holdDurationMs');
  });

  it('does not retry a 23P01 and leaves no quote-bound row', async () => {
    const quoteId = randomUUID();
    const guest = contact('exclusion');
    await seedBookingHoldFixture(database.pool, {
      quoteId,
      contact: guest,
      singleAvailableRoom: true,
    });
    await database.pool.query(
      `CREATE FUNCTION task3_force_exclusion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE exclusion_violation USING CONSTRAINT = 'room_inventory_blocks_active_overlap_excl'; END $$`,
    );
    await database.pool.query(
      `CREATE TRIGGER task3_force_exclusion_trigger BEFORE INSERT ON room_inventory_blocks FOR EACH ROW EXECUTE FUNCTION task3_force_exclusion()`,
    );
    try {
      await expect(
        createBookingHoldWithRetry(
          database.pool,
          {
            quoteId,
            contact: guest,
            holdDurationMs: HOLD_DURATION_MS,
            correlationId: randomUUID(),
          },
          { maxAttempts: 3 },
        ),
      ).rejects.toMatchObject({ code: 'ALLOCATION_BUSY' });
      expect(await task3Count(database, quoteId)).toBe(0);
    } finally {
      await database.pool.query(
        'DROP TRIGGER task3_force_exclusion_trigger ON room_inventory_blocks',
      );
      await database.pool.query('DROP FUNCTION task3_force_exclusion()');
    }
  });
});
