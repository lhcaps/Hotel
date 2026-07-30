import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GOOGLE_PROVIDER_ID,
  deriveCustomerLoginPresentation,
} from '../../src/app/login/customer-login-presentation';

describe('customer login presentation derivation', () => {
  it('returns the Google mode with the Google provider id when neither switch is set', () => {
    expect(
      deriveCustomerLoginPresentation({
        ROOM_TEST_OAUTH_BROWSER_ENABLED: undefined,
        ROOM_TEST_OAUTH_PROVIDER_ID: undefined,
      }),
    ).toEqual({ mode: 'google', enabled: false, providerId: DEFAULT_GOOGLE_PROVIDER_ID });
  });

  it('keeps Google disabled until the API readiness response is fetched', () => {
    expect(
      deriveCustomerLoginPresentation({
        ROOM_TEST_OAUTH_BROWSER_ENABLED: undefined,
        ROOM_TEST_OAUTH_PROVIDER_ID: undefined,
      }).enabled,
    ).toBe(false);
  });

  it('returns the test-oidc mode with the configured provider id when browser mode is enabled', () => {
    expect(
      deriveCustomerLoginPresentation({
        ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
        ROOM_TEST_OAUTH_PROVIDER_ID: 'det-oauth',
      }),
    ).toEqual({ mode: 'test-oidc', enabled: true, providerId: 'det-oauth' });
  });

  it('uses an empty provider id when browser mode is enabled without one', () => {
    const presentation = deriveCustomerLoginPresentation({
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
      ROOM_TEST_OAUTH_PROVIDER_ID: undefined,
    });
    expect(presentation.mode).toBe('test-oidc');
    expect(presentation.providerId).toBe('');
  });

  it('treats ROOM_TEST_OAUTH_BROWSER_ENABLED=false the same as absent', () => {
    expect(
      deriveCustomerLoginPresentation({
        ROOM_TEST_OAUTH_BROWSER_ENABLED: 'false',
        ROOM_TEST_OAUTH_PROVIDER_ID: 'det-oauth',
      }),
    ).toEqual({ mode: 'google', enabled: false, providerId: DEFAULT_GOOGLE_PROVIDER_ID });
  });
});
