'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Spinner } from './ui/spinner';
import { Button } from './ui/button';
import { useLocale } from './locale-provider';
import { translate } from '../lib/i18n/messages';

export function AdminLogoutButton() {
  const router = useRouter();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      // Use the same-origin proxy so the session cookie set by sign-in is
      // cleared on the web origin (not just on the API origin where the
      // browser would refuse to send a cross-site fetch).
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'same-origin',
      });
      router.replace('/admin/login');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, 'admin.loginError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-logout-button">
      <Button
        aria-busy={pending}
        className="admin-logout-button__trigger"
        disabled={pending}
        onClick={() => void logout()}
        size="sm"
        type="button"
        variant="outline"
      >
        {pending ? (
          <>
            <Spinner aria-hidden="true" />
            {translate(locale, 'admin.signingIn')}
          </>
        ) : (
          translate(locale, 'public.logout')
        )}
      </Button>
      {error === undefined ? null : <p role="alert">{error}</p>}
    </div>
  );
}
