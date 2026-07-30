'use client';

import { useState, useTransition } from 'react';

import { type Locale, translate } from '../lib/i18n/messages';

export function AccountLanguageSettings({ locale }: Readonly<{ locale: Locale }>) {
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, startTransition] = useTransition();
  const changed = selectedLocale !== locale;

  function saveLocale() {
    if (!changed) return;
    startTransition(async () => {
      setStatus('idle');
      try {
        const response = await fetch('/locale', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale: selectedLocale }),
        });
        if (!response.ok) throw new Error('locale update failed');
        setStatus('saved');
        window.location.reload();
      } catch {
        setStatus('error');
      }
    });
  }

  return (
    <section aria-labelledby="account-language-heading" className="account-settings">
      <h2 id="account-language-heading">{translate(locale, 'account.languageHeading')}</h2>
      <p>{translate(locale, 'account.languageHelp')}</p>
      <fieldset>
        <legend className="sr-only">{translate(locale, 'account.languageHeading')}</legend>
        <label>
          <input
            checked={selectedLocale === 'vi'}
            name="locale"
            onChange={() => setSelectedLocale('vi')}
            type="radio"
            value="vi"
          />
          {translate(locale, 'account.languageVietnamese')}
        </label>
        <label>
          <input
            checked={selectedLocale === 'en'}
            name="locale"
            onChange={() => setSelectedLocale('en')}
            type="radio"
            value="en"
          />
          {translate(locale, 'account.languageEnglish')}
        </label>
      </fieldset>
      <button disabled={!changed || pending} onClick={saveLocale} type="button">
        {pending
          ? translate(locale, 'account.savingLanguage')
          : translate(locale, 'account.saveLanguage')}
      </button>
      {status === 'saved' ? (
        <p role="status">{translate(locale, 'account.languageSaved')}</p>
      ) : null}
      {status === 'error' ? (
        <p role="alert">{translate(locale, 'account.languageSaveError')}</p>
      ) : null}
    </section>
  );
}
