'use client';

import { useState } from 'react';

import { useLocale } from '../../../../components/locale-provider';
import { translate } from '../../../../lib/i18n/messages';

interface ClaimBookingClientProps {
  readonly apiBase: string;
  readonly bookingCode: string;
}

export function ClaimBookingClient({ apiBase, bookingCode }: ClaimBookingClientProps) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function claim() {
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await fetch(
        `${new URL(apiBase).origin}/api/v1/customer/bookings/${bookingCode}/claim`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
        },
      );
      if (response.status === 401) {
        throw new Error(translate(locale, 'claim.signInRequired'));
      }
      if (response.status === 409) {
        throw new Error(translate(locale, 'claim.alreadyClaimed'));
      }
      if (!response.ok) {
        throw new Error(translate(locale, 'claim.error'));
      }
      setMessage(translate(locale, 'claim.success'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, 'claim.error'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2>{translate(locale, 'claim.heading', { code: bookingCode })}</h2>
      <p>{translate(locale, 'claim.help')}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          void claim();
        }}
      >
        {pending ? translate(locale, 'claim.pending') : translate(locale, 'claim.submit')}
      </button>
      {error === undefined ? null : <p role="alert">{error}</p>}
      {message === undefined ? null : <p role="status">{message}</p>}
    </section>
  );
}
