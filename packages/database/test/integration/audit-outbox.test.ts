import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  createMigratedTestDatabase,
  IDS,
  insertCatalogFixture,
  postgresErrorCode,
} from './helpers.js';

describe('audit and transactional outbox invariants', () => {
  let database: GuardedTestDatabase;
  let auditId: string;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
    auditId = randomUUID();
    await database.pool.query(
      `INSERT INTO audit_events
         (id, property_id, aggregate_type, aggregate_id, event_type, actor_type, payload)
       VALUES ($1, $2, 'BOOKING', $3, 'HOLD_CREATED', 'SYSTEM', '{"safe":true}'::jsonb)`,
      [auditId, IDS.property, IDS.booking],
    );
  });

  afterAll(async () => {
    await database.dispose();
  });

  it('rejects UPDATE and DELETE for append-only audit events', async () => {
    const updateError = await database.pool
      .query(`UPDATE audit_events SET event_type = 'CHANGED' WHERE id = $1`, [auditId])
      .catch((error: unknown) => error);
    expect(postgresErrorCode(updateError)).toBe('P0001');

    const deleteError = await database.pool
      .query(`DELETE FROM audit_events WHERE id = $1`, [auditId])
      .catch((error: unknown) => error);
    expect(postgresErrorCode(deleteError)).toBe('P0001');
  });

  it('requires object payloads and consistent outbox publication state', async () => {
    const invalidPayload = await database.pool
      .query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, 'BOOKING', $2, 'BOOKING_CONFIRMED', '[]'::jsonb)`,
        [IDS.property, IDS.booking],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(invalidPayload)).toBe('23514');

    const missingPublishedAt = await database.pool
      .query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload, status)
         VALUES ($1, 'BOOKING', $2, 'BOOKING_CONFIRMED', '{}'::jsonb, 'PUBLISHED')`,
        [IDS.property, IDS.booking],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(missingPublishedAt)).toBe('23514');

    const unexpectedPublishedAt = await database.pool
      .query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload, status, published_at)
         VALUES ($1, 'BOOKING', $2, 'BOOKING_CONFIRMED', '{}'::jsonb,
                 'PENDING', CURRENT_TIMESTAMP)`,
        [IDS.property, IDS.booking],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(unexpectedPublishedAt)).toBe('23514');

    await expect(
      database.pool.query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload, status, published_at)
         VALUES ($1, 'BOOKING', $2, 'BOOKING_CONFIRMED', '{"bookingId":"safe"}'::jsonb,
                 'PUBLISHED', CURRENT_TIMESTAMP)`,
        [IDS.property, IDS.booking],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('rejects negative attempt counts', async () => {
    const error = await database.pool
      .query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload, attempt_count)
         VALUES ($1, 'BOOKING', $2, 'BOOKING_CONFIRMED', '{}'::jsonb, -1)`,
        [IDS.property, IDS.booking],
      )
      .catch((cause: unknown) => cause);
    expect(postgresErrorCode(error)).toBe('23514');
  });
});
