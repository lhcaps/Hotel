'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Coupon } from '@room/contracts';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { formatDateTime, formatVnd, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { AdminDetailSheet, AdminPageHeader } from './admin/admin-ui';
import { Button } from './ui/button';

const lifecycleLabels = {
  AVAILABLE: 'coupon.lifecycleAvailable',
  EXPIRED: 'coupon.lifecycleExpired',
  DISABLED: 'coupon.lifecycleDisabled',
} as const;

function lifecycleLabel(locale: ReturnType<typeof useLocale>, value: string) {
  return translate(
    locale,
    lifecycleLabels[value as keyof typeof lifecycleLabels] ?? 'coupon.lifecycleDisabled',
  );
}

export function CouponDetail({ id }: { id: string }) {
  const locale = useLocale();
  const [coupon, setCoupon] = useState<Coupon>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const load = () =>
    void adminApi
      .getCoupon(id)
      .then(setCoupon)
      .catch((reason: unknown) =>
        setError(
          reason instanceof AdminApiError && reason.problem.status === 403
            ? translate(locale, 'coupon.forbidden')
            : translate(locale, 'coupon.detailLoadError'),
        ),
      );
  useEffect(load, [id, locale]);
  async function disable() {
    setPending(true);
    try {
      await adminApi.disableCoupon(id);
      setMessage(translate(locale, 'coupon.disabled'));
      setConfirmOpen(false);
      load();
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? translate(locale, 'coupon.disableError')
          : translate(locale, 'coupon.unexpectedError'),
      );
    } finally {
      setPending(false);
    }
  }
  if (error)
    return (
      <section className="admin-page">
        <p role="alert">{error}</p>
      </section>
    );
  if (!coupon)
    return (
      <section className="admin-page">
        <p aria-live="polite">{translate(locale, 'coupon.loading')}</p>
      </section>
    );
  return (
    <section className="admin-page">
      <Link href="/admin/coupons">← {translate(locale, 'coupon.backToList')}</Link>
      <AdminPageHeader
        title={coupon.code}
        actions={<Link href="/admin/coupons">{translate(locale, 'coupon.backToList')}</Link>}
      />
      <p>
        {translate(locale, 'coupon.lifecycle')}:{' '}
        <strong>{lifecycleLabel(locale, coupon.lifecycle)}</strong>{' '}
        {translate(locale, 'coupon.databaseStatus')}:{' '}
        {coupon.status === 'ACTIVE'
          ? translate(locale, 'coupon.statusActive')
          : translate(locale, 'coupon.statusDisabled')}
      </p>
      {message && <p role="status">{message}</p>}
      <div className="coupon-detail">
        <p>
          {translate(locale, 'coupon.discount')}:{' '}
          {coupon.discountType === 'FIXED'
            ? formatVnd(locale, coupon.fixedAmountVnd ?? 0)
            : `${(coupon.percentageBasisPoints ?? 0) / 100}%`}
        </p>
        <p>
          {translate(locale, 'coupon.minimum')}: {formatVnd(locale, coupon.minimumOrderAmountVnd)}
        </p>
        <p>
          {translate(locale, 'coupon.validity')}: {formatDateTime(locale, coupon.validFrom)} —{' '}
          {formatDateTime(locale, coupon.validUntil)}
        </p>
        <p>
          {translate(locale, 'coupon.scope')}:{' '}
          {coupon.appliesToAllRoomTypes
            ? translate(locale, 'coupon.allRoomTypes')
            : coupon.roomTypeIds.join(', ')}
        </p>
        <p>
          {translate(locale, 'coupon.totalLimit')}:{' '}
          {coupon.totalUsageLimit ?? translate(locale, 'coupon.unlimited')} ·{' '}
          {translate(locale, 'coupon.perCustomerLimit')}:{' '}
          {coupon.perCustomerLimit ?? translate(locale, 'coupon.unlimited')}
        </p>
        <p>
          {translate(locale, 'coupon.activeReservations')}: {coupon.counts.activeReservations} ·{' '}
          {translate(locale, 'coupon.redeemed')}: {coupon.counts.redeemed} ·{' '}
          {translate(locale, 'coupon.released')}: {coupon.counts.released}
        </p>
      </div>
      {coupon.status === 'ACTIVE' && (
        <Button disabled={pending} type="button" onClick={() => setConfirmOpen(true)}>
          {translate(locale, 'coupon.disable')}
        </Button>
      )}
      <AdminDetailSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={translate(locale, 'coupon.disable')}
        description={translate(locale, 'coupon.disableConfirm')}
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setConfirmOpen(false)}>
              {translate(locale, 'admin.cancel')}
            </Button>
            <Button
              data-testid="coupon-disable-confirm"
              disabled={pending}
              onClick={() => void disable()}
            >
              {translate(locale, 'coupon.disable')}
            </Button>
          </>
        }
      >
        <p>{translate(locale, 'coupon.disableConfirm')}</p>
      </AdminDetailSheet>
    </section>
  );
}
