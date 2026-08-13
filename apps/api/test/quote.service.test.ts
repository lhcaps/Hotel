import { describe, expect, it, vi } from 'vitest';
import {
  QuoteService,
  QuotePricingConfigurationError,
  QuoteMultiNightStateError,
  QuoteUnavailableError,
  type QuoteRepositoryPort,
} from '../src/pricing/quote.service.js';
const request = {
  mode: 'hourly' as const,
  roomTypeId: '550e8400-e29b-41d4-a716-446655440010',
  checkIn: '2026-07-23T04:00:00.000Z',
  checkOut: '2026-07-23T07:00:00.000Z',
  adults: 2,
  children: 0,
};
const catalog = {
  THREE_HOUR_COMBO: { status: 'ACTIVE' as const, prices: { TIER_1: 359000 } },
  EXTRA_HOUR: { status: 'ACTIVE' as const, prices: { TIER_1: 50000 } },
};
describe('QuoteService', () => {
  it('does not issue an unavailable quote', async () => {
    const repo: QuoteRepositoryPort = {
      catalogFor: vi.fn().mockResolvedValue({
        available: false,
        priceTierCode: 'TIER_1',
        propertyTimezone: 'Asia/Ho_Chi_Minh',
        catalog,
        planLabels: {},
      }),
      issue: vi.fn(),
      get: vi.fn(),
    };
    await expect(new QuoteService(repo).issue(request)).rejects.toBeInstanceOf(
      QuoteUnavailableError,
    );
    expect(repo.issue).not.toHaveBeenCalled();
  });

  it('reads an immutable legacy V1 quote snapshot without repricing it', async () => {
    const legacySnapshot = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      roomTypeId: '550e8400-e29b-41d4-a716-446655440001',
      roomTypeName: 'Deluxe',
      checkIn: '2026-07-22T11:00:00+07:00',
      checkOut: '2026-07-22T14:00:00+07:00',
      adults: 2,
      children: 0,
      expiresAt: '2026-07-22T11:15:00+07:00',
      pricing: {
        ruleVersion: 'phase-4-pricing-availability-v1',
        selectedPlanCode: 'LUNCH_COMBO',
        basePlanCode: 'LUNCH_COMBO',
        baseMinutes: 180,
        extraUnits: 0,
        baseAmountVnd: 359000,
        extraAmountVnd: 0,
        totalAmountVnd: 359000,
        lineItems: [{ code: 'LUNCH_COMBO', amountVnd: 359000, units: 1 }],
      },
    };
    const repo: QuoteRepositoryPort = {
      catalogFor: vi.fn(),
      issue: vi.fn(),
      get: vi.fn().mockResolvedValue({ snapshot: legacySnapshot, expired: false }),
    };

    await expect(new QuoteService(repo).get(legacySnapshot.id)).resolves.toMatchObject({
      id: legacySnapshot.id,
      pricing: { ruleVersion: 'phase-4-pricing-availability-v1', totalAmountVnd: 359000 },
    });
    expect(repo.issue).not.toHaveBeenCalled();
  });

  it('turns an inactive or incomplete pricing catalog into a safe typed failure', async () => {
    const repo: QuoteRepositoryPort = {
      catalogFor: vi.fn().mockResolvedValue({
        available: true,
        priceTierCode: 'TIER_1',
        propertyTimezone: 'Asia/Ho_Chi_Minh',
        planLabels: {},
        catalog: { THREE_HOUR_COMBO: { status: 'DRAFT', prices: { TIER_1: 359000 } } },
      }),
      issue: vi.fn(),
      get: vi.fn(),
    };
    await expect(new QuoteService(repo).issue(request)).rejects.toBeInstanceOf(
      QuotePricingConfigurationError,
    );
    expect(repo.issue).not.toHaveBeenCalled();
  });

  it('keeps the additive multi-night intent from offers and quote issuance', async () => {
    const repo: QuoteRepositoryPort = {
      catalogFor: vi.fn(),
      issue: vi.fn(),
      get: vi.fn(),
    };
    const multiNightRequest = {
      ...request,
      checkIn: '2026-07-22T21:00:00+07:00',
      checkOut: '2026-07-24T09:00:00+07:00',
      mode: 'multi_night',
    };
    await expect(new QuoteService(repo).eligibleOffers(multiNightRequest)).rejects.toThrow();
    await expect(new QuoteService(repo).issue(multiNightRequest)).rejects.toThrow();
    expect(repo.catalogFor).not.toHaveBeenCalled();
    expect(repo.issue).not.toHaveBeenCalled();
  });

  it('routes a mode-free Customer quote to the server-owned flexible resolver', async () => {
    const repo: QuoteRepositoryPort = { catalogFor: vi.fn(), issue: vi.fn(), get: vi.fn() };
    const multiNight = {
      quote: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue({ state: 'NO_VALID_PRICING', items: [] }),
    };
    const { mode: _legacyMode, ...customerRequest } = request;
    void _legacyMode;

    await expect(
      new QuoteService(repo, { multiNight }).issue(customerRequest),
    ).rejects.toMatchObject({
      code: 'NO_VALID_PRICING',
    });

    expect(multiNight.quote).toHaveBeenCalledWith(customerRequest);
    expect(repo.catalogFor).not.toHaveBeenCalled();
  });

  it('preserves server-owned multi-night availability states at quote time', async () => {
    const repo: QuoteRepositoryPort = {
      catalogFor: vi.fn(),
      issue: vi.fn(),
      get: vi.fn(),
    };
    const multiNight = {
      quote: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue({ state: 'NO_CONTINUOUS_ROOM', items: [] }),
    };
    await expect(
      new QuoteService(repo, { multiNight }).issue({
        ...request,
        mode: 'multi_night',
        checkIn: '2026-07-22T21:00:00+07:00',
        checkOut: '2026-07-24T09:00:00+07:00',
      }),
    ).rejects.toMatchObject({ code: 'NO_CONTINUOUS_ROOM' });
    expect(multiNight.search).toHaveBeenCalledTimes(1);
  });

  it('maps malformed multi-night guests to a stable typed state', async () => {
    const repo: QuoteRepositoryPort = { catalogFor: vi.fn(), issue: vi.fn(), get: vi.fn() };
    await expect(
      new QuoteService(repo).issue({
        ...request,
        mode: 'multi_night',
        adults: 0,
      }),
    ).rejects.toBeInstanceOf(QuoteMultiNightStateError);
    await expect(
      new QuoteService(repo).issue({
        ...request,
        mode: 'multi_night',
        adults: 0,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_GUEST_COUNT' });
  });
});
