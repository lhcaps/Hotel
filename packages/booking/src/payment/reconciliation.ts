/**
 * Gate B canonical reconciliation primitives (Phase 8C).
 *
 * The reconciliation service is the only authority that turns non-canonical
 * (status-query) provider evidence into business state. It uses
 * `applyVerifiedPaymentEvent` as the single settlement path; everything else
 * (claiming, leasing, advancing, audit) is database-only state on the
 * existing `payment_attempts` reconciliation columns.
 *
 * The worker that drives this module is intentionally out of scope. The
 * exported `claimReconciliationAttempts` and `recoverExpiredReconciliationLeases`
 * helpers are the only worker-facing surface.
 */

import {
  and,
  bookings,
  createDatabaseClient,
  eq,
  inArray,
  ne,
  or,
  paymentAttempts,
  paymentProviderSettings,
  sql,
  type DatabasePool,
} from '@room/database';
import { createHash, randomUUID } from 'node:crypto';

import { applyVerifiedPaymentEvent } from './payment-service.js';

export const DEFAULT_RECONCILIATION_MAX_ATTEMPTS = 8;

export const DEFAULT_RECONCILIATION_DELAY_MINUTES: readonly number[] = [1, 5, 15, 60, 240];

export const MIN_RECONCILIATION_MAX_ATTEMPTS = 1;
export const MAX_RECONCILIATION_MAX_ATTEMPTS = 32;
export const MIN_RECONCILIATION_DELAY_MINUTES = 1;
export const MAX_RECONCILIATION_DELAY_MINUTES = 24 * 60;

export const MIN_RECONCILIATION_LEASE_TTL_MS = 1_000;
export const MAX_RECONCILIATION_LEASE_TTL_MS = 5 * 60 * 1_000;

export const MIN_RECONCILIATION_BATCH_SIZE = 1;
export const MAX_RECONCILIATION_BATCH_SIZE = 200;

export const MIN_RECONCILIATION_PROVIDER_TIMEOUT_MS = 1_000;
export const MAX_RECONCILIATION_PROVIDER_TIMEOUT_MS = 60_000;

export interface ReconciliationPolicy {
  readonly maxAttempts: number;
  readonly delayMinutes: readonly number[];
}

export const DEFAULT_RECONCILIATION_POLICY: ReconciliationPolicy = {
  maxAttempts: DEFAULT_RECONCILIATION_MAX_ATTEMPTS,
  delayMinutes: DEFAULT_RECONCILIATION_DELAY_MINUTES,
};

export type ReconciliationQueryErrorCategory =
  'transient' | 'permanent' | 'not_found' | 'unsafe_to_classify';

export type ReconciliationQueryOutcome =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'NOT_FOUND' | 'STALE_FAILURE';

export interface ReconciliationQueryError {
  readonly category: ReconciliationQueryErrorCategory;
  readonly code: string;
  readonly message?: string;
}

export interface ReconciliationQueryResult {
  readonly outcome:
    Exclude<ReconciliationQueryOutcome, 'PENDING' | 'NOT_FOUND' | 'STALE_FAILURE'> | 'PENDING';
  readonly providerTransactionId: string | null;
  readonly amountVnd: bigint | null;
  readonly occurredAt: Date | null;
  readonly rawBodyDigest: Buffer | null;
}

export interface ReconciliationStatusQueryPort {
  query(input: {
    readonly provider: 'MOMO' | 'VNPAY';
    readonly providerOrderId: string;
    readonly signal: AbortSignal;
  }): Promise<ReconciliationQueryResult | ReconciliationQueryError>;
}

export interface ClaimReconciliationAttemptInput {
  readonly pool: DatabasePool;
  readonly batchSize: number;
  readonly leaseTtlMs: number;
  readonly leaseOwner: string;
  readonly now?: Date;
}

export interface ClaimedReconciliationAttempt {
  readonly id: string;
  readonly propertyId: string;
  readonly paymentId: string;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly providerOrderId: string;
  readonly providerTransactionId: string | null;
  readonly amountVnd: bigint;
  readonly status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REVIEW_REQUIRED';
  readonly reconciliationAttemptCount: number;
  readonly nextReconciliationAt: Date | null;
  readonly expiresAt: Date | null;
  readonly leaseId: string;
  readonly leaseExpiresAt: Date;
}

