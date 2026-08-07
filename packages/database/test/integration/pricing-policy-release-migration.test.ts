import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';

import { createMigratedTestDatabase } from './helpers.js';
import type { GuardedTestDatabase } from '../../src/testing.js';

const RULE_SCHEMA_VERSION = 'operations-v3-b0.2-policy-v1';

interface CatalogContext {
  readonly propertyId: string;
  readonly otherPropertyId: string;
  readonly tierId: string;
  readonly otherTierId: string;
  readonly actorId: string;
}

interface PolicyOptions {
  readonly id?: string;
  readonly propertyId?: string;
  readonly versionNumber?: number;
  readonly internalName?: string;
  readonly status?: 'DRAFT' | 'PUBLISHED' | 'RETIRED' | 'CANCELLED';
  readonly applicabilityBasis?: 'QUOTE_INSTANT' | 'STAY_START';
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string | null;
  readonly createdBy?: string;
  readonly publishedBy?: string | null;
  readonly publishedAt?: string | null;
  readonly retiredBy?: string | null;
  readonly retiredAt?: string | null;
  readonly cancelledBy?: string | null;
  readonly cancelledAt?: string | null;
  readonly cancellationReason?: string | null;
}

interface ComponentOptions {
  readonly id?: string;
  readonly policyId: string;
  readonly componentCode?: string;
  readonly componentKind?: 'BASE_STAY' | 'EXTENSION';
  readonly coverageModel?: 'FIXED_ELAPSED' | 'LOCAL_CLOCK_WINDOW' | 'REQUEST_BOUNDARY';
  readonly billingModel?: 'FIXED_OCCURRENCE' | 'STARTED_UNIT';
  readonly fixedDurationMinutes?: number | null;
  readonly localStartMinute?: number | null;
  readonly localEndMinute?: number | null;
  readonly localEndDayOffset?: number | null;
  readonly boundaryPosition?: 'LEADING' | 'TRAILING' | null;
  readonly boundaryMinMinutes?: number | null;
  readonly boundaryMaxMinutes?: number | null;
  readonly billingUnitMinutes?: number | null;
  readonly minimumBillingUnits?: number | null;
  readonly maximumBillingUnits?: number | null;
  readonly maximumOccurrences?: number;
}

function uuid(): string {
  return randomUUID();
}

function policyId(): string {
  return uuid();
}

