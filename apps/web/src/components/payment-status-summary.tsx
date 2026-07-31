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

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly status: PaymentStatusResponse };

export function PaymentStatusSummary({ bookingCode }: Readonly<{ bookingCode: string }>) {
  const locale = useLocale();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof globalThis.setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await bookingApi.getPaymentStatus(bookingCode);
        if (cancelled) return;
        setState({ kind: 'ready', status: next });
        if (isPending(next) && !terminal.has(next.paymentStatus ?? '')) {
          retry = globalThis.setTimeout(() => void load(), 5_000);
        }
      } catch {
        if (!cancelled) setState({ kind: 'failed' });
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (retry !== undefined) globalThis.clearTimeout(retry);
    };
  }, [bookingCode, retryNonce]);

  function onRetry() {
    setState({ kind: 'loading' });
    setRetryNonce((current) => current + 1);
  }

  if (state.kind === 'loading') {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mt-4 rounded-md border border-slate-200 p-4"
        data-testid="payment-status-loading"
      >
        <h3 className="font-semibold">{translate(locale, 'payment.statusHeading')}</h3>
        <p className="mt-2 text-sm text-slate-600" data-testid="payment-status-loading-text">
          {translate(locale, 'payment.states.loading')}
        </p>
        <div
          aria-hidden="true"
          className="mt-3 h-2 w-full animate-pulse rounded bg-slate-200"
          data-testid="payment-status-loading-skeleton"
        />
      </section>
    );
  }

  if (state.kind === 'failed') {
    return (
      <section
        aria-live="polite"
        className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4"
        data-testid="payment-status-load-error"
        role="alert"
      >
        <h3 className="font-semibold text-amber-900">
          {translate(locale, 'payment.statusHeading')}
        </h3>
        <p className="mt-2 text-sm text-amber-900" data-testid="payment-status-load-error-text">
          {translate(locale, 'payment.states.loadError')}
        </p>
        <p className="mt-1 text-sm text-amber-800">
          {translate(locale, 'payment.states.loadErrorHelp')}
        </p>
        <button
          aria-label={translate(locale, 'payment.loadErrorRetry')}
          className="mt-3 inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
          data-testid="payment-status-load-error-retry"
          onClick={onRetry}
          type="button"
        >
          {translate(locale, 'payment.loadErrorRetry')}
        </button>
      </section>
    );
  }

  const status = state.status;
  if (status.paymentStatus === null) return null;
  return (
    <section
      aria-live="polite"
      className="mt-4 rounded-md border border-slate-200 p-4"
      data-testid="payment-status-summary"
    >
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
