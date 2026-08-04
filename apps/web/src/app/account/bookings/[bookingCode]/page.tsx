import { cookies, headers } from 'next/headers';
import { BookingAccessPassPanel } from '../../../../components/booking-access-pass-panel';
import { CustomerBookingActions } from '../../../../components/customer-booking-actions';
import { PaymentProviderSelector } from '../../../../components/payment-provider-selector';
import { PaymentStatusSummary } from '../../../../components/payment-status-summary';

import {
  formatDateTime,
  formatVnd,
  resolveLocale,
  translate,
  translatePaymentStatus,
} from '../../../../lib/i18n/messages';
import { resolveInternalApiBaseUrl } from '../../../../lib/internal-api';

/*
 * The browser API base is public and points at Caddy. Server Components must
 * use the private Compose API origin so a production render never depends on
 * resolving the public hostname from inside the web container.
 */

interface BookingDetail {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly currency: string;
  readonly grossAmountVnd: string;
  readonly discountAmountVnd: string;
  readonly finalAmountVnd: string;
  readonly paymentStatus: string;
  readonly adults: number;
  readonly children: number;
  readonly roomType: { readonly id: string; readonly name: string };
  readonly offer: { readonly code: string; readonly label: string } | null;
  readonly cancellationPolicy: {
    readonly code: string;
    readonly version: number;
    readonly capturedAt: string;
    readonly checkIn: string;
    readonly refundBasis: 'PAID_AMOUNT';
    readonly timezone: string;
    readonly sevenDayDeadline: string;
    readonly threeDayDeadline: string;
  } | null;
  readonly cancellationRefundState: string | null;
  readonly cancellationRefundAmountVnd: string | null;
  readonly cancellationRetainedAmountVnd: string | null;
  readonly createdAt: string;
}

interface PageProps {
  readonly params: Promise<{ readonly bookingCode: string }>;
}

export default async function CustomerBookingDetailPage({ params }: PageProps) {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  const { bookingCode } = await params;
  const internalApiBase = resolveInternalApiBaseUrl();
  if (internalApiBase === undefined) {
    return (
      <main>
        <p>{translate(locale, 'account.serverUnavailable')}</p>
      </main>
    );
  }
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie') ?? '';
  const response = await fetch(`${internalApiBase}/customer/bookings/${bookingCode}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (response.status === 401) {
    return (
      <main>
        <p>
          <a href="/login">{translate(locale, 'account.signInBookingDetail')}</a>
        </p>
      </main>
    );
  }
  if (response.status === 404) {
    return (
      <main>
        <p>{translate(locale, 'account.bookingNotFound')}</p>
      </main>
    );
  }
  if (!response.ok) {
    return (
      <main>
        <p>{translate(locale, 'account.bookingLoadError')}</p>
      </main>
    );
  }
  const booking = (await response.json()) as BookingDetail;
  return (
    <main className="account-page" id="main-content">
      <div className="account-page__inner">
        <header className="account-page__heading">
          <h1>{translate(locale, 'account.bookingHeading', { code: booking.bookingCode })}</h1>
        </header>
        <dl className="booking-detail">
          <div>
            <dt>{translate(locale, 'account.status')}</dt>
            <dd>{translatePaymentStatus(locale, booking.status)}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'account.payment')}</dt>
            <dd>{translatePaymentStatus(locale, booking.paymentStatus)}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'account.roomType')}</dt>
            <dd>{booking.roomType.name}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'account.offer')}</dt>
            <dd>{booking.offer?.label ?? translate(locale, 'account.notAvailable')}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'account.checkIn')}</dt>
            <dd>{formatDateTime(locale, booking.checkIn)}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'account.checkOut')}</dt>
            <dd>{formatDateTime(locale, booking.checkOut)}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'account.grossTotal')}</dt>
            <dd>{formatVnd(locale, Number(booking.grossAmountVnd))}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'account.discount')}</dt>
            <dd>{formatVnd(locale, Number(booking.discountAmountVnd))}</dd>
          </div>
          <div className="booking-detail__total">
            <dt>{translate(locale, 'account.finalTotal')}</dt>
            <dd>{formatVnd(locale, Number(booking.finalAmountVnd))}</dd>
          </div>
        </dl>
        <section aria-labelledby="cancellation-policy-heading">
          <h2 id="cancellation-policy-heading">
            {translate(locale, 'account.cancellationPolicy')}
          </h2>
          {booking.cancellationPolicy === null ? (
            <p>{translate(locale, 'account.cancellationPolicyUnavailable')}</p>
          ) : (
            <div>
              <p>{translate(locale, 'account.cancellationPolicyBasis')}</p>
              <ul>
                <li>{translate(locale, 'account.cancellationRule7Days')}</li>
                <li>{translate(locale, 'account.cancellationRule3Days')}</li>
                <li>{translate(locale, 'account.cancellationRuleUnder3Days')}</li>
              </ul>
              <p>
                {translate(locale, 'account.cancellationBoundary7Days')}:{' '}
                {formatDateTime(locale, booking.cancellationPolicy.sevenDayDeadline)} ·{' '}
                {translate(locale, 'account.cancellationBoundary3Days')}:{' '}
                {formatDateTime(locale, booking.cancellationPolicy.threeDayDeadline)} (
                {booking.cancellationPolicy.timezone})
              </p>
              <p>
                {booking.cancellationPolicy.code} v{booking.cancellationPolicy.version} ·{' '}
                {formatDateTime(locale, booking.cancellationPolicy.capturedAt)}
              </p>
            </div>
          )}
        </section>
        {booking.status === 'HOLD' && Number(booking.finalAmountVnd) > 0 ? (
          <PaymentProviderSelector bookingCode={booking.bookingCode} customer />
        ) : null}
        <PaymentStatusSummary bookingCode={booking.bookingCode} customer />
        <BookingAccessPassPanel bookingCode={booking.bookingCode} customer />
        <CustomerBookingActions
          adults={booking.adults}
          bookingCode={booking.bookingCode}
          checkIn={booking.checkIn}
          checkOut={booking.checkOut}
          children={booking.children}
          finalAmountVnd={booking.finalAmountVnd}
        />
      </div>
    </main>
  );
}