async function createCatalogContext(pool: Pool): Promise<CatalogContext> {
  const propertyId = uuid();
  const otherPropertyId = uuid();
  const tierId = uuid();
  const otherTierId = uuid();
  const actorId = uuid();

  await pool.query(
    `INSERT INTO users (id, name, email, role)
     VALUES ($1, 'Policy actor', $2, 'ADMIN')`,
    [actorId, `${actorId}@example.test`],
  );
  await pool.query(
    `INSERT INTO properties (id, code, name, timezone)
     VALUES ($1, $2, 'Policy property', 'Asia/Ho_Chi_Minh'),
            ($3, $4, 'Other policy property', 'Asia/Ho_Chi_Minh')`,
    [
      propertyId,
      `POLICY_${propertyId.slice(0, 8)}`,
      otherPropertyId,
      `OTHER_${otherPropertyId.slice(0, 8)}`,
    ],
  );
  await pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name)
     VALUES ($1, $2, 'STANDARD', 'Standard'),
            ($3, $4, 'DELUXE', 'Deluxe')`,
    [tierId, propertyId, otherTierId, otherPropertyId],
  );

  return { propertyId, otherPropertyId, tierId, otherTierId, actorId };
}

async function insertPolicy(
  pool: Pool,
  context: CatalogContext,
  options: PolicyOptions = {},
): Promise<string> {
  const id = options.id ?? policyId();
  const status = options.status ?? 'DRAFT';
  const published = status === 'PUBLISHED' || status === 'RETIRED';
  const retired = status === 'RETIRED';
  const cancelled = status === 'CANCELLED';
  const effectiveFrom = options.effectiveFrom ?? '2028-01-01T00:00:00.000Z';

  await pool.query(
    `INSERT INTO pricing_policy_versions
       (id, property_id, version_number, internal_name, status,
        applicability_basis, effective_from, effective_until, timezone_snapshot,
        rule_schema_version, maximum_component_lines, created_by,
        published_by, published_at, retired_by, retired_at,
        cancelled_by, cancelled_at, cancellation_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Asia/Ho_Chi_Minh', $9, 64, $10,
             $11, $12, $13, $14, $15, $16, $17)`,
    [
      id,
      options.propertyId ?? context.propertyId,
      options.versionNumber ?? 1,
      options.internalName ?? `Policy ${id.slice(0, 8)}`,
      status,
      options.applicabilityBasis ?? 'QUOTE_INSTANT',
      effectiveFrom,
      options.effectiveUntil ?? null,
      RULE_SCHEMA_VERSION,
      options.createdBy ?? context.actorId,
      published ? (options.publishedBy ?? context.actorId) : null,
      published ? (options.publishedAt ?? '2027-01-01T00:00:00.000Z') : null,
      retired ? (options.retiredBy ?? context.actorId) : null,
      retired ? (options.retiredAt ?? '2029-01-01T00:00:00.000Z') : null,
      cancelled ? (options.cancelledBy ?? context.actorId) : null,
      cancelled ? (options.cancelledAt ?? '2027-01-01T00:00:00.000Z') : null,
      cancelled ? (options.cancellationReason ?? 'Draft abandoned') : null,
    ],
  );
  return id;
}

async function insertComponent(pool: Pool, options: ComponentOptions): Promise<string> {
  const id = options.id ?? uuid();
  const coverageModel = options.coverageModel ?? 'FIXED_ELAPSED';
  const billingModel = options.billingModel ?? 'FIXED_OCCURRENCE';
  await pool.query(
    `INSERT INTO pricing_policy_components
       (id, policy_version_id, component_code, component_kind, coverage_model,
        billing_model, fixed_duration_minutes, local_start_minute_inclusive,
        local_end_minute_exclusive, local_end_day_offset, boundary_position,
        boundary_min_duration_minutes, boundary_max_duration_minutes,
        billing_unit_minutes, minimum_billing_units, maximum_billing_units,
        maximum_occurrences_per_candidate, condition_complexity_rank,
        tie_break_rank, restriction_metadata, display_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
             $14, $15, $16, $17, 0, 0, '{}'::jsonb, '{}'::jsonb)`,
    [
      id,
      options.policyId,
      options.componentCode ?? `COMPONENT_${id.slice(0, 8).toUpperCase()}`,
      options.componentKind ?? 'BASE_STAY',
      coverageModel,
      billingModel,
      options.fixedDurationMinutes ?? (coverageModel === 'FIXED_ELAPSED' ? 1440 : null),
      options.localStartMinute ?? null,
      options.localEndMinute ?? null,
      options.localEndDayOffset ?? null,
      options.boundaryPosition ?? null,
      options.boundaryMinMinutes ?? null,
      options.boundaryMaxMinutes ?? null,
      options.billingUnitMinutes ?? null,
      options.minimumBillingUnits ?? null,
      options.maximumBillingUnits ?? null,
      options.maximumOccurrences ?? 1,
    ],
  );
  return id;
}

async function insertPrice(
  pool: Pool,
  context: CatalogContext,
  policyIdValue: string,
  componentId: string,
  options: {
    readonly propertyId?: string;
    readonly tierId?: string;
    readonly amount?: number;
  } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO pricing_policy_component_prices
       (id, policy_version_id, component_id, property_id, price_tier_id, amount_vnd)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      uuid(),
      policyIdValue,
      componentId,
      options.propertyId ?? context.propertyId,
      options.tierId ?? context.tierId,
      options.amount ?? 100000,
    ],
  );
}

async function insertEdge(
  pool: Pool,
  policyIdValue: string,
  predecessorId: string,
  successorId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO pricing_policy_component_edges
       (id, policy_version_id, predecessor_component_id, successor_component_id)
     VALUES ($1, $2, $3, $4)`,
    [uuid(), policyIdValue, predecessorId, successorId],
  );
}

