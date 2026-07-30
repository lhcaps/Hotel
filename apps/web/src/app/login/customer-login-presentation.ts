/**
 * Pure derivation of the customer login page presentation from the
 * server-only environment. Lives outside the Next.js page so it can
 * be unit-tested in isolation.
 *
 * The login server component reads the same env vars (no validator)
 * because Next.js prerenders the page at build time before the web
 * process has validated its environment.
 */

export type CustomerLoginPresentation =
  | {
      readonly mode: 'google';
      readonly enabled: boolean;
      readonly providerId: 'google';
    }
  | {
      readonly mode: 'test-oidc';
      readonly enabled: true;
      readonly providerId: string;
    };

export interface CustomerLoginEnvironment {
  readonly ROOM_TEST_OAUTH_BROWSER_ENABLED: string | undefined;
  readonly ROOM_TEST_OAUTH_PROVIDER_ID: string | undefined;
}

export const DEFAULT_GOOGLE_PROVIDER_ID = 'google' as const;

export function deriveCustomerLoginPresentation(
  environment: CustomerLoginEnvironment,
): CustomerLoginPresentation {
  if (environment.ROOM_TEST_OAUTH_BROWSER_ENABLED === 'true') {
    return {
      mode: 'test-oidc',
      enabled: true,
      providerId: environment.ROOM_TEST_OAUTH_PROVIDER_ID ?? '',
    };
  }
  return {
    mode: 'google',
    // Browser readiness is fetched from the API after hydration. This value is
    // retained as a false-safe server-rendered default for the login page.
    enabled: false,
    providerId: DEFAULT_GOOGLE_PROVIDER_ID,
  };
}
