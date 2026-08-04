'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLocale } from '../../components/locale-provider';
import { translate } from '../../lib/i18n/messages';

export function CustomerLoginAdminState() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page" aria-labelledby="customer-login-heading">
      <section className="login-card">
        <h1 id="customer-login-heading">{translate(locale, 'login.adminSessionTitle')}</h1>
        <p>{translate(locale, 'login.adminSessionHelp')}</p>
        <p>
          <Link className="login-card__google" href="/admin">
            {translate(locale, 'login.openAdmin')}
          </Link>
        </p>
        <button disabled={pending} onClick={() => void logout()} type="button">
          {pending
            ? translate(locale, 'login.adminLogoutPending')
            : translate(locale, 'login.adminLogout')}
        </button>
      </section>
    </main>
  );
}