async function selectPolicy(pool: Pool, propertyId: string, instant: string): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
       FROM pricing_policy_versions
      WHERE property_id = $1
        AND status = 'PUBLISHED'
        AND applicability_basis = 'QUOTE_INSTANT'
        AND effective_from <= $2::timestamptz
        AND (effective_until IS NULL OR $2::timestamptz < effective_until)
      ORDER BY effective_from DESC, id`,
    [propertyId, instant],
  );
  return result.rows.map((row) => row.id);
}

describe('Operations V3 pricing policy release migration', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database?.dispose();
  });

  it('creates the four empty policy tables and release enums without catalog rows', async () => {
    const tables = await database.pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE 'pricing_policy_%'
        ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      'pricing_policy_component_edges',
      'pricing_policy_component_prices',
      'pricing_policy_components',
      'pricing_policy_versions',
    ]);
    const counts = await database.pool.query<{ table_name: string; count: string }>(
      `SELECT table_name, row_count::text AS count
         FROM (
           SELECT 'pricing_policy_component_edges' AS table_name, count(*) AS row_count
             FROM pricing_policy_component_edges
           UNION ALL
           SELECT 'pricing_policy_component_prices', count(*) FROM pricing_policy_component_prices
           UNION ALL
           SELECT 'pricing_policy_components', count(*) FROM pricing_policy_components
           UNION ALL
           SELECT 'pricing_policy_versions', count(*) FROM pricing_policy_versions
         ) counts
        ORDER BY table_name`,
    );
    expect(counts.rows).toEqual([
      { table_name: 'pricing_policy_component_edges', count: '0' },
      { table_name: 'pricing_policy_component_prices', count: '0' },
      { table_name: 'pricing_policy_components', count: '0' },
      { table_name: 'pricing_policy_versions', count: '0' },
    ]);
    await expect(
      database.pool.query(
        `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'pricing_policy_version_status' ORDER BY enumsortorder`,
      ),
    ).resolves.toMatchObject({
      rows: [
        { enumlabel: 'DRAFT' },
        { enumlabel: 'PUBLISHED' },
        { enumlabel: 'RETIRED' },
        { enumlabel: 'CANCELLED' },
      ],
    });
  });

  it('allows a draft to be cancelled and makes cancelled drafts immutable', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await database.pool.query(
      `UPDATE pricing_policy_versions
          SET status = 'CANCELLED', cancelled_by = $2, cancelled_at = now(), cancellation_reason = 'No longer needed'
        WHERE id = $1`,
      [id, context.actorId],
    );
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET internal_name = 'changed' WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('establishes one property basis and rejects a second published basis', async () => {
    const context = await createCatalogContext(database.pool);
    await insertPolicy(database.pool, context, { status: 'PUBLISHED' });
    await expect(
      insertPolicy(database.pool, context, {
        status: 'PUBLISHED',
        versionNumber: 2,
        applicabilityBasis: 'STAY_START',
        effectiveFrom: '2029-01-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'P0001' });
    await expect(
      insertPolicy(database.pool, context, {
        status: 'PUBLISHED',
        propertyId: context.otherPropertyId,
        applicabilityBasis: 'STAY_START',
      }),
    ).resolves.toBeTypeOf('string');
  });

  it('keeps a future successor published but not selectable before cutover', async () => {
    const context = await createCatalogContext(database.pool);
    const predecessorId = policyId();
    const successorId = policyId();
    const cutover = '2028-06-01T00:00:00.000Z';
    await database.pool.query('BEGIN');
    try {
      await insertPolicy(database.pool, context, {
        id: predecessorId,
        status: 'PUBLISHED',
        effectiveFrom: '2028-01-01T00:00:00.000Z',
      });
      await insertPolicy(database.pool, context, {
        id: successorId,
        status: 'PUBLISHED',
        versionNumber: 2,
        effectiveFrom: cutover,
        effectiveUntil: '2029-01-01T00:00:00.000Z',
      });
      await database.pool.query(
        `UPDATE pricing_policy_versions SET effective_until = $2 WHERE id = $1`,
        [predecessorId, cutover],
      );
      await database.pool.query('COMMIT');
    } catch (error) {
      await database.pool.query('ROLLBACK');
      throw error;
    }

    await expect(
      database.pool.query<{ status: string }>(
        `SELECT status FROM pricing_policy_versions WHERE id = $1`,
        [successorId],
      ),
    ).resolves.toMatchObject({ rows: [{ status: 'PUBLISHED' }] });
    await expect(
      selectPolicy(database.pool, context.propertyId, '2028-05-31T23:59:59.999Z'),
    ).resolves.toEqual([predecessorId]);
    await expect(selectPolicy(database.pool, context.propertyId, cutover)).resolves.toEqual([
      successorId,
    ]);
    await expect(
      selectPolicy(database.pool, context.propertyId, '2029-01-01T00:00:00.000Z'),
    ).resolves.toEqual([]);
  });

  it('rejects standalone closure and preserves the old open-ended policy', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context, { status: 'PUBLISHED' });
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET effective_until = '2028-06-01T00:00:00.000Z' WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
    await expect(
      database.pool.query<{ effective_until: Date | null }>(
        `SELECT effective_until FROM pricing_policy_versions WHERE id = $1`,
        [id],
      ),
    ).resolves.toMatchObject({ rows: [{ effective_until: null }] });
  });

  it('permits retirement only after the published interval ends and rejects scheduled cancellation', async () => {
    const context = await createCatalogContext(database.pool);
    const endedId = await insertPolicy(database.pool, context, {
      status: 'PUBLISHED',
      effectiveFrom: '2020-01-01T00:00:00.000Z',
      effectiveUntil: '2020-02-01T00:00:00.000Z',
    });
    await database.pool.query(
      `UPDATE pricing_policy_versions SET status = 'RETIRED', retired_by = $2, retired_at = now() WHERE id = $1`,
      [endedId, context.actorId],
    );
    const futureId = await insertPolicy(database.pool, context, {
      status: 'PUBLISHED',
      versionNumber: 2,
      effectiveFrom: '2029-01-01T00:00:00.000Z',
    });
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET status = 'CANCELLED', cancelled_by = $2, cancelled_at = now(), cancellation_reason = 'defer'
          WHERE id = $1`,
        [futureId, context.actorId],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('freezes published root and child commercial rows', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const componentId = await insertComponent(database.pool, { policyId: id });
    await insertPrice(database.pool, context, id, componentId);
    await database.pool.query(
      `UPDATE pricing_policy_versions SET status = 'PUBLISHED', published_by = $2, published_at = now() WHERE id = $1`,
      [id, context.actorId],
    );
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET internal_name = 'mutated' WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_components SET component_code = 'MUTATED' WHERE id = $1`,
        [componentId],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
    await expect(
      database.pool.query(
        `DELETE FROM pricing_policy_component_prices WHERE policy_version_id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('enforces component coverage and billing field shapes', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        coverageModel: 'REQUEST_BOUNDARY',
        boundaryPosition: 'LEADING',
        boundaryMinMinutes: 15,
        boundaryMaxMinutes: 30,
        maximumOccurrences: 2,
      }),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        billingModel: 'FIXED_OCCURRENCE',
        billingUnitMinutes: 15,
      }),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        billingModel: 'STARTED_UNIT',
        billingUnitMinutes: 15,
        minimumBillingUnits: 3,
        maximumBillingUnits: 2,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects boundary self-edges and accepts only bounded non-boundary repeats', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const oneOccurrence = await insertComponent(database.pool, { policyId: id });
    await expect(insertEdge(database.pool, id, oneOccurrence, oneOccurrence)).rejects.toMatchObject(
      { code: 'P0001' },
    );
    const leading = await insertComponent(database.pool, {
      policyId: id,
      componentKind: 'EXTENSION',
      coverageModel: 'REQUEST_BOUNDARY',
      boundaryPosition: 'LEADING',
      boundaryMinMinutes: 15,
      boundaryMaxMinutes: 60,
    });
    await expect(insertEdge(database.pool, id, leading, leading)).rejects.toMatchObject({
      code: 'P0001',
    });
    const repeated = await insertComponent(database.pool, { policyId: id, maximumOccurrences: 2 });
    await expect(insertEdge(database.pool, id, repeated, repeated)).resolves.toBeUndefined();
  });

  it('enforces composite price ownership and per-tier uniqueness', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const componentId = await insertComponent(database.pool, { policyId: id });
    await insertPrice(database.pool, context, id, componentId);
    await expect(insertPrice(database.pool, context, id, componentId)).rejects.toMatchObject({
      code: '23505',
    });
    const otherPolicyId = await insertPolicy(database.pool, context, { versionNumber: 2 });
    await expect(
      insertPrice(database.pool, context, otherPolicyId, componentId),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      insertPrice(database.pool, context, id, componentId, {
        propertyId: context.otherPropertyId,
        tierId: context.otherTierId,
      }),
    ).rejects.toMatchObject({ code: '23503' });
    const otherPolicyComponentId = await insertComponent(database.pool, {
      policyId: otherPolicyId,
    });
    await expect(
      insertEdge(database.pool, id, componentId, otherPolicyComponentId),
    ).rejects.toMatchObject({
      code: 'P0001',
    });
  });

  it('rejects duplicate per-property version numbers', async () => {
    const context = await createCatalogContext(database.pool);
    await insertPolicy(database.pool, context, { versionNumber: 1 });
    await expect(insertPolicy(database.pool, context, { versionNumber: 1 })).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('keeps draft defaults explicit and positive', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      database.pool.query(
        `SELECT status, applicability_basis, maximum_component_lines
           FROM pricing_policy_versions WHERE id = $1`,
        [id],
      ),
    ).resolves.toMatchObject({
      rows: [
        { status: 'DRAFT', applicability_basis: 'QUOTE_INSTANT', maximum_component_lines: 64 },
      ],
    });
    await expect(insertPolicy(database.pool, context, { versionNumber: 0 })).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('rejects an invalid policy rule schema version', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET rule_schema_version = 'legacy' WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects an invalid component line limit', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET maximum_component_lines = 0 WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('requires status metadata for publication', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      database.pool.query(`UPDATE pricing_policy_versions SET status = 'PUBLISHED' WHERE id = $1`, [
        id,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('permits the controlled draft to published transition', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions
            SET status = 'PUBLISHED', published_by = $2, published_at = now()
          WHERE id = $1`,
        [id, context.actorId],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('rejects draft to retired without a published interval', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions
            SET status = 'RETIRED', published_by = $2, published_at = now(), retired_by = $2, retired_at = now()
          WHERE id = $1`,
        [id, context.actorId],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects overlapping published periods for one property', async () => {
    const context = await createCatalogContext(database.pool);
    await insertPolicy(database.pool, context, {
      status: 'PUBLISHED',
      effectiveFrom: '2028-01-01T00:00:00.000Z',
      effectiveUntil: '2028-06-01T00:00:00.000Z',
    });
    await expect(
      insertPolicy(database.pool, context, {
        status: 'PUBLISHED',
        versionNumber: 2,
        effectiveFrom: '2028-05-31T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('allows half-open published periods to touch at a cutover', async () => {
    const context = await createCatalogContext(database.pool);
    await insertPolicy(database.pool, context, {
      status: 'PUBLISHED',
      effectiveFrom: '2028-01-01T00:00:00.000Z',
      effectiveUntil: '2028-06-01T00:00:00.000Z',
    });
    await expect(
      insertPolicy(database.pool, context, {
        status: 'PUBLISHED',
        versionNumber: 2,
        effectiveFrom: '2028-06-01T00:00:00.000Z',
      }),
    ).resolves.toBeTypeOf('string');
  });

  it('allows the same published interval on another property', async () => {
    const context = await createCatalogContext(database.pool);
    await insertPolicy(database.pool, context, { status: 'PUBLISHED' });
    await expect(
      insertPolicy(database.pool, context, {
        propertyId: context.otherPropertyId,
        status: 'PUBLISHED',
        applicabilityBasis: 'STAY_START',
      }),
    ).resolves.toBeTypeOf('string');
  });

  it('keeps the property basis through retirement', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context, {
      status: 'PUBLISHED',
      effectiveFrom: '2020-01-01T00:00:00.000Z',
      effectiveUntil: '2020-02-01T00:00:00.000Z',
    });
    await database.pool.query(
      `UPDATE pricing_policy_versions SET status = 'RETIRED', retired_by = $2, retired_at = now() WHERE id = $1`,
      [id, context.actorId],
    );
    await expect(
      insertPolicy(database.pool, context, {
        status: 'PUBLISHED',
        versionNumber: 2,
        applicabilityBasis: 'STAY_START',
        effectiveFrom: '2029-01-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects extending an already published effective interval', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context, {
      status: 'PUBLISHED',
      effectiveUntil: '2028-06-01T00:00:00.000Z',
    });
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET effective_until = '2028-07-01T00:00:00.000Z' WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects a published closure in the past', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context, { status: 'PUBLISHED' });
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET effective_until = '2026-01-01T00:00:00.000Z' WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects premature retirement of a future published period', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context, { status: 'PUBLISHED' });
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_versions SET status = 'RETIRED', retired_by = $2, retired_at = now() WHERE id = $1`,
        [id, context.actorId],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rejects children under a cancelled draft', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await database.pool.query(
      `UPDATE pricing_policy_versions
          SET status = 'CANCELLED', cancelled_by = $2, cancelled_at = now(), cancellation_reason = 'abandoned'
        WHERE id = $1`,
      [id, context.actorId],
    );
    await expect(insertComponent(database.pool, { policyId: id })).rejects.toMatchObject({
      code: 'P0001',
    });
  });

  it('rejects root deletion', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      database.pool.query(`DELETE FROM pricing_policy_versions WHERE id = $1`, [id]),
    ).rejects.toMatchObject({
      code: 'P0001',
    });
  });

  it('rejects lower-case component codes', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, { policyId: id, componentCode: 'lowercase' }),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('requires fixed elapsed durations to use fifteen-minute units', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, { policyId: id, fixedDurationMinutes: 20 }),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('rejects an invalid local clock order', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        coverageModel: 'LOCAL_CLOCK_WINDOW',
        localStartMinute: 600,
        localEndMinute: 540,
        localEndDayOffset: 0,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts a local clock window that crosses midnight explicitly', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        coverageModel: 'LOCAL_CLOCK_WINDOW',
        localStartMinute: 1380,
        localEndMinute: 120,
        localEndDayOffset: 1,
      }),
    ).resolves.toBeTypeOf('string');
  });

  it('rejects inverted request-boundary duration bounds', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        coverageModel: 'REQUEST_BOUNDARY',
        boundaryPosition: 'LEADING',
        boundaryMinMinutes: 60,
        boundaryMaxMinutes: 30,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts started-unit billing with ordered positive bounds', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        billingModel: 'STARTED_UNIT',
        billingUnitMinutes: 30,
        minimumBillingUnits: 2,
        maximumBillingUnits: 4,
      }),
    ).resolves.toBeTypeOf('string');
  });

  it('requires a billing unit for started-unit billing', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, {
        policyId: id,
        billingModel: 'STARTED_UNIT',
        minimumBillingUnits: 1,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('bounds maximum component occurrences', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await expect(
      insertComponent(database.pool, { policyId: id, maximumOccurrences: 65 }),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('requires object metadata on components', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const componentId = await insertComponent(database.pool, { policyId: id });
    await expect(
      database.pool.query(
        `UPDATE pricing_policy_components SET restriction_metadata = '[]'::jsonb WHERE id = $1`,
        [componentId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('enforces unique component codes within one policy', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    await insertComponent(database.pool, { policyId: id, componentCode: 'DUPLICATE' });
    await expect(
      insertComponent(database.pool, { policyId: id, componentCode: 'DUPLICATE' }),
    ).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('rejects incoming edges to a leading boundary component', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const predecessor = await insertComponent(database.pool, { policyId: id });
    const leading = await insertComponent(database.pool, {
      policyId: id,
      componentKind: 'EXTENSION',
      coverageModel: 'REQUEST_BOUNDARY',
      boundaryPosition: 'LEADING',
      boundaryMinMinutes: 15,
      boundaryMaxMinutes: 60,
    });
    await expect(insertEdge(database.pool, id, predecessor, leading)).rejects.toMatchObject({
      code: 'P0001',
    });
  });

  it('rejects outgoing edges from a trailing boundary component', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const trailing = await insertComponent(database.pool, {
      policyId: id,
      componentKind: 'EXTENSION',
      coverageModel: 'REQUEST_BOUNDARY',
      boundaryPosition: 'TRAILING',
      boundaryMinMinutes: 15,
      boundaryMaxMinutes: 60,
    });
    const successor = await insertComponent(database.pool, { policyId: id });
    await expect(insertEdge(database.pool, id, trailing, successor)).rejects.toMatchObject({
      code: 'P0001',
    });
  });

  it('rejects non-positive component prices', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const componentId = await insertComponent(database.pool, { policyId: id });
    await expect(
      insertPrice(database.pool, context, id, componentId, { amount: 0 }),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('enforces unique directed component edges', async () => {
    const context = await createCatalogContext(database.pool);
    const id = await insertPolicy(database.pool, context);
    const predecessor = await insertComponent(database.pool, {
      policyId: id,
      maximumOccurrences: 2,
    });
    const successor = await insertComponent(database.pool, { policyId: id });
    await insertEdge(database.pool, id, predecessor, successor);
    await expect(insertEdge(database.pool, id, predecessor, successor)).rejects.toMatchObject({
      code: '23505',
    });
  });
});

async function publishInTransaction(
  pool: Pool,
  policyIdValue: string,
  actorId: string,
): Promise<{ readonly ok: boolean; readonly code: string | undefined }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE pricing_policy_versions
          SET status = 'PUBLISHED', published_by = $2, published_at = now()
        WHERE id = $1`,
      [policyIdValue, actorId],
    );
    await client.query('COMMIT');
    return { ok: true, code: undefined };
  } catch (error) {
    await client.query('ROLLBACK');
    return {
      ok: false,
      code:
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { readonly code: unknown }).code)
          : undefined,
    };
  } finally {
    client.release();
  }
}

describe('Operations V3 pricing policy concurrency invariants', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database?.dispose();
  });

  it('serializes the first published basis for one property', async () => {
    const context = await createCatalogContext(database.pool);
    const first = await insertPolicy(database.pool, context, {
      applicabilityBasis: 'QUOTE_INSTANT',
    });
    const second = await insertPolicy(database.pool, context, {
      versionNumber: 2,
      applicabilityBasis: 'STAY_START',
      effectiveFrom: '2029-01-01T00:00:00.000Z',
    });
    const outcomes = await Promise.all([
      publishInTransaction(database.pool, first, context.actorId),
      publishInTransaction(database.pool, second, context.actorId),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toHaveLength(1);
    expect(outcomes.find((outcome) => !outcome.ok)?.code).toBe('P0001');
  });

  it('allows concurrent publication of non-overlapping periods with one basis', async () => {
    const context = await createCatalogContext(database.pool);
    const first = await insertPolicy(database.pool, context, {
      effectiveFrom: '2028-01-01T00:00:00.000Z',
      effectiveUntil: '2028-06-01T00:00:00.000Z',
    });
    const second = await insertPolicy(database.pool, context, {
      versionNumber: 2,
      effectiveFrom: '2028-06-01T00:00:00.000Z',
    });
    const outcomes = await Promise.all([
      publishInTransaction(database.pool, first, context.actorId),
      publishInTransaction(database.pool, second, context.actorId),
    ]);
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
  });

  it('rejects one of two concurrent overlapping publications', async () => {
    const context = await createCatalogContext(database.pool);
    const first = await insertPolicy(database.pool, context, {
      effectiveFrom: '2028-01-01T00:00:00.000Z',
    });
    const second = await insertPolicy(database.pool, context, {
      versionNumber: 2,
      effectiveFrom: '2028-06-01T00:00:00.000Z',
    });
    const outcomes = await Promise.all([
      publishInTransaction(database.pool, first, context.actorId),
      publishInTransaction(database.pool, second, context.actorId),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.find((outcome) => !outcome.ok)?.code).toBe('23P01');
  });

  it('does not serialize unrelated properties onto one basis lock', async () => {
    const context = await createCatalogContext(database.pool);
    const first = await insertPolicy(database.pool, context, {
      applicabilityBasis: 'QUOTE_INSTANT',
    });
    const second = await insertPolicy(database.pool, context, {
      propertyId: context.otherPropertyId,
      applicabilityBasis: 'STAY_START',
    });
    const outcomes = await Promise.all([
      publishInTransaction(database.pool, first, context.actorId),
      publishInTransaction(database.pool, second, context.actorId),
    ]);
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
  });

  it('keeps concurrent exact-cutover scheduling atomic', async () => {
    const context = await createCatalogContext(database.pool);
    const predecessorId = await insertPolicy(database.pool, context, {
      status: 'PUBLISHED',
      effectiveFrom: '2028-01-01T00:00:00.000Z',
    });
    const firstSuccessorId = await insertPolicy(database.pool, context, {
      versionNumber: 2,
      effectiveFrom: '2028-06-01T00:00:00.000Z',
    });
    const secondSuccessorId = await insertPolicy(database.pool, context, {
      versionNumber: 3,
      effectiveFrom: '2028-06-01T00:00:00.000Z',
    });
    const schedule = async (
      successorId: string,
    ): Promise<{ readonly ok: boolean; readonly code: string | undefined }> => {
      const client = await database.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE pricing_policy_versions
              SET status = 'PUBLISHED', published_by = $2, published_at = now()
            WHERE id = $1`,
          [successorId, context.actorId],
        );
        await client.query(
          `UPDATE pricing_policy_versions SET effective_until = '2028-06-01T00:00:00.000Z' WHERE id = $1`,
          [predecessorId],
        );
        await client.query('COMMIT');
        return { ok: true, code: undefined };
      } catch (error) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          code:
            typeof error === 'object' && error !== null && 'code' in error
              ? String((error as { readonly code: unknown }).code)
              : undefined,
        };
      } finally {
        client.release();
      }
    };
    const outcomes = await Promise.all([schedule(firstSuccessorId), schedule(secondSuccessorId)]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.find((outcome) => !outcome.ok)?.code).toBe('23P01');
  });
});
