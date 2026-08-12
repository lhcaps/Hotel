import { describe, expect, it } from 'vitest';

import { resolvePublicApiOrigin } from './public-api-origin';

describe('resolvePublicApiOrigin', () => {
  it.each([undefined, '', '   ', '/api/v1', 'not a URL', 'ftp://peacenest.vn/api/v1'])(
    'returns undefined for invalid configuration: %s',
    (value) => {
      expect(resolvePublicApiOrigin(value)).toBeUndefined();
    },
  );

  it('returns the origin for a valid public API base', () => {
    expect(resolvePublicApiOrigin('https://peacenest.vn/api/v1')).toBe('https://peacenest.vn');
  });

  it('does not accept credentials in a public API URL', () => {
    expect(resolvePublicApiOrigin('https://user:pass@peacenest.vn/api/v1')).toBeUndefined();
  });
});
