import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createDatabasePool, migrateDatabase } from '@room/database';
import type { GuardedTestDatabase } from '@room/database/testing';
import { createPreparedGuardedTestDatabase } from '@room/database/testing';
import { normalizeContact, type NormalizedContact } from '../../src/contact.js';
import type {
  BookingHoldResult,
  CreateBookingHoldInput,
} from '../../src/services/create-booking-hold.js';
import { createBookingHoldWithRetry } from '../../src/services/create-booking-hold.js';
import { seedBookingHoldFixture } from '../fixtures/booking-hold-fixtures.js';

const DIGEST_SECRET = Buffer.from('task4-test-secret-32-bytes-long');
export const HOLD_DURATION_MS = 15 * 60 * 1000;

export interface SqlBarrier {
  readonly reached: Promise<void>;
  arrive(): Promise<void>;
  release(): void;
}

export interface CallerPool {
  readonly pool: Pool;
  readonly transactionPool: Pool;
  readonly observerPool: Pool;
  close(): Promise<void>;
}

export interface ConcurrencyFixture {
  readonly database: GuardedTestDatabase;
  readonly adminPool: Pool;
  readonly callers: readonly [CallerPool, CallerPool];
  close(): Promise<void>;
}

export interface BookingState {
  readonly bookings: number;
  readonly contacts: number;
  readonly blocks: number;
  readonly audits: number;
  readonly outbox: number;
}

export interface BookingAllocation {
  readonly bookingId: string;
  readonly quoteId: string;
  readonly roomId: string;
  readonly status: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

function statementText(argument: unknown): string {
  if (typeof argument === 'string') return argument;
  if (typeof argument === 'object' && argument !== null && 'text' in argument) {
    const text = (argument as { readonly text?: unknown }).text;
    if (typeof text === 'string') return text;
  }
  return '';
}

export function createSqlBarrier(parties: number): SqlBarrier {
  let arrivals = 0;
  let resolveReached: (() => void) | undefined;
  let resolveRelease: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => {
    resolveReached = resolve;
  });
  const released = new Promise<void>((resolve) => {
    resolveRelease = resolve;
  });
  return {
    reached,
    async arrive() {
      arrivals += 1;
      if (arrivals === parties) resolveReached?.();
      await released;
    },
    release() {
      resolveRelease?.();
    },
  };
}

export function normalizedContact(label: string): NormalizedContact {
  return normalizeContact(
    {
      fullName: `Task Four ${label}`,
      email: `${label}@test.invalid`,
      phone: label.endsWith('two') ? '+84901234568' : '+84901234567',
    },
    DIGEST_SECRET,
  );
}

export function equivalentContacts(): readonly [NormalizedContact, NormalizedContact] {
  return [
    normalizeContact(
      { fullName: '  Task   Four Guest  ', email: 'Guest@TEST.invalid ', phone: '+84 90 123 4567' },
      DIGEST_SECRET,
    ),
    normalizeContact(
      { fullName: 'Task Four Guest', email: 'guest@test.invalid', phone: '+84901234567' },
      DIGEST_SECRET,
    ),
  ];
}

function createCallerPool(
  databaseUrl: string,
  applicationName: string,
  barrier?: {
    readonly matches: (statement: string) => boolean;
    readonly value: SqlBarrier;
    readonly phase?: 'before' | 'after';
  },
  statements?: string[],
): CallerPool {
  const transactionPool = createDatabasePool(databaseUrl, {
    max: 1,
    applicationName: `${applicationName}-transaction`,
  });
  const observerPool = createDatabasePool(databaseUrl, {
    max: 1,
    applicationName: `${applicationName}-observer`,
  });
  const instrumentedClients = new WeakSet<PoolClient>();
  const pool = new Proxy(transactionPool, {
    get(target, property, receiver) {
      if (property === 'query') return observerPool.query.bind(observerPool);
      if (property !== 'connect') return Reflect.get(target, property, receiver) as unknown;
      return async () => {
        const client = await target.connect();
        if (!instrumentedClients.has(client)) {
          instrumentedClients.add(client);
          const originalQuery = client.query.bind(client);
          client.query = (async (...args: Parameters<typeof originalQuery>) => {
            const statement = statementText(args[0]).trim();
            statements?.push(statement);
            const shouldWait = barrier?.matches(statement) === true;
            if (shouldWait && barrier.phase !== 'after') await barrier.value.arrive();
            const result = await originalQuery(...args);
            if (shouldWait && barrier.phase === 'after') await barrier.value.arrive();
            return result;
          }) as typeof originalQuery;
        }
        return client;
      };
    },
  }) as Pool;
  return {
    pool,
    transactionPool,
    observerPool,
    async close() {
      await Promise.all([transactionPool.end(), observerPool.end()]);
    },
  };
}