export interface RecoverExpiredReconciliationLeasesInput {
  readonly pool: DatabasePool;
  readonly batchSize: number;
  readonly now?: Date;
}

export interface ReleaseReconciliationLeaseInput {
  readonly pool: DatabasePool;
  readonly attemptId: string;
  readonly leaseId: string;
  readonly leaseOwner: string;
  readonly now?: Date;
}

export interface AdvanceReconciliationAttemptInput {
  readonly pool: DatabasePool;
  readonly attemptId: string;
  readonly leaseOwner: string;
  readonly nextReconciliationAt: Date;
  readonly lastErrorCode: string | null;
  readonly now?: Date;
}

export interface CountReconciliationDueInput {
  readonly pool: DatabasePool;
  readonly now?: Date;
}

export interface ReconcilePaymentAttemptInput {
  readonly pool: DatabasePool;
  readonly attemptId: string;
  readonly leaseId: string;
  readonly leaseOwner: string;
  readonly queryProvider: ReconciliationStatusQueryPort;
  readonly queryTimeoutMs: number;
  readonly policy?: ReconciliationPolicy;
  readonly now?: Date;
}

export type ReconciliationCycleOutcome =
  | 'PROCESSED'
  | 'TERMINAL_NOT_FOUND'
  | 'TERMINAL_REVIEW_REQUIRED'
  | 'TRANSIENT_RETRY_SCHEDULED'
  | 'PERMANENT_RETRY_EXHAUSTED'
  | 'PERMANENT_REVIEW_REQUIRED'
  | 'TRANSIENT_RETRY_EXHAUSTED'
  | 'STALE_FAILURE_PROTECTED'
  | 'LEASE_LOST';

export interface ReconcilePaymentAttemptResult {
  readonly outcome: ReconciliationCycleOutcome;
  readonly attemptId: string;
  readonly errorCode: string | null;
  readonly nextReconciliationAt: Date | null;
}

export interface RunReconciliationCycleInput {
  readonly pool: DatabasePool;
  readonly batchSize: number;
  readonly leaseTtlMs: number;
  readonly leaseOwner: string;
  readonly queryProvider: ReconciliationStatusQueryPort;
  readonly queryTimeoutMs: number;
  readonly policy?: ReconciliationPolicy;
  readonly now?: Date;
}

export interface RunReconciliationCycleSummary {
  readonly processed: number;
  readonly byOutcome: Readonly<Record<ReconciliationCycleOutcome, number>>;
}

export interface DeriveAttemptExpiryInput {
  readonly pool: DatabasePool;
  readonly bookingId: string;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly providerKnownExpiryAt: Date | null;
  readonly now?: Date;
}

export interface ExtendedCreatePaymentAttemptInput {
  readonly pool: DatabasePool;
  readonly propertyId: string;
  readonly bookingId: string;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly idempotencyKey: string;
  readonly providerKnownExpiryAt: Date | null;
  readonly now?: Date;
}

export function validateReconciliationPolicy(policy: ReconciliationPolicy): void {
  if (!Number.isInteger(policy.maxAttempts)) {
    throw new RangeError('policy.maxAttempts must be an integer');
  }
  if (
    policy.maxAttempts < MIN_RECONCILIATION_MAX_ATTEMPTS ||
    policy.maxAttempts > MAX_RECONCILIATION_MAX_ATTEMPTS
  ) {
    throw new RangeError(
      `policy.maxAttempts must be between ${MIN_RECONCILIATION_MAX_ATTEMPTS} and ${MAX_RECONCILIATION_MAX_ATTEMPTS}`,
    );
  }
  if (!Array.isArray(policy.delayMinutes)) {
    throw new RangeError('policy.delayMinutes must be an array');
  }
  for (const minutes of policy.delayMinutes) {
    if (!Number.isInteger(minutes)) {
      throw new RangeError('policy.delayMinutes entries must be integers');
    }
    if (minutes < MIN_RECONCILIATION_DELAY_MINUTES || minutes > MAX_RECONCILIATION_DELAY_MINUTES) {
      throw new RangeError(
        `policy.delayMinutes entries must be between ${MIN_RECONCILIATION_DELAY_MINUTES} and ${MAX_RECONCILIATION_DELAY_MINUTES}`,
      );
    }
  }
  if (policy.delayMinutes.length === 0) {
    throw new RangeError('policy.delayMinutes must not be empty');
  }
}

