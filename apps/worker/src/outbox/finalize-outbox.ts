import { type DatabasePool, type DatabasePoolClient } from '@room/database';

import type { OutboxClaimRow } from './claim-outbox-batch.js';

export type OutboxErrorCategory =
  | 'SMTP_TIMEOUT'
  | 'SMTP_CONNECT'
  | 'SMTP_REJECTED'
  | 'TEMPLATE_RENDER'
  | 'CONTEXT_MISSING'
  | 'LEASE_LOST';

export interface FinalizeOutboxSuccessInput {
  readonly pool: DatabasePool;
  readonly claim: OutboxClaimRow;
  readonly client?: DatabasePoolClient;
}

export interface FinalizeOutboxFailureInput {
  readonly pool: DatabasePool;
  readonly claim: OutboxClaimRow;
  readonly category: OutboxErrorCategory;
  readonly baseBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly client?: DatabasePoolClient;
}

export interface FinalizeOutboxSuccessResult {
  readonly updated: boolean;
  readonly alreadyPublished: boolean;
}

export interface FinalizeOutboxFailureResult {
  readonly updated: boolean;
  readonly rescheduledAt: Date | null;
}

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export function validateFailureInput(input: FinalizeOutboxFailureInput): void {
  if (
    !Number.isInteger(input.baseBackoffMs) ||
    input.baseBackoffMs < MIN_BACKOFF_MS ||
    input.baseBackoffMs > MAX_BACKOFF_MS
  ) {
    throw new RangeError(
      `baseBackoffMs must be an integer between ${MIN_BACKOFF_MS} and ${MAX_BACKOFF_MS}`,
    );
  }
  if (
    !Number.isInteger(input.maxBackoffMs) ||
    input.maxBackoffMs < input.baseBackoffMs ||
    input.maxBackoffMs > MAX_BACKOFF_MS
  ) {
    throw new RangeError(
      `maxBackoffMs must be an integer between baseBackoffMs and ${MAX_BACKOFF_MS}`,
    );
  }
}

export function calculateBackoffMs(
  attemptCount: number,
  baseBackoffMs: number,
  maxBackoffMs: number,
): number {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new RangeError('attemptCount must be a positive integer');
  }
  validateFailureInput({
    pool: undefined as unknown as DatabasePool,
    claim: undefined as unknown as OutboxClaimRow,
    category: 'LEASE_LOST',
    baseBackoffMs,
    maxBackoffMs,
  });
  const exponent = attemptCount - 1;
  const candidate = baseBackoffMs * 2 ** exponent;
  if (candidate > maxBackoffMs) {
    return maxBackoffMs;
  }
  return candidate;
}

export async function finalizeOutboxSuccess(
  input: FinalizeOutboxSuccessInput,
): Promise<FinalizeOutboxSuccessResult> {
  const run = async (client: DatabasePoolClient): Promise<FinalizeOutboxSuccessResult> => {
    const timestamp = await client.query<{ database_now: Date }>(
      'SELECT CURRENT_TIMESTAMP AS database_now',
    );
    const databaseNow = timestamp.rows[0]?.database_now;
    if (databaseNow === undefined) {
      throw new Error('PostgreSQL returned no authoritative timestamp');
    }

    const result = await client.query(
      `UPDATE outbox_events
          SET status = 'PUBLISHED',
              published_at = $2,
              lease_id = NULL,
              claimed_at = NULL,
              lease_expires_at = NULL,
              last_error_category = NULL
        WHERE id = $1
          AND status = 'PENDING'
          AND lease_id = $3`,
      [input.claim.id, databaseNow, input.claim.leaseId],
    );

    if (result.rowCount === 1) {
      return { updated: true, alreadyPublished: false };
    }

    const existing = await client.query<{ status: string }>(
      'SELECT status FROM outbox_events WHERE id = $1',
      [input.claim.id],
    );
    const status = existing.rows[0]?.status;
    if (status === 'PUBLISHED') {
      return { updated: false, alreadyPublished: true };
    }
    return { updated: false, alreadyPublished: false };
  };

  if (input.client !== undefined) {
    return run(input.client);
  }
  const client = await input.pool.connect();
  try {
    return await run(client);
  } finally {
    client.release();
  }
}

export async function finalizeOutboxFailure(
  input: FinalizeOutboxFailureInput,
): Promise<FinalizeOutboxFailureResult> {
  validateFailureInput(input);

  const run = async (client: DatabasePoolClient): Promise<FinalizeOutboxFailureResult> => {
    const timestamp = await client.query<{ database_now: Date }>(
      'SELECT CURRENT_TIMESTAMP AS database_now',
    );
    const databaseNow = timestamp.rows[0]?.database_now;
    if (databaseNow === undefined) {
      throw new Error('PostgreSQL returned no authoritative timestamp');
    }

    const backoffMs = calculateBackoffMs(
      input.claim.attemptCount,
      input.baseBackoffMs,
      input.maxBackoffMs,
    );

    const result = await client.query<{ available_at: Date }>(
      `UPDATE outbox_events
            SET status = 'PENDING',
                lease_id = NULL,
                claimed_at = NULL,
                lease_expires_at = NULL,
                last_error_category = $3,
                available_at = $2::timestamptz + ($4::bigint * INTERVAL '1 millisecond'),
                attempt_count = attempt_count
          WHERE id = $1
            AND status = 'PENDING'
            AND lease_id = $5
        RETURNING available_at`,
      [input.claim.id, databaseNow, input.category, backoffMs, input.claim.leaseId],
    );

    if (result.rowCount === 1) {
      const row = result.rows[0];
      if (row === undefined) {
        return { updated: true, rescheduledAt: null };
      }
      return { updated: true, rescheduledAt: row.available_at };
    }
    return { updated: false, rescheduledAt: null };
  };

  if (input.client !== undefined) {
    return run(input.client);
  }
  const client = await input.pool.connect();
  try {
    return await run(client);
  } finally {
    client.release();
  }
}
