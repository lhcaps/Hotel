'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, adminApi, type AdminBookingDetail } from '../../../../../lib/admin-api';
import { CouponDeliveryAction } from '../../../../../components/coupon-delivery-action';
import { CancellationPolicySummary } from '../../../../../components/cancellation-policy-summary';
import { useLocale } from '../../../../../components/locale-provider';
import { AdminPageHeader } from '../../../../../components/admin/admin-ui';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import {
  formatDateTime,
  formatVnd,
  translate,
  translateAdminStatus,
  translatePaymentStatus,
} from '../../../../../lib/i18n/messages';

const roomStatusLabels = {
  ACTIVE: 'admin.roomStatusActive',
  INACTIVE: 'admin.roomStatusInactive',
  MAINTENANCE: 'admin.roomStatusMaintenance',
} as const;

export default function AdminBookingDetailPage() {
  const locale = useLocale();
  const params = useParams<{ bookingCode: string }>();
  const bookingCode = params.bookingCode;
  const [detail, setDetail] = useState<AdminBookingDetail>();
  const [error, setError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();
  const [reason, setReason] = useState('');
  const [cancellationPreview, setCancellationPreview] =
    useState<Awaited<ReturnType<typeof adminApi.getAdminCancellationPreview>>>();

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
        <AdminPageHeader
          title={translate(locale, 'account.bookingHeading', { code: bookingCode })}
        />
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      </section>
    );
  }

  if (detail === undefined) {
    return (
      <section className="admin-page">
        <AdminPageHeader
          title={translate(locale, 'account.bookingHeading', { code: bookingCode })}
        />
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
        <Link href="/admin/bookings">{translate(locale, 'admin.backToBookings')}</Link>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'account.bookingHeading', { code: detail.bookingCode })}
        actions={<Link href="/admin/bookings">{translate(locale, 'admin.backToBookings')}</Link>}
      />
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
          <dt>{translate(locale, 'admin.email')}</dt>
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
          <dt>{translate(locale, 'account.checkIn')}</dt>
          <dd>{formatDateTime(locale, detail.interval.checkIn)}</dd>
          <dt>{translate(locale, 'account.checkOut')}</dt>
          <dd>{formatDateTime(locale, detail.interval.checkOut)}</dd>
          <dt>{translate(locale, 'admin.roomType')}</dt>
          <dd>{detail.roomType.name}</dd>
          <dt>{translate(locale, 'admin.physicalRoom')}</dt>
          <dd>{detail.room?.roomNumber ?? translate(locale, 'admin.roomUnassigned')}</dd>
          <dt>{translate(locale, 'admin.roomOperationalStatus')}</dt>
          <dd>
            {detail.roomStatus === undefined || detail.roomStatus === null
              ? translate(locale, 'admin.roomUnassigned')
              : translate(locale, roomStatusLabels[detail.roomStatus])}
          </dd>
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
          <dt>{translate(locale, 'coupon.code')}</dt>
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
        <CancellationPolicySummary policy={detail.cancellationPolicy} />
      </section>

      <section className="admin-card">
        <h2>{translate(locale, 'admin.operationalReview')}</h2>
        {detail.operationalReview === null ? (
          <p>{translate(locale, 'admin.noReview')}</p>
        ) : (
          <p>
            {translate(locale, 'admin.review')} ·{' '}
            {translateAdminStatus(locale, detail.operationalReview.status)} ·{' '}
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
                <strong>{translateAdminStatus(locale, entry.eventType)}</strong> ·{' '}
                {translateAdminStatus(locale, entry.actorType)} ·{' '}
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
                <Button
                  disabled={pendingAction !== undefined}
                  onClick={() => {
                    setPendingAction('cancel-preview');
                    setError(undefined);
                    void adminApi
                      .getAdminCancellationPreview(detail.bookingCode)
                      .then(setCancellationPreview)
                      .catch(() => setError(translate(locale, 'admin.actionError')))
                      .finally(() => setPendingAction(undefined));
                  }}
                  type="button"
                >
                  {translate(locale, 'admin.previewCancellation')}
                </Button>
                {cancellationPreview ? (
                  <div role="status">
                    <p>{cancellationPreview.policyMessage}</p>
                    <p>
                      {translate(locale, 'admin.estimatedRefund')}:{' '}
                      {formatVnd(locale, cancellationPreview.estimatedRefundVnd)} ·{' '}
                      {translate(locale, 'account.cancellationPaidAmount')}:{' '}
                      {formatVnd(locale, cancellationPreview.paidAmountVnd)} ·{' '}
                      {translate(locale, 'account.cancellationRetainedAmount')}:{' '}
                      {formatVnd(locale, cancellationPreview.retainedAmountVnd)}
                    </p>
                    {cancellationPreview.policy ? (
                      <p>
                        {translate(locale, 'account.cancellationBoundary7Days')}:{' '}
                        {formatDateTime(locale, cancellationPreview.policy.sevenDayDeadline)} ·{' '}
                        {translate(locale, 'account.cancellationBoundary3Days')}:{' '}
                        {formatDateTime(locale, cancellationPreview.policy.threeDayDeadline)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label>
                  {translate(locale, 'admin.cancelReason')}
                  <Input
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={translate(locale, 'admin.reasonPlaceholder')}
                    required
                    value={reason}
                  />
                </label>
                <Button disabled={pendingAction !== undefined} type="submit">
                  {pendingAction === 'cancel'
                    ? translate(locale, 'admin.cancelling')
                    : translate(locale, 'admin.cancelBooking')}
                </Button>
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
                  <Input
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={translate(locale, 'admin.reasonPlaceholder')}
                    required
                    value={reason}
                  />
                </label>
                <Button disabled={pendingAction !== undefined} type="submit">
                  {pendingAction === 'no-show'
                    ? translate(locale, 'admin.markingNoShow')
                    : translate(locale, 'admin.markNoShow')}
                </Button>
              </form>
            ) : null}
            {detail.availableActions.includes('check-in') ? (
              <form
                onSubmit={runAction('check-in', () =>
                  adminApi.checkInAdminBooking(detail.bookingCode),
                )}
              >
                <Button
                  aria-label={translate(locale, 'admin.legacyCheckInLabel')}
                  disabled={pendingAction !== undefined}
                  type="submit"
                >
                  {pendingAction === 'check-in'
                    ? translate(locale, 'admin.checkingIn')
                    : translate(locale, 'account.checkIn')}
                </Button>
              </form>
            ) : null}
            {detail.availableActions.includes('check-out') ? (
              <form
                onSubmit={runAction('check-out', () =>
                  adminApi.checkOutAdminBooking(detail.bookingCode),
                )}
              >
                <Button
                  aria-label={translate(locale, 'admin.legacyCheckOutLabel')}
                  disabled={pendingAction !== undefined}
                  type="submit"
                >
                  {pendingAction === 'check-out'
                    ? translate(locale, 'admin.checkingOut')
                    : translate(locale, 'account.checkOut')}
                </Button>
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