export function computeReconciliationDelay(
  retryCount: number,
  policy: ReconciliationPolicy = DEFAULT_RECONCILIATION_POLICY,
): number {
  validateReconciliationPolicy(policy);
  if (retryCount < 0) {
    throw new RangeError('retryCount must be >= 0');
  }
  const index = Math.min(retryCount, policy.delayMinutes.length - 1);
  return policy.delayMinutes[index] as number;
}

export function computeReconciliationNextReconciliationAt(
  retryCount: number,
  policy: ReconciliationPolicy,
  now: Date,
): Date {
  const minutes = computeReconciliationDelay(retryCount, policy);
  return new Date(now.getTime() + minutes * 60_000);
}

export function classifyReconciliationQueryError(error: unknown): ReconciliationQueryError {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Record<string, unknown>;
    const categoryCandidate = candidate.category;
    const codeCandidate = candidate.code;
    const messageCandidate = candidate.message;
    if (
      (categoryCandidate === 'transient' ||
        categoryCandidate === 'permanent' ||
        categoryCandidate === 'not_found' ||
        categoryCandidate === 'unsafe_to_classify') &&
      typeof codeCandidate === 'string' &&
      codeCandidate.length > 0 &&
      codeCandidate.length <= 128
    ) {
      const result: ReconciliationQueryError = {
        category: categoryCandidate,
        code: codeCandidate,
      };
      if (typeof messageCandidate === 'string') {
        return { ...result, message: messageCandidate.slice(0, 256) };
      }
      return result;
    }
  }
  if (error instanceof Error) {
    return {
      category: 'unsafe_to_classify',
      code: 'UNCLASSIFIED_ERROR',
      message: error.name.slice(0, 128),
    };
  }
  return { category: 'unsafe_to_classify', code: 'UNCLASSIFIED_ERROR' };
}

function decodeHexSha256(rawBody: Buffer): Buffer {
  if (rawBody.length !== 32) {
    return createHash('sha256').update(rawBody).digest();
  }
  return rawBody;
}

function safeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, string | number | null> {
  const safe: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      safe[key] = value.slice(0, 256);
    } else if (typeof value === 'number') {
      safe[key] = Number.isFinite(value) ? value : null;
    } else if (value === null || value === undefined) {
      safe[key] = null;
    } else {
      safe[key] = String(value).slice(0, 256);
    }
  }
  return safe;
}

export function deriveAttemptExpiryAuthority(
  bookingHoldExpiresAt: Date | null,
  providerCheckoutExpiryMinutes: number | null,
  providerKnownExpiryAt: Date | null,
  now: Date,
): Date | null {
  const candidates: Date[] = [];
  if (bookingHoldExpiresAt !== null && bookingHoldExpiresAt.getTime() > now.getTime()) {
    candidates.push(bookingHoldExpiresAt);
  }
  if (
    providerCheckoutExpiryMinutes !== null &&
    Number.isInteger(providerCheckoutExpiryMinutes) &&
    providerCheckoutExpiryMinutes > 0
  ) {
    const providerExpiry = new Date(now.getTime() + providerCheckoutExpiryMinutes * 60_000);
    if (providerExpiry.getTime() > now.getTime()) {
      candidates.push(providerExpiry);
    }
  }
  if (providerKnownExpiryAt !== null && providerKnownExpiryAt.getTime() > now.getTime()) {
    candidates.push(providerKnownExpiryAt);
  }
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((date) => date.getTime())));
}

export async function loadAttemptExpiryAuthority(
  input: DeriveAttemptExpiryInput,
): Promise<{ holdExpiresAt: Date | null; providerCheckoutExpiryMinutes: number | null }> {
  const database = createDatabaseClient(input.pool);
  const bookingRows = await database
    .select({ holdExpiresAt: bookings.holdExpiresAt })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  const booking = bookingRows[0];
  const settingsRows = await database
    .select({
      propertyId: paymentProviderSettings.propertyId,
      checkoutExpiryMinutes: paymentProviderSettings.checkoutExpiryMinutes,
    })
    .from(paymentProviderSettings)
    .innerJoin(bookings, eq(bookings.id, input.bookingId))
    .where(
      and(
        eq(paymentProviderSettings.propertyId, bookings.propertyId),
        eq(paymentProviderSettings.provider, input.provider),
      ),
    )
    .limit(1);
  const settingsRow = settingsRows[0];
  return {
    holdExpiresAt: booking?.holdExpiresAt ?? null,
    providerCheckoutExpiryMinutes: settingsRow?.checkoutExpiryMinutes ?? null,
  };
}

