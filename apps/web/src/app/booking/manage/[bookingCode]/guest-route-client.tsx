'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BookingDetailPanel } from '../../../../components/booking-detail-panel';
import { ConfirmedSuccessPanel } from '../../../../components/confirmed-success-panel';
import { PaymentStatusSummary } from '../../../../components/payment-status-summary';
import { bookingApi, BookingApiError } from '../../../../lib/booking-api';
import { useLocale } from '../../../../components/locale-provider';
import { translate, translatePaymentStatus } from '../../../../lib/i18n/messages';
import type { BookingDetailResponse, PaymentStatusResponse } from '@room/contracts';

const BOOKING_CODE_PATTERN = /^[A-Z0-9-]{8,32}$/;

type ViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly booking: BookingDetailResponse };

export function GuestBookingRouteClient() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ bookingCode: string }>();
  const raw = params?.bookingCode ?? '';
  const bookingCode = raw.toUpperCase();
  const valid = BOOKING_CODE_PATTERN.test(bookingCode);
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [payment, setPayment] = useState<PaymentStatusResponse | null>(null);

  useEffect(() => {
    if (!valid) {
      setState({ kind: 'error', message: translate(locale, 'guest.bookingNotFound') });
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        const booking = await bookingApi.getGuestBooking(bookingCode);
        if (cancelled) return;
        setState({ kind: 'ready', booking });
        try {
          const status = await bookingApi.getPaymentStatus(bookingCode);
          if (!cancelled) setPayment(status);
        } catch {
          // Payment status is auxiliary for the persistent route. The booking
          // detail payload alone is sufficient to render the page.
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof BookingApiError && (error.status === 401 || error.status === 403)) {
          setState({ kind: 'unauthorized' });
        } else if (error instanceof BookingApiError && error.status === 404) {
          setState({ kind: 'error', message: translate(locale, 'guest.bookingNotFound') });
        } else {
          setState({
            kind: 'error',
            message:
              error instanceof BookingApiError && error.status >= 500
                ? translate(locale, 'guest.unavailable')
                : translate(locale, 'guest.loadError'),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingCode, locale, valid]);

  function onSessionExpired() {
    router.replace('/booking/manage');
  }

  function onLogout() {
    router.replace('/booking/manage');
  }

  if (state.kind === 'loading') {
    return (
      <main className="guest-access-page" id="main-content">
        <div className="guest-access-page__inner">
          <header className="guest-access-page__heading">
            <p>{translate(locale, 'guest.manageEyebrow')}</p>
            <h1>{translate(locale, 'guest.detailHeading')}</h1>
          </header>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p aria-live="polite">{translate(locale, 'guest.loading')}</p>
          </section>
        </div>
      </main>
    );
  }

  if (state.kind === 'unauthorized') {
    return (
      <main className="guest-access-page" id="main-content">
        <div className="guest-access-page__inner">
          <header className="guest-access-page__heading">
            <p>{translate(locale, 'guest.manageEyebrow')}</p>
            <h1>{translate(locale, 'guest.detailHeading')}</h1>
          </header>
          <section
            aria-labelledby="guest-route-unauthorized-heading"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="guest-route-unauthorized-heading" className="text-xl font-semibold">
              {translate(locale, 'guest.detailUnavailable')}
            </h2>
            <p className="mt-2 text-slate-600" role="alert">
              {translate(locale, 'guest.sessionExpired')}
            </p>
            <button
              className="mt-6 inline-flex items-center justify-center rounded-md bg-sky-700 px-4 py-2 font-medium text-white"
              onClick={onSessionExpired}
              type="button"
            >
              {translate(locale, 'guest.sessionExpiredAction')}
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className="guest-access-page" id="main-content">
        <div className="guest-access-page__inner">
          <header className="guest-access-page__heading">
            <p>{translate(locale, 'guest.manageEyebrow')}</p>
            <h1>{translate(locale, 'guest.detailHeading')}</h1>
          </header>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p role="alert">{state.message}</p>
            <Link className="hospitality-button mt-4" href="/booking/manage">
              {translate(locale, 'public.guestAccess')}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const isConfirmed =
    state.booking.status === 'CONFIRMED' &&
    payment !== null &&
    payment.paymentStatus === 'SUCCEEDED';

  return (
    <main className="guest-access-page" id="main-content">
      <div className="guest-access-page__inner">
        <header className="guest-access-page__heading">
          <p>{translate(locale, 'guest.manageEyebrow')}</p>
          <h1>{translate(locale, 'guest.detailHeading')}</h1>
          {payment !== null ? (
            <p className="text-xs text-slate-500" data-testid="guest-route-payment-state">
              {translatePaymentStatus(locale, payment.paymentStatus)}
            </p>
          ) : null}
        </header>
        {isConfirmed && payment !== null ? (
          <ConfirmedSuccessPanel booking={state.booking} payment={payment} />
        ) : null}
        <BookingDetailPanel
          bookingCode={state.booking.bookingCode}
          email={state.booking.contact.emailMasked.replace(/^\*+/, '')}
          onLogout={onLogout}
        />
        <PaymentStatusSummary bookingCode={state.booking.bookingCode} />
      </div>
    </main>
  );
}
