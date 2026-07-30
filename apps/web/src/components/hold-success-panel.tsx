'use client';

import { useEffect, useRef, useState } from 'react';
import type { BookingHoldResponse, BookingHoldStatusResponse } from '@room/contracts';

import { bookingApi, BookingApiError } from '../lib/booking-api';
import { formatDateTime, formatVnd, translate, type Locale } from '../lib/i18n/messages';
import {
  computeCountdown,
  createServerClock,
  formatCountdown,
  type ServerClock,
} from '../lib/server-time';
import { CouponSummary } from './coupon-summary';
import { useLocale } from './locale-provider';

export interface HoldSuccessPanelProps {
  readonly hold: BookingHoldResponse;
  readonly bookingCode: string;
  readonly email: string;
  readonly onManageBooking: () => void;
}

function shouldAnnounce(locale: Locale, remainingMs: number): string | null {
  if (remainingMs <= 60_000 && remainingMs > 59_000) return translate(locale, 'hold.underMinute');
  if (remainingMs <= 5 * 60_000 && remainingMs > 4 * 60_000 + 59_000) {
    return translate(locale, 'hold.underFiveMinutes');
  }
  return null;
}

function deriveClockFromHold(hold: BookingHoldResponse): ServerClock {
  // Fallback: treat holdExpiresAt minus a nominal hold window (15 min) as an
  // approximate server time. Used only if the booking-hold-status fetch fails.
  const approximateHoldStart = new Date(hold.holdExpiresAt).getTime() - 15 * 60 * 1000;
  return createServerClock(new Date(approximateHoldStart).toISOString(), Date.now());
}

export function HoldSuccessPanel({
  hold,
  bookingCode,
  email,
  onManageBooking,
}: HoldSuccessPanelProps) {
  const locale = useLocale();
  const clockRef = useRef<ServerClock>(deriveClockFromHold(hold));
  const initialExpiresAt = hold.holdExpiresAt;
  const initialView = computeCountdown(clockRef.current, initialExpiresAt);
  const [remainingMs, setRemainingMs] = useState<number>(initialView.remainingMs);
  const [expired, setExpired] = useState(initialView.expired);
  const [announcement, setAnnouncement] = useState<string>('');
  const [serverExpiresAt, setServerExpiresAt] = useState<string>(initialExpiresAt);
  const [clockSynced, setClockSynced] = useState(false);

  // Initial server-time sync: fetch booking-hold-status to learn the server's
  // current time and authoritative holdExpiresAt before showing the countdown.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status: BookingHoldStatusResponse = await bookingApi.getBookingHoldStatus({
          bookingCode,
          email,
        });
        if (cancelled) return;
        clockRef.current = createServerClock(status.serverTime, Date.now());
        const expiresAt = status.holdExpiresAt ?? hold.holdExpiresAt;
        setServerExpiresAt(expiresAt);
        const view = computeCountdown(clockRef.current, expiresAt);
        setRemainingMs(view.remainingMs);
        setExpired(view.expired || status.status === 'EXPIRED');
        setClockSynced(true);
        if (view.expired || status.status === 'EXPIRED') {
          setAnnouncement(translate(locale, 'hold.expired'));
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof BookingApiError) {
          setExpired(true);
          setAnnouncement(translate(locale, 'hold.expired'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingCode, email, hold.holdExpiresAt, locale]);

  useEffect(() => {
    if (expired || !clockSynced) return undefined;
    const interval = globalThis.setInterval(() => {
      const view = computeCountdown(clockRef.current, serverExpiresAt);
      setRemainingMs(view.remainingMs);
      const next = shouldAnnounce(locale, view.remainingMs);
      if (next !== null) setAnnouncement(next);
      if (view.expired) {
        setExpired(true);
      }
    }, 1_000);
    return () => globalThis.clearInterval(interval);
  }, [serverExpiresAt, expired, clockSynced, locale]);

  // When the countdown reaches zero, recheck the authoritative server status.
  useEffect(() => {
    if (!expired || !clockSynced) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const status: BookingHoldStatusResponse = await bookingApi.getBookingHoldStatus({
          bookingCode,
          email,
        });
        if (cancelled) return;
        const expiresAt = status.holdExpiresAt ?? serverExpiresAt;
        clockRef.current = createServerClock(status.serverTime, Date.now());
        const view = computeCountdown(clockRef.current, expiresAt);
        setServerExpiresAt(expiresAt);
        setRemainingMs(view.remainingMs);
        if (status.status === 'EXPIRED' || view.expired) {
          setExpired(true);
          setAnnouncement(translate(locale, 'hold.expired'));
        } else if (status.status === 'HOLD') {
          setExpired(false);
          setAnnouncement('');
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof BookingApiError) {
          setAnnouncement(translate(locale, 'hold.expired'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expired, clockSynced, bookingCode, email, serverExpiresAt, locale]);

  return (
    <section aria-labelledby="hold-success-heading" className="hold-success-panel">
      <h2 id="hold-success-heading" className="text-xl font-semibold text-sky-800">
        {translate(locale, 'hold.created')}
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.bookingCode')}</dt>
          <dd className="font-mono text-lg font-semibold tracking-wide">{bookingCode}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.status')}</dt>
          <dd className="font-medium">{hold.status}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.checkIn')}</dt>
          <dd className="font-medium">{formatDateTime(locale, hold.checkIn)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.checkOut')}</dt>
          <dd className="font-medium">{formatDateTime(locale, hold.checkOut)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.amount')}</dt>
          <dd className="font-medium">{formatVnd(locale, hold.amountVnd)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">{translate(locale, 'hold.expiresAt')}</dt>
          <dd className="font-medium">{formatDateTime(locale, serverExpiresAt)}</dd>
        </div>
      </dl>

      {hold.coupon !== undefined ? (
        <div className="mt-4">
          <CouponSummary coupon={hold.coupon} testId="hold-coupon-summary" />
        </div>
      ) : null}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="mt-4 rounded-lg bg-slate-50 p-4"
        data-testid="hold-countdown"
      >
        {expired ? (
          <p className="font-semibold text-red-700">{translate(locale, 'hold.expired')}</p>
        ) : (
          <p>
            {translate(locale, 'hold.remaining')}{' '}
            <span className="font-mono text-lg font-semibold">{formatCountdown(remainingMs)}</span>
          </p>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-600">{translate(locale, 'hold.instructions')}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        {expired ? (
          <a className="primary-button" href="/">
            {translate(locale, 'quote.searchAgain')}
          </a>
        ) : (
          <button className="hospitality-button px-4 py-2" onClick={onManageBooking} type="button">
            {translate(locale, 'hold.manage')}
          </button>
        )}
      </div>

      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>
    </section>
  );
}
