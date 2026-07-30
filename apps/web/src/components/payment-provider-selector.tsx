'use client';

import { useEffect, useState } from 'react';

import { bookingApi, type PublicPaymentProvider } from '../lib/booking-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function PaymentProviderSelector({ bookingCode }: Readonly<{ bookingCode: string }>) {
  const locale = useLocale();
  const [providers, setProviders] = useState<readonly PublicPaymentProvider[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<'MOMO' | 'VNPAY' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void bookingApi
      .listPaymentProviders()
      .then((response) => {
        if (!Array.isArray(response)) {
          setMessage(translate(locale, 'payment.loadError'));
          return;
        }
        setProviders(response);
      })
      .catch(() => setMessage(translate(locale, 'payment.loadError')));
  }, [locale]);
  async function initiate(provider: 'MOMO' | 'VNPAY') {
    if (pending !== null) return;
    setPending(provider);
    setSelected(provider);
    setMessage(null);
    try {
      const result = await bookingApi.initiatePayment(
        bookingCode,
        provider,
        globalThis.crypto.randomUUID(),
      );
      const url = new URL(result.redirectUrl);
      if (url.protocol !== 'https:') throw new Error('unsafe redirect');
      globalThis.location.assign(url.toString());
    } catch {
      setMessage(translate(locale, 'payment.initError'));
      setPending(null);
    }
  }
  if (providers.length === 0)
    return (
      <p className="mt-4 text-sm text-slate-600">{translate(locale, 'payment.noProviders')}</p>
    );
  return (
    <section className="mt-6 border-t pt-4" aria-labelledby="payment-providers-heading">
      <h3 id="payment-providers-heading" className="font-semibold">
        {translate(locale, 'payment.selection')}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{translate(locale, 'payment.selectionHelp')}</p>
      <div className="payment-provider-options mt-3">
        {providers.map((provider) => (
          <div className={`payment-provider-option${selected === provider.provider ? ' payment-provider-option--selected' : ''}`} key={provider.provider}>
            <button
              aria-pressed={selected === provider.provider}
              className="payment-provider-option__button"
              type="button"
              disabled={!provider.enabled || pending !== null}
              onClick={() => void initiate(provider.provider)}
            >
              <span aria-hidden="true" className="payment-provider-option__name">{provider.displayName}</span>
              <span className="payment-provider-option__action">
                {pending === provider.provider
                  ? translate(locale, 'payment.redirecting')
                  : provider.enabled
                    ? translate(locale, 'payment.payWith', { provider: provider.displayName })
                    : translate(locale, 'payment.providerUnavailable')}
              </span>
            </button>
            {!provider.enabled ? (
              <p className="payment-provider-option__reason">
                {provider.maintenanceMessage ?? translate(locale, 'payment.providerUnavailable')}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {message ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
