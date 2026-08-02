'use client';

import { useEffect, useState } from 'react';

import { BookingApiError, bookingApi } from '../lib/booking-api';
import { formatDateTime, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

type AccessPassState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'ready'; readonly expiresAt: string; readonly svg: string };

export function BookingAccessPassPanel({ bookingCode }: { readonly bookingCode: string }) {
  const locale = useLocale();
  const [state, setState] = useState<AccessPassState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void bookingApi
      .getBookingAccessPass(bookingCode)
      .then((pass) => {
        if (!cancelled) setState({ kind: 'ready', expiresAt: pass.expiresAt, svg: pass.svg });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof BookingApiError && error.status === 409) {
          setState({ kind: 'unavailable' });
          return;
        }
        setState({ kind: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [bookingCode]);

  if (state.kind === 'loading') return null;

  if (state.kind === 'unavailable') {
    return (
      <p className="mt-4 text-sm text-slate-600">{translate(locale, 'accessPass.unavailable')}</p>
    );
  }

  return (
    <section
      aria-labelledby="booking-access-pass-heading"
      className="mt-6 rounded-lg border border-emerald-200 bg-white p-4"
    >
      <h3 className="font-semibold text-emerald-950" id="booking-access-pass-heading">
        {translate(locale, 'accessPass.heading')}
      </h3>
      <p className="mt-1 text-sm text-slate-700">{translate(locale, 'accessPass.instructions')}</p>
      <img
        alt={translate(locale, 'accessPass.imageAlt')}
        className="mt-4 h-64 w-64 max-w-full rounded bg-white p-2"
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.svg)}`}
      />
      <p className="mt-2 text-xs text-slate-600">
        {translate(locale, 'accessPass.expiresAt', {
          expiresAt: formatDateTime(locale, state.expiresAt),
        })}
      </p>
    </section>
  );
}
