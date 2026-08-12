import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from './locale-provider';
import { PublicHeader } from './public-header';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('PublicHeader public API configuration', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  it.each([undefined, '', 'not a URL'])('renders without crashing for %s', async (apiBaseUrl) => {
    if (apiBaseUrl !== undefined) process.env.NEXT_PUBLIC_API_BASE_URL = apiBaseUrl;

    render(
      <LocaleProvider locale="en">
        <PublicHeader locale="en" />
      </LocaleProvider>,
    );

    expect(screen.getByRole('banner')).toBeTruthy();
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });

  it('fetches the session from the canonical origin when configured', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://peacenest.vn/api/v1';
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user: { role: 'CUSTOMER' } }), { status: 200 }),
    );

    render(
      <LocaleProvider locale="en">
        <PublicHeader locale="en" />
      </LocaleProvider>,
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('https://peacenest.vn/api/auth/get-session', {
        credentials: 'include',
      }),
    );
  });
});
