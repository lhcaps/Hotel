'use client';

import Link from 'next/link';
import type { BookingDetailResponse, PaymentStatusResponse } from '@room/contracts';

import { CouponSummary } from './coupon-summary';
import { BookingAccessPassPanel } from './booking-access-pass-panel';
import { CancellationPolicySummary } from './cancellation-policy-summary';
import { useLocale } from './locale-provider';
import { formatDateTime, formatVnd, translate } from '../lib/i18n/messages';

export interface ConfirmedSuccessPanelProps {
  readonly booking: BookingDetailResponse;
  readonly payment: PaymentStatusResponse;
}

export function ConfirmedSuccessPanel({ booking, payment }: ConfirmedSuccessPanelProps) {
  const locale = useLocale();
  const headingId = 'confirmed-success-heading';
  const amountVnd = payment.amountVnd > 0 ? payment.amountVnd : booking.amountVnd;
  const providerLabel =
    payment.provider === null
      ? '—'
      : payment.provider === 'MOMO'
        ? translate(locale, 'payment.provider.momo')
        : payment.provider;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm"
      data-testid="confirmed-success-surface"
      role="region"
    >
      <h2
        id={headingId}
        className="break-words text-2xl font-semibold text-emerald-900"
        data-testid="confirmed-success-heading"
        tabIndex={-1}
      >
        {translate(locale, 'success.heading')}
      </h2>
      <p className="mt-2 text-emerald-900">{translate(locale, 'success.subHeading')}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'hold.bookingCode')}</dt>
          <dd className="break-all font-mono text-base font-semibold tracking-wide">
            {booking.bookingCode}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'guest.property')}</dt>
          <dd className="font-medium">{booking.property.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'guest.roomType')}</dt>
          <dd className="font-medium">{booking.roomType.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'hold.checkIn')}</dt>
          <dd className="font-medium">{formatDateTime(locale, booking.checkIn)}</dd>
        </div>
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'hold.checkOut')}</dt>
          <dd className="font-medium">{formatDateTime(locale, booking.checkOut)}</dd>
        </div>
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'admin.guest')}</dt>
          <dd className="font-medium">
            {translate(locale, 'guest.guests', {
              adults: booking.adults,
              children: booking.children,
            })}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'payment.payment')}</dt>
          <dd className="font-medium">{providerLabel}</dd>
        </div>
        <div>
          <dt className="text-sm text-emerald-800">{translate(locale, 'hold.amount')}</dt>
          <dd className="font-medium">{formatVnd(locale, amountVnd)}</dd>
        </div>
      </dl>

      {booking.coupon !== undefined ? (
        <div className="mt-4">
          <CouponSummary coupon={booking.coupon} testId="success-coupon-summary" />
        </div>
      ) : null}

      <CancellationPolicySummary
        className="mt-6 rounded-md border border-emerald-200 bg-white/70 p-4"
        policy={booking.cancellationPolicy}
      />

      <BookingAccessPassPanel bookingCode={booking.bookingCode} />

      <p className="mt-4 text-sm text-emerald-900" role="status">
        {translate(locale, 'success.emailNotice')}
      </p>

      {process.env['NEXT_PUBLIC_DEMO_MAILPIT_HINT'] === 'true' ? (
        <p className="mt-2 text-xs text-emerald-700" data-testid="demo-mailpit-hint">
          {translate(locale, 'success.demoMailpit')}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <button className="hospitality-button" onClick={() => window.print()} type="button">
          {translate(locale, 'success.print')}
        </button>
        <Link className="hospitality-button" href={`/booking/manage/${booking.bookingCode}`}>
          {translate(locale, 'success.manage')}
        </Link>
        <Link className="hospitality-button" href="/">
          {translate(locale, 'success.home')}
        </Link>
      </div>
    </section>
  );
}
