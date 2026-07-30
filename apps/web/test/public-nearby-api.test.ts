import { describe, expect, it } from 'vitest';

import { publicApi } from '../src/lib/admin-api';

describe('publicApi.searchNearbyAvailability routing', () => {
  it('POSTs to /public/availability/nearby', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });
      return new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const response = await publicApi.searchNearbyAvailability({
        checkIn: '2027-01-10T04:00:00.000Z',
        checkOut: '2027-01-10T07:00:00.000Z',
        adults: 2,
        children: 0,
        expandMinutes: 60,
        limit: 6,
      });
      expect(response.candidates).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    }
    expect(calls).toHaveLength(1);
    const last = calls[0];
    expect(last).toBeDefined();
    expect(last?.url).toMatch(/\/public\/availability\/nearby(\?|$)/);
    expect(last?.url).not.toMatch(/\/api\/v1\/availability\/nearby(\?|$)/);
    expect(last?.url).not.toMatch(/\/availability\/nearby(\?|$)/);
  });
});