export async function createConcurrencyFixture(input?: {
  readonly barriers?: readonly [
    (
      | {
          readonly matches: (statement: string) => boolean;
          readonly value: SqlBarrier;
          readonly phase?: 'before' | 'after';
        }
      | undefined
    ),
    (
      | {
          readonly matches: (statement: string) => boolean;
          readonly value: SqlBarrier;
          readonly phase?: 'before' | 'after';
        }
      | undefined
    ),
  ];
  readonly statements?: readonly [string[] | undefined, string[] | undefined];
}): Promise<ConcurrencyFixture> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
  const database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
    await migrateDatabase(guarded.databaseUrl);
  });
  const adminPool = createDatabasePool(database.databaseUrl, {
    max: 1,
    applicationName: 'task4-concurrency-admin',
  });
  const callers = [
    createCallerPool(
      database.databaseUrl,
      'task4-caller-one',
      input?.barriers?.[0],
      input?.statements?.[0],
    ),
    createCallerPool(
      database.databaseUrl,
      'task4-caller-two',
      input?.barriers?.[1],
      input?.statements?.[1],
    ),
  ] as const;
  return {
    database,
    adminPool,
    callers,
    async close() {
      await Promise.all(callers.map((caller) => caller.close()));
      await adminPool.end();
      await database.dispose();
    },
  };
}

export async function seedScenario(input: {
  readonly pool: Pool;
  readonly roomCount: 1 | 2;
  readonly quoteCount: 1 | 2;
  readonly contact: NormalizedContact;
}): Promise<{
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomIds: readonly string[];
  readonly quoteIds: readonly string[];
}> {
  const quoteId = randomUUID();
  const secondRoomId = randomUUID();
  const fixture = await seedBookingHoldFixture(input.pool, {
    quoteId,
    contact: input.contact,
    singleAvailableRoom: input.roomCount === 1,
    secondRoomId,
  });
  const quoteIds = [quoteId];
  if (input.quoteCount === 2) {
    const secondQuoteId = randomUUID();
    await input.pool.query(
      `INSERT INTO quotes
       (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
        base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at, created_at)
       SELECT $1, property_id, room_type_id, check_in, check_out, adults, children, currency,
              base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot,
              CURRENT_TIMESTAMP + interval '15 minutes', CURRENT_TIMESTAMP
         FROM quotes WHERE id = $2`,
      [secondQuoteId, quoteId],
    );
    quoteIds.push(secondQuoteId);
  }
  return {
    propertyId: fixture.propertyId,
    roomTypeId: fixture.roomTypeId,
    roomIds: input.roomCount === 1 ? [fixture.roomId] : [fixture.roomId, secondRoomId],
    quoteIds,
  };
}

export function requiredValue<T>(values: readonly T[], index: number, label: string): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Expected ${label} at index ${index}`);
  return value;
}

export function requiredRow<T extends QueryResultRow>(result: QueryResult<T>, label: string): T {
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Expected ${label}`);
  return row;
}

export function bookingInput(quoteId: string, contact: NormalizedContact): CreateBookingHoldInput {
  return {
    quoteId,
    contact,
    holdDurationMs: HOLD_DURATION_MS,
    correlationId: randomUUID(),
  };
}

