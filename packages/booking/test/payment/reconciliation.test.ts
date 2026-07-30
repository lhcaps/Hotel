import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { migrateDatabase } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import {
  claimReconciliationAttempts,
  DEFAULT_RECONCILIATION_POLICY,
  recoverExpiredReconciliationLeases,
  reconcilePaymentAttempt,
  validateReconciliationPolicy,
} from '../../src/payment/reconciliation.js';
import type {
  ReconciliationQueryError,
  ReconciliationQueryResult,
  ReconciliationStatusQueryPort,
} from '../../src/payment/reconciliation.js';
import { createPaymentAttempt } from '../../src/payment/payment-service.js';
import { normalizeContact } from '../../src/contact.js';
import {
  seedBookingHoldFixture,
  seedConsumedExpiredBooking,
} from '../fixtures/booking-hold-fixtures.js';

interface ProviderQueryFixture {
  readonly query: ReconciliationStatusQueryPort['query'];
  readonly calls: ReadonlyArray<{ readonly providerOrderId: string }>;
  enqueue(result: ReconciliationQueryResult | ReconciliationQueryError): void;
  enqueueError(category: ReconciliationQueryError['category'], code: string): void;
}

function createQueryFixture(): ProviderQueryFixture {
  const queue: Array<ReconciliationQueryResult | ReconciliationQueryError> = [];
  const calls: Array<{ readonly providerOrderId: string }> = [];
  const port: ReconciliationStatusQueryPort = {
    query: async (input) => {
      calls.push({ providerOrderId: input.providerOrderId });
      const next = queue.shift();
      if (next === undefined) {
        return {
          category: 'transient',
          code: 'NO_FAKE_RESPONSE',
        };
      }
      return next;
    },
  };
  const fixture: ProviderQueryFixture = {
    calls,
    query: port.query,
    enqueue(result) {
      queue.push(result);
    },
    enqueueError(category, code) {
      queue.push({ category, code });
    },
  };
  return fixture;
}

function asPort(query: ReconciliationStatusQueryPort['query']): ReconciliationStatusQueryPort {
  return { query };
}

function makeSuccessResult(
  amountVnd: bigint,
  occurredAt: Date,
  providerTransactionId = 'momo-reconciliation-tx',
): ReconciliationQueryResult {
  return {
    outcome: 'SUCCEEDED',
    providerTransactionId,
    amountVnd,
    occurredAt,
    rawBodyDigest: null,
  };
}

