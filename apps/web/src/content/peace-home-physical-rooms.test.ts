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

  it('maps physical presentation to the authoritative room-concept records', () => {
    const catalog = {
      items: peaceHomePhysicalRooms.map((room, index) => ({
        id: `00000000-0000-4000-8000-00000000000${index + 1}`,
        name: room.name,
        description: null,
        maxAdults: 2,
        maxChildren: room.name === 'Rose' ? 1 : 2,
        maxOccupancy: room.name === 'Rose' ? 3 : room.tierCode === 'SIGNATURE' ? 6 : 4,
        amenities: [],
      })),
    };
    const presented = presentPhysicalRooms(catalog);
    expect(presented).toHaveLength(9);
    expect(presented.find((room) => room.name === 'Rose')?.roomType.maxOccupancy).toBe(3);
    expect(presented.find((room) => room.name === 'Wabi')?.startingFromVnd).toBe(399_000);
    expect(presented.find((room) => room.name === 'Nami')?.roomType.name).toBe('Nami');
  });

  it('drops concepts that are not present in the live catalog (e.g. archived legacy tier rows)', () => {
    const catalog = {
      items: [
        {
          id: '00000000-0000-4000-8000-000000000099',
          name: 'Nami',
          description: null,
          maxAdults: 2,
          maxChildren: 2,
          maxOccupancy: 4,
          amenities: [],
        },
      ],
    };
    const presented = presentPhysicalRooms(catalog);
    expect(presented).toHaveLength(1);
    expect(presented[0]?.name).toBe('Nami');
  });
});
