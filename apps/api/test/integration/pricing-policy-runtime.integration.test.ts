import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import { PricingPolicyEventWriter } from '../../src/pricing-policy/pricing-policy.events.js';
import { OperationsV3PricingCatalogGate } from '../../src/pricing-policy/pricing-policy.gate.js';
import { PublishedPricingPolicyLookupService } from '../../src/pricing-policy/pricing-policy.lookup.service.js';
import { PricingPolicyRepository } from '../../src/pricing-policy/pricing-policy.repository.js';
import { PricingPolicyService } from '../../src/pricing-policy/pricing-policy.service.js';

const ids = {
  property: '00000000-0000-4000-8000-000000009101',
  tier: '00000000-0000-4000-8000-000000009201',
  admin: '00000000-0000-4000-8000-000000009901',
};

const actor = {
  userId: ids.admin,
  requestId: 'request-pricing-policy-integration',
  correlationId: 'correlation-pricing-policy-integration',
};

interface PolicyVersionDbRow {
  readonly id: string;
  readonly status: string;
  readonly effective_until: string | null;
}

interface AuditDbRow {
  readonly request_id: string | null;
}

interface OutboxDbRow {
  readonly status: string;
}

describe('Operations V3 internal pricing-policy runtime', () => {
  let database: GuardedTestDatabase;
  let client: DatabaseClient;
  let repository: PricingPolicyRepository;
  let service: PricingPolicyService;
  let lookup: PublishedPricingPolicyLookupService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined)
      throw new Error('TEST_DATABASE_URL is required for pricing policy integration tests');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    client = createDatabaseClient(database.pool);
    repository = new PricingPolicyRepository(client);
    service = new PricingPolicyService(
      client as unknown as {
        transaction<T>(operation: (transaction: unknown) => Promise<T>): Promise<T>;
      },
      repository,
      new PricingPolicyEventWriter(),
    );
    lookup = new PublishedPricingPolicyLookupService(
      new OperationsV3PricingCatalogGate(true),
      repository,
    );
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
       VALUES ($1, 'B02_POLICY_PROPERTY', 'B0.2 Policy Property', 'Asia/Ho_Chi_Minh')`,
      [ids.property],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
       VALUES ($1, $2, 'B02_STANDARD', 'B0.2 standard', 1)`,
      [ids.tier, ids.property],
    );
    await database.pool.query(
      `INSERT INTO users (id, email, name, role)
       VALUES ($1, 'b02-operations-admin@example.test', 'B0.2 Operations Admin', 'ADMIN')`,
      [ids.admin],
    );
  }, 120_000);

  afterAll(async () => {
    await database?.dispose();
  }, 30_000);

  async function addSimpleComponent(
    policyId: string,
    amount: bigint,
    effectiveUntil: Date | null = null,
  ): Promise<void> {
    const draft = await repository.getAggregate(undefined, policyId);
    if (draft === undefined) throw new Error('expected draft');
    const componentId = randomUUID();
    await service.updateDraft(actor, policyId, {
      internalName: draft.root.internalName,
      effectiveFrom: draft.root.effectiveFrom,
      effectiveUntil: effectiveUntil ?? draft.root.effectiveUntil,
      maximumComponentLines: draft.root.maximumComponentLines,
      changeNote: draft.root.changeNote,
      components: [
        {
          id: componentId,
          policyVersionId: policyId,
          componentCode: 'BASE_STAY',
          componentKind: 'BASE_STAY',
          coverageModel: 'FIXED_ELAPSED',
          billingModel: 'FIXED_OCCURRENCE',
          fixedDurationMinutes: 1440,
          localStartMinuteInclusive: null,
          localEndMinuteExclusive: null,
          localEndDayOffset: null,
          boundaryPosition: null,
          boundaryMinDurationMinutes: null,
          boundaryMaxDurationMinutes: null,
          billingUnitMinutes: null,
          minimumBillingUnits: null,
          maximumBillingUnits: null,
          maximumOccurrencesPerCandidate: 1,
          conditionComplexityRank: 0,
          tieBreakRank: 0,
          restrictionMetadata: {},
          displayMetadata: {},
          legacyProvenance: null,
        },
      ],
      prices: [
        {
          id: randomUUID(),
          propertyId: ids.property,
          policyVersionId: policyId,
          componentId,
          priceTierId: ids.tier,
          amountVnd: amount,
        },
      ],
      edges: [],
    });
  }

  it('creates, previews, publishes, and resolves one complete policy aggregate', async () => {
    const created = await service.createDraft(actor, {
      internalName: 'B0.2 initial policy',
      effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
    });
    await addSimpleComponent(created.policyId, 350000n);

    await expect(service.preview(created.policyId)).resolves.toMatchObject({
      publicationReady: true,
    });
    const published = await service.publishInitial(actor, created.policyId);
    expect(published.status).toBe('PUBLISHED');

    await expect(
      lookup.resolve(ids.property, 'STAY_START', new Date('2026-12-31T23:59:59.000Z')),
    ).resolves.toMatchObject({ kind: 'NOT_CONFIGURED' });
    const resolved = await lookup.resolve(
      ids.property,
      'STAY_START',
      new Date('2027-01-01T00:00:00.000Z'),
    );
    expect(resolved.kind).toBe('FOUND');
    if (resolved.kind === 'FOUND') {
      expect(resolved.policy.root.status).toBe('PUBLISHED');
      expect(resolved.policy.components).toHaveLength(1);
      expect(resolved.policy.prices[0]?.amountVnd).toBe(350000n);
    }
  });

  it('serializes concurrent version allocation on the property row', async () => {
    const [first, second] = await Promise.all([
      service.createDraft(actor, {
        internalName: 'Concurrent draft A',
        effectiveFrom: new Date('2030-01-01T00:00:00.000Z'),
      }),
      service.createDraft(actor, {
        internalName: 'Concurrent draft B',
        effectiveFrom: new Date('2030-01-02T00:00:00.000Z'),
      }),
    ]);

    expect(new Set([first.versionNumber, second.versionNumber])).toEqual(new Set([2n, 3n]));
  });

  it('atomically supersedes the predecessor and keeps lookup boundary semantics', async () => {
    const predecessor = await repository.getLineage(undefined, ids.property);
    const predecessorPolicy = predecessor[0];
    if (predecessorPolicy === undefined) throw new Error('expected initial published policy');
    const successor = await service.createDraft(actor, {
      internalName: 'B0.2 successor policy',
      effectiveFrom: new Date('2028-01-01T00:00:00.000Z'),
    });
    await addSimpleComponent(successor.policyId, 375000n);
    const cutover = new Date('2028-01-01T00:00:00.000Z');

    await expect(
      service.scheduleSupersession(actor, predecessorPolicy.id, successor.policyId, cutover),
    ).resolves.toMatchObject({ status: 'PUBLISHED' });
    await expect(
      lookup.resolve(ids.property, 'STAY_START', new Date('2027-12-31T23:59:59.000Z')),
    ).resolves.toMatchObject({ kind: 'FOUND' });
    const atCutover = await lookup.resolve(ids.property, 'STAY_START', cutover);
    expect(atCutover.kind).toBe('FOUND');
    if (atCutover.kind === 'FOUND') expect(atCutover.policy.root.id).toBe(successor.policyId);
    const rows = await database.pool.query<PolicyVersionDbRow>(
      `SELECT id, status, effective_from, effective_until
       FROM pricing_policy_versions WHERE property_id = $1 ORDER BY version_number`,
      [ids.property],
    );
    const publishedRows = rows.rows.filter((row) => row.status === 'PUBLISHED');
    expect(publishedRows).toHaveLength(2);
    const predecessorRow = publishedRows.find((row) => row.id === predecessorPolicy.id);
    const successorRow = publishedRows.find((row) => row.id === successor.policyId);
    if (predecessorRow === undefined || predecessorRow.effective_until === null)
      throw new Error('expected predecessor closure');
    if (successorRow === undefined) throw new Error('expected published successor');
    expect(new Date(predecessorRow.effective_until).toISOString()).toBe(cutover.toISOString());
  });

  it('keeps audit and outbox entries transactional and rejects published cancellation', async () => {
    const result = await database.pool.query<AuditDbRow>(
      `SELECT event_type, payload->>'requestId' AS request_id
       FROM audit_events WHERE property_id = $1 AND aggregate_type = 'PRICING_POLICY'
       ORDER BY occurred_at`,
      [ids.property],
    );
    const outbox = await database.pool.query<OutboxDbRow>(
      `SELECT event_type, status FROM outbox_events
       WHERE property_id = $1 AND aggregate_type = 'PRICING_POLICY'
       ORDER BY created_at`,
      [ids.property],
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    expect(result.rows.every((row) => row.request_id === actor.requestId)).toBe(true);
    expect(outbox.rows.length).toBe(result.rows.length);
    expect(outbox.rows.every((row) => row.status === 'PENDING')).toBe(true);

    const published = await repository.getLineage(undefined, ids.property);
    const publishedPolicy = published[0];
    if (publishedPolicy === undefined) throw new Error('expected published policy');
    await expect(service.cancelDraft(actor, publishedPolicy.id, 'must fail')).rejects.toMatchObject(
      {
        code: 'PUBLISHED_CANCELLATION_FORBIDDEN',
      },
    );
  });
});
