'use client';

import { useEffect, useState } from 'react';

import { useLocale } from '../../../components/locale-provider';
import { resolvePublicApiOrigin } from '../../../lib/public-api-origin';
import {
  formatDateTime,
  formatVnd,
  translate,
  translatePaymentStatus,
  type Locale,
} from '../../../lib/i18n/messages';

interface BookingSummary {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly currency: string;
  readonly finalAmountVnd: string;
  readonly createdAt: string;
}

interface BookingListResponse {
  readonly items: readonly BookingSummary[];
  readonly nextCursor: string | null;
}

type BookingsState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }
  | { kind: 'ready'; items: readonly BookingSummary[] };

export function CustomerBookingsClient() {
  const locale = useLocale();
  const [state, setState] = useState<BookingsState>({ kind: 'loading' });

  useEffect(() => {
    const origin = resolvePublicApiOrigin();
    if (origin === undefined) {
      setState({ kind: 'error' });
      return;
    }
    let cancelled = false;
    void fetch(`${origin}/api/v1/customer/bookings?limit=20`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setState({ kind: 'unauthenticated' });
          return;
        }
        if (!response.ok) {
          setState({ kind: 'error' });
          return;
        }
        const payload = (await response.json()) as BookingListResponse;
        setState({ kind: 'ready', items: payload.items });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="account-page" id="main-content">
      <div className="account-page__inner">
        <header className="account-page__heading">
          <h1>{translate(locale, 'account.bookingsHeading')}</h1>
        </header>
        {renderBody(state, locale)}
      </div>
    </main>
  );
}

function renderBody(state: BookingsState, locale: Locale): React.ReactNode {
  if (state.kind === 'loading') {
    return <p className="account-empty">{translate(locale, 'account.bookingsLoading')}</p>;
  }
  if (state.kind === 'unauthenticated') {
    return (
      <p>
        <a href="/login">{translate(locale, 'account.signInBookings')}</a>
      </p>
    );
  }
  if (state.kind === 'error') {
    return <p>{translate(locale, 'account.bookingsLoadError')}</p>;
  }
  if (state.items.length === 0) {
    return <p className="account-empty">{translate(locale, 'account.bookingsEmpty')}</p>;
  }
  return (
    <ul className="booking-list">
      {state.items.map((item) => (
        <li key={item.bookingId}>
          <a href={`/account/bookings/${item.bookingCode}`}>
            <span>
              <strong>{item.bookingCode}</strong>
              <small>
                {formatDateTime(locale, item.checkIn)} &rarr;{' '}
                {formatDateTime(locale, item.checkOut)}
              </small>
            </span>
            <span>
              <em>{translatePaymentStatus(locale, item.status)}</em>
              <strong>{formatVnd(locale, Number(item.finalAmountVnd))}</strong>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
