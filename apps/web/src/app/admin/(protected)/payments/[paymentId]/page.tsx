'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { useLocale } from '../../../../../components/locale-provider';
import { AdminApiError, adminApi, type AdminPaymentDetail } from '../../../../../lib/admin-api';
import {
  formatDateTime,
  formatVnd,
  type MessageKey,
  translate,
  translatePaymentStatus,
} from '../../../../../lib/i18n/messages';

const reconciliationKeys = {
  NOT_REQUESTED: 'admin.reconciliationNotRequested',
  IN_PROGRESS: 'admin.reconciliationInProgress',
  COMPLETED: 'admin.reconciliationCompleted',
  STALE: 'admin.reconciliationStale',
  SUCCESS: 'admin.reconciliationSuccess',
  STILL_PENDING: 'admin.reconciliationStillPending',
  FAILED: 'admin.reconciliationFailed',
  REVIEW_REQUIRED: 'admin.reconciliationReviewRequired',
} as const satisfies Record<string, MessageKey>;

const actorKeys = {
  GUEST: 'admin.actorGuest',
  CUSTOMER: 'admin.actorCustomer',
  ADMIN: 'admin.actorAdministrator',
  SYSTEM: 'admin.actorSystem',
  PROVIDER: 'admin.actorProvider',
} as const satisfies Record<string, MessageKey>;

const eventKeys = {
  PAYMENT_ATTEMPT_REQUESTED: 'admin.eventPaymentAttemptRequested',
  PAYMENT_PROVIDER_REVIEW_REQUIRED: 'admin.eventPaymentProviderReviewRequired',
  PAYMENT_RECONCILIATION_FLAGGED: 'admin.eventPaymentReconciliationFlagged',
  PAYMENT_RECONCILIATION_REQUESTED: 'admin.eventPaymentReconciliationRequested',
  PAYMENT_RECONCILIATION_COMPLETED: 'admin.eventPaymentReconciliationCompleted',
} as const satisfies Record<string, MessageKey>;

function mappedMessageKey(
  labels: Readonly<Record<string, MessageKey>>,
  value: string,
): MessageKey | undefined {
  return Object.entries(labels).find(([candidate]) => candidate === value)?.[1];
}

function providerLabel(value: string | null, locale: 'vi' | 'en'): string {
  if (value === null) return translate(locale, 'account.notAvailable');
  if (value === 'MOMO') return 'MoMo';
  if (value === 'VNPAY') return 'VNPay';
  return translate(locale, 'admin.providerOther');
}

function reconciliationLabel(value: string, locale: 'vi' | 'en'): string {
  const key = mappedMessageKey(reconciliationKeys, value);
  return key === undefined ? humanizeCode(value) : translate(locale, key);
}

function actorLabel(value: string, locale: 'vi' | 'en'): string {
  const key = mappedMessageKey(actorKeys, value);
  return key === undefined ? humanizeCode(value) : translate(locale, key);
}

function eventLabel(value: string, locale: 'vi' | 'en'): string {
  const key = mappedMessageKey(eventKeys, value);
  return key === undefined ? humanizeCode(value) : translate(locale, key);
}

function humanizeCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatOptionalDate(locale: 'vi' | 'en', value: string | null): string {
  return value === null ? translate(locale, 'account.notAvailable') : formatDateTime(locale, value);
}

function environmentLabel(locale: 'vi' | 'en', value: string): string {
  return translate(
    locale,
    value === 'sandbox' ? 'admin.environmentSandbox' : 'admin.environmentProduction',
  );
}

interface AdminPaymentDetailPageProps {
  readonly params?: { readonly paymentId?: string };
}

