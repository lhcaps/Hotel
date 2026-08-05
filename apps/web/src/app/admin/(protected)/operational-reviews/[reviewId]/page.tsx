'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  adminApi,
  type AdminOperationalReviewDetail,
} from '../../../../../lib/admin-api';
import { useLocale } from '../../../../../components/locale-provider';
import { formatDateTime, translate, translateAdminStatus } from '../../../../../lib/i18n/messages';

export default function OperationalReviewDetailPage() {
  const locale = useLocale();
  const { reviewId } = useParams<{ reviewId: string }>();
  const [review, setReview] = useState<AdminOperationalReviewDetail>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');

  const refresh = useCallback(() => {
    setError(undefined);
    adminApi
      .getOperationalReview(reviewId)
      .then(setReview)
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? translate(locale, 'admin.reviewDetailLoadError')
            : translate(locale, 'admin.reviewDetailLoadError'),
        );
      });
  }, [locale, reviewId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function onResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.trim() === '') {
      setError(translate(locale, 'admin.noteRequired'));
      return;
    }
    setPending(true);
    setError(undefined);
    adminApi
      .resolveOperationalReview(reviewId, note.trim())
      .then((updated) => {
        setReview(updated);
        setNote('');
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? translate(locale, 'admin.reviewResolveError')
            : translate(locale, 'admin.reviewResolveError'),
        );
      })
      .finally(() => {
        setPending(false);
      });
  }

  if (review === undefined && error === undefined) {
    return (
      <section className="admin-page">
        <h1>
          {translate(locale, 'admin.review')} {reviewId.slice(0, 8)}
        </h1>
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      </section>
    );
  }

  if (review === undefined) {
    return (
      <section className="admin-page">
        <h1>
          {translate(locale, 'admin.review')} {reviewId.slice(0, 8)}
        </h1>
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
        <Link href="/admin/operational-reviews">{translate(locale, 'admin.backToReviews')}</Link>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <h1>
        {translate(locale, 'admin.review')} {review.reviewId.slice(0, 8)}
      </h1>
      <p>
        {translate(locale, 'admin.status')}:{' '}
        <strong>{translateAdminStatus(locale, review.status)}</strong> ·{' '}
        {translate(locale, 'admin.type')}: <strong>{review.category}</strong>
      </p>
      {error === undefined ? null : (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      <section className="admin-card">
        <h2>{translate(locale, 'account.bookings')}</h2>
        <p>
          <Link href={`/admin/bookings/${review.bookingCode}`}>{review.bookingCode}</Link>
        </p>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.openReason')}</h2>
        <p>{review.openedReason}</p>
        <p>
          {translate(locale, 'admin.openedAt')}: {formatDateTime(locale, review.openedAt)}
        </p>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.processingStatus')}</h2>
        {review.status === 'OPEN' ? (
          <form onSubmit={onResolve}>
            <label>
              {translate(locale, 'admin.processingNote')}
              <textarea
                onChange={(event) => setNote(event.target.value)}
                placeholder={translate(locale, 'admin.processingNotePlaceholder')}
                required
                rows={4}
                value={note}
              />
            </label>
            <button disabled={pending} type="submit">
              {pending
                ? translate(locale, 'admin.processing')
                : translate(locale, 'admin.markResolved')}
            </button>
          </form>
        ) : (
          <dl>
            <dt>{translate(locale, 'admin.resolvedAt')}</dt>
            <dd>{review.resolvedAt === null ? '—' : formatDateTime(locale, review.resolvedAt)}</dd>
          </dl>
        )}
      </section>
      <p>
        <Link href="/admin/operational-reviews">{translate(locale, 'admin.backToReviews')}</Link>
      </p>
    </section>
  );
}
