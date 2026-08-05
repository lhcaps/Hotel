import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminApi } from '../src/lib/admin-api';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('adminApi booking routes', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('serialises the contract booking-code prefix as q', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ page: 1, pageSize: 20, totalItems: 1, items: [] }),
    );

    await adminApi.listAdminBookings({
      page: 1,
      pageSize: 20,
      q: 'UAT-CONFIRMED-20270711',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      'http://api.local/api/v1/admin/bookings?page=1&pageSize=20&q=UAT-CONFIRMED-20270711',
    );
    expect(firstCall?.[1]?.credentials).toBe('include');
  });
});
