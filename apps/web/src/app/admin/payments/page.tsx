'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  adminApi,
  type AdminPaymentProvider,
  type AdminPaymentStatus,
  type AdminPaymentSummary,
} from '../../../lib/admin-api';
import { useLocale } from '../../../components/locale-provider';
import {
  formatDateTime,
  formatVnd,
  translate,
  translatePaymentStatus,
} from '../../../lib/i18n/messages';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  '',
  'PENDING',
  'SUCCEEDED',
  'REVIEW_REQUIRED',
  'CANCELLED',
  'EXPIRED',
] as const;

const PROVIDER_OPTIONS = ['', 'MOMO', 'VNPAY'] as const;

const REVIEW_OPTIONS = ['', 'needs_review', 'normal'] as const;

interface Filters {
  readonly bookingCode: string;
  readonly status: (typeof STATUS_OPTIONS)[number];
  readonly provider: (typeof PROVIDER_OPTIONS)[number];
  readonly review: (typeof REVIEW_OPTIONS)[number];
  readonly createdFrom: string;
  readonly createdTo: string;
}

const emptyFilters: Filters = {
  bookingCode: '',
  status: '',
  provider: '',
  review: '',
  createdFrom: '',
  createdTo: '',
};

function providerLabel(value: AdminPaymentProvider | null): string {
  if (value === null) return '—';
  return value;
}

export default function AdminPaymentsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<readonly AdminPaymentSummary[]>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const refresh = useCallback(
    (nextPage: number, next: Filters) => {
      setItems(undefined);
      setError(undefined);
      const params: {
        page: number;
        pageSize: number;
        status?: AdminPaymentStatus;
        provider?: AdminPaymentProvider;
        bookingCode?: string;
        needsReview?: boolean;
        createdFrom?: string;
        createdTo?: string;
      } = { page: nextPage, pageSize: PAGE_SIZE };
      if (next.status !== '') params.status = next.status;
      if (next.provider !== '') params.provider = next.provider;
      if (next.bookingCode !== '') params.bookingCode = next.bookingCode;
      if (next.review === 'needs_review') params.needsReview = true;
      if (next.review === 'normal') params.needsReview = false;
      if (next.createdFrom !== '') params.createdFrom = next.createdFrom;
      if (next.createdTo !== '') params.createdTo = next.createdTo;
      adminApi
        .listPayments(params)
        .then((response) => {
          setItems(response.items);
          setPage(response.page);
          setTotalPages(Math.max(1, response.totalPages));
          setTotalItems(response.totalItems);
        })
        .catch((cause: unknown) => {
          setItems([]);
          setError(
            cause instanceof AdminApiError
              ? translate(locale, 'admin.paymentsLoadError')
              : translate(locale, 'admin.paymentsLoadError'),
          );
        });
    },
    [locale],
  );

  useEffect(() => {
    refresh(1, filters);
  }, [refresh, filters]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    refresh(1, filters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    refresh(1, emptyFilters);
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'admin.paymentsHeading')}</h1>
      <p>{translate(locale, 'admin.paymentsHelp')}</p>
      <form onSubmit={onSubmit}>
        <label>
          {translate(locale, 'admin.bookingCode')}
          <input
            onChange={(event) => updateFilter('bookingCode', event.target.value)}
            placeholder="BK-ABCDEF"
            type="search"
            value={filters.bookingCode}
          />
        </label>
        <label>
          {translate(locale, 'admin.status')}
          <select
            onChange={(event) => updateFilter('status', event.target.value as Filters['status'])}
            value={filters.status}
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === ''
                  ? translate(locale, 'admin.all')
                  : translatePaymentStatus(locale, value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.provider')}
          <select
            onChange={(event) =>
              updateFilter('provider', event.target.value as Filters['provider'])
            }
            value={filters.provider}
          >
            {PROVIDER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === '' ? translate(locale, 'admin.all') : value}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.review')}
          <select
            onChange={(event) => updateFilter('review', event.target.value as Filters['review'])}
            value={filters.review}
          >
            {REVIEW_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === ''
                  ? translate(locale, 'admin.all')
                  : value === 'needs_review'
                    ? translate(locale, 'admin.needsReview')
                    : translate(locale, 'admin.normal')}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.createdFrom')}
          <input
            onChange={(event) => updateFilter('createdFrom', event.target.value)}
            type="date"
            value={filters.createdFrom}
          />
        </label>
        <label>
          {translate(locale, 'admin.to')}
          <input
            onChange={(event) => updateFilter('createdTo', event.target.value)}
            type="date"
            value={filters.createdTo}
          />
        </label>
        <button type="submit">{translate(locale, 'admin.apply')}</button>
        <button onClick={resetFilters} type="button">
          {translate(locale, 'admin.reset')}
        </button>
      </form>
      {items === undefined && error === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      ) : null}
      {error === undefined ? null : (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
      {items !== undefined && items.length === 0 ? (
        <div className="table-empty">{translate(locale, 'admin.paymentsEmpty')}</div>
      ) : null}
      {items !== undefined && items.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>{translate(locale, 'account.payment')}</th>
              <th>{translate(locale, 'account.bookings')}</th>
              <th>{translate(locale, 'admin.provider')}</th>
              <th>{translate(locale, 'admin.status')}</th>
              <th>{translate(locale, 'admin.amount')}</th>
              <th>Attempt</th>
              <th>{translate(locale, 'admin.review')}</th>
              <th>{translate(locale, 'admin.reconciliation')}</th>
              <th>{translate(locale, 'admin.lastEvent')}</th>
              <th>{translate(locale, 'admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.paymentId}>
                <td>{item.paymentId.slice(0, 8)}</td>
                <td>
                  <Link href={`/admin/bookings/${item.bookingCode}`}>{item.bookingCode}</Link>
                </td>
                <td>{providerLabel(item.provider)}</td>
                <td>{translatePaymentStatus(locale, item.status)}</td>
                <td>{formatVnd(locale, item.amountVnd)}</td>
                <td>{item.attemptCount}</td>
                <td>
                  {item.needsReview ? (
                    <span style={{ color: 'var(--color-warning, #b45309)', fontWeight: 600 }}>
                      {translate(locale, 'admin.needsReview')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{item.reconciliationStatus}</td>
                <td>{formatDateTime(locale, item.lastEventAt)}</td>
                <td>
                  <Link href={`/admin/payments/${item.paymentId}`}>
                    {translate(locale, 'admin.open')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="admin-pagination">
        <button disabled={page <= 1} onClick={() => refresh(page - 1, filters)} type="button">
          {translate(locale, 'admin.previousPage')}
        </button>
        <span>{translate(locale, 'admin.paymentPageOf', { page, totalPages, totalItems })}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => refresh(page + 1, filters)}
          type="button"
        >
          {translate(locale, 'admin.nextPage')}
        </button>
      </div>
    </section>
  );
}
