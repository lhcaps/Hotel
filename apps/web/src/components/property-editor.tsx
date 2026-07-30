'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function PropertyEditor() {
  const locale = useLocale();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void adminApi
      .property()
      .then((property) => {
        if (!active) return;
        setCode(property.code);
        setName(property.name);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setMessage(
          cause instanceof AdminApiError
            ? translate(locale, 'property.loadError')
            : translate(locale, 'property.loadError'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const property = await adminApi.updateProperty({ code, name });
      setCode(property.code);
      setName(property.name);
      setMessage(translate(locale, 'property.saved'));
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'property.saveError')
          : translate(locale, 'property.saveError'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'admin.property')}</h1>
      <p>{translate(locale, 'property.help')}</p>
      {loading ? <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p> : null}
      <form onSubmit={save}>
        <label>
          {translate(locale, 'property.code')}
          <input
            disabled={loading || pending}
            onChange={(event) => setCode(event.target.value)}
            value={code}
          />
        </label>
        <label>
          {translate(locale, 'property.name')}
          <input
            disabled={loading || pending}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <button disabled={loading || pending} type="submit">
          {pending ? translate(locale, 'profile.saving') : translate(locale, 'property.save')}
        </button>
      </form>
      {message === undefined ? null : <p role="alert">{message}</p>}
    </section>
  );
}
