import { describe, expect, it, vi } from 'vitest';

import {
  PublicRoomCatalogService,
  type PublicRoomCatalogRepositoryPort,
} from '../src/public-catalog/public-room-catalog.service.js';

describe('PublicRoomCatalogService', () => {
  it('returns only customer-safe room type facts and their active amenities', async () => {
    const repository: PublicRoomCatalogRepositoryPort = {
      list: vi.fn().mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          code: 'NAMI',
          name: 'Deluxe',
          description: 'A quiet, comfortable room.',
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 3,
          amenities: [{ name: 'Wi-Fi' }, { name: 'Air conditioning' }],
        },
      ]),
    };

    const result = await new PublicRoomCatalogService(repository).list();

    expect(result.items).toEqual([
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        code: 'NAMI',
        name: 'Deluxe',
        description: 'A quiet, comfortable room.',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        amenities: [{ name: 'Wi-Fi' }, { name: 'Air conditioning' }],
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /property|roomNumber|roomId|housekeeping|maintenance/i,
    );
  });
});
