import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadPublicRoomCatalog } from './public-room-catalog';

describe('loadPublicRoomCatalog', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads the public catalog endpoint without falling back to marketing placeholders', async () => {
    vi.stubEnv('INTERNAL_API_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test/api/v1');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440010',
              name: 'Deluxe',
              description: 'A quiet room.',
              maxAdults: 2,
              maxChildren: 1,
              maxOccupancy: 3,
              amenities: [{ name: 'Wi-Fi' }],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPublicRoomCatalog()).resolves.toMatchObject({
      items: [{ name: 'Deluxe', amenities: [{ name: 'Wi-Fi' }] }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/public/room-types',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('uses the private API origin while rendering on a Compose network', async () => {
    vi.stubEnv('INTERNAL_API_BASE_URL', 'http://api:3001/api/v1');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://public.example.test/api/v1');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPublicRoomCatalog()).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api:3001/api/v1/public/room-types',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