export default function AdminPaymentDetailPage({
  params: legacyParams,
}: AdminPaymentDetailPageProps = {}) {
  const locale = useLocale();
  const params = useParams<{ paymentId: string }>();
  const paymentId = params?.paymentId ?? legacyParams?.paymentId ?? '';
  const [detail, setDetail] = useState<AdminPaymentDetail>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmingQuery, setConfirmingQuery] = useState(false);
  const [queryMessage, setQueryMessage] = useState<string>();

  const refresh = useCallback(() => {
    setError(undefined);
    return adminApi
      .getPayment(paymentId)
      .then(setDetail)
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? translate(locale, 'admin.paymentDetailLoadError')
            : translate(locale, 'admin.paymentDetailLoadError'),
        );
      });
  }, [paymentId, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function onQueryProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (detail === undefined) return;
    if (detail.providerRef === null) {
      setError(translate(locale, 'admin.noProvider'));
      return;
    }
    setPending(true);
    setError(undefined);
    setQueryMessage(undefined);
    adminApi
      .queryPaymentStatus(paymentId, detail.updatedAt)
      .then((result) => {
        setQueryMessage(
          translate(locale, 'admin.reconciliationRequestedMessage', {
            status: reconciliationLabel(result.reconciliation.status, locale),
          }),
        );
        void refresh();
      })
      .catch((cause: unknown) => {
        if (cause instanceof AdminApiError && cause.problem.status === 409) {
          void refresh().finally(() => {
            setError(translate(locale, 'admin.paymentConflict'));
          });
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
        <h1>
          {translate(locale, 'account.payment')} {paymentId.slice(0, 8)}
        </h1>
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      </section>
    );
  }

  if (detail === undefined) {
    return (
      <section className="admin-page">
        <h1>
          {translate(locale, 'account.payment')} {paymentId.slice(0, 8)}
        </h1>
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
        <Link href="/admin/payments">{translate(locale, 'admin.backToPayments')}</Link>
      </section>
    );
  }

  const reviewRequired = detail.reviewRequiredAt !== null || detail.status === 'REVIEW_REQUIRED';

  return (
    <section className="admin-page">
      <div className="admin-page__heading">
        <div>
          <p className="admin-eyebrow">{translate(locale, 'admin.paymentsHeading')}</p>
          <h1>
            {translate(locale, 'account.payment')} {detail.paymentId.slice(0, 8)}
          </h1>
        </div>
        <Link href="/admin/payments">{translate(locale, 'admin.backToPayments')}</Link>
      </div>
      <p>
        {translatePaymentStatus(locale, detail.status)} ·{' '}
        {providerLabel(detail.providerRef?.provider ?? null, locale)} ·{' '}
        {translate(locale, 'account.bookings')}:{' '}
        <Link href={`/admin/bookings/${detail.booking.bookingCode}`}>
          {detail.booking.bookingCode}
        </Link>
      </p>
      {reviewRequired ? (
        <p role="status" style={{ color: 'var(--color-warning, #b45309)', fontWeight: 600 }}>
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
          <dd>{detail.booking.contact.fullName}</dd>
          <dt>{translate(locale, 'admin.email')}</dt>
          <dd>{detail.booking.contact.emailMasked}</dd>
          <dt>{translate(locale, 'admin.phone')}</dt>
          <dd>{detail.booking.contact.phoneMasked}</dd>
          <dt>{translate(locale, 'admin.status')}</dt>
          <dd>{translatePaymentStatus(locale, detail.booking.bookingStatus)}</dd>
          <dt>{translate(locale, 'admin.amount')}</dt>
          <dd>{formatVnd(locale, detail.booking.finalAmountVnd)}</dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.overview')}</h2>
        <dl>
          <dt>{translate(locale, 'admin.amount')}</dt>
          <dd>{formatVnd(locale, detail.amountVnd)}</dd>
          <dt>{translate(locale, 'admin.provider')}</dt>
          <dd>
            {detail.providerRef === null
              ? translate(locale, 'admin.noProvider')
              : `${detail.providerRef.displayName} · ${environmentLabel(locale, detail.providerRef.environment)}`}
          </dd>
          <dt>{translate(locale, 'admin.createdAt')}</dt>
          <dd>{formatDateTime(locale, detail.createdAt)}</dd>
          <dt>{translate(locale, 'admin.updatedAt')}</dt>
          <dd>{formatDateTime(locale, detail.updatedAt)}</dd>
          <dt>{translate(locale, 'admin.confirmedAt')}</dt>
          <dd>{formatOptionalDate(locale, detail.succeededAt)}</dd>
          <dt>{translate(locale, 'admin.cancelledAt')}</dt>
          <dd>{formatOptionalDate(locale, detail.cancelledAt)}</dd>
          <dt>{translate(locale, 'admin.expiredAt')}</dt>
          <dd>{formatOptionalDate(locale, detail.expiredAt)}</dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.attempts', { count: detail.attempts.length })}</h2>
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
              </tr>
            </thead>
            <tbody>
              {detail.attempts.map((attempt, index) => (
                <tr key={attempt.paymentAttemptId}>
                  <td>{index + 1}</td>
                  <td>{providerLabel(attempt.provider, locale)}</td>
                  <td>{translatePaymentStatus(locale, attempt.status)}</td>
                  <td>{formatVnd(locale, attempt.amountVnd)}</td>
                  <td>{formatDateTime(locale, attempt.initiatedAt)}</td>
                  <td>{formatOptionalDate(locale, attempt.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.eventTimeline', { count: detail.timeline.length })}</h2>
        {detail.timeline.length === 0 ? (
          <p>{translate(locale, 'admin.noEvents')}</p>
        ) : (
          <ol className="admin-timeline">
            {detail.timeline.map((event) => (
              <li key={event.id}>
                <strong>{eventLabel(event.eventType, locale)}</strong> ·{' '}
                {actorLabel(event.actorType, locale)} · {formatDateTime(locale, event.occurredAt)}
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
          <dd>{reconciliationLabel(detail.reconciliation.status, locale)}</dd>
          <dt>{translate(locale, 'admin.requestedAt')}</dt>
          <dd>{formatOptionalDate(locale, detail.reconciliation.requestedAt)}</dd>
          <dt>{translate(locale, 'admin.lastReconciledAt')}</dt>
          <dd>{formatOptionalDate(locale, detail.reconciliation.lastReconciledAt)}</dd>
          <dt>{translate(locale, 'admin.attemptCount')}</dt>
          <dd>{detail.reconciliation.lastAttemptCount}</dd>
          <dt>{translate(locale, 'admin.providerResult')}</dt>
          <dd>
            {detail.reconciliation.providerResponse === null
              ? translate(locale, 'account.notAvailable')
              : reconciliationLabel(detail.reconciliation.providerResponse, locale)}
          </dd>
          <dt>{translate(locale, 'admin.errorCode')}</dt>
          <dd>
            {detail.reconciliation.lastErrorCode === null
              ? '—'
              : humanizeCode(detail.reconciliation.lastErrorCode)}
          </dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.auditTrail', { count: detail.audit.length })}</h2>
        {detail.audit.length === 0 ? (
          <p>{translate(locale, 'admin.noAuditEntries')}</p>
        ) : (
          <ol className="admin-timeline">
            {detail.audit.map((entry) => (
              <li key={entry.id}>
                <strong>{eventLabel(entry.eventType, locale)}</strong> ·{' '}
                {actorLabel(entry.actorType, locale)} · {formatDateTime(locale, entry.occurredAt)}
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
            {translate(
              locale,
              detail.operationalReview.status === 'OPEN'
                ? 'admin.reviewOpen'
                : 'admin.reviewResolved',
            )}{' '}
            ·{' '}
            <Link href={`/admin/operational-reviews/${detail.operationalReview.reviewId}`}>
              {translate(locale, 'admin.openReview')}
            </Link>
          </p>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.availableActions')}</h2>
        {detail.providerRef === null ? (
          <p>{translate(locale, 'admin.noProvider')}</p>
        ) : confirmingQuery ? (
          <form onSubmit={onQueryProvider}>
            <p>{translate(locale, 'admin.providerQueryHelp')}</p>
            <button disabled={pending} type="submit">
              {pending
                ? translate(locale, 'admin.querying')
                : translate(locale, 'admin.confirmProviderQuery')}
            </button>
            <button disabled={pending} onClick={() => setConfirmingQuery(false)} type="button">
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
    </section>
  );
}
