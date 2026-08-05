'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  adminApi,
  type AdminPaymentProvider,
  type AdminPaymentStatus,
  type AdminPaymentSummary,
} from '../../../../lib/admin-api';
import { useLocale } from '../../../../components/locale-provider';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Table } from '../../../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import { Field, FieldLabel } from '../../../../components/ui/field';
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
import {
  formatDateTime,
  formatVnd,
  translate,
  translatePaymentStatus,
} from '../../../../lib/i18n/messages';

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

function providerLabel(
  locale: ReturnType<typeof useLocale>,
  value: AdminPaymentProvider | null,
): string {
  if (value === null) return translate(locale, 'admin.unknownProvider');
  return value === 'MOMO' ? 'MoMo' : 'VNPay';
}

function statusTone(value: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (value === 'SUCCEEDED') return 'success';
  if (value === 'CANCELLED' || value === 'FAILED') return 'danger';
  if (value === 'REVIEW_REQUIRED' || value === 'PENDING') return 'warning';
  return 'info';
}

export default function AdminPaymentsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<readonly AdminPaymentSummary[]>();
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
        status?: AdminPaymentStatus;
        provider?: AdminPaymentProvider;
        bookingCode?: string;
        reviewRequired?: boolean;
        createdFrom?: string;
        createdTo?: string;
      } = { page: nextPage, pageSize: PAGE_SIZE };
      if (next.status !== '') params.status = next.status;
      if (next.provider !== '') params.provider = next.provider;
      if (next.bookingCode !== '') params.bookingCode = next.bookingCode;
      if (next.review === 'needs_review') params.reviewRequired = true;
      if (next.review === 'normal') params.reviewRequired = false;
      if (next.createdFrom !== '') params.createdFrom = next.createdFrom;
      if (next.createdTo !== '') params.createdTo = next.createdTo;
      adminApi
        .listPayments(params)
        .then((response) => {
          setItems(response.items);
          setPage(response.page);
          setTotalPages(Math.max(1, Math.ceil(response.totalItems / response.pageSize)));
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
      <AdminPageHeader
        title={translate(locale, 'admin.paymentsHeading')}
        description={translate(locale, 'admin.paymentsHelp')}
      />
      <AdminFilterToolbar onSubmit={onSubmit}>
        <Field>
          <FieldLabel htmlFor="admin-payment-booking-code">
            {translate(locale, 'admin.bookingCode')}
          </FieldLabel>
          <Input
            id="admin-payment-booking-code"
            onChange={(event) => updateFilter('bookingCode', event.target.value)}
            placeholder={translate(locale, 'admin.bookingCodePlaceholder')}
            type="search"
            value={filters.bookingCode}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-payment-status">
            {translate(locale, 'admin.status')}
          </FieldLabel>
          <Select
            value={filters.status || 'ALL'}
            onValueChange={(value) =>
              updateFilter(
                'status',
                (value === null || value === 'ALL' ? '' : value) as Filters['status'],
              )
            }
          >
            <SelectTrigger id="admin-payment-status" className="w-full">
              <SelectValue>
                {filters.status === ''
                  ? translate(locale, 'admin.all')
                  : translatePaymentStatus(locale, filters.status)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((value) => (
                <SelectItem key={value || 'ALL'} value={value || 'ALL'}>
                  {value === ''
                    ? translate(locale, 'admin.all')
                    : translatePaymentStatus(locale, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-payment-provider">
            {translate(locale, 'admin.provider')}
          </FieldLabel>
          <Select
            value={filters.provider || 'ALL'}
            onValueChange={(value) =>
              updateFilter(
                'provider',
                (value === null || value === 'ALL' ? '' : value) as Filters['provider'],
              )
            }
          >
            <SelectTrigger id="admin-payment-provider" className="w-full">
              <SelectValue>
                {filters.provider === ''
                  ? translate(locale, 'admin.all')
                  : filters.provider === 'MOMO'
                    ? 'MoMo'
                    : 'VNPay'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((value) => (
                <SelectItem key={value || 'ALL'} value={value || 'ALL'}>
                  {value === ''
                    ? translate(locale, 'admin.all')
                    : value === 'MOMO'
                      ? 'MoMo'
                      : 'VNPay'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-payment-review">
            {translate(locale, 'admin.review')}
          </FieldLabel>
          <Select
            value={filters.review || 'ALL'}
            onValueChange={(value) =>
              updateFilter(
                'review',
                (value === null || value === 'ALL' ? '' : value) as Filters['review'],
              )
            }
          >
            <SelectTrigger aria-label="Review" id="admin-payment-review" className="w-full">
              <SelectValue>
                {filters.review === ''
                  ? translate(locale, 'admin.all')
                  : filters.review === 'needs_review'
                    ? translate(locale, 'admin.needsReview')
                    : translate(locale, 'admin.normal')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REVIEW_OPTIONS.map((value) => (
                <SelectItem
                  aria-label={
                    value === 'needs_review'
                      ? translate(locale, 'admin.legacyReviewLabel')
                      : undefined
                  }
                  key={value || 'ALL'}
                  value={value || 'ALL'}
                >
                  {value === '' ? (
                    translate(locale, 'admin.all')
                  ) : value === 'needs_review' ? (
                    <>
                      {translate(locale, 'admin.needsReview')}
                      <span className="sr-only">
                        {translate(locale, 'admin.legacyReviewLabel')}
                      </span>
                    </>
                  ) : (
                    translate(locale, 'admin.normal')
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-payment-created-from">
            {translate(locale, 'admin.createdFrom')}
          </FieldLabel>
          <Input
            id="admin-payment-created-from"
            onChange={(event) => updateFilter('createdFrom', event.target.value)}
            type="date"
            value={filters.createdFrom}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-payment-created-to">
            {translate(locale, 'admin.to')}
          </FieldLabel>
          <Input
            id="admin-payment-created-to"
            onChange={(event) => updateFilter('createdTo', event.target.value)}
            type="date"
            value={filters.createdTo}
          />
        </Field>
        <div className="admin-row-actions">
          <Button type="submit">{translate(locale, 'admin.apply')}</Button>
          <Button onClick={resetFilters} type="button" variant="outline">
            {translate(locale, 'admin.reset')}
          </Button>
        </div>
      </AdminFilterToolbar>
      {items === undefined && error === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {error === undefined ? null : (
        <AdminErrorState title={translate(locale, 'admin.paymentsLoadError')} description={error} />
      )}
      {items !== undefined && items.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'admin.paymentsEmpty')} />
      ) : null}
      {items !== undefined && items.length > 0 ? (
        <AdminDataTable className="admin-payments-table">
          <Table>
            <thead>
              <tr>
                <th>{translate(locale, 'account.payment')}</th>
                <th>{translate(locale, 'account.bookings')}</th>
                <th>{translate(locale, 'admin.provider')}</th>
                <th>{translate(locale, 'admin.status')}</th>
                <th>{translate(locale, 'admin.amount')}</th>
                <th>{translate(locale, 'payment.attempt')}</th>
                <th>{translate(locale, 'admin.review')}</th>
                <th>{translate(locale, 'admin.updatedAt')}</th>
                <th>{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.paymentId}>
                  <td data-label={translate(locale, 'account.payment')}>
                    {item.paymentId.slice(0, 8)}
                  </td>
                  <td data-label={translate(locale, 'account.bookings')}>
                    <Link href={`/admin/bookings/${item.booking.bookingCode}`}>
                      {item.booking.bookingCode}
                    </Link>
                  </td>
                  <td data-label={translate(locale, 'admin.provider')}>
                    {providerLabel(locale, item.provider)}
                  </td>
                  <td data-label={translate(locale, 'admin.status')}>
                    <AdminStatusBadge tone={statusTone(item.status)}>
                      {translatePaymentStatus(locale, item.status)}
                    </AdminStatusBadge>
                  </td>
                  <td data-label={translate(locale, 'admin.amount')}>
                    {formatVnd(locale, item.amountVnd)}
                  </td>
                  <td data-label={translate(locale, 'payment.attempt')}>
                    {item.latestAttempt === null
                      ? '—'
                      : `${translatePaymentStatus(locale, item.latestAttempt.status)} · ${providerLabel(locale, item.latestAttempt.provider)}`}
                  </td>
                  <td data-label={translate(locale, 'admin.review')}>
                    <AdminStatusBadge tone={item.reviewRequired ? 'warning' : 'neutral'}>
                      {item.reviewRequired ? (
                        <>
                          {translate(locale, 'admin.needsReview')}
                          <span className="sr-only">
                            {translate(locale, 'admin.legacyReviewLabel')}
                          </span>
                        </>
                      ) : (
                        translate(locale, 'admin.normal')
                      )}
                    </AdminStatusBadge>
                  </td>
                  <td data-label={translate(locale, 'admin.updatedAt')}>
                    {formatDateTime(locale, item.updatedAt)}
                  </td>
                  <td data-label={translate(locale, 'admin.action')}>
                    <Link href={`/admin/payments/${item.paymentId}`}>
                      {translate(locale, 'admin.open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </AdminDataTable>
      ) : null}
      <AdminTablePagination
        page={page}
        pageCount={totalPages}
        onPageChange={(nextPage) => refresh(nextPage, filters)}
        previousLabel={translate(locale, 'admin.previousPage')}
        nextLabel={translate(locale, 'admin.nextPage')}
      />
    </section>
  );
}
