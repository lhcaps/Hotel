import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import {
  buildClearCookieHeader,
  GUEST_SESSION_COOKIE_PATH,
  GUEST_SESSION_COOKIE_NAME,
  parseGuestSessionCookie,
  serializeGuestSessionCookie,
} from '../../src/booking/cookie.js';

describe('guest session cookie helpers', () => {
  it('round-trips a raw token through serialize/parse', () => {
    const token = Buffer.from('a'.repeat(48), 'utf8');
    const cookie = serializeGuestSessionCookie(token, {
      nodeEnv: 'production',
      ttlSeconds: 1800,
    });
    expect(cookie.name).toBe(GUEST_SESSION_COOKIE_NAME);
    expect(cookie.header.startsWith(`${GUEST_SESSION_COOKIE_NAME}=`)).toBe(true);
    expect(cookie.header).toContain('HttpOnly');
    expect(cookie.header).toContain('SameSite=Lax');
    expect(cookie.header).toContain('Secure');
    expect(cookie.header).toContain(`Path=${GUEST_SESSION_COOKIE_PATH}`);
    expect(cookie.header).toContain('Max-Age=1800');

    const parsed = parseGuestSessionCookie(cookie.value);
    expect(parsed?.equals(token)).toBe(true);
  });

  it('omits Secure in non-production environments', () => {
    const cookie = serializeGuestSessionCookie(Buffer.alloc(16), {
      nodeEnv: 'development',
      ttlSeconds: 60,
    });
    expect(cookie.header).not.toContain('Secure');
    expect(cookie.header).toContain('Max-Age=60');
  });

  it('clamps Max-Age to a non-negative integer', () => {
    const cookie = serializeGuestSessionCookie(Buffer.alloc(8), {
      nodeEnv: 'test',
      ttlSeconds: -5,
    });
    expect(cookie.header).toContain('Max-Age=0');
  });

  it('returns null for malformed cookie payloads', () => {
    expect(parseGuestSessionCookie('not-a-real-payload')).not.toBeNull();
  });

  it('builds a clear header that retains the cookie name', () => {
    const header = buildClearCookieHeader({ nodeEnv: 'production', ttlSeconds: 0 });
    expect(header.startsWith(`${GUEST_SESSION_COOKIE_NAME}=`)).toBe(true);
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('Secure');
    expect(header).toContain('HttpOnly');
  });

  it('builds a clear header without Secure outside production', () => {
    const header = buildClearCookieHeader({ nodeEnv: 'test', ttlSeconds: 0 });
    expect(header).not.toContain('Secure');
  });
});