export async function deriveAttemptExpiryAuthorityForBooking(
  input: DeriveAttemptExpiryInput,
): Promise<Date | null> {
  const now = input.now ?? new Date();
  const { holdExpiresAt, providerCheckoutExpiryMinutes } = await loadAttemptExpiryAuthority({
    ...input,
    now,
  });
  return deriveAttemptExpiryAuthority(
    holdExpiresAt,
    providerCheckoutExpiryMinutes,
    input.providerKnownExpiryAt,
    now,
  );
}

export function validateReconciliationBatchSize(batchSize: number): void {
  if (
    !Number.isInteger(batchSize) ||
    batchSize < MIN_RECONCILIATION_BATCH_SIZE ||
    batchSize > MAX_RECONCILIATION_BATCH_SIZE
  ) {
    throw new RangeError(
      `batchSize must be an integer between ${MIN_RECONCILIATION_BATCH_SIZE} and ${MAX_RECONCILIATION_BATCH_SIZE}`,
    );
  }
}

export function validateReconciliationLeaseTtl(leaseTtlMs: number): void {
  if (
    !Number.isInteger(leaseTtlMs) ||
    leaseTtlMs < MIN_RECONCILIATION_LEASE_TTL_MS ||
    leaseTtlMs > MAX_RECONCILIATION_LEASE_TTL_MS
  ) {
    throw new RangeError(
      `leaseTtlMs must be an integer between ${MIN_RECONCILIATION_LEASE_TTL_MS} and ${MAX_RECONCILIATION_LEASE_TTL_MS}`,
    );
  }
}

export function validateReconciliationQueryTimeout(queryTimeoutMs: number): void {
  if (
    !Number.isInteger(queryTimeoutMs) ||
    queryTimeoutMs < MIN_RECONCILIATION_PROVIDER_TIMEOUT_MS ||
    queryTimeoutMs > MAX_RECONCILIATION_PROVIDER_TIMEOUT_MS
  ) {
    throw new RangeError(
      `queryTimeoutMs must be an integer between ${MIN_RECONCILIATION_PROVIDER_TIMEOUT_MS} and ${MAX_RECONCILIATION_PROVIDER_TIMEOUT_MS}`,
    );
  }
}

export function validateLeaseOwner(leaseOwner: string): void {
  if (typeof leaseOwner !== 'string' || leaseOwner.trim() === '') {
    throw new RangeError('leaseOwner must be a non-empty string');
  }
  if (leaseOwner.length > 128) {
    throw new RangeError('leaseOwner must be at most 128 characters');
  }
}

