import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveInternalApiBaseUrl, resolveInternalApiOrigin } from './internal-api';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('internal API topology', () => {
  it('uses the server-only base and origin without reading the browser public base', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://peacenest.vn/api/v1');
    vi.stubEnv('INTERNAL_API_BASE_URL', 'http://api:3001/api/v1');

    expect(resolveInternalApiBaseUrl()).toBe('http://api:3001/api/v1');
    expect(resolveInternalApiOrigin()).toBe('http://api:3001');
  });

  it('fails closed when the server-only base is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://peacenest.vn/api/v1');
    vi.stubEnv('INTERNAL_API_BASE_URL', '');

    expect(resolveInternalApiBaseUrl()).toBeUndefined();
    expect(resolveInternalApiOrigin()).toBeUndefined();
  });
});
