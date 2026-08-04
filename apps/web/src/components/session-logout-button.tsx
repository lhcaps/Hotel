'use client';

import { useState } from 'react';

import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function SessionLogoutButton({ redirectTo }: { readonly redirectTo: string }) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(translate(locale, 'profile.logoutError'));
      globalThis.location.assign(redirectTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, 'profile.logoutError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button disabled={pending} onClick={() => void logout()} type="button">
        {pending ? translate(locale, 'profile.loggingOut') : translate(locale, 'public.logout')}
      </button>
      {error === undefined ? null : <p role="alert">{error}</p>}
    </div>
  );
}
