'use client';

import { useState, useTransition } from 'react';

import { type Locale, translate } from '../lib/i18n/messages';

export function LocaleSwitch({ locale }: { readonly locale: Locale }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const next = locale === 'vi' ? 'en' : 'vi';

  function switchLocale() {
    startTransition(async () => {
      setError(undefined);
      try {
        const response = await fetch('/locale', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale: next }),
        });
        if (!response.ok) throw new Error('locale update failed');
        window.location.reload();
      } catch {
        setError(translate(locale, 'locale.changeError'));
      }
    });
  }

  return (
    <div>
      <button
        aria-label={translate(locale, 'locale.switch')}
        disabled={pending}
        onClick={switchLocale}
        type="button"
      >
        {translate(locale, 'locale.switch')}
      </button>
      {error === undefined ? null : <p role="alert">{error}</p>}
    </div>
  );
}