export async function claimReconciliationAttempts(
  input: ClaimReconciliationAttemptInput,
): Promise<readonly ClaimedReconciliationAttempt[]> {
  validateReconciliationBatchSize(input.batchSize);
  validateReconciliationLeaseTtl(input.leaseTtlMs);
  validateLeaseOwner(input.leaseOwner);
  const now = input.now ?? new Date();
  const leaseId = randomUUID();
  const database = createDatabaseClient(input.pool);
  return database.transaction(async (tx) => {
    const eligible = await tx
      .select({ id: paymentAttempts.id })
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.status, 'PENDING'),
          or(
            sql`${paymentAttempts.nextReconciliationAt} IS NULL`,
            sql`${paymentAttempts.nextReconciliationAt} <= ${now}`,
          ),
          or(
            sql`${paymentAttempts.leaseExpiresAt} IS NULL`,
            sql`${paymentAttempts.leaseExpiresAt} <= ${now}`,
          ),
          or(
            sql`${paymentAttempts.leaseOwner} IS NULL`,
            ne(paymentAttempts.leaseOwner, input.leaseOwner),
          ),
        ),
      )
      .orderBy(paymentAttempts.nextReconciliationAt, paymentAttempts.createdAt)
      .for('update', { skipLocked: true })
      .limit(input.batchSize);
    if (eligible.length === 0) return [];
    const ids = eligible.map((row) => row.id);
    const updated = await tx
      .update(paymentAttempts)
      .set({
        leaseOwner: input.leaseOwner,
        leaseExpiresAt: new Date(now.getTime() + input.leaseTtlMs),
        updatedAt: now,
      })
      .where(
        and(
          inArray(paymentAttempts.id, ids),
          eq(paymentAttempts.status, 'PENDING'),
          or(
            sql`${paymentAttempts.leaseExpiresAt} IS NULL`,
            sql`${paymentAttempts.leaseExpiresAt} <= ${now}`,
          ),
        ),
      )
      .returning({
        id: paymentAttempts.id,
        propertyId: paymentAttempts.propertyId,
        paymentId: paymentAttempts.paymentId,
        provider: paymentAttempts.provider,
        providerOrderId: paymentAttempts.providerOrderId,
        providerTransactionId: paymentAttempts.providerTransactionId,
        amountVnd: paymentAttempts.amountVnd,
        status: paymentAttempts.status,
        reconciliationAttemptCount: paymentAttempts.reconciliationAttemptCount,
        nextReconciliationAt: paymentAttempts.nextReconciliationAt,
        expiresAt: paymentAttempts.expiresAt,
        leaseOwner: paymentAttempts.leaseOwner,
        leaseExpiresAt: paymentAttempts.leaseExpiresAt,
      });
    return updated
      .filter((row) => row.leaseOwner === input.leaseOwner && row.leaseExpiresAt !== null)
      .map((row) => ({
        id: row.id,
        propertyId: row.propertyId,
        paymentId: row.paymentId,
        provider: row.provider,
        providerOrderId: row.providerOrderId,
        providerTransactionId: row.providerTransactionId,
        amountVnd: row.amountVnd,
        status: row.status,
        reconciliationAttemptCount: row.reconciliationAttemptCount,
        nextReconciliationAt: row.nextReconciliationAt,
        expiresAt: row.expiresAt,
        leaseId,
        leaseExpiresAt: row.leaseExpiresAt as Date,
      }));
  });
}

export async function recoverExpiredReconciliationLeases(
  input: RecoverExpiredReconciliationLeasesInput,
): Promise<number> {
  validateReconciliationBatchSize(input.batchSize);
  const now = input.now ?? new Date();
  const database = createDatabaseClient(input.pool);
  const result = await database
    .update(paymentAttempts)
    .set({
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(paymentAttempts.status, 'PENDING'),
        sql`${paymentAttempts.leaseOwner} IS NOT NULL`,
        sql`${paymentAttempts.leaseExpiresAt} <= ${now}`,
      ),
    )
    .returning({ id: paymentAttempts.id });
  return result.length === 0 ? 0 : Math.min(input.batchSize, result.length);
}

export async function releaseReconciliationLease(
  input: ReleaseReconciliationLeaseInput,
): Promise<boolean> {
  const now = input.now ?? new Date();
  const database = createDatabaseClient(input.pool);
  const result = await database
    .update(paymentAttempts)
    .set({
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(paymentAttempts.id, input.attemptId),
        eq(paymentAttempts.leaseOwner, input.leaseOwner),
      ),
    )
    .returning({ id: paymentAttempts.id });
  return result.length > 0;
}

export async function advanceReconciliationAttempt(
  input: AdvanceReconciliationAttemptInput,
): Promise<boolean> {
  const now = input.now ?? new Date();
  const database = createDatabaseClient(input.pool);
  const result = await database
    .update(paymentAttempts)
    .set({
      nextReconciliationAt: input.nextReconciliationAt,
      lastReconciledAt: now,
      lastErrorCode: input.lastErrorCode,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(paymentAttempts.id, input.attemptId),
        eq(paymentAttempts.leaseOwner, input.leaseOwner),
      ),
    )
    .returning({ id: paymentAttempts.id });
  return result.length > 0;
}

export async function countReconciliationDueAttempts(
  input: CountReconciliationDueInput,
): Promise<number> {
  const now = input.now ?? new Date();
  const database = createDatabaseClient(input.pool);
  const rows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.status, 'PENDING'),
        or(
          sql`${paymentAttempts.nextReconciliationAt} IS NULL`,
          sql`${paymentAttempts.nextReconciliationAt} <= ${now}`,
        ),
      ),
    );
  return rows[0]?.count ?? 0;
}

