'use client';

import { useEffect, useState } from 'react';
import type { PaymentStatusResponse } from '@room/contracts';

import { bookingApi } from '../lib/booking-api';
import { translate, translatePaymentStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

const terminal = new Set(['SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW_REQUIRED']);

function isPending(status: PaymentStatusResponse): boolean {
  if (status.paymentStatus === 'PENDING' || status.attemptStatus === 'PENDING') return true;
  return false;
}

export function PaymentStatusSummary({ bookingCode }: Readonly<{ bookingCode: string }>) {
  const locale = useLocale();
  const [status, setStatus] = useState<PaymentStatusResponse>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof globalThis.setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await bookingApi.getPaymentStatus(bookingCode);
        if (cancelled) return;
        setStatus(next);
        setFailed(false);
        if (isPending(next) && !terminal.has(next.paymentStatus ?? '')) {
          retry = globalThis.setTimeout(() => void load(), 5_000);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (retry !== undefined) globalThis.clearTimeout(retry);
    };
  }, [bookingCode]);

  if (failed || status === undefined || status.paymentStatus === null) return null;
  return (
    <section aria-live="polite" className="mt-4 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold">{translate(locale, 'payment.statusHeading')}</h3>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">{translate(locale, 'payment.provider')}</dt>
          <dd>{status.provider}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'payment.payment')}</dt>
          <dd>{translatePaymentStatus(locale, status.paymentStatus)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'payment.attempt')}</dt>
          <dd>
            {translatePaymentStatus(locale, status.attemptStatus) ===
            translate(locale, 'payment.status.UNKNOWN')
              ? translate(locale, 'payment.pendingProvider')
              : translatePaymentStatus(locale, status.attemptStatus)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'payment.booking')}</dt>
          <dd>{translatePaymentStatus(locale, status.bookingStatus)}</dd>
        </div>
      </dl>
      {status.customerMessage !== null ? (
        <p className="mt-2 text-sm text-amber-800" role="alert">
          {status.customerMessage}
        </p>
      ) : null}
      {isPending(status) ? (
        <p className="mt-2 text-sm text-slate-600">{translate(locale, 'payment.checking')}</p>
      ) : null}
    </section>
  );
}
