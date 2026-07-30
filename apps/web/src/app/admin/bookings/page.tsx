'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, adminApi, type AdminBookingSummary } from '../../../lib/admin-api';
import { useLocale } from '../../../components/locale-provider';
import { formatDateTime, formatVnd, translate, translatePaymentStatus } from '../../../lib/i18n/messages';

const STATUS_OPTIONS = [
  '',
  'HOLD',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
  'EXPIRED',
] as const;

const PAYMENT_OPTIONS = ['', 'NONE', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUND_PENDING'] as const;

const REVIEW_OPTIONS = ['', 'NONE', 'OPEN', 'RESOLVED'] as const;

const PAGE_SIZE = 20;

interface Filters {
  readonly bookingCode: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly reviewPresence: string;
  readonly checkInFrom: string;
  readonly checkInTo: string;
}

const emptyFilters: Filters = {
  bookingCode: '',
  status: '',
  paymentStatus: '',
  reviewPresence: '',
  checkInFrom: '',
  checkInTo: '',
};

export default function AdminBookingsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<readonly AdminBookingSummary[]>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const refresh = useCallback(
    (nextPage: number, next: Filters) => {
      setItems(undefined);
      setError(undefined);
      const params: {
      page: number;
      pageSize: number;
      q?: string;
        status?: string;
        paymentStatus?: string;
        reviewPresence?: string;
        checkInFrom?: string;
        checkInTo?: string;
      } = { page: nextPage, pageSize: PAGE_SIZE };
      // The public admin contract names the booking-code prefix filter `q`.
      // Sending the UI field name (`bookingCode`) caused the API's strict
      // query schema to reject every filtered request.
      if (next.bookingCode !== '') params.q = next.bookingCode;
      if (next.status !== '') params.status = next.status;
      if (next.paymentStatus !== '') params.paymentStatus = next.paymentStatus;
      if (next.reviewPresence !== '') params.reviewPresence = next.reviewPresence;
      if (next.checkInFrom !== '') params.checkInFrom = next.checkInFrom;
      if (next.checkInTo !== '') params.checkInTo = next.checkInTo;
      adminApi
        .listAdminBookings(params)
        .then((response) => {
          setItems(response.items);
          setPage(response.page);
          setTotalPages(Math.max(1, response.totalPages));
        })
        .catch((cause: unknown) => {
          setItems([]);
          setError(
            cause instanceof AdminApiError
              ? translate(locale, 'admin.bookingsLoadError')
              : translate(locale, 'admin.bookingsLoadError'),
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
      <h1>{translate(locale, 'admin.bookingsHeading')}</h1>
      <p>{translate(locale, 'admin.bookingsHelp')}</p>
      <form onSubmit={onSubmit}>
        <label>
          {translate(locale, 'admin.bookingCode')}
          <input
            onChange={(event) => updateFilter('bookingCode', event.target.value)}
            placeholder="Example: BK-ABCDEF"
            type="search"
            value={filters.bookingCode}
          />
        </label>
        <label>
          {translate(locale, 'admin.status')}
          <select
            onChange={(event) => updateFilter('status', event.target.value)}
            value={filters.status}
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === '' ? translate(locale, 'admin.all') : translatePaymentStatus(locale, value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'account.payment')}
          <select
            onChange={(event) => updateFilter('paymentStatus', event.target.value)}
            value={filters.paymentStatus}
          >
            {PAYMENT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === '' ? translate(locale, 'admin.all') : translatePaymentStatus(locale, value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.review')}
          <select
            onChange={(event) => updateFilter('reviewPresence', event.target.value)}
            value={filters.reviewPresence}
          >
            {REVIEW_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === '' ? translate(locale, 'admin.all') : value}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.checkInFrom')}
          <input
            onChange={(event) => updateFilter('checkInFrom', event.target.value)}
            type="date"
            value={filters.checkInFrom}
          />
        </label>
        <label>
          {translate(locale, 'admin.to')}
          <input
            onChange={(event) => updateFilter('checkInTo', event.target.value)}
            type="date"
            value={filters.checkInTo}
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
        <div className="table-empty">{translate(locale, 'admin.bookingsEmpty')}</div>
      ) : null}
      {items !== undefined && items.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>{translate(locale, 'admin.code')}</th>
              <th>{translate(locale, 'admin.guest')}</th>
              <th>{translate(locale, 'admin.status')}</th>
              <th>{translate(locale, 'admin.room')}</th>
              <th>{translate(locale, 'account.checkIn')}</th>
              <th>{translate(locale, 'account.checkOut')}</th>
              <th>{translate(locale, 'admin.amount')}</th>
              <th>{translate(locale, 'account.payment')}</th>
              <th>{translate(locale, 'admin.review')}</th>
              <th>{translate(locale, 'admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.bookingCode}>
                <td>
                  <Link href={`/admin/bookings/${item.bookingCode}`}>{item.bookingCode}</Link>
                </td>
                <td>{item.guestName}</td>
                <td>{translatePaymentStatus(locale, item.status)}</td>
                <td>
                  {item.roomType.name}
                  {item.room === null ? '' : ` · ${item.room.roomNumber}`}
                </td>
                <td>{formatDateTime(locale, item.checkIn)}</td>
                <td>{formatDateTime(locale, item.checkOut)}</td>
                <td>{formatVnd(locale, item.finalAmountVnd)}</td>
                <td>{translatePaymentStatus(locale, item.paymentStatus)}</td>
                <td>
                  {item.reviewPresence === 'OPEN'
                    ? 'OPEN'
                    : item.reviewPresence === 'RESOLVED'
                      ? 'RESOLVED'
                      : '—'}
                </td>
                <td>
                  <Link href={`/admin/bookings/${item.bookingCode}`}>{translate(locale, 'admin.open')}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="admin-pagination">
        <button
          disabled={page <= 1}
          onClick={() => refresh(page - 1, filters)}
          type="button"
        >
          {translate(locale, 'admin.previousPage')}
        </button>
        <span>
          {translate(locale, 'admin.pageOf', { page, totalPages })}
        </span>
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
