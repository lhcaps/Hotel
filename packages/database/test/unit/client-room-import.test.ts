import { CLIENT_ROOM_MANIFEST, validateClientRoomManifest } from '../../src/client-room-import.js';
import { describe, expect, it } from 'vitest';

describe('client room import manifest', () => {
  it('contains exactly the approved 23 physical rooms, nine concepts, and price table', () => {
    validateClientRoomManifest();
    expect(CLIENT_ROOM_MANIFEST.rooms).toHaveLength(23);
    expect(new Set(CLIENT_ROOM_MANIFEST.rooms.map((room) => room.physicalRoomCode)).size).toBe(23);
    expect(new Set(CLIENT_ROOM_MANIFEST.rooms.map((room) => room.name))).toEqual(
      new Set(['Rose', 'Nami', 'Phù Vân', 'Sunset', 'Yuki', 'Sabi', 'Sudal', 'Wabi', 'Haven']),
    );
    expect(CLIENT_ROOM_MANIFEST.ratePlans.map((plan) => plan.amounts)).toEqual([
      [359_000, 419_000, 489_000],
      [299_000, 349_000, 399_000],
      [399_000, 469_000, 549_000],
      [499_000, 589_000, 689_000],
      [749_000, 879_000, 1_029_000],
      [80_000, 95_000, 110_000],
    ]);
    expect(CLIENT_ROOM_MANIFEST.tiers.find((tier) => tier.code === 'SIGNATURE')).toMatchObject({
      maxOccupancy: 5,
    });
  });
});
