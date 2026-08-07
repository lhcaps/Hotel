import { describe, expect, it, vi } from 'vitest';

import {
  PRICING_POLICY_RULE_SCHEMA_VERSION,
  type DraftPricingPolicyAggregate,
} from '../src/pricing-policy/pricing-policy.domain.js';
import { PricingPolicyConflictError } from '../src/pricing-policy/pricing-policy.errors.js';
import { PricingPolicyEventWriter } from '../src/pricing-policy/pricing-policy.events.js';
import { PricingPolicyRepository } from '../src/pricing-policy/pricing-policy.repository.js';
import {
  PricingPolicyService,
  type PricingPolicyTransactionManager,
} from '../src/pricing-policy/pricing-policy.service.js';

const propertyId = '00000000-0000-4000-8000-000000000101';
const actorId = '00000000-0000-4000-8000-000000000901';
const tierId = '00000000-0000-4000-8000-000000000201';
const policyId = '00000000-0000-4000-8000-000000001001';
const componentId = '00000000-0000-4000-8000-000000002001';

const actor = {
  userId: actorId,
  requestId: 'request-operations-v3',
  correlationId: 'correlation-operations-v3',
};

function draftAggregate(
  overrides: Partial<DraftPricingPolicyAggregate['root']> = {},
): DraftPricingPolicyAggregate {
  return {
    root: {
      id: policyId,
      propertyId,
      versionNumber: 1n,
      internalName: 'Policy',
      status: 'DRAFT',
      applicabilityBasis: 'STAY_START',
      effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      ruleSchemaVersion: PRICING_POLICY_RULE_SCHEMA_VERSION,
      maximumComponentLines: 8,
      createdBy: actorId,
      createdAt: new Date('2026-08-07T00:00:00.000Z'),
      updatedAt: new Date('2026-08-07T00:00:00.000Z'),
      changeNote: null,
      legacyProvenance: null,
      ...overrides,
    },
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
        id: '00000000-0000-4000-8000-000000003001',
        propertyId,
        policyVersionId: policyId,
        componentId,
        priceTierId: tierId,
        amountVnd: 350000n,
      },
    ],
    edges: [],
  };
}

function setup(overrides: Record<string, unknown> = {}) {
  const events = {
    write: vi.fn().mockResolvedValue(undefined),
  } as unknown as PricingPolicyEventWriter;
  const repository = {
    getCurrentProperty: vi.fn().mockResolvedValue({ id: propertyId, timezone: 'Asia/Ho_Chi_Minh' }),
    lockProperty: vi.fn().mockResolvedValue(undefined),
    lockPolicy: vi.fn().mockResolvedValue(undefined),
    allocateNextVersion: vi.fn().mockResolvedValue(1n),
    insertDraft: vi.fn().mockResolvedValue(undefined),
    getAggregate: vi.fn().mockResolvedValue(draftAggregate()),
    getHeader: vi.fn().mockResolvedValue({
      id: policyId,
      propertyId,
      status: 'PUBLISHED',
      applicabilityBasis: 'STAY_START',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      versionNumber: 1n,
    }),
    getLineage: vi.fn().mockResolvedValue([]),
    getPriceTierIds: vi.fn().mockResolvedValue(new Set([tierId])),
    updateDraftRoot: vi.fn().mockResolvedValue(undefined),
    replaceDraftContents: vi.fn().mockResolvedValue(undefined),
    publishDraft: vi.fn().mockResolvedValue(undefined),
    closePublished: vi.fn().mockResolvedValue(undefined),
    cancelDraft: vi.fn().mockResolvedValue(undefined),
    retirePublished: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as PricingPolicyRepository;
  const database: PricingPolicyTransactionManager = {
    transaction: async <T>(operation: (transaction: unknown) => Promise<T>) => operation({}),
  };
  return { service: new PricingPolicyService(database, repository, events), repository, events };
}

describe('pricing policy lifecycle service', () => {
  it('allocates a server-owned basis and property timezone when creating a draft', async () => {
    const { service, repository, events } = setup({
      getAggregate: vi.fn().mockResolvedValue(undefined),
    });

    const result = await service.createDraft(actor, {
      internalName: '  New policy  ',
      effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(result.status).toBe('DRAFT');
    expect(repository.insertDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        applicabilityBasis: 'STAY_START',
        timezoneSnapshot: 'Asia/Ho_Chi_Minh',
        internalName: 'New policy',
      }),
    );
    expect(events.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'PRICING_POLICY_DRAFT_CREATED' }),
    );
  });

  it('previews without mutation and publishes only a validated initial release', async () => {
    const { service, repository, events } = setup();

    const preview = await service.preview(policyId);
    expect(preview.publicationReady).toBe(true);
    expect(repository.publishDraft).not.toHaveBeenCalled();
    expect(events.write).not.toHaveBeenCalled();

    await service.publishInitial(actor, policyId);
    expect(repository.publishDraft).toHaveBeenCalledOnce();
    expect(events.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'PRICING_POLICY_PUBLISHED' }),
    );
  });

  it('rejects cancellation of a published policy and premature retirement', async () => {
    const { service } = setup();

    await expect(
      service.cancelDraft(actor, policyId, 'operator correction'),
    ).rejects.toBeInstanceOf(PricingPolicyConflictError);
    await expect(service.retire(actor, policyId)).rejects.toBeInstanceOf(
      PricingPolicyConflictError,
    );
  });

  it('cancels a draft and retires only an ended published interval', async () => {
    const draftSetup = setup({
      getHeader: vi.fn().mockResolvedValue({
        id: policyId,
        propertyId,
        status: 'DRAFT',
        applicabilityBasis: 'STAY_START',
        effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
        effectiveUntil: null,
        versionNumber: 1n,
      }),
    });
    await expect(
      draftSetup.service.cancelDraft(actor, policyId, 'operator correction'),
    ).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(draftSetup.repository.cancelDraft).toHaveBeenCalledOnce();

    const retiredSetup = setup({
      getHeader: vi.fn().mockResolvedValue({
        id: policyId,
        propertyId,
        status: 'PUBLISHED',
        applicabilityBasis: 'STAY_START',
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveUntil: new Date('2025-02-01T00:00:00.000Z'),
        versionNumber: 1n,
      }),
    });
    await expect(retiredSetup.service.retire(actor, policyId)).resolves.toMatchObject({
      status: 'RETIRED',
    });
    expect(retiredSetup.repository.retirePublished).toHaveBeenCalledOnce();
  });

  it('publishes the successor and closes the predecessor in one service transaction', async () => {
    const predecessorId = '00000000-0000-4000-8000-000000001002';
    const successorId = policyId;
    const { service, repository } = setup({
      getHeader: vi.fn().mockResolvedValue({
        id: predecessorId,
        propertyId,
        status: 'PUBLISHED',
        applicabilityBasis: 'STAY_START',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveUntil: null,
        versionNumber: 1n,
      }),
      getAggregate: vi.fn().mockResolvedValue(draftAggregate()),
    });

    const cutover = new Date(Date.now() + 60_000);
    const result = await service.scheduleSupersession(actor, predecessorId, successorId, cutover);

    expect(result.status).toBe('PUBLISHED');
    expect(repository.closePublished).toHaveBeenCalledWith(
      expect.anything(),
      predecessorId,
      cutover,
      expect.any(Date),
    );
    expect(repository.publishDraft).toHaveBeenCalledWith(
      expect.anything(),
      successorId,
      actorId,
      expect.any(Date),
    );
  });
});