async function setProviderSettings(
  pool: GuardedTestDatabase['pool'],
  propertyId: string,
  provider: 'MOMO' | 'VNPAY',
  checkoutExpiryMinutes: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO payment_provider_settings
       (property_id, provider, enabled, display_name, display_order, checkout_expiry_minutes)
     VALUES ($1, $2, true, 'Test', 1, $3)
     ON CONFLICT (property_id, provider)
       DO UPDATE SET checkout_expiry_minutes = EXCLUDED.checkout_expiry_minutes`,
    [propertyId, provider, checkoutExpiryMinutes],
  );
}

async function setAttemptReadyForReconciliation(
  pool: GuardedTestDatabase['pool'],
  attemptId: string,
  options: { nextReconciliationAt?: Date | null; expiresAt?: Date | null } = {},
): Promise<void> {
  const next =
    options.nextReconciliationAt === undefined
      ? new Date(Date.now() - 60_000)
      : options.nextReconciliationAt;
  const expires =
    options.expiresAt === undefined ? new Date(Date.now() + 60 * 60_000) : options.expiresAt;
  await pool.query(
    `UPDATE payment_attempts
        SET next_reconciliation_at = $2,
            expires_at = $3,
            lease_owner = NULL,
            lease_expires_at = NULL,
            reconciliation_attempt_count = 0
      WHERE id = $1`,
    [attemptId, next, expires],
  );
}

describe('Gate B canonical reconciliation service', () => {
  let database: GuardedTestDatabase | undefined;

  afterEach(async () => {
    await database?.dispose();
    database = undefined;
  });

  it('stores the minimum authority (hold vs provider vs adapter) on payment_attempts.expires_at', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Reconcile Fixture', email: 'reconcile@example.test', phone: '+84901000001' },
      Buffer.alloc(32, 30),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    await setProviderSettings(database.pool, seeded.propertyId, 'MOMO', 60);
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const adapterExpiry = new Date(Date.now() + 5 * 60_000);
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-expiry-001',
      providerKnownExpiryAt: adapterExpiry,
    });
    const stored = await database.pool.query<{ expires_at: Date }>(
      `SELECT expires_at FROM payment_attempts WHERE id = $1`,
      [attempt.id],
    );
    expect(stored.rows[0]?.expires_at).toBeDefined();
    const storedExpiresAt = stored.rows[0]!.expires_at as unknown as Date;
    expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(adapterExpiry.getTime());
    expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(
      new Date(Date.now() + 60 * 60_000).getTime() + 5_000,
    );
  });

  it('claims due attempts, dispatches to applyVerifiedPaymentEvent on success, and clears the lease', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      {
        fullName: 'Reconcile Success',
        email: 'reconcile-success@example.test',
        phone: '+84901000002',
      },
      Buffer.alloc(32, 31),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-success-001',
      now: new Date(),
    });
    await setAttemptReadyForReconciliation(database.pool, attempt.id);

    const fake = createQueryFixture();
    fake.enqueue(makeSuccessResult(359000n, new Date()));
    const claimed = await claimReconciliationAttempts({
      pool: database.pool,
      batchSize: 5,
      leaseTtlMs: 30_000,
      leaseOwner: 'reconciler-test-1',
    });
    expect(claimed).toHaveLength(1);
    const leased = claimed[0]!;
    expect(leased.id).toBe(attempt.id);
    expect(leased.leaseExpiresAt.getTime()).toBeGreaterThan(Date.now());

    const result = await reconcilePaymentAttempt({
      pool: database.pool,
      attemptId: leased.id,
      leaseId: leased.leaseId,
      leaseOwner: 'reconciler-test-1',
      queryProvider: asPort(fake.query),
      queryTimeoutMs: 5_000,
    });

    expect(result.outcome).toBe('PROCESSED');
    expect(result.errorCode).toBeNull();

    const bookings = await database.pool.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [held.bookingId],
    );
    expect(bookings.rows[0]?.status).toBe('CONFIRMED');

    const attempts = await database.pool.query<{
      status: string;
      lease_owner: string | null;
      lease_expires_at: Date | null;
      last_error_code: string | null;
      last_reconciled_at: Date | null;
    }>(
      `SELECT status, lease_owner, lease_expires_at, last_error_code, last_reconciled_at
         FROM payment_attempts WHERE id = $1`,
      [attempt.id],
    );
    const updated = attempts.rows[0]!;
    expect(updated.status).toBe('SUCCEEDED');
    expect(updated.lease_owner).toBeNull();
    expect(updated.lease_expires_at).toBeNull();
    expect(updated.last_error_code).toBeNull();
    expect(updated.last_reconciled_at).not.toBeNull();
  });

  it('schedules a transient retry with the first ladder delay and bumps the attempt count', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Reconcile Retry', email: 'reconcile-retry@example.test', phone: '+84901000003' },
      Buffer.alloc(32, 32),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-retry-001',
      now: new Date(),
    });
    await setAttemptReadyForReconciliation(database.pool, attempt.id);

    const fake = createQueryFixture();
    fake.enqueueError('transient', 'TIMEOUT');
    const claimed = await claimReconciliationAttempts({
      pool: database.pool,
      batchSize: 5,
      leaseTtlMs: 30_000,
      leaseOwner: 'reconciler-test-2',
    });
    const leased = claimed[0]!;
    const result = await reconcilePaymentAttempt({
      pool: database.pool,
      attemptId: leased.id,
      leaseId: leased.leaseId,
      leaseOwner: 'reconciler-test-2',
      queryProvider: asPort(fake.query),
      queryTimeoutMs: 5_000,
    });

    expect(result.outcome).toBe('TRANSIENT_RETRY_SCHEDULED');
    expect(result.errorCode).toBe('TIMEOUT');
    expect(result.nextReconciliationAt).not.toBeNull();
    const ladderDelay = DEFAULT_RECONCILIATION_POLICY.delayMinutes[0]! * 60_000;
    expect(result.nextReconciliationAt!.getTime() - Date.now()).toBeGreaterThanOrEqual(
      ladderDelay - 5_000,
    );

    const attempts = await database.pool.query<{
      status: string;
      next_reconciliation_at: Date | null;
      reconciliation_attempt_count: number;
      last_error_code: string | null;
      lease_owner: string | null;
    }>(
      `SELECT status, next_reconciliation_at, reconciliation_attempt_count,
              last_error_code, lease_owner
         FROM payment_attempts WHERE id = $1`,
      [attempt.id],
    );
    const updated = attempts.rows[0]!;
    expect(updated.status).toBe('PENDING');
    expect(updated.lease_owner).toBeNull();
    expect(updated.last_error_code).toBe('TIMEOUT');
    expect(updated.reconciliation_attempt_count).toBe(1);
  });

  it('terminates a "not_found" query as EXPIRED without invoking the canonical event path', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      {
        fullName: 'Reconcile NotFound',
        email: 'reconcile-notfound@example.test',
        phone: '+84901000004',
      },
      Buffer.alloc(32, 33),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-notfound-001',
      now: new Date(),
    });
    await setAttemptReadyForReconciliation(database.pool, attempt.id);

    const fake = createQueryFixture();
    fake.enqueueError('not_found', 'NO_SUCH_TRANSACTION');
    const claimed = await claimReconciliationAttempts({
      pool: database.pool,
      batchSize: 5,
      leaseTtlMs: 30_000,
      leaseOwner: 'reconciler-test-3',
    });
    const leased = claimed[0]!;
    const result = await reconcilePaymentAttempt({
      pool: database.pool,
      attemptId: leased.id,
      leaseId: leased.leaseId,
      leaseOwner: 'reconciler-test-3',
      queryProvider: asPort(fake.query),
      queryTimeoutMs: 5_000,
    });

    expect(result.outcome).toBe('TERMINAL_NOT_FOUND');
    expect(result.errorCode).toBe('NO_SUCH_TRANSACTION');

    const attempts = await database.pool.query<{
      status: string;
      last_error_code: string | null;
    }>(`SELECT status, last_error_code FROM payment_attempts WHERE id = $1`, [attempt.id]);
    expect(attempts.rows[0]?.status).toBe('EXPIRED');
  });

  it('protects a stale success from being downgraded by a later failure', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      {
        fullName: 'Reconcile Stale Success',
        email: 'reconcile-stale@example.test',
        phone: '+84901000005',
      },
      Buffer.alloc(32, 34),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-stale-001',
      now: new Date(),
    });
    await setAttemptReadyForReconciliation(database.pool, attempt.id);
    await database.pool.query(
      `UPDATE payment_attempts
          SET status = 'SUCCEEDED', completed_at = CURRENT_TIMESTAMP,
              provider_transaction_id = 'momo-stale-tx'
        WHERE id = $1`,
      [attempt.id],
    );

    const fake = createQueryFixture();
    fake.enqueue({
      outcome: 'FAILED',
      providerTransactionId: 'momo-stale-failure',
      amountVnd: 359000n,
      occurredAt: new Date(),
      rawBodyDigest: null,
    });
    const claimed = await claimReconciliationAttempts({
      pool: database.pool,
      batchSize: 5,
      leaseTtlMs: 30_000,
      leaseOwner: 'reconciler-test-4',
    });
    expect(claimed).toHaveLength(0);

    const attempts = await database.pool.query<{ status: string }>(
      `SELECT status FROM payment_attempts WHERE id = $1`,
      [attempt.id],
    );
    expect(attempts.rows[0]?.status).toBe('SUCCEEDED');
  });

  it('strips a transient retry budget over the limit and parks the attempt in REVIEW_REQUIRED', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      {
        fullName: 'Reconcile Exhausted',
        email: 'reconcile-exhausted@example.test',
        phone: '+84901000006',
      },
      Buffer.alloc(32, 35),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-exhausted-001',
      now: new Date(),
    });
    await database.pool.query(
      `UPDATE payment_attempts
          SET reconciliation_attempt_count = $2,
              next_reconciliation_at = CURRENT_TIMESTAMP - interval '1 second'
        WHERE id = $1`,
      [attempt.id, DEFAULT_RECONCILIATION_POLICY.maxAttempts],
    );

    const fake = createQueryFixture();
    fake.enqueueError('transient', 'TIMEOUT');
    const claimed = await claimReconciliationAttempts({
      pool: database.pool,
      batchSize: 5,
      leaseTtlMs: 30_000,
      leaseOwner: 'reconciler-test-5',
    });
    const leased = claimed[0]!;
    const result = await reconcilePaymentAttempt({
      pool: database.pool,
      attemptId: leased.id,
      leaseId: leased.leaseId,
      leaseOwner: 'reconciler-test-5',
      queryProvider: asPort(fake.query),
      queryTimeoutMs: 5_000,
    });
    expect(result.outcome).toBe('TRANSIENT_RETRY_EXHAUSTED');

    const attempts = await database.pool.query<{
      status: string;
      review_code: string | null;
    }>(`SELECT status, review_code FROM payment_attempts WHERE id = $1`, [attempt.id]);
    expect(attempts.rows[0]?.status).toBe('REVIEW_REQUIRED');
    expect(attempts.rows[0]?.review_code).toBe('RECONCILIATION_TRANSIENT_EXHAUSTED');
  });

  it('refuses to advance an attempt whose lease expired before the cycle touched it', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Reconcile Lease', email: 'reconcile-lease@example.test', phone: '+84901000007' },
      Buffer.alloc(32, 36),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-lease-001',
      now: new Date(),
    });
    await setAttemptReadyForReconciliation(database.pool, attempt.id);

    const fake = createQueryFixture();
    fake.enqueue(makeSuccessResult(359000n, new Date()));
    const claimed = await claimReconciliationAttempts({
      pool: database.pool,
      batchSize: 5,
      leaseTtlMs: 1_000,
      leaseOwner: 'reconciler-lease',
    });
    const leased = claimed[0]!;
    await database.pool.query(
      `UPDATE payment_attempts
          SET lease_expires_at = CURRENT_TIMESTAMP - interval '1 minute'
        WHERE id = $1`,
      [attempt.id],
    );
    const result = await reconcilePaymentAttempt({
      pool: database.pool,
      attemptId: leased.id,
      leaseId: leased.leaseId,
      leaseOwner: 'reconciler-lease',
      queryProvider: asPort(fake.query),
      queryTimeoutMs: 5_000,
    });
    expect(result.outcome).toBe('LEASE_LOST');
  });

  it('recoverExpiredReconciliationLeases releases orphaned leases only', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      {
        fullName: 'Reconcile Recover',
        email: 'reconcile-recover@example.test',
        phone: '+84901000008',
      },
      Buffer.alloc(32, 37),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'reconcile-recover-001',
      now: new Date(),
    });
    await database.pool.query(
      `UPDATE payment_attempts
          SET lease_owner = 'abandoned-worker',
              lease_expires_at = CURRENT_TIMESTAMP - interval '1 minute'
        WHERE id = $1`,
      [attempt.id],
    );
    const recovered = await recoverExpiredReconciliationLeases({
      pool: database.pool,
      batchSize: 10,
    });
    expect(recovered).toBeGreaterThanOrEqual(1);

    const attempts = await database.pool.query<{
      lease_owner: string | null;
      lease_expires_at: Date | null;
    }>(`SELECT lease_owner, lease_expires_at FROM payment_attempts WHERE id = $1`, [attempt.id]);
    expect(attempts.rows[0]?.lease_owner).toBeNull();
    expect(attempts.rows[0]?.lease_expires_at).toBeNull();
  });

  it('respects the typed policy object and rejects an ad-hoc policy', async () => {
    expect(() =>
      validateReconciliationPolicy({
        maxAttempts: 0,
        delayMinutes: [1],
      }),
    ).toThrow();
  });
});