function buildEventKey(
  attemptId: string,
  providerOrderId: string,
  providerTransactionId: string | null,
  outcome: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED',
  occurredAt: Date,
): string {
  const digest = createHash('sha256');
  digest.update(attemptId);
  digest.update('|');
  digest.update(providerOrderId);
  digest.update('|');
  digest.update(providerTransactionId ?? '');
  digest.update('|');
  digest.update(outcome);
  digest.update('|');
  digest.update(occurredAt.toISOString());
  return `reconciliation:${digest.digest('hex').slice(0, 40)}`;
}

export async function reconcilePaymentAttempt(
  input: ReconcilePaymentAttemptInput,
): Promise<ReconcilePaymentAttemptResult> {
  const policy = input.policy ?? DEFAULT_RECONCILIATION_POLICY;
  validateReconciliationPolicy(policy);
  validateReconciliationQueryTimeout(input.queryTimeoutMs);
  const now = input.now ?? new Date();
  const database = createDatabaseClient(input.pool);

  const lockRows = await database
    .select({
      id: paymentAttempts.id,
      propertyId: paymentAttempts.propertyId,
      paymentId: paymentAttempts.paymentId,
      provider: paymentAttempts.provider,
      providerOrderId: paymentAttempts.providerOrderId,
      amountVnd: paymentAttempts.amountVnd,
      status: paymentAttempts.status,
      reconciliationAttemptCount: paymentAttempts.reconciliationAttemptCount,
      expiresAt: paymentAttempts.expiresAt,
      leaseOwner: paymentAttempts.leaseOwner,
      leaseExpiresAt: paymentAttempts.leaseExpiresAt,
    })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.id, input.attemptId))
    .limit(1)
    .for('update');
  const attempt = lockRows[0];
  if (attempt === undefined) {
    return {
      outcome: 'LEASE_LOST',
      attemptId: input.attemptId,
      errorCode: 'ATTEMPT_NOT_FOUND',
      nextReconciliationAt: null,
    };
  }
  if (attempt.leaseOwner === null || attempt.leaseExpiresAt === null) {
    return {
      outcome: 'LEASE_LOST',
      attemptId: input.attemptId,
      errorCode: 'LEASE_NOT_HELD',
      nextReconciliationAt: null,
    };
  }
  if (attempt.leaseExpiresAt.getTime() <= now.getTime()) {
    return {
      outcome: 'LEASE_LOST',
      attemptId: input.attemptId,
      errorCode: 'LEASE_EXPIRED',
      nextReconciliationAt: null,
    };
  }

  if (attempt.status !== 'PENDING') {
    if (attempt.status === 'SUCCEEDED') {
      return {
        outcome: 'STALE_FAILURE_PROTECTED',
        attemptId: input.attemptId,
        errorCode: 'STALE_SUCCESS',
        nextReconciliationAt: null,
      };
    }
    if (attempt.status === 'REVIEW_REQUIRED') {
      return {
        outcome: 'TERMINAL_REVIEW_REQUIRED',
        attemptId: input.attemptId,
        errorCode: 'ALREADY_REVIEW_REQUIRED',
        nextReconciliationAt: null,
      };
    }
    return {
      outcome: 'STALE_FAILURE_PROTECTED',
      attemptId: input.attemptId,
      errorCode: 'STALE_TERMINAL',
      nextReconciliationAt: null,
    };
  }

  if (attempt.expiresAt !== null && attempt.expiresAt.getTime() <= now.getTime()) {
    return {
      outcome: 'STALE_FAILURE_PROTECTED',
      attemptId: input.attemptId,
      errorCode: 'ATTEMPT_EXPIRED',
      nextReconciliationAt: null,
    };
  }

  const nextRetryCount = attempt.reconciliationAttemptCount + 1;
  const exhausted = nextRetryCount > policy.maxAttempts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.queryTimeoutMs);
  let queryResult: ReconciliationQueryResult | ReconciliationQueryError;
  try {
    queryResult = await input.queryProvider.query({
      provider: attempt.provider,
      providerOrderId: attempt.providerOrderId,
      signal: controller.signal,
    });
  } catch (error) {
    queryResult = classifyReconciliationQueryError(error);
  } finally {
    clearTimeout(timeout);
  }

  if ('category' in queryResult) {
    const error = queryResult;
    if (error.category === 'permanent') {
      await releaseReconciliationLease({
        pool: input.pool,
        attemptId: attempt.id,
        leaseId: input.leaseId,
        leaseOwner: input.leaseOwner,
        now,
      });
      await database
        .update(paymentAttempts)
        .set({
          status: 'REVIEW_REQUIRED',
          completedAt: now,
          reviewCode: 'RECONCILIATION_PERMANENT_ERROR',
          lastReconciledAt: now,
          lastErrorCode: error.code,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(eq(paymentAttempts.id, attempt.id));
      return {
        outcome: 'PERMANENT_REVIEW_REQUIRED',
        attemptId: attempt.id,
        errorCode: error.code,
        nextReconciliationAt: null,
      };
    }
    if (error.category === 'not_found') {
      await releaseReconciliationLease({
        pool: input.pool,
        attemptId: attempt.id,
        leaseId: input.leaseId,
        leaseOwner: input.leaseOwner,
        now,
      });
      await database
        .update(paymentAttempts)
        .set({
          status: 'EXPIRED',
          completedAt: now,
          lastReconciledAt: now,
          lastErrorCode: error.code,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(eq(paymentAttempts.id, attempt.id));
      return {
        outcome: 'TERMINAL_NOT_FOUND',
        attemptId: attempt.id,
        errorCode: error.code,
        nextReconciliationAt: null,
      };
    }
    if (exhausted) {
      await releaseReconciliationLease({
        pool: input.pool,
        attemptId: attempt.id,
        leaseId: input.leaseId,
        leaseOwner: input.leaseOwner,
        now,
      });
      await database
        .update(paymentAttempts)
        .set({
          status: 'REVIEW_REQUIRED',
          completedAt: now,
          reviewCode: 'RECONCILIATION_TRANSIENT_EXHAUSTED',
          lastReconciledAt: now,
          lastErrorCode: error.code,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(eq(paymentAttempts.id, attempt.id));
      return {
        outcome: 'TRANSIENT_RETRY_EXHAUSTED',
        attemptId: attempt.id,
        errorCode: error.code,
        nextReconciliationAt: null,
      };
    }
    const nextReconciliationAt = computeReconciliationNextReconciliationAt(
      attempt.reconciliationAttemptCount,
      policy,
      now,
    );
    await advanceReconciliationAttempt({
      pool: input.pool,
      attemptId: attempt.id,
      leaseOwner: input.leaseOwner,
      nextReconciliationAt,
      lastErrorCode: error.code,
      now,
    });
    await database
      .update(paymentAttempts)
      .set({ reconciliationAttemptCount: nextRetryCount })
      .where(eq(paymentAttempts.id, attempt.id));
    return {
      outcome: 'TRANSIENT_RETRY_SCHEDULED',
      attemptId: attempt.id,
      errorCode: error.code,
      nextReconciliationAt,
    };
  }

  if (queryResult.outcome === 'PENDING') {
    if (exhausted) {
      await releaseReconciliationLease({
        pool: input.pool,
        attemptId: attempt.id,
        leaseId: input.leaseId,
        leaseOwner: input.leaseOwner,
        now,
      });
      return {
        outcome: 'TRANSIENT_RETRY_EXHAUSTED',
        attemptId: attempt.id,
        errorCode: 'PROVIDER_STILL_PENDING',
        nextReconciliationAt: null,
      };
    }
    const nextReconciliationAt = computeReconciliationNextReconciliationAt(
      attempt.reconciliationAttemptCount,
      policy,
      now,
    );
    await advanceReconciliationAttempt({
      pool: input.pool,
      attemptId: attempt.id,
      leaseOwner: input.leaseOwner,
      nextReconciliationAt,
      lastErrorCode: null,
      now,
    });
    await database
      .update(paymentAttempts)
      .set({ reconciliationAttemptCount: nextRetryCount })
      .where(eq(paymentAttempts.id, attempt.id));
    return {
      outcome: 'TRANSIENT_RETRY_SCHEDULED',
      attemptId: attempt.id,
      errorCode: 'PROVIDER_STILL_PENDING',
      nextReconciliationAt,
    };
  }

  const occurredAt = queryResult.occurredAt ?? now;
  const eventKey = buildEventKey(
    attempt.id,
    attempt.providerOrderId,
    queryResult.providerTransactionId,
    queryResult.outcome,
    occurredAt,
  );
  const rawBodyDigest = queryResult.rawBodyDigest
    ? decodeHexSha256(queryResult.rawBodyDigest)
    : createHash('sha256').update(eventKey).digest();

  const settled = await applyVerifiedPaymentEvent({
    pool: input.pool,
    provider: attempt.provider,
    eventKey,
    providerOrderId: attempt.providerOrderId,
    providerTransactionId: queryResult.providerTransactionId ?? '',
    normalizedOutcome: queryResult.outcome,
    amountVnd: queryResult.amountVnd ?? attempt.amountVnd,
    currency: 'VND',
    occurredAt,
    rawBodyDigest,
    verificationMarker: 'VERIFIED_BY_ADAPTER',
  });

  await releaseReconciliationLease({
    pool: input.pool,
    attemptId: attempt.id,
    leaseId: input.leaseId,
    leaseOwner: input.leaseOwner,
    now,
  });

  await database
    .update(paymentAttempts)
    .set({
      lastReconciledAt: now,
      lastErrorCode: null,
      reconciliationAttemptCount: nextRetryCount,
    })
    .where(eq(paymentAttempts.id, attempt.id));

  if (settled.processingStatus === 'PROCESSED') {
    return {
      outcome: 'PROCESSED',
      attemptId: attempt.id,
      errorCode: null,
      nextReconciliationAt: null,
    };
  }
  if (settled.processingStatus === 'DUPLICATE') {
    return {
      outcome: 'PROCESSED',
      attemptId: attempt.id,
      errorCode: 'DUPLICATE',
      nextReconciliationAt: null,
    };
  }
  return {
    outcome: 'TERMINAL_REVIEW_REQUIRED',
    attemptId: attempt.id,
    errorCode: 'CANONICAL_REVIEW_REQUIRED',
    nextReconciliationAt: null,
  };
}

export async function runReconciliationCycle(
  input: RunReconciliationCycleInput,
): Promise<RunReconciliationCycleSummary> {
  const policy = input.policy ?? DEFAULT_RECONCILIATION_POLICY;
  validateReconciliationPolicy(policy);
  validateReconciliationBatchSize(input.batchSize);
  validateReconciliationLeaseTtl(input.leaseTtlMs);
  validateLeaseOwner(input.leaseOwner);
  validateReconciliationQueryTimeout(input.queryTimeoutMs);

  const claimNow = input.now ?? new Date();
  const claimed = await claimReconciliationAttempts({
    pool: input.pool,
    batchSize: input.batchSize,
    leaseTtlMs: input.leaseTtlMs,
    leaseOwner: input.leaseOwner,
    now: claimNow,
  });
  const byOutcome: Record<ReconciliationCycleOutcome, number> = {
    PROCESSED: 0,
    TERMINAL_NOT_FOUND: 0,
    TERMINAL_REVIEW_REQUIRED: 0,
    TRANSIENT_RETRY_SCHEDULED: 0,
    PERMANENT_RETRY_EXHAUSTED: 0,
    PERMANENT_REVIEW_REQUIRED: 0,
    TRANSIENT_RETRY_EXHAUSTED: 0,
    STALE_FAILURE_PROTECTED: 0,
    LEASE_LOST: 0,
  };
  for (const attempt of claimed) {
    const reconcileInput: ReconcilePaymentAttemptInput = {
      pool: input.pool,
      attemptId: attempt.id,
      leaseId: attempt.leaseId,
      leaseOwner: input.leaseOwner,
      queryProvider: input.queryProvider,
      queryTimeoutMs: input.queryTimeoutMs,
      policy,
      now: claimNow,
    };
    const result = await reconcilePaymentAttempt(reconcileInput);
    byOutcome[result.outcome] += 1;
  }
  return {
    processed: claimed.length,
    byOutcome,
  };
}

export interface SafeAuditMetadataInput {
  readonly attemptId: string;
  readonly outcome: ReconciliationCycleOutcome;
  readonly errorCode: string | null;
  readonly retryCount: number;
  readonly leaseOwner: string;
  readonly policy: ReconciliationPolicy;
}

export function buildSafeAuditMetadata(
  input: SafeAuditMetadataInput,
): Record<string, string | number | null> {
  return safeAuditMetadata({
    attemptId: input.attemptId,
    outcome: input.outcome,
    errorCode: input.errorCode,
    retryCount: input.retryCount,
    leaseOwner: input.leaseOwner,
    maxAttempts: input.policy.maxAttempts,
    delayMinutes: input.policy.delayMinutes.join(','),
  });
}

export const _internal = {
  buildEventKey,
  decodeHexSha256,
  safeAuditMetadata,
};
