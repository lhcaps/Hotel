import { describe, expect, it } from 'vitest';

import {
  peaceHomeCommonImages,
  peaceHomePhysicalRooms,
  presentPhysicalRooms,
} from './peace-home-physical-rooms';

describe('Peace Home public room presentation', () => {
  it('contains exactly the nine client rooms and only self-hosted galleries', () => {
    expect(peaceHomePhysicalRooms.map((room) => room.name)).toEqual([
      'Rose',
      'Nami',
      'Phù Vân',
      'Sunset',
      'Yuki',
      'Sabi',
      'Sudal',
      'Wabi',
      'Haven',
    ]);
    expect(peaceHomePhysicalRooms.map((room) => room.gallery.length)).toEqual([
      6, 6, 7, 7, 7, 6, 6, 7, 7,
    ]);
    for (const image of [
      ...peaceHomeCommonImages,
      ...peaceHomePhysicalRooms.flatMap((room) => room.gallery),
    ]) {
      expect(image).toMatch(/^\/images\/peace-home\//);
      expect(image).not.toContain('drive.google');
      expect(image).not.toContain('http');
    }
  });

  it('maps physical presentation to the authoritative tier records', () => {
    const catalog = {
      items: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Standard',
          description: null,
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 3,
          amenities: [],
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          name: 'Deluxe',
          description: null,
          maxAdults: 2,
          maxChildren: 2,
          maxOccupancy: 4,
          amenities: [],
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          name: 'Signature',
          description: null,
          maxAdults: 4,
          maxChildren: 2,
          maxOccupancy: 6,
          amenities: [],
        },
      ],
    };
    const presented = presentPhysicalRooms(catalog);
    expect(presented).toHaveLength(9);
    expect(presented.filter((room) => room.roomType.name === 'Deluxe')).toHaveLength(6);
    expect(presented.find((room) => room.name === 'Rose')?.roomType.maxOccupancy).toBe(3);
    expect(presented.find((room) => room.name === 'Wabi')?.startingFromVnd).toBe(399_000);
  });
});
