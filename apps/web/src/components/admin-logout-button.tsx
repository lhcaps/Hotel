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
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (apiBase !== undefined) {
        await fetch(`${new URL(apiBase).origin}/api/auth/sign-out`, {
          method: 'POST',
          credentials: 'include',
        });
      }
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