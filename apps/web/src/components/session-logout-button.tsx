'use client';

import { useCallback, useState } from 'react';

import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function useSessionLogout(redirectTo: string) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const logout = useCallback(async () => {
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
  }, [locale, pending, redirectTo]);

  return { error, logout, pending };
}

export function SessionLogoutButton({ redirectTo }: { readonly redirectTo: string }) {
  const locale = useLocale();
  const { error, logout, pending } = useSessionLogout(redirectTo);

  const button = (
    <button disabled={pending} onClick={() => void logout()} type="button">
      {pending ? translate(locale, 'profile.loggingOut') : translate(locale, 'public.logout')}
    </button>
  );

  return (
    <div>
      {button}
      {error === undefined ? null : <p role="alert">{error}</p>}
    </div>
  );
}
