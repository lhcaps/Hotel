import { cookies, headers } from 'next/headers';

import { formatDateTime, formatVnd, resolveLocale, translate, translatePaymentStatus } from '../../../lib/i18n/messages';

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

export default async function CustomerBookingsPage() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
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
  const response = await fetch(`${new URL(apiBase).origin}/api/v1/customer/bookings?limit=20`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (response.status === 401) {
    return (
      <main>
        <p>
          <a href="/login">{translate(locale, 'account.signInBookings')}</a>
        </p>
      </main>
    );
  }
  if (!response.ok) {
    return (
      <main>
        <p>{translate(locale, 'account.bookingsLoadError')}</p>
      </main>
    );
  }
  const payload = (await response.json()) as BookingListResponse;
  return (
    <main className="account-page" id="main-content">
      <div className="account-page__inner">
        <header className="account-page__heading">
          <h1>{translate(locale, 'account.bookingsHeading')}</h1>
        </header>
        {payload.items.length === 0 ? (
          <p className="account-empty">{translate(locale, 'account.bookingsEmpty')}</p>
        ) : (
          <ul className="booking-list">
            {payload.items.map((item) => (
              <li key={item.bookingId}>
                <a href={`/account/bookings/${item.bookingCode}`}>
                  <span>
                    <strong>{item.bookingCode}</strong>
                    <small>{formatDateTime(locale, item.checkIn)} &rarr; {formatDateTime(locale, item.checkOut)}</small>
                  </span>
                  <span>
                    <em>{translatePaymentStatus(locale, item.status)}</em>
                    <strong>{formatVnd(locale, Number(item.finalAmountVnd))}</strong>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
