'use client';

import { useEffect, useState } from 'react';
import type { BookingAccessPassResponse } from '@room/contracts';

import { BookingApiError, bookingApi } from '../lib/booking-api';
import { formatDateTime, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

type AccessPassState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'ready';
      readonly expiresAt: string;
      readonly svg: string;
      readonly arrival?: BookingAccessPassResponse['arrival'];
    };

export function BookingAccessPassPanel({
  bookingCode,
  customer = false,
}: {
  readonly bookingCode: string;
  readonly customer?: boolean;
}) {
  const locale = useLocale();
  const [state, setState] = useState<AccessPassState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (
      customer
        ? bookingApi.getCustomerBookingAccessPass(bookingCode)
        : bookingApi.getBookingAccessPass(bookingCode)
    )
      .then((pass) => {
        if (!cancelled) {
          setState({
            kind: 'ready',
            expiresAt: pass.expiresAt,
            svg: pass.svg,
            arrival: pass.arrival,
          });
        }
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
  }, [bookingCode, customer]);

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
      {state.arrival === undefined ? null : (
        <>
          <dl className="mt-5 grid gap-3 border-t border-emerald-100 pt-4 text-sm text-slate-800 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.gatePass')}
              </dt>
              <dd>{state.arrival.gatePass}</dd>
            </div>
            <div>
              <dt className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.roomPass')}
              </dt>
              <dd>{state.arrival.roomPass}</dd>
            </div>
            <div>
              <dt className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.wifi')}
              </dt>
              <dd>{state.arrival.wifi.ssid}</dd>
            </div>
            <div>
              <dt className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.wifiPassword')}
              </dt>
              <dd>{state.arrival.wifi.password}</dd>
            </div>
            <div>
              <dt className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.location')}
              </dt>
              <dd>{state.arrival.location}</dd>
            </div>
            <div>
              <dt className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.support')}
              </dt>
              <dd>{state.arrival.supportContact}</dd>
            </div>
          </dl>
          <div className="mt-4 space-y-2 border-t border-emerald-100 pt-4 text-sm text-slate-800">
            <p>
              <span className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.arrivalInstructions')}
              </span>
              {state.arrival.instructions}
            </p>
            <p>
              <span className="font-medium text-emerald-950">
                {translate(locale, 'accessPass.preparationNote')}
              </span>
              {state.arrival.preparationNote}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
