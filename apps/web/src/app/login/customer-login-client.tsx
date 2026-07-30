'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { CustomerLoginPresentation } from './customer-login-presentation';
import { useLocale } from '../../components/locale-provider';

import { type Locale, translate } from '../../lib/i18n/messages';

const GOOGLE_SIGN_IN_ENDPOINT = '/api/auth/sign-in/social';
const GENERIC_OAUTH_SIGN_IN_ENDPOINT = '/api/auth/sign-in/oauth2';
const CALLBACK_PATH = '/account/bookings';

interface CustomerLoginClientProps {
  readonly presentation: CustomerLoginPresentation;
}

function hasGoogleReadiness(value: unknown): value is { google: { enabled: boolean } } {
  if (typeof value !== 'object' || value === null || !('google' in value)) return false;
  const google = value.google;
  return (
    typeof google === 'object' &&
    google !== null &&
    'enabled' in google &&
    typeof google.enabled === 'boolean' &&
    'unavailableReason' in google &&
    (google.unavailableReason === null || google.unavailableReason === 'CONFIGURATION_REQUIRED')
  );
}

function parseSignInInitiation(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('url' in value)) return undefined;
  const url = value.url;
  if (typeof url !== 'string') return undefined;
  try {
    return new URL(url).toString();
  } catch {
    return undefined;
  }
}

async function fetchGoogleReadiness(): Promise<boolean> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBase === undefined) return false;
  const response = await fetch(`${apiBase}/public/provider-readiness`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) return false;
  const body: unknown = await response.json();
  return hasGoogleReadiness(body) && body.google.enabled;
}

async function initiateSignIn(
  locale: Locale,
  apiOrigin: string,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${apiOrigin}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(translate(locale, 'login.startError'));
  }
  const redirectUrl = parseSignInInitiation(await response.json());
  if (redirectUrl === undefined) throw new Error(translate(locale, 'login.redirectUrlError'));
  return redirectUrl;
}

export function CustomerLoginClient({ presentation }: CustomerLoginClientProps) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();

  useEffect(() => {
    if (presentation.mode === 'google') {
      void fetchGoogleReadiness().then(setGoogleReady);
    }
  }, [presentation.mode]);

  async function startGoogle() {
    if (presentation.mode !== 'google') return;
    if (!googleReady) {
      setError(translate(locale, 'login.unavailable'));
      return;
    }
    await beginSignIn(locale, setPending, setError, GOOGLE_SIGN_IN_ENDPOINT, {
      provider: presentation.providerId,
      callbackURL: callbackUrl(),
    });
  }

  async function startTestIdentity() {
    if (presentation.mode !== 'test-oidc') return;
    await beginSignIn(locale, setPending, setError, GENERIC_OAUTH_SIGN_IN_ENDPOINT, {
      providerId: presentation.providerId,
      callbackURL: callbackUrl(),
    });
  }

  function useGuestAccess() {
    router.push('/booking/manage');
  }

  return (
    <main className="login-page" aria-labelledby="customer-login-heading">
      <section className="login-card">
        <h1 id="customer-login-heading">{translate(locale, 'login.heading')}</h1>
        {presentation.mode === 'google' ? (
          <>
            <p>{translate(locale, 'login.googleHelp')}</p>
            <button
              type="button"
              className="login-card__google"
              disabled={!googleReady || pending}
              onClick={() => {
                void startGoogle();
              }}
            >
              {pending ? translate(locale, 'login.redirecting') : translate(locale, 'login.google')}
            </button>
            {!googleReady ? <p role="status">{translate(locale, 'login.googleDisabled')}</p> : null}
          </>
        ) : (
          <>
            <p>{translate(locale, 'login.testHelp')}</p>
            <button
              type="button"
              className="login-card__google"
              data-testid="test-identity-button"
              disabled={pending}
              onClick={() => {
                void startTestIdentity();
              }}
            >
              {pending
                ? translate(locale, 'login.redirecting')
                : translate(locale, 'login.testIdentity')}
            </button>
          </>
        )}
        {error === undefined ? null : <p role="alert">{error}</p>}
      </section>
      <section className="login-card login-card--secondary">
        <h2>{translate(locale, 'login.guestHeading')}</h2>
        <p>{translate(locale, 'login.guestHelp')}</p>
        <button type="button" onClick={useGuestAccess}>
          {translate(locale, 'login.guestAccess')}
        </button>
      </section>
    </main>
  );
}

function callbackUrl(): string {
  if (typeof window === 'undefined') return CALLBACK_PATH;
  return `${window.location.origin}${CALLBACK_PATH}`;
}

async function beginSignIn(
  locale: Locale,
  setPending: (value: boolean) => void,
  setError: (value: string | undefined) => void,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  setPending(true);
  setError(undefined);
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBase === undefined) throw new Error(translate(locale, 'login.serverError'));
    const apiOrigin = new URL(apiBase).origin;
    const redirectUrl = await initiateSignIn(locale, apiOrigin, endpoint, body);
    window.location.assign(redirectUrl);
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : translate(locale, 'login.error'));
    setPending(false);
  }
}
