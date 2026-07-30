import { describe, expect, it } from 'vitest';

import { extractRequestIp, parseCidrList, type RequestLike } from '../../src/booking/ip.js';

function req(partial: Partial<RequestLike>): RequestLike {
  return partial;
}

describe('extractRequestIp', () => {
  it('falls back to the socket address when no X-Forwarded-For is present', () => {
    const ip = extractRequestIp(req({ socket: { remoteAddress: '10.0.0.5' } }), []);
    expect(ip).toBe('10.0.0.5');
  });

  it('falls back to the socket address when X-Forwarded-For is present but the socket is not from a trusted proxy', () => {
    const ip = extractRequestIp(
      req({
        socket: { remoteAddress: '198.51.100.7' },
        headers: { 'x-forwarded-for': '203.0.113.99' },
      }),
      parseCidrList('10.0.0.0/8'),
    );
    expect(ip).toBe('198.51.100.7');
  });

  it('honors X-Forwarded-For when the socket address matches a trusted CIDR', () => {
    const ip = extractRequestIp(
      req({
        socket: { remoteAddress: '10.0.0.7' },
        headers: { 'x-forwarded-for': '203.0.113.99, 10.0.0.7' },
      }),
      parseCidrList('10.0.0.0/8'),
    );
    expect(ip).toBe('203.0.113.99');
  });

  it('walks the trusted CIDR list and accepts the first match', () => {
    const ip = extractRequestIp(
      req({
        socket: { remoteAddress: '192.168.1.42' },
        headers: { 'x-forwarded-for': '203.0.113.99' },
      }),
      parseCidrList('10.0.0.0/8,192.168.0.0/16'),
    );
    expect(ip).toBe('203.0.113.99');
  });

  it('returns null when both the socket and headers are absent', () => {
    const ip = extractRequestIp(req({}), parseCidrList('10.0.0.0/8'));
    expect(ip).toBeNull();
  });

  it('treats an empty X-Forwarded-For value as absent', () => {
    const ip = extractRequestIp(
      req({ socket: { remoteAddress: '203.0.113.10' }, headers: { 'x-forwarded-for': '' } }),
      parseCidrList('10.0.0.0/8'),
    );
    expect(ip).toBe('203.0.113.10');
  });

  it('accepts an X-Forwarded-For header expressed as an array', () => {
    const ip = extractRequestIp(
      req({
        socket: { remoteAddress: '10.0.0.4' },
        headers: { 'x-forwarded-for': ['203.0.113.50, 10.0.0.4'] },
      }),
      parseCidrList('10.0.0.0/8'),
    );
    expect(ip).toBe('203.0.113.50');
  });
});

describe('parseCidrList', () => {
  it('returns an empty list for empty input', () => {
    expect(parseCidrList('')).toEqual([]);
  });

  it('parses and trims a comma-separated list', () => {
    expect(parseCidrList(' 10.0.0.0/8 , 192.168.0.0/16 ')).toEqual([
      { cidr: '10.0.0.0/8' },
      { cidr: '192.168.0.0/16' },
    ]);
  });

  it('throws on a malformed CIDR', () => {
    expect(() => parseCidrList('10.0.0.0')).toThrow(/Invalid CIDR/);
    expect(() => parseCidrList('not-a-cidr/8')).toThrow(/Invalid CIDR/);
    expect(() => parseCidrList('256.0.0.0/8')).toThrow(/Invalid CIDR octet/);
    expect(() => parseCidrList('10.0.0.0/33')).toThrow(/Invalid CIDR prefix/);
  });
});
