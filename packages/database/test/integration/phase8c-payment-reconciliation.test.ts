import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_SCHEMA_VERSION, getSchemaStatus } from '../../src/schema-status.js';
import type { GuardedTestDatabase } from '../../src/testing.js';
import { createMigratedTestDatabase, IDS, insertBooking, insertCatalogFixture } from './helpers.js';

const PAYMENT_ID = '00000000-0000-4000-8000-000000000901';
const ATTEMPT_ID = '00000000-0000-4000-8000-000000000902';
const REVIEW_ID = '00000000-0000-4000-8000-000000000903';

async function insertPayment(database: GuardedTestDatabase, id = PAYMENT_ID): Promise<void> {
  await database.pool.query(
    `INSERT INTO payments (id, property_id, booking_id, amount_vnd)
     VALUES ($1, $2, $3, 359000)`,
    [id, IDS.property, IDS.booking],
  );
}

async function insertAttempt(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO payment_attempts
       (id, property_id, payment_id, provider, idempotency_key, provider_order_id, amount_vnd)
     VALUES ($1, $2, $3, 'MOMO', 'reconciliation-test', 'order-reconciliation-test', 359000)`,
    [ATTEMPT_ID, IDS.property, PAYMENT_ID],
  );
}

describe('Phase 8C payment reconciliation migration', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
    await insertBooking(database.pool);
    await insertPayment(database);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('reports the Phase 8C schema identity', async () => {
    await expect(getSchemaStatus(database.pool)).resolves.toEqual({
      ready: true,
      actualVersion: EXPECTED_SCHEMA_VERSION,
      expectedVersion: EXPECTED_SCHEMA_VERSION,
    });
  });

  it('rejects duplicate payments for the same property and booking', async () => {
    await expect(
      database.pool.query(
        `INSERT INTO payments (id, property_id, booking_id, amount_vnd)
         VALUES ($1, $2, $3, 359000)`,
        ['00000000-0000-4000-8000-000000000904', IDS.property, IDS.booking],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects an operational review whose payment belongs to another property or booking', async () => {
    const otherProperty = '00000000-0000-4000-8000-000000000104';
    await database.pool.query(
      `INSERT INTO properties (id, code, name) VALUES ($1, 'OTHER_PROPERTY', 'Other Property')`,
      [otherProperty],
    );
    await expect(
      database.pool.query(
        `INSERT INTO operational_reviews
           (id, property_id, booking_id, payment_id, category, opened_reason)
         VALUES ($1, $2, $3, $4, 'PAID_CANCELLATION', 'mismatch')`,
        [REVIEW_ID, otherProperty, IDS.booking, PAYMENT_ID],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('enforces reconciliation defaults and lease consistency', async () => {
    await insertAttempt(database);
    const result = await database.pool.query<{
      reconciliation_attempt_count: number;
      next_reconciliation_at: Date | null;
      last_reconciled_at: Date | null;
      last_error_code: string | null;
      lease_owner: string | null;
      lease_expires_at: Date | null;
    }>(
      `SELECT reconciliation_attempt_count, next_reconciliation_at, last_reconciled_at,
              last_error_code, lease_owner, lease_expires_at
         FROM payment_attempts WHERE id = $1`,
      [ATTEMPT_ID],
    );
    expect(result.rows[0]).toMatchObject({
      reconciliation_attempt_count: 0,
      next_reconciliation_at: null,
      last_reconciled_at: null,
      last_error_code: null,
      lease_owner: null,
      lease_expires_at: null,
    });
    await expect(
      database.pool.query(
        `UPDATE payment_attempts SET lease_owner = 'worker-1', lease_expires_at = NULL WHERE id = $1`,
        [ATTEMPT_ID],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('exposes the requested reconciliation and payment review indexes', async () => {
    const result = await database.pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'payment_attempts_reconciliation_eligible_idx',
            'payments_property_status_updated_idx',
            'payment_provider_events_provider_received_idx',
            'operational_reviews_payment_review_idx'
          )`,
    );
    expect(result.rows.map((row) => row.indexname).sort()).toEqual([
      'operational_reviews_payment_review_idx',
      'payment_attempts_reconciliation_eligible_idx',
      'payment_provider_events_provider_received_idx',
      'payments_property_status_updated_idx',
    ]);
  });
});
