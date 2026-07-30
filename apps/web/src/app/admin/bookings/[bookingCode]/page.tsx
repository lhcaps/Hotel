'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, adminApi, type AdminBookingDetail } from '../../../../lib/admin-api';
import { CouponDeliveryAction } from '../../../../components/coupon-delivery-action';
import { useLocale } from '../../../../components/locale-provider';
import {
  formatDateTime,
  formatVnd,
  translate,
  translatePaymentStatus,
} from '../../../../lib/i18n/messages';

export default function AdminBookingDetailPage() {
  const locale = useLocale();
  const params = useParams<{ bookingCode: string }>();
  const bookingCode = params.bookingCode;
  const [detail, setDetail] = useState<AdminBookingDetail>();
  const [error, setError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();
  const [reason, setReason] = useState('');

  const refresh = useCallback(() => {
    setError(undefined);
    adminApi
      .getAdminBooking(bookingCode)
      .then(setDetail)
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? translate(locale, 'admin.bookingDetailLoadError')
            : translate(locale, 'admin.bookingDetailLoadError'),
        );
      });
  }, [bookingCode, locale]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function runAction(
    label: string,
    action: () => Promise<AdminBookingDetail>,
    requiredReason = false,
  ) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (requiredReason && reason.trim() === '') {
        setError(translate(locale, 'admin.reasonRequired'));
        return;
      }
      setPendingAction(label);
      setError(undefined);
      try {
        const updated = await action();
        setDetail(updated);
        setReason('');
      } catch (cause: unknown) {
        setError(
          cause instanceof AdminApiError
            ? translate(locale, 'admin.actionError')
            : translate(locale, 'admin.actionError'),
        );
      } finally {
        setPendingAction(undefined);
      }
    };
  }

  if (detail === undefined && error === undefined) {
    return (
      <section className="admin-page">
        <h1>{translate(locale, 'account.bookingHeading', { code: bookingCode })}</h1>
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      </section>
    );
  }

  if (detail === undefined) {
    return (
      <section className="admin-page">
        <h1>{translate(locale, 'account.bookingHeading', { code: bookingCode })}</h1>
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
        <Link href="/admin/bookings">{translate(locale, 'admin.backToBookings')}</Link>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'account.bookingHeading', { code: detail.bookingCode })}</h1>
      <p>
        {translate(locale, 'admin.status')}:{' '}
        <strong>{translatePaymentStatus(locale, detail.status)}</strong> ·{' '}
        {translate(locale, 'admin.guest')}: <strong>{detail.contact.fullName}</strong>
      </p>
      {error === undefined ? null : (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      <section className="admin-card">
        <h2>{translate(locale, 'admin.contact')}</h2>
        <dl>
          <dt>{translate(locale, 'admin.fullName')}</dt>
          <dd>{detail.contact.fullName}</dd>
          <dt>Email</dt>
          <dd>{detail.contact.emailMasked}</dd>
          <dt>{translate(locale, 'admin.phone')}</dt>
          <dd>{detail.contact.phoneMasked}</dd>
          <dt>{translate(locale, 'admin.adults')}</dt>
          <dd>{detail.occupancy.adults}</dd>
          <dt>{translate(locale, 'admin.children')}</dt>
          <dd>{detail.occupancy.children}</dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.timeAndRoom')}</h2>
        <dl>
          <dt>Check-in</dt>
          <dd>{formatDateTime(locale, detail.interval.checkIn)}</dd>
          <dt>Check-out</dt>
          <dd>{formatDateTime(locale, detail.interval.checkOut)}</dd>
          <dt>{translate(locale, 'admin.roomType')}</dt>
          <dd>{detail.roomType.name}</dd>
          <dt>{translate(locale, 'admin.physicalRoom')}</dt>
          <dd>{detail.room?.roomNumber ?? translate(locale, 'admin.roomUnassigned')}</dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.pricingAndPayment')}</h2>
        <dl>
          <dt>{translate(locale, 'admin.total')}</dt>
          <dd>{formatVnd(locale, detail.pricing.grossAmountVnd)}</dd>
          <dt>{translate(locale, 'admin.discount')}</dt>
          <dd>{formatVnd(locale, detail.pricing.discountAmountVnd)}</dd>
          <dt>{translate(locale, 'admin.collected')}</dt>
          <dd>{formatVnd(locale, detail.pricing.finalAmountVnd)}</dd>
          <dt>Coupon</dt>
          <dd>{detail.pricing.coupon?.code ?? '—'}</dd>
          <dt>{translate(locale, 'account.payment')}</dt>
          <dd>
            {translatePaymentStatus(locale, detail.payment.status)}
            {detail.payment.amountVnd === null
              ? ''
              : ` · ${formatVnd(locale, detail.payment.amountVnd)}`}
          </dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.operationalReview')}</h2>
        {detail.operationalReview === null ? (
          <p>{translate(locale, 'admin.noReview')}</p>
        ) : (
          <p>
            Review {detail.operationalReview.reviewId} · {detail.operationalReview.status} ·{' '}
            <Link href={`/admin/operational-reviews/${detail.operationalReview.reviewId}`}>
              {translate(locale, 'admin.openReview')}
            </Link>
          </p>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.history')}</h2>
        {detail.timeline.length === 0 ? (
          <p>{translate(locale, 'admin.noEvents')}</p>
        ) : (
          <ol className="admin-timeline">
            {detail.timeline.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.eventType}</strong> · {entry.actorType}
                {entry.actorId === null ? '' : ` · ${entry.actorId}`} ·{' '}
                {formatDateTime(locale, entry.occurredAt)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.availableActions')}</h2>
        {detail.availableActions.length === 0 ? (
          <p>{translate(locale, 'admin.noActions')}</p>
        ) : (
          <>
            {detail.availableActions.includes('cancel') ? (
              <form
                onSubmit={runAction(
                  'cancel',
                  () => adminApi.cancelAdminBooking(detail.bookingCode, reason.trim()),
                  true,
                )}
              >
                <label>
                  {translate(locale, 'admin.cancelReason')}
                  <input
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={translate(locale, 'admin.reasonPlaceholder')}
                    required
                    value={reason}
                  />
                </label>
                <button disabled={pendingAction !== undefined} type="submit">
                  {pendingAction === 'cancel'
                    ? translate(locale, 'admin.cancelling')
                    : translate(locale, 'admin.cancelBooking')}
                </button>
              </form>
            ) : null}
            {detail.availableActions.includes('no-show') ? (
              <form
                onSubmit={runAction(
                  'no-show',
                  () => adminApi.markNoShowAdminBooking(detail.bookingCode, reason.trim()),
                  true,
                )}
              >
                <label>
                  {translate(locale, 'admin.noShowReason')}
                  <input
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={translate(locale, 'admin.reasonPlaceholder')}
                    required
                    value={reason}
                  />
                </label>
                <button disabled={pendingAction !== undefined} type="submit">
                  {pendingAction === 'no-show'
                    ? translate(locale, 'admin.markingNoShow')
                    : translate(locale, 'admin.markNoShow')}
                </button>
              </form>
            ) : null}
            {detail.availableActions.includes('check-in') ? (
              <form
                onSubmit={runAction('check-in', () =>
                  adminApi.checkInAdminBooking(detail.bookingCode),
                )}
              >
                <button disabled={pendingAction !== undefined} type="submit">
                  {pendingAction === 'check-in'
                    ? translate(locale, 'admin.checkingIn')
                    : 'Check-in'}
                </button>
              </form>
            ) : null}
            {detail.availableActions.includes('check-out') ? (
              <form
                onSubmit={runAction('check-out', () =>
                  adminApi.checkOutAdminBooking(detail.bookingCode),
                )}
              >
                <button disabled={pendingAction !== undefined} type="submit">
                  {pendingAction === 'check-out'
                    ? translate(locale, 'admin.checkingOut')
                    : 'Check-out'}
                </button>
              </form>
            ) : null}
          </>
        )}
      </section>
      <section className="admin-card">
        <CouponDeliveryAction bookingCode={detail.bookingCode} />
      </section>
      <p>
        <Link href="/admin/bookings">{translate(locale, 'admin.backToBookings')}</Link>
      </p>
    </section>
  );
}
