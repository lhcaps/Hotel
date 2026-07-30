'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Coupon } from '@room/contracts';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { formatDateTime, formatVnd, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

const discount = (locale: ReturnType<typeof useLocale>, coupon: Coupon) =>
  coupon.discountType === 'FIXED'
    ? formatVnd(locale, coupon.fixedAmountVnd ?? 0)
    : `${(coupon.percentageBasisPoints ?? 0) / 100}%`;

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
      <div className="page-heading">
        <div>
          <h1>Coupon</h1>
          <p>{translate(locale, 'coupon.adminHelp')}</p>
        </div>
        <Link className="primary-button" href="/admin/coupons/new">
          {translate(locale, 'coupon.create')}
        </Link>
      </div>
      <div className="coupon-filters">
        <label>
          {translate(locale, 'coupon.search')}
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          {translate(locale, 'coupon.lifecycle')}
          <select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
            <option value="ALL">{translate(locale, 'admin.all')}</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setLifecycle('ALL');
          }}
        >
          {translate(locale, 'coupon.clearFilters')}
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : items === undefined ? (
        <p aria-live="polite">{translate(locale, 'coupon.loading')}</p>
      ) : filtered?.length === 0 ? (
        <p className="table-empty">{translate(locale, 'coupon.empty')}</p>
      ) : (
        <div className="coupon-grid">
          {filtered?.map((coupon) => (
            <article className="coupon-card" key={coupon.id}>
              <div className="page-heading">
                <h2>{coupon.code}</h2>
                <strong>{coupon.lifecycle}</strong>
              </div>
              <p>
                {coupon.discountType} · {discount(locale, coupon)}
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