export async function runCaller(
  caller: CallerPool,
  input: CreateBookingHoldInput,
): Promise<BookingHoldResult> {
  return createBookingHoldWithRetry(caller.pool, input);
}

export async function bookingState(pool: Pool, propertyId: string): Promise<BookingState> {
  const result = await pool.query<BookingState>(
    `SELECT
       (SELECT COUNT(*)::int FROM bookings WHERE property_id = $1) AS bookings,
       (SELECT COUNT(*)::int FROM booking_contacts bc JOIN bookings b ON b.id = bc.booking_id WHERE b.property_id = $1) AS contacts,
       (SELECT COUNT(*)::int FROM room_inventory_blocks WHERE property_id = $1 AND status = 'ACTIVE') AS blocks,
       (SELECT COUNT(*)::int FROM audit_events WHERE property_id = $1 AND event_type = 'HOLD_CREATED') AS audits,
       (SELECT COUNT(*)::int FROM outbox_events WHERE property_id = $1 AND event_type = 'booking.hold.created') AS outbox`,
    [propertyId],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error('Expected booking state counts');
  return row;
}

export async function quoteBookingState(pool: Pool, quoteId: string): Promise<BookingState> {
  const result = await pool.query<BookingState>(
    `SELECT
       (SELECT COUNT(*)::int FROM bookings WHERE quote_id = $1) AS bookings,
       (SELECT COUNT(*)::int FROM booking_contacts bc JOIN bookings b ON b.id = bc.booking_id WHERE b.quote_id = $1) AS contacts,
       (SELECT COUNT(*)::int FROM room_inventory_blocks rib JOIN bookings b ON b.id = rib.booking_id WHERE b.quote_id = $1) AS blocks,
       (SELECT COUNT(*)::int FROM audit_events ae JOIN bookings b ON b.id = ae.aggregate_id WHERE b.quote_id = $1) AS audits,
       (SELECT COUNT(*)::int FROM outbox_events oe JOIN bookings b ON b.id = oe.aggregate_id WHERE b.quote_id = $1) AS outbox`,
    [quoteId],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error('Expected quote booking state counts');
  return row;
}

export async function bookingAllocations(
  pool: Pool,
  propertyId: string,
): Promise<BookingAllocation[]> {
  const result = await pool.query<BookingAllocation>(
    `SELECT b.id AS "bookingId", b.quote_id AS "quoteId", b.room_id AS "roomId", b.status,
            bc.full_name AS "fullName", bc.normalized_email AS email,
            bc.normalized_phone_e164 AS phone
       FROM bookings b
       JOIN booking_contacts bc ON bc.booking_id = b.id
      WHERE b.property_id = $1
      ORDER BY b.created_at, b.id`,
    [propertyId],
  );
  return result.rows;
}

export async function activeOverlapCount(pool: Pool, propertyId: string): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM room_inventory_blocks left_block
       JOIN room_inventory_blocks right_block
         ON left_block.id < right_block.id
        AND left_block.property_id = right_block.property_id
        AND left_block.room_id = right_block.room_id
        AND left_block.status = 'ACTIVE'
        AND right_block.status = 'ACTIVE'
        AND tstzrange(left_block.starts_at, left_block.ends_at, '[)') &&
            tstzrange(right_block.starts_at, right_block.ends_at, '[)')
      WHERE left_block.property_id = $1`,
    [propertyId],
  );
  return result.rows[0]?.count ?? 0;
}

export function postgresCause(
  error: unknown,
): { readonly code?: unknown; readonly constraint?: unknown } | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as {
    readonly code?: unknown;
    readonly constraint?: unknown;
    readonly cause?: unknown;
  };
  if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) return candidate;
  return postgresCause(candidate.cause);
}

export async function settled<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  const [result] = await Promise.allSettled([promise]);
  if (result === undefined) throw new Error('Expected settled result');
  return result;
}

export type PgQueryResult<R extends QueryResultRow = QueryResultRow> = QueryResult<R>;
