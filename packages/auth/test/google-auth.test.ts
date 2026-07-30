import { describe, expect, it } from 'vitest';

import { buildGoogleSocialProvider } from '../src/google-auth.js';

describe('buildGoogleSocialProvider', () => {
  it('returns an empty list when Google auth is disabled', () => {
    expect(buildGoogleSocialProvider({ enabled: false })).toEqual([]);
  });

  it('throws when enabled but credentials are missing', () => {
    expect(() => buildGoogleSocialProvider({ enabled: true })).toThrow(
      /requires clientId, clientSecret, and redirectUri/,
    );
  });

  it('throws when only some credentials are present', () => {
    expect(() =>
      buildGoogleSocialProvider({
        enabled: true,
        clientId: '0123456789.apps.googleusercontent.com',
      }),
    ).toThrow(/requires clientId, clientSecret, and redirectUri/);
  });

  it('returns the google provider block when enabled with full credentials', () => {
    const providers = buildGoogleSocialProvider({
      enabled: true,
      clientId: '0123456789.apps.googleusercontent.com',
      clientSecret: 'test-google-client-secret-1234',
      redirectUri: 'http://localhost:3000/api/auth/callback/google',
    });
    expect(providers).toHaveLength(1);
    const google = providers[0]?.google;
    expect(google).toBeDefined();
    expect(google?.clientId).toBe('0123456789.apps.googleusercontent.com');
    expect(google?.clientSecret).toBe('test-google-client-secret-1234');
    expect(google?.redirectURI).toBe('http://localhost:3000/api/auth/callback/google');
  });

  it('mapProfileToUser returns CUSTOMER role only', () => {
    const providers = buildGoogleSocialProvider({
      enabled: true,
      clientId: '0123456789.apps.googleusercontent.com',
      clientSecret: 'test-google-client-secret-1234',
      redirectUri: 'http://localhost:3000/api/auth/callback/google',
    });
    const google = providers[0]?.google;
    expect(google).toBeDefined();
    const profile = google?.mapProfileToUser();
    expect(profile).toEqual({ role: 'CUSTOMER' });
  });
});
