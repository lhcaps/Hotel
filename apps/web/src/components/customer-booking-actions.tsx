'use client';

import { useState, type FormEvent } from 'react';

import { BookingApiError, bookingApi } from '../lib/booking-api';
import { fromProblemDetails, pickFieldError } from '../lib/form-error';
import { formatDateTime, formatVnd, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function CustomerBookingActions({
  bookingCode,
  checkIn,
  checkOut,
  adults,
  children,
  finalAmountVnd,
}: Readonly<{
  bookingCode: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  finalAmountVnd: string;
}>) {
  const locale = useLocale();
  const [cancellation, setCancellation] =
    useState<Awaited<ReturnType<typeof bookingApi.getCustomerCancellationPreview>>>();
  const [alteration, setAlteration] =
    useState<Awaited<ReturnType<typeof bookingApi.getCustomerAlterationPreview>>>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [cancellationReason, setCancellationReason] = useState('Customer requested cancellation');
  const [form, setForm] = useState({
    checkIn: toLocalInput(checkIn),
    checkOut: toLocalInput(checkOut),
    adults: String(adults),
    children: String(children),
  });

  function projectFieldError(cause: unknown, fields: readonly string[]): string | undefined {
    if (!(cause instanceof BookingApiError)) return undefined;
    const problemState = fromProblemDetails(cause.problem);
    for (const field of fields) {
      const fieldError = pickFieldError(problemState, field);
      if (fieldError !== undefined) return fieldError;
    }
    return undefined;
  }

  async function previewCancellation() {
    setPending('cancel');
    setError(undefined);
    try {
      setCancellation(await bookingApi.getCustomerCancellationPreview(bookingCode));
    } catch (cause) {
      const fieldError = projectFieldError(cause, ['bookingCode']);
      setError(
        fieldError
          ? fieldError
          : cause instanceof BookingApiError
            ? cause.message
            : translate(locale, 'account.previewError'),
      );
    } finally {
      setPending(undefined);
    }
  }

  async function previewAlteration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending('alter');
    setError(undefined);
    try {
      setAlteration(
        await bookingApi.getCustomerAlterationPreview(bookingCode, {
          checkIn: new Date(form.checkIn).toISOString(),
          checkOut: new Date(form.checkOut).toISOString(),
          adults: Number(form.adults),
          children: Number(form.children),
        }),
      );
    } catch (cause) {
      const fieldError = projectFieldError(cause, ['checkIn', 'checkOut', 'adults', 'children']);
      setError(
        fieldError
          ? fieldError
          : cause instanceof BookingApiError
            ? cause.message
            : translate(locale, 'account.previewError'),
      );
    } finally {
      setPending(undefined);
    }
  }

  return (
    <section className="booking-detail__actions" aria-labelledby="booking-actions-heading">
      <h2 id="booking-actions-heading">{translate(locale, 'account.manageBooking')}</h2>
      <button
        disabled={pending !== undefined}
        onClick={() => void previewCancellation()}
        type="button"
      >
        {pending === 'cancel'
          ? translate(locale, 'account.previewLoading')
          : translate(locale, 'account.previewCancellation')}
      </button>
      {cancellation ? (
        <div role="status">
          <p>
            {cancellation.policyMessage}{' '}
            {translate(locale, 'account.estimatedRefund', {
              amount: formatVnd(locale, Number(cancellation.estimatedRefundVnd)),
            })}
          </p>
          <p>
            {translate(locale, 'account.cancellationPaidAmount')}:{' '}
            {formatVnd(locale, Number(cancellation.paidAmountVnd))} ·{' '}
            {translate(locale, 'account.cancellationRefundAmount')}:{' '}
            {formatVnd(locale, Number(cancellation.estimatedRefundVnd))} ·{' '}
            {translate(locale, 'account.cancellationRetainedAmount')}:{' '}
            {formatVnd(locale, Number(cancellation.retainedAmountVnd))}
          </p>
          {cancellation.policy ? (
            <p>
              {translate(locale, 'account.cancellationBoundary7Days')}:{' '}
              {formatDateTime(locale, cancellation.policy.sevenDayDeadline)} ·{' '}
              {translate(locale, 'account.cancellationBoundary3Days')}:{' '}
              {formatDateTime(locale, cancellation.policy.threeDayDeadline)}
            </p>
          ) : null}
          {cancellation.eligible ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!globalThis.confirm(translate(locale, 'account.cancellationConfirmWarning'))) {
                  return;
                }
                setPending('cancel-execute');
                setError(undefined);
                void bookingApi
                  .cancelCustomerBooking(
                    bookingCode,
                    cancellationReason.trim() || 'Customer requested cancellation',
                    crypto.randomUUID(),
                  )
                  .then(() => {
                    window.location.reload();
                  })
                  .catch((cause: unknown) => {
                    const fieldError = projectFieldError(cause, ['cancellationReason']);
                    setError(
                      fieldError
                        ? fieldError
                        : cause instanceof BookingApiError
                          ? cause.message
                          : translate(locale, 'account.actionError'),
                    );
                  })
                  .finally(() => setPending(undefined));
              }}
            >
              <label>
                {translate(locale, 'account.cancellationReason')}
                <input
                  required
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                />
              </label>
              <button disabled={pending !== undefined} type="submit">
                {pending === 'cancel-execute'
                  ? translate(locale, 'account.cancelling')
                  : translate(locale, 'account.confirmCancellation')}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      <form onSubmit={(event) => void previewAlteration(event)}>
        <h3>{translate(locale, 'account.previewAlteration')}</h3>
        <label>
          {translate(locale, 'account.checkIn')}
          <input
            required
            type="datetime-local"
            value={form.checkIn}
            onChange={(event) =>
              setForm((current) => ({ ...current, checkIn: event.target.value }))
            }
          />
        </label>
        <label>
          {translate(locale, 'account.checkOut')}
          <input
            required
            type="datetime-local"
            value={form.checkOut}
            onChange={(event) =>
              setForm((current) => ({ ...current, checkOut: event.target.value }))
            }
          />
        </label>
        <label>
          {translate(locale, 'account.adults')}
          <input
            min={1}
            required
            type="number"
            value={form.adults}
            onChange={(event) => setForm((current) => ({ ...current, adults: event.target.value }))}
          />
        </label>
        <label>
          {translate(locale, 'account.children')}
          <input
            min={0}
            required
            type="number"
            value={form.children}
            onChange={(event) =>
              setForm((current) => ({ ...current, children: event.target.value }))
            }
          />
        </label>
        <button disabled={pending !== undefined} type="submit">
          {pending === 'alter'
            ? translate(locale, 'account.previewLoading')
            : translate(locale, 'account.previewAlterationSubmit')}
        </button>
      </form>
      {alteration ? (
        <p role="status">
          {alteration.policyMessage}{' '}
          {alteration.quote === null
            ? ''
            : translate(locale, 'account.previewTotal', {
                amount: formatVnd(locale, alteration.quote.pricing.totalAmountVnd),
              })}
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <p className="text-sm text-slate-600">
        {translate(locale, 'account.currentTotal', {
          amount: formatVnd(locale, Number(finalAmountVnd)),
          checkIn: formatDateTime(locale, checkIn),
          checkOut: formatDateTime(locale, checkOut),
        })}
      </p>
    </section>
  );
}

function toLocalInput(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
