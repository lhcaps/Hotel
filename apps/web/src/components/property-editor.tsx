'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function PropertyEditor() {
  const locale = useLocale();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [minimumStayMinutes, setMinimumStayMinutes] = useState(60);
  const [maximumStayMinutes, setMaximumStayMinutes] = useState(10080);
  const [minimumLeadTimeMinutes, setMinimumLeadTimeMinutes] = useState(0);
  const [maximumAdvanceBookingDays, setMaximumAdvanceBookingDays] = useState(365);
  const [defaultOvernightDurationMinutes, setDefaultOvernightDurationMinutes] = useState(720);
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
        setMinimumStayMinutes(property.minimumStayMinutes ?? 60);
        setMaximumStayMinutes(property.maximumStayMinutes ?? 10080);
        setMinimumLeadTimeMinutes(property.minimumLeadTimeMinutes ?? 0);
        setMaximumAdvanceBookingDays(property.maximumAdvanceBookingDays ?? 365);
        setDefaultOvernightDurationMinutes(property.defaultOvernightDurationMinutes ?? 720);
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
      const property = await adminApi.updateProperty({
        code,
        name,
        minimumStayMinutes,
        maximumStayMinutes,
        minimumLeadTimeMinutes,
        maximumAdvanceBookingDays,
        defaultOvernightDurationMinutes,
      });
      setCode(property.code);
      setName(property.name);
      setMinimumStayMinutes(property.minimumStayMinutes ?? minimumStayMinutes);
      setMaximumStayMinutes(property.maximumStayMinutes ?? maximumStayMinutes);
      setMinimumLeadTimeMinutes(property.minimumLeadTimeMinutes ?? minimumLeadTimeMinutes);
      setMaximumAdvanceBookingDays(property.maximumAdvanceBookingDays ?? maximumAdvanceBookingDays);
      setDefaultOvernightDurationMinutes(
        property.defaultOvernightDurationMinutes ?? defaultOvernightDurationMinutes,
      );
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
        <label>
          {translate(locale, 'property.minimumStayMinutes')}
          <input
            disabled={loading || pending}
            min={1}
            onChange={(event) => setMinimumStayMinutes(Number(event.target.value))}
            type="number"
            value={minimumStayMinutes}
          />
        </label>
        <label>
          {translate(locale, 'property.maximumStayMinutes')}
          <input
            disabled={loading || pending}
            min={1}
            onChange={(event) => setMaximumStayMinutes(Number(event.target.value))}
            type="number"
            value={maximumStayMinutes}
          />
        </label>
        <label>
          {translate(locale, 'property.minimumLeadTimeMinutes')}
          <input
            disabled={loading || pending}
            min={0}
            onChange={(event) => setMinimumLeadTimeMinutes(Number(event.target.value))}
            type="number"
            value={minimumLeadTimeMinutes}
          />
        </label>
        <label>
          {translate(locale, 'property.maximumAdvanceBookingDays')}
          <input
            disabled={loading || pending}
            min={0}
            onChange={(event) => setMaximumAdvanceBookingDays(Number(event.target.value))}
            type="number"
            value={maximumAdvanceBookingDays}
          />
        </label>
        <label>
          {translate(locale, 'property.defaultOvernightDurationMinutes')}
          <input
            disabled={loading || pending}
            min={1}
            onChange={(event) => setDefaultOvernightDurationMinutes(Number(event.target.value))}
            type="number"
            value={defaultOvernightDurationMinutes}
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
