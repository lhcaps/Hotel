'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  adminApi,
  type AdminPaymentDetail,
} from '../../../../lib/admin-api';
import { useLocale } from '../../../../components/locale-provider';
import { formatDateTime, formatVnd, translate, translatePaymentStatus } from '../../../../lib/i18n/messages';

interface AdminPaymentDetailPageProps {
  readonly params: Readonly<{ paymentId: string }>;
}

export default function AdminPaymentDetailPage({ params }: AdminPaymentDetailPageProps) {
  const locale = useLocale();
  const [detail, setDetail] = useState<AdminPaymentDetail>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmingQuery, setConfirmingQuery] = useState(false);
  const [queryMessage, setQueryMessage] = useState<string>();

  const refresh = useCallback(() => {
    setError(undefined);
    return adminApi
      .getPayment(params.paymentId)
      .then(setDetail)
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError ? translate(locale, 'admin.paymentDetailLoadError') : translate(locale, 'admin.paymentDetailLoadError'),
        );
      });
  }, [params.paymentId, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function onQueryProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (detail === undefined) return;
    if (detail.provider === null) {
      setError(translate(locale, 'admin.noProvider'));
      return;
    }
    setPending(true);
    setError(undefined);
    setQueryMessage(undefined);
    adminApi
      .queryPaymentStatus(params.paymentId)
      .then((result) => {
        setQueryMessage(result.message);
        void refresh();
      })
      .catch((cause: unknown) => {
        if (cause instanceof AdminApiError && cause.problem.status === 409) {
          void refresh().finally(() => {
            setError(
              translate(locale, 'admin.paymentConflict'),
            );
          });
        } else if (cause instanceof AdminApiError) {
          setError(translate(locale, 'admin.providerQueryError'));
        } else {
          setError(translate(locale, 'admin.providerQueryError'));
        }
      })
      .finally(() => {
        setPending(false);
        setConfirmingQuery(false);
      });
  }

  if (detail === undefined && error === undefined) {
    return (
      <section className="admin-page">
        <h1>{translate(locale, 'account.payment')} {params.paymentId.slice(0, 8)}</h1>
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      </section>
    );
  }

  if (detail === undefined) {
    return (
      <section className="admin-page">
        <h1>{translate(locale, 'account.payment')} {params.paymentId.slice(0, 8)}</h1>
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
        <Link href="/admin/payments">{translate(locale, 'admin.backToPayments')}</Link>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'account.payment')} {detail.paymentId.slice(0, 8)}</h1>
      <p>
        {translate(locale, 'admin.status')}: <strong>{translatePaymentStatus(locale, detail.status)}</strong>
        {detail.provider === null ? '' : ` · ${translate(locale, 'admin.provider')}: ${detail.provider}`} · {translate(locale, 'account.bookings')}:{' '}
        <Link href={`/admin/bookings/${detail.bookingCode}`}>{detail.bookingCode}</Link>
      </p>
      {detail.needsReview ? (
        <p
          role="status"
          style={{ color: 'var(--color-warning, #b45309)', fontWeight: 600 }}
        >
          {translate(locale, 'admin.paymentReviewRequired')}
        </p>
      ) : null}
      {error === undefined ? null : (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
      {queryMessage === undefined ? null : <p role="status">{queryMessage}</p>}

      <section className="admin-card">
        <h2>{translate(locale, 'account.bookings')}</h2>
        <dl>
          <dt>{translate(locale, 'admin.guest')}</dt>
          <dd>{detail.booking.guestName}</dd>
          <dt>Check-in</dt>
          <dd>{formatDateTime(locale, detail.booking.checkIn)}</dd>
          <dt>Check-out</dt>
          <dd>{formatDateTime(locale, detail.booking.checkOut)}</dd>
          <dt>{translate(locale, 'admin.status')}</dt>
          <dd>{translatePaymentStatus(locale, detail.booking.status)}</dd>
          <dt>{translate(locale, 'admin.amount')}</dt>
          <dd>{formatVnd(locale, detail.booking.finalAmountVnd)}</dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.overview')}</h2>
        <dl>
          <dt>{translate(locale, 'admin.amount')}</dt>
          <dd>{formatVnd(locale, detail.amountVnd)}</dd>
          <dt>{translate(locale, 'admin.createdAt')}</dt>
          <dd>{formatDateTime(locale, detail.createdAt)}</dd>
          <dt>{translate(locale, 'admin.updatedAt')}</dt>
          <dd>{formatDateTime(locale, detail.updatedAt)}</dd>
          {detail.confirmedAt === null ? null : (
            <>
              <dt>{translate(locale, 'admin.confirmedAt')}</dt>
              <dd>{formatDateTime(locale, detail.confirmedAt)}</dd>
            </>
          )}
          {detail.cancelledAt === null ? null : (
            <>
              <dt>{translate(locale, 'admin.cancelledAt')}</dt>
              <dd>{formatDateTime(locale, detail.cancelledAt)}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="admin-card">
        <h2>Attempts ({detail.attempts.length})</h2>
        {detail.attempts.length === 0 ? (
          <p>{translate(locale, 'admin.noAttempts')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{translate(locale, 'admin.provider')}</th>
                <th>{translate(locale, 'admin.status')}</th>
                <th>{translate(locale, 'admin.amount')}</th>
                <th>{translate(locale, 'admin.startedAt')}</th>
                <th>{translate(locale, 'admin.completedAt')}</th>
                <th>{translate(locale, 'admin.failureReason')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.attempts.map((attempt) => (
                <tr key={attempt.attemptId}>
                  <td>{attempt.sequence}</td>
                  <td>{attempt.provider ?? '—'}</td>
                  <td>{translatePaymentStatus(locale, attempt.status)}</td>
                  <td>{formatVnd(locale, attempt.amountVnd)}</td>
                  <td>{formatDateTime(locale, attempt.createdAt)}</td>
                  <td>
                    {attempt.completedAt === null ? '—' : formatDateTime(locale, attempt.completedAt)}
                  </td>
                  <td>{attempt.failureReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.eventTimeline', { count: detail.events.length })}</h2>
        {detail.events.length === 0 ? (
          <p>{translate(locale, 'admin.noEvents')}</p>
        ) : (
          <ol className="admin-timeline">
            {detail.events.map((event) => (
              <li key={event.eventId}>
                <strong>{event.eventType}</strong> · {event.actorType}
                {event.provider === null ? '' : ` · ${event.provider}`} ·{' '}
                {formatDateTime(locale, event.occurredAt)}
                <div>{event.summary}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.reconciliation')}</h2>
        <dl>
          <dt>{translate(locale, 'admin.status')}</dt>
          <dd>{detail.reconciliation.status}</dd>
          <dt>{translate(locale, 'admin.lastCheckedAt')}</dt>
          <dd>{formatDateTime(locale, detail.reconciliation.lastCheckedAt)}</dd>
          <dt>{translate(locale, 'admin.lastReconciledAt')}</dt>
          <dd>
            {detail.reconciliation.lastReconciledAt === null
              ? '—'
              : formatDateTime(locale, detail.reconciliation.lastReconciledAt)}
          </dd>
          <dt>{translate(locale, 'admin.mismatchedFields')}</dt>
          <dd>
            {detail.reconciliation.mismatchedFields.length === 0
              ? '—'
              : detail.reconciliation.mismatchedFields.join(', ')}
          </dd>
          <dt>{translate(locale, 'admin.note')}</dt>
          <dd>{detail.reconciliation.note ?? '—'}</dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.auditTrail', { count: detail.auditTrail.length })}</h2>
        {detail.auditTrail.length === 0 ? (
          <p>{translate(locale, 'admin.noAuditEntries')}</p>
        ) : (
          <ol className="admin-timeline">
            {detail.auditTrail.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.eventType}</strong> · {entry.actorType}
                {entry.actorId === null ? '' : ` · ${entry.actorId}`} ·{' '}
                {formatDateTime(locale, entry.occurredAt)}
                <div>{entry.summary}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.operationalReview')}</h2>
        {detail.operationalReview === null ? (
          <p>{translate(locale, 'admin.noPaymentReview')}</p>
        ) : (
          <p>
            Review {detail.operationalReview.reviewId.slice(0, 8)} ·{' '}
            <strong>{detail.operationalReview.status}</strong> ·{' '}
            <Link href={`/admin/operational-reviews/${detail.operationalReview.reviewId}`}>
              {translate(locale, 'admin.openReview')}
            </Link>
          </p>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.availableActions')}</h2>
        {detail.provider === null ? (
          <p>{translate(locale, 'admin.noProvider')}</p>
        ) : confirmingQuery ? (
          <form onSubmit={onQueryProvider}>
            <p>
              {translate(locale, 'admin.providerQueryHelp')}
            </p>
            <button disabled={pending} type="submit">
              {pending ? translate(locale, 'admin.querying') : translate(locale, 'admin.confirmProviderQuery')}
            </button>
            <button
              disabled={pending}
              onClick={() => setConfirmingQuery(false)}
              type="button"
            >
              {translate(locale, 'admin.cancel')}
            </button>
          </form>
        ) : (
          <button
            disabled={pending}
            onClick={() => {
              setConfirmingQuery(true);
              setError(undefined);
              setQueryMessage(undefined);
            }}
            type="button"
          >
            {translate(locale, 'admin.queryProviderStatus')}
          </button>
        )}
        <p>{translate(locale, 'admin.noManualPaymentSuccess')}</p>
      </section>

      <p>
        <Link href="/admin/payments">{translate(locale, 'admin.backToPayments')}</Link>
      </p>
    </section>
  );
}
