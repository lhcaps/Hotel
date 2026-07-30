import { describe, expect, it } from 'vitest';

import { POST } from '../src/app/locale/route';

describe('locale route', () => {
  it('persists the selected supported locale for server and client rendering', async () => {
    const response = await POST(
      new Request('http://web.local/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: 'en' }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ locale: 'en' });
    expect(response.headers.get('set-cookie')).toContain('room_locale=en');
    expect(response.headers.get('set-cookie')).toContain('Path=/');
  });

  it('fails safely to Vietnamese for malformed locale input', async () => {
    const response = await POST(
      new Request('http://web.local/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: 'fr' }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ locale: 'vi' });
  });
});
