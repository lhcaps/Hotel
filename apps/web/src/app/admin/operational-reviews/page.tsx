'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  adminApi,
  type AdminOperationalReviewSummary,
} from '../../../lib/admin-api';
import { useLocale } from '../../../components/locale-provider';
import { formatDateTime, translate } from '../../../lib/i18n/messages';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['', 'OPEN', 'RESOLVED'] as const;

interface Filters {
  readonly status: (typeof STATUS_OPTIONS)[number];
  readonly bookingCode: string;
}

const emptyFilters: Filters = { status: '', bookingCode: '' };

export default function OperationalReviewsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<readonly AdminOperationalReviewSummary[]>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);

  const refresh = useCallback(
    (nextPage: number, next: Filters) => {
      setItems(undefined);
      setError(undefined);
      const params: {
        page: number;
        pageSize: number;
        status?: 'OPEN' | 'RESOLVED';
        bookingCode?: string;
      } = { page: nextPage, pageSize: PAGE_SIZE };
      if (next.status !== '') params.status = next.status;
      if (next.bookingCode !== '') params.bookingCode = next.bookingCode;
      adminApi
        .listOperationalReviews(params)
        .then((response) => {
          setItems(response.items);
          setPage(response.page);
          setTotalPages(Math.max(1, response.totalPages));
        })
        .catch((cause: unknown) => {
          setItems([]);
          setError(
            cause instanceof AdminApiError
              ? translate(locale, 'admin.reviewsLoadError')
              : translate(locale, 'admin.reviewsLoadError'),
          );
        });
    },
    [locale],
  );

  useEffect(() => {
    refresh(1, emptyFilters);
  }, [refresh]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
    refresh(1, filters);
  }

  function reset() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    refresh(1, emptyFilters);
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'admin.reviews')}</h1>
      <p>{translate(locale, 'admin.reviewsHelp')}</p>
      <form onSubmit={onSubmit}>
        <label>
          {translate(locale, 'admin.status')}
          <select
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as Filters['status'],
              }))
            }
            value={filters.status}
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === '' ? translate(locale, 'admin.all') : value}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.bookingCode')}
          <input
            onChange={(event) =>
              setFilters((current) => ({ ...current, bookingCode: event.target.value }))
            }
            placeholder="BK-ABCDEF"
            type="search"
            value={filters.bookingCode}
          />
        </label>
        <button type="submit">{translate(locale, 'admin.apply')}</button>
        <button onClick={reset} type="button">
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
        <div className="table-empty">{translate(locale, 'admin.reviewsEmpty')}</div>
      ) : null}
      {items !== undefined && items.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>{translate(locale, 'admin.review')}</th>
              <th>{translate(locale, 'account.bookings')}</th>
              <th>{translate(locale, 'admin.type')}</th>
              <th>{translate(locale, 'admin.status')}</th>
              <th>{translate(locale, 'admin.openedAt')}</th>
              <th>{translate(locale, 'admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.reviewId}>
                <td>{item.reviewId.slice(0, 8)}</td>
                <td>
                  <Link href={`/admin/bookings/${item.bookingCode}`}>{item.bookingCode}</Link>
                </td>
                <td>{item.category}</td>
                <td>{item.status}</td>
                <td>{formatDateTime(locale, item.openedAt)}</td>
                <td>
                  <Link href={`/admin/operational-reviews/${item.reviewId}`}>
                    {translate(locale, 'admin.open')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="admin-pagination">
        <button
          disabled={page <= 1}
          onClick={() => refresh(page - 1, appliedFilters)}
          type="button"
        >
          {translate(locale, 'admin.previousPage')}
        </button>
        <span>{translate(locale, 'admin.pageOf', { page, totalPages })}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => refresh(page + 1, appliedFilters)}
          type="button"
        >
          {translate(locale, 'admin.nextPage')}
        </button>
      </div>
    </section>
  );
}
