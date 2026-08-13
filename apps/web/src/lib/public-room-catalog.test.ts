import { describe, expect, it } from 'vitest';

import { publicRoomImage } from './public-room-catalog';

describe('publicRoomImage', () => {
  it('uses the stable authoritative room code and never hashes an opaque room id', () => {
    expect(publicRoomImage('ROSE')).toBe('/images/peace-home/rose/rose-066-card.webp');
    expect(publicRoomImage('NAMI')).toBe('/images/peace-home/nami/nami-030-card.webp');
    expect(publicRoomImage('WABI')).toBe('/images/peace-home/wabi/wabi-124-card.webp');
  });

  it('fails closed for a room code without a client-owned media assignment', () => {
    expect(publicRoomImage('UNKNOWN_ROOM')).toBeUndefined();
  });
});
