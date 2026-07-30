import { describe, expect, it } from 'vitest';

import { trustedProxy } from '../src/trusted-proxy.js';

describe('trustedProxy', () => {
  it('disables proxy trust when no CIDR is configured', () => {
    expect(trustedProxy('')).toBe(false);
  });

  it('normalizes the explicit comma-separated proxy allowlist', () => {
    expect(trustedProxy(' 10.0.0.0/8,127.0.0.1 ')).toEqual(['10.0.0.0/8', '127.0.0.1']);
  });

  it.each(['10.0.0.0/33', 'not-an-ip', '2001:db8::/129'])(
    'rejects malformed CIDRs: %s',
    (value) => {
      expect(() => trustedProxy(value)).toThrow(/TRUSTED_PROXY_CIDRS/);
    },
  );
});
