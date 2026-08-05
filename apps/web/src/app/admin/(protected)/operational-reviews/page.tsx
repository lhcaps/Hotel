'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  adminApi,
  type AdminOperationalReviewSummary,
} from '../../../../lib/admin-api';
import { useLocale } from '../../../../components/locale-provider';
import { formatDateTime, translate, translateAdminStatus } from '../../../../lib/i18n/messages';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Field, FieldLabel } from '../../../../components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterToolbar,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTablePagination,
} from '../../../../components/admin/admin-ui';

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
          setTotalPages(Math.max(1, Math.ceil(response.totalItems / response.pageSize)));
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
      <AdminPageHeader
        title={translate(locale, 'admin.reviews')}
        description={translate(locale, 'admin.reviewsHelp')}
      />
      <AdminFilterToolbar onSubmit={onSubmit}>
        <Field>
          <FieldLabel htmlFor="admin-review-status">{translate(locale, 'admin.status')}</FieldLabel>
          <Select
            value={filters.status || 'ALL'}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: (value === null || value === 'ALL' ? '' : value) as Filters['status'],
              }))
            }
          >
            <SelectTrigger id="admin-review-status" className="w-full">
              <SelectValue>
                {filters.status === ''
                  ? translate(locale, 'admin.all')
                  : translateAdminStatus(locale, filters.status)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((value) => (
                <SelectItem key={value || 'ALL'} value={value || 'ALL'}>
                  {value === ''
                    ? translate(locale, 'admin.all')
                    : translateAdminStatus(locale, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-review-booking-code">
            {translate(locale, 'admin.bookingCode')}
          </FieldLabel>
          <Input
            id="admin-review-booking-code"
            onChange={(event) =>
              setFilters((current) => ({ ...current, bookingCode: event.target.value }))
            }
            placeholder={translate(locale, 'admin.bookingCodePlaceholder')}
            type="search"
            value={filters.bookingCode}
          />
        </Field>
        <div className="admin-row-actions">
          <Button type="submit">{translate(locale, 'admin.apply')}</Button>
          <Button onClick={reset} type="button" variant="outline">
            {translate(locale, 'admin.reset')}
          </Button>
        </div>
      </AdminFilterToolbar>
      {items === undefined && error === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {error === undefined ? null : (
        <AdminErrorState title={translate(locale, 'admin.reviewsLoadError')} description={error} />
      )}
      {items !== undefined && items.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'admin.reviewsEmpty')} />
      ) : null}
      {items !== undefined && items.length > 0 ? (
        <AdminDataTable className="admin-reviews-table">
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
                  <td data-label={translate(locale, 'admin.review')}>
                    {item.reviewId.slice(0, 8)}
                  </td>
                  <td data-label={translate(locale, 'account.bookings')}>
                    <Link href={`/admin/bookings/${item.bookingCode}`}>{item.bookingCode}</Link>
                  </td>
                  <td data-label={translate(locale, 'admin.type')}>{item.category}</td>
                  <td>
                    <AdminStatusBadge tone={item.status === 'RESOLVED' ? 'success' : 'warning'}>
                      {translateAdminStatus(locale, item.status)}
                    </AdminStatusBadge>
                  </td>
                  <td data-label={translate(locale, 'admin.openedAt')}>
                    {formatDateTime(locale, item.openedAt)}
                  </td>
                  <td data-label={translate(locale, 'admin.action')}>
                    <Link href={`/admin/operational-reviews/${item.reviewId}`}>
                      {translate(locale, 'admin.open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminDataTable>
      ) : null}
      <AdminTablePagination
        page={page}
        pageCount={totalPages}
        onPageChange={(nextPage) => refresh(nextPage, appliedFilters)}
        previousLabel={translate(locale, 'admin.previousPage')}
        nextLabel={translate(locale, 'admin.nextPage')}
      />
    </section>
  );
}
