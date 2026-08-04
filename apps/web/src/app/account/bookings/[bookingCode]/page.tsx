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
  readonly createdAt: string;
}

interface PageProps {
  readonly params: Promise<{ readonly bookingCode: string }>;
}

export default async function CustomerBookingDetailPage({ params }: PageProps) {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  const { bookingCode } = await params;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBase === undefined) {
    return (
      <main>
        <p>{translate(locale, 'account.serverUnavailable')}</p>
      </main>
    );
  }
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie') ?? '';
  const response = await fetch(
    `${new URL(apiBase).origin}/api/v1/customer/bookings/${bookingCode}`,
    {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    },
  );
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
