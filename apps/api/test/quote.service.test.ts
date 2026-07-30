import { describe, expect, it, vi } from 'vitest';
import {
  QuoteService,
  QuotePricingConfigurationError,
  QuoteUnavailableError,
  type QuoteRepositoryPort,
} from '../src/pricing/quote.service.js';
const request = {
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
});
