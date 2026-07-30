'use client';

import { useEffect, useId, useState } from 'react';
import type { BookingDetailResponse } from '@room/contracts';

import { bookingApi, BookingApiError } from '../lib/booking-api';
import { CouponSummary } from './coupon-summary';
import { PaymentProviderSelector } from './payment-provider-selector';
import { PaymentStatusSummary } from './payment-status-summary';
import { formatDateTime, formatVnd, translate, translatePaymentStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export interface BookingDetailPanelProps {
  readonly bookingCode: string;
  readonly email: string;
  readonly onLogout: () => void;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unauthorized'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly booking: BookingDetailResponse };

function describeProblem(locale: ReturnType<typeof useLocale>, error: BookingApiError): string {
  if (error.status === 401 || error.status === 403) {
    return translate(locale, 'guest.sessionExpired');
  }
  if (error.status === 404) {
    return translate(locale, 'guest.bookingNotFound');
  }
  if (error.status >= 500) {
    return translate(locale, 'guest.unavailable');
  }
  return error.message;
}

function describeUnknown(locale: ReturnType<typeof useLocale>, error: unknown): string {
  if (error instanceof BookingApiError) return describeProblem(locale, error);
  return translate(locale, 'guest.loadError');
}

export function BookingDetailPanel({ bookingCode, email, onLogout }: BookingDetailPanelProps) {
  const locale = useLocale();
  const formId = useId();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await bookingApi.getGuestBooking(bookingCode);
        if (!cancelled) setState({ kind: 'ready', booking: response });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof BookingApiError && (error.status === 401 || error.status === 403)) {
          setState({
            kind: 'unauthorized',
            message: describeProblem(locale, error),
          });
        } else {
          setState({ kind: 'error', message: describeUnknown(locale, error) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingCode, locale]);

  async function onLogoutClick() {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      await bookingApi.logoutGuestAccess();
      onLogout();
    } catch {
      onLogout();
    } finally {
      setLogoutPending(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <section
        aria-labelledby={`${formId}-heading`}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id={`${formId}-heading`} className="text-xl font-semibold">
          {translate(locale, 'guest.detailHeading')}
        </h2>
        <p aria-live="polite" className="mt-4 text-slate-600">
          {translate(locale, 'guest.loading')}
        </p>
      </section>
    );
  }

  if (state.kind === 'unauthorized' || state.kind === 'error') {
    return (
      <section
        aria-labelledby={`${formId}-heading`}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id={`${formId}-heading`} className="text-xl font-semibold">
          {translate(locale, 'guest.detailUnavailable')}
        </h2>
        <p className="mt-2 text-slate-600" role="alert">
          {state.message}
        </p>
      </section>
    );
  }

  const booking = state.booking;
  const expiresAt = booking.holdExpiresAt;

  return (
    <section
      aria-labelledby={`${formId}-heading`}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 id={`${formId}-heading`} className="text-xl font-semibold">
        {translate(locale, 'guest.detailHeading')}
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.bookingCode')}</dt>
          <dd className="font-mono text-lg font-semibold tracking-wide">{booking.bookingCode}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.status')}</dt>
          <dd className="font-medium">{translatePaymentStatus(locale, booking.status)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'guest.property')}</dt>
          <dd className="font-medium">{booking.property.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'guest.roomType')}</dt>
          <dd className="font-medium">{booking.roomType.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.checkIn')}</dt>
          <dd className="font-medium">{formatDateTime(locale, booking.checkIn)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.checkOut')}</dt>
          <dd className="font-medium">{formatDateTime(locale, booking.checkOut)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'admin.guest')}</dt>
          <dd className="font-medium">
            {translate(locale, 'guest.guests', {
              adults: booking.adults,
              children: booking.children,
            })}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.amount')}</dt>
          <dd className="font-medium">{formatVnd(locale, booking.amountVnd)}</dd>
        </div>
        {expiresAt !== null ? (
          <div>
            <dt className="text-sm text-slate-500">{translate(locale, 'hold.expiresAt')}</dt>
            <dd className="font-medium">{formatDateTime(locale, expiresAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'guest.contact')}</dt>
          <dd className="font-medium">
            {booking.contact.fullName}
            <br />
            <span className="text-sm text-slate-600">{booking.contact.emailMasked}</span>
            <br />
            <span className="text-sm text-slate-600">{booking.contact.phoneMasked}</span>
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-slate-500" data-testid="booking-email">
        {translate(locale, 'guest.queryingEmail', { email })}
      </p>

      {booking.coupon !== undefined ? (
        <div className="mt-4">
          <CouponSummary coupon={booking.coupon} testId="detail-coupon-summary" />
        </div>
      ) : null}

      {booking.status === 'HOLD' && booking.amountVnd > 0 ? (
        <PaymentProviderSelector bookingCode={booking.bookingCode} />
      ) : null}

      <PaymentStatusSummary bookingCode={booking.bookingCode} />

      <button
        className="mt-4 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 print:hidden"
        onClick={() => window.print()}
        type="button"
      >
        Print confirmation
      </button>

      <button
        aria-busy={logoutPending}
        className="mt-6 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 disabled:opacity-60"
        disabled={logoutPending}
        onClick={() => void onLogoutClick()}
        type="button"
      >
        {logoutPending ? translate(locale, 'guest.loggingOut') : translate(locale, 'guest.logout')}
      </button>
    </section>
  );
}
