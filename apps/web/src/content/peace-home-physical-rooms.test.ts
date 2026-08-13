import { describe, expect, it } from 'vitest';

import {
  peaceHomeCommonImages,
  peaceNestRoomMedia,
  presentPhysicalRooms,
  roomStartingPrice,
} from './peace-home-physical-rooms';

describe('PeaceNest public room presentation', () => {
  it('contains only client-owned gallery assignments for the nine stable room codes', () => {
    expect(peaceNestRoomMedia.map((room) => room.code)).toEqual([
      'ROSE',
      'NAMI',
      'PHU_VAN',
      'SUNSET',
      'YUKI',
      'SABI',
      'SUDAL',
      'WABI',
      'HAVEN',
    ]);
    expect(peaceNestRoomMedia.map((room) => room.gallery.length)).toEqual([
      6, 6, 7, 7, 7, 6, 6, 7, 7,
    ]);
    for (const image of [
      ...peaceHomeCommonImages,
      ...peaceNestRoomMedia.flatMap((room) => room.gallery),
    ]) {
      expect(image).toMatch(/^\/images\/peace-home\//);
      expect(image).not.toContain('drive.google');
      expect(image).not.toContain('http');
    }
  });

  it('uses the stable API room code when an editor changes a display name', () => {
    const catalog = {
      items: peaceNestRoomMedia.map((room, index) => ({
        id: `00000000-0000-4000-8000-00000000000${index + 1}`,
        code: room.code,
        name: `Editorial name for ${room.slug}`,
        description: null,
        maxAdults: 2,
        maxChildren: room.code === 'ROSE' ? 1 : 2,
        maxOccupancy: room.code === 'ROSE' ? 3 : ['WABI', 'HAVEN'].includes(room.code) ? 6 : 4,
        amenities: [],
        startingFromVnd: null,
      })),
    };
    const presented = presentPhysicalRooms(catalog);
    expect(presented).toHaveLength(9);
    expect(presented.find((room) => room.code === 'ROSE')?.roomType.maxOccupancy).toBe(3);
    const wabi = presented.find((room) => room.code === 'WABI');
    expect(wabi === undefined ? undefined : roomStartingPrice(wabi)).toBeNull();
    expect(presented.find((room) => room.code === 'NAMI')?.roomType.name).toBe(
      'Editorial name for nami',
    );
  });

  it('does not invent presentation for a catalog room without a media assignment', () => {
    const catalog = {
      items: [
        {
          id: '00000000-0000-4000-8000-000000000099',
          code: 'UNKNOWN_ROOM',
          name: 'Unassigned room',
          description: null,
          maxAdults: 2,
          maxChildren: 2,
          maxOccupancy: 4,
          amenities: [],
          startingFromVnd: null,
        },
      ],
    };
    expect(presentPhysicalRooms(catalog)).toEqual([]);
  });
});
