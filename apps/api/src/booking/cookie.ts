/**
 * Cookie serialization / parsing for the Phase 5 guest session cookie.
 *
 * Name: `rm_guest_session_v1`
 * Attributes: HttpOnly, SameSite=Lax, Path=/api/v1/public, Secure in production,
 * Max-Age = `GUEST_SESSION_TTL_MS / 1000` (default 1800s).
 *
 * The cookie payload is the base64url-encoded raw session token; only
 * the SHA-256 digest of that token is stored in the database.
 */

import { Buffer } from 'node:buffer';

export interface GuestSessionCookieAttributes {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly ttlSeconds: number;
  readonly path?: string;
}

export const GUEST_SESSION_COOKIE_NAME = 'rm_guest_session_v1';
export const GUEST_SESSION_COOKIE_PATH = '/api/v1/public';

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function base64UrlDecode(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

export interface SerializedCookie {
  readonly name: string;
  readonly value: string;
  readonly header: string;
}

export function serializeGuestSessionCookie(
  token: Buffer,
  attributes: GuestSessionCookieAttributes,
): SerializedCookie {
  const value = base64UrlEncode(token);
  const secureFlag = attributes.nodeEnv === 'production';
  const maxAge = Math.max(0, Math.floor(attributes.ttlSeconds));
  const parts = [
    `${GUEST_SESSION_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${attributes.path ?? GUEST_SESSION_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
  ];
  if (secureFlag) {
    parts.push('Secure');
  }
  return {
    name: GUEST_SESSION_COOKIE_NAME,
    value,
    header: parts.join('; '),
  };
}

export function parseGuestSessionCookie(rawValue: string): Buffer | null {
  return base64UrlDecode(rawValue);
}

export function serializeGuestSessionExpiry(
  attributes: GuestSessionCookieAttributes,
): SerializedCookie {
  return serializeGuestSessionCookie(Buffer.alloc(0), attributes);
}

export function buildClearCookieHeader(attributes: GuestSessionCookieAttributes): string {
  const secureFlag = attributes.nodeEnv === 'production';
  const parts = [
    `${GUEST_SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${attributes.path ?? GUEST_SESSION_COOKIE_PATH}`,
    'Max-Age=0',
  ];
  if (secureFlag) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
