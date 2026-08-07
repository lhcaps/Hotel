import { describe, expect, it, vi } from 'vitest';

import {
  AvailabilityService,
  offerSummary,
  type AvailabilityRepositoryPort,
} from '../src/pricing/availability.service.js';
import { PricingRuleNotFoundError } from '../src/pricing/pricing-engine.js';

const request = {
  checkIn: '2026-07-23T04:00:00.000Z',
  checkOut: '2026-07-23T07:00:00.000Z',
  adults: 2,
  children: 1,
};
describe('AvailabilityService', () => {
  it('returns only safe room-type availability, excluding blocked physical rooms', async () => {
    const repository: AvailabilityRepositoryPort = {
      search: async () => [
        {
          roomTypeId: '550e8400-e29b-41d4-a716-446655440010',
          roomTypeName: 'Deluxe',
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 3,
          amenities: ['Wi-Fi'],
          availableRoomCount: 1,
          offer: { planLabel: 'Three-hour combo', amountVnd: 300000 },
        },
      ],
    };
    const service = new AvailabilityService(repository);
    const result = await service.search(request);
    expect(result.items).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/roomNumber|roomId|room_id/i);
  });

  it('propagates missing rate-plan configuration instead of returning a false empty result', () => {
    expect(() =>
      offerSummary(request, {
        priceTierCode: 'TIER_1',
        propertyTimezone: 'Asia/Ho_Chi_Minh',
        catalog: {},
        planLabels: {},
      }),
    ).toThrow(PricingRuleNotFoundError);
  });

  it('preserves arbitrary exact intervals and reports an explicit empty state', async () => {
    const repository: AvailabilityRepositoryPort = { search: vi.fn().mockResolvedValue([]) };
    const result = await new AvailabilityService(repository).search({
      ...request,
      checkIn: '2099-07-24T04:00:17.000Z',
      checkOut: '2099-07-25T04:15:46.000Z',
    });
    expect(repository.search).toHaveBeenCalledOnce();
    expect(result.state).toBe('NO_EXACT_AVAILABILITY');
    expect(result.requestedInterval).toEqual({
      checkIn: '2099-07-24T04:00:17.000Z',
      checkOut: '2099-07-25T04:15:46.000Z',
    });
  });

  it('rejects multi-night safely while the public gate is not wired', async () => {
    const repository: AvailabilityRepositoryPort = {
      search: vi.fn(),
      searchWithState: vi.fn(),
    };
    const result = await new AvailabilityService(repository).search({
      ...request,
      checkIn: '2026-07-22T21:00:00+07:00',
      checkOut: '2026-07-24T09:00:00+07:00',
      mode: 'multi_night',
    });
    expect(result.state).toBe('SERVICE_UNAVAILABLE');
    expect(repository.search).not.toHaveBeenCalled();
    expect(repository.searchWithState).not.toHaveBeenCalled();
  });
});
