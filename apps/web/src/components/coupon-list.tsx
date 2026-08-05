'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Coupon } from '@room/contracts';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { formatDateTime, formatVnd, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button, buttonVariants } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminFilterToolbar,
  AdminLoadingState,
  AdminPageHeader,
} from './admin/admin-ui';

const discount = (locale: ReturnType<typeof useLocale>, coupon: Coupon) =>
  coupon.discountType === 'FIXED'
    ? formatVnd(locale, coupon.fixedAmountVnd ?? 0)
    : `${(coupon.percentageBasisPoints ?? 0) / 100}%`;

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

export function CouponList() {
  const locale = useLocale();
  const [items, setItems] = useState<readonly Coupon[]>();
  const [query, setQuery] = useState('');
  const [lifecycle, setLifecycle] = useState('ALL');
  const [error, setError] = useState<string>();
  useEffect(() => {
    void adminApi
      .listCoupons()
      .then((result) => setItems(result.items))
      .catch((reason: unknown) =>
        setError(
          reason instanceof AdminApiError
            ? safeError(locale, reason.problem.status)
            : translate(locale, 'coupon.loadError'),
        ),
      );
  }, [locale]);
  const filtered = useMemo(
    () =>
      items?.filter(
        (coupon) =>
          coupon.code.includes(query.trim().toUpperCase()) &&
          (lifecycle === 'ALL' || coupon.lifecycle === lifecycle),
      ),
    [items, lifecycle, query],
  );
  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.coupons')}
        description={translate(locale, 'coupon.adminHelp')}
        actions={
          <Link className={buttonVariants()} href="/admin/coupons/new">
            {translate(locale, 'coupon.create')}
          </Link>
        }
      />
      <AdminFilterToolbar>
        <label>
          {translate(locale, 'coupon.search')}
          <Input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          {translate(locale, 'coupon.lifecycle')}
          <Select
            value={lifecycle}
            onValueChange={(value) => {
              if (value !== null) setLifecycle(value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {lifecycle === 'ALL'
                  ? translate(locale, 'admin.all')
                  : lifecycleLabel(locale, lifecycle)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
              <SelectItem value="AVAILABLE">{lifecycleLabel(locale, 'AVAILABLE')}</SelectItem>
              <SelectItem value="EXPIRED">{lifecycleLabel(locale, 'EXPIRED')}</SelectItem>
              <SelectItem value="DISABLED">{lifecycleLabel(locale, 'DISABLED')}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button
          type="button"
          onClick={() => {
            setQuery('');
            setLifecycle('ALL');
          }}
          variant="outline"
        >
          {translate(locale, 'coupon.clearFilters')}
        </Button>
      </AdminFilterToolbar>
      {error ? (
        <AdminErrorState title={translate(locale, 'coupon.loadError')} description={error} />
      ) : items === undefined ? (
        <AdminLoadingState label={translate(locale, 'coupon.loading')} />
      ) : filtered?.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'coupon.empty')} />
      ) : (
        <div className="coupon-grid">
          {filtered?.map((coupon) => (
            <article className="coupon-card" key={coupon.id}>
              <div className="page-heading">
                <h2>{coupon.code}</h2>
                <strong>{lifecycleLabel(locale, coupon.lifecycle)}</strong>
              </div>
              <p>
                {translate(
                  locale,
                  coupon.discountType === 'FIXED' ? 'coupon.fixed' : 'coupon.percentage',
                )}{' '}
                · {discount(locale, coupon)}
              </p>
              <p>
                {formatDateTime(locale, coupon.validFrom)} —{' '}
                {formatDateTime(locale, coupon.validUntil)}
              </p>
              <p>
                {translate(locale, 'coupon.scope')}:{' '}
                {coupon.appliesToAllRoomTypes
                  ? translate(locale, 'coupon.allRoomTypes')
                  : translate(locale, 'coupon.roomTypeCount', { count: coupon.roomTypeIds.length })}
              </p>
              <dl>
                <div>
                  <dt>{translate(locale, 'coupon.activeReservations')}</dt>
                  <dd>{coupon.counts.activeReservations}</dd>
                </div>
                <div>
                  <dt>{translate(locale, 'coupon.redeemed')}</dt>
                  <dd>{coupon.counts.redeemed}</dd>
                </div>
                <div>
                  <dt>{translate(locale, 'coupon.released')}</dt>
                  <dd>{coupon.counts.released}</dd>
                </div>
              </dl>
              <Link href={`/admin/coupons/${coupon.id}`}>
                {translate(locale, 'coupon.viewDetails')}
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
function safeError(locale: ReturnType<typeof useLocale>, status: number) {
  return status === 401
    ? translate(locale, 'coupon.unauthorized')
    : status === 403
      ? translate(locale, 'coupon.forbidden')
      : translate(locale, 'coupon.loadError');
}
