import { describe, expect, it, vi } from 'vitest';

import type { ActorContext } from '../src/auth/actor-context.js';
import { CatalogConflictError } from '../src/catalog/catalog.errors.js';
import {
  type RatePlanRepositoryPort,
  RatePlanService,
  type RatePlanTransactionManager,
} from '../src/pricing/rate-plan.service.js';

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['pricing.rate_plan.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00Z'),
  requestId: 'request-1',
};
const property = { id: '550e8400-e29b-41d4-a716-446655440010' };
const plan = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  propertyId: property.id,
  code: 'THREE_HOUR_COMBO' as const,
  name: '3 hours',
  status: 'DRAFT' as const,
  includedDurationMinutes: 180,
  priority: 10,
  isBasePlan: true,
  minCheckInMinuteInclusive: null,
  maxCheckInMinuteExclusive: null,
  minDurationMinutesInclusive: 60,
  maxDurationMinutesInclusive: 240,
};
const tierId = '550e8400-e29b-41d4-a716-446655440030';

function repository(): RatePlanRepositoryPort {
  const basePlan = { ...plan, prices: [{ priceTierId: tierId, amountVnd: 359000n }] };
  const fiveHour = {
    ...plan,
    id: '550e8400-e29b-41d4-a716-446655440021',
    code: 'FIVE_HOUR_COMBO' as const,
    name: '5 hours',
    status: 'ACTIVE' as const,
    includedDurationMinutes: 300,
    priority: 20,
    minDurationMinutesInclusive: 255,
    maxDurationMinutesInclusive: 960,
    prices: [{ priceTierId: tierId, amountVnd: 450000n }],
  };
  const night = {
    ...plan,
    id: '550e8400-e29b-41d4-a716-446655440022',
    code: 'NIGHT_COMBO' as const,
    name: 'night',
    status: 'ACTIVE' as const,
    includedDurationMinutes: 300,
    priority: 40,
    minCheckInMinuteInclusive: 1080,
    maxCheckInMinuteExclusive: 1440,
    minDurationMinutesInclusive: 315,
    maxDurationMinutesInclusive: 960,
    prices: [{ priceTierId: tierId, amountVnd: 600000n }],
  };
  const day = {
    ...plan,
    id: '550e8400-e29b-41d4-a716-446655440023',
    code: 'DAY_COMBO' as const,
    name: 'day',
    status: 'ACTIVE' as const,
    includedDurationMinutes: 1440,
    priority: 50,
    minDurationMinutesInclusive: 975,
    maxDurationMinutesInclusive: 1440,
    prices: [{ priceTierId: tierId, amountVnd: 800000n }],
  };
  const lunch = {
    ...plan,
    id: '550e8400-e29b-41d4-a716-446655440024',
    code: 'LUNCH_COMBO' as const,
    name: 'lunch',
    status: 'ACTIVE' as const,
    includedDurationMinutes: 180,
    priority: 30,
    minCheckInMinuteInclusive: 660,
    maxCheckInMinuteExclusive: 900,
    prices: [{ priceTierId: tierId, amountVnd: 359000n }],
  };
  const extra = {
    ...plan,
    id: '550e8400-e29b-41d4-a716-446655440025',
    code: 'EXTRA_HOUR' as const,
    name: 'extra',
    status: 'ACTIVE' as const,
    isBasePlan: false,
    includedDurationMinutes: 60,
    minDurationMinutesInclusive: null,
    maxDurationMinutesInclusive: null,
    prices: [{ priceTierId: tierId, amountVnd: 100000n }],
  };
  const all = [lunch, basePlan, fiveHour, night, day, extra];
  return {
    getCurrentProperty: vi.fn().mockResolvedValue(property),
    listRatePlans: vi.fn().mockResolvedValue(all),
    lockActiveRuleSet: vi.fn().mockResolvedValue(all),
    createRatePlan: vi
      .fn()
      .mockImplementation(
        async (
          _tx: unknown,
          _propertyId: string,
          command: {
            readonly code: string;
            readonly name: string;
            readonly includedDurationMinutes: number;
            readonly priority: number;
            readonly isBasePlan: boolean;
            readonly minCheckInMinuteInclusive: number | null;
            readonly maxCheckInMinuteExclusive: number | null;
            readonly minDurationMinutesInclusive: number | null;
            readonly maxDurationMinutesInclusive: number | null;
          },
        ) => ({
          id: '550e8400-e29b-41d4-a716-446655440099',
          propertyId: property.id,
          code: command.code,
          name: command.name,
          status: 'DRAFT' as const,
          includedDurationMinutes: command.includedDurationMinutes,
          priority: command.priority,
          isBasePlan: command.isBasePlan,
          minCheckInMinuteInclusive: command.minCheckInMinuteInclusive,
          maxCheckInMinuteExclusive: command.maxCheckInMinuteExclusive,
          minDurationMinutesInclusive: command.minDurationMinutesInclusive,
          maxDurationMinutesInclusive: command.maxDurationMinutesInclusive,
          prices: [],
        }),
      ),
    updatePrice: vi.fn().mockResolvedValue(undefined),
    updateSelectionRule: vi
      .fn()
      .mockImplementation(
        async (
          _tx: unknown,
          _propertyId: string,
          _planId: string,
          patch: { includedDurationMinutes?: number; priority?: number },
        ) => ({
          ...basePlan,
          ...(patch.includedDurationMinutes !== undefined
            ? { includedDurationMinutes: patch.includedDurationMinutes }
            : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          prices: [{ priceTierId: tierId, amountVnd: 359000n }],
        }),
      ),
    setStatus: vi
      .fn()
      .mockImplementation(
        async (
          _tx: unknown,
          _propertyId: string,
          planId: string,
          status: 'ACTIVE' | 'INACTIVE',
        ) => {
          const target = all.find((planRow) => planRow.id === planId);
          if (target === undefined) return undefined;
          return { ...target, status, prices: target.prices };
        },
      ),
    requiredActiveTierIds: vi.fn().mockResolvedValue([tierId]),
    missingPrices: vi.fn().mockResolvedValue([]),
  };
}
const transactions: RatePlanTransactionManager = {
  transaction: async <T>(fn: (transaction: unknown) => Promise<T>) => fn({}),
};

describe('RatePlanService', () => {
  it('updates a VND price and writes an atomic scrubbed audit event', async () => {
    const repo = repository();
    const audit = { write: vi.fn().mockResolvedValue(undefined) };
    const service = new RatePlanService(transactions, repo, audit);
    await service.updatePrice(actor, plan.id, tierId, { amountVnd: 419000 });
    expect(repo.updatePrice).toHaveBeenCalledWith(
      expect.anything(),
      property.id,
      plan.id,
      tierId,
      419000,
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'RATE_PLAN_PRICE_UPDATED', actorId: actor.userId }),
    );
  });

  it('rejects activation when any active room-type tier is not priced', async () => {
    const repo = repository();
    (repo.missingPrices as ReturnType<typeof vi.fn>).mockResolvedValue([tierId]);
    const service = new RatePlanService(transactions, repo, { write: vi.fn() });
    await expect(service.activate(actor, plan.id, { activate: true })).rejects.toBeInstanceOf(
      CatalogConflictError,
    );
    expect(repo.setStatus).not.toHaveBeenCalled();
  });

  it('activates a complete plan and audits it in the same transaction', async () => {
    const repo = repository();
    const audit = { write: vi.fn().mockResolvedValue(undefined) };
    const service = new RatePlanService(transactions, repo, audit);
    await expect(service.activate(actor, plan.id, { activate: true })).resolves.toMatchObject({
      status: 'ACTIVE',
    });
    expect(repo.setStatus).toHaveBeenCalledWith(expect.anything(), property.id, plan.id, 'ACTIVE');
    expect(audit.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'RATE_PLAN_ACTIVATED' }),
    );
  });

  it('creates a DRAFT plan, persists it, and emits an audit event', async () => {
    const repo = repository();
    const audit = { write: vi.fn().mockResolvedValue(undefined) };
    const service = new RatePlanService(transactions, repo, audit);
    const result = await service.create(actor, {
      code: 'SIX_HOUR_FLEX',
      name: 'Six hour flex',
      includedDurationMinutes: 360,
      priority: 25,
      isBasePlan: true,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 240,
      maxDurationMinutesInclusive: 480,
    });
    expect(result).toMatchObject({
      code: 'SIX_HOUR_FLEX',
      name: 'Six hour flex',
      status: 'DRAFT',
      includedDurationMinutes: 360,
      priority: 25,
      isBasePlan: true,
    });
    expect(result.prices).toEqual([{ priceTierId: tierId, amountVnd: null }]);
    expect(repo.createRatePlan).toHaveBeenCalledWith(
      expect.anything(),
      property.id,
      expect.objectContaining({ code: 'SIX_HOUR_FLEX' }),
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'RATE_PLAN_CREATED', actorId: actor.userId }),
    );
  });

  it('rejects create payloads that violate the schema (invalid code)', async () => {
    const repo = repository();
    const audit = { write: vi.fn().mockResolvedValue(undefined) };
    const service = new RatePlanService(transactions, repo, audit);
    await expect(
      service.create(actor, {
        code: 'invalid-lowercase',
        name: 'Bad plan',
        includedDurationMinutes: 180,
        priority: 0,
        isBasePlan: true,
      }),
    ).rejects.toThrow();
    expect(repo.createRatePlan).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('maps a duplicate-code database error to a catalog conflict', async () => {
    const repo = repository();
    (repo.createRatePlan as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      const error = new Error('duplicate key') as Error & { code?: string };
      error.code = '23505';
      throw error;
    });
    const service = new RatePlanService(transactions, repo, { write: vi.fn() });
    await expect(
      service.create(actor, {
        code: 'THREE_HOUR_COMBO',
        name: 'Duplicate',
        includedDurationMinutes: 180,
        priority: 10,
        isBasePlan: true,
        minCheckInMinuteInclusive: null,
        maxCheckInMinuteExclusive: null,
        minDurationMinutesInclusive: 60,
        maxDurationMinutesInclusive: 240,
      }),
    ).rejects.toBeInstanceOf(CatalogConflictError);
  });
});
