'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, adminApi, type AdminBookingSummary } from '../../../../lib/admin-api';
import { useLocale } from '../../../../components/locale-provider';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Table } from '../../../../components/ui/table';
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
import {
  formatDateTime,
  formatVnd,
  translate,
  translateAdminStatus,
  translatePaymentStatus,
} from '../../../../lib/i18n/messages';
import {
  emptyAdminBookingFilters,
  hasReversedAdminBookingDateRange,
  readAdminBookingFilterState,
  toAdminBookingFilterQuery,
  type AdminBookingFilters,
} from '../../../../lib/admin-booking-filter-state';

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

const roomStatusLabels = {
  ACTIVE: 'admin.roomStatusActive',
  INACTIVE: 'admin.roomStatusInactive',
  MAINTENANCE: 'admin.roomStatusMaintenance',
} as const;

function statusTone(value: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (value === 'CONFIRMED' || value === 'SUCCEEDED' || value === 'RESOLVED') return 'success';
  if (value === 'CANCELLED' || value === 'FAILED') return 'danger';
  if (value === 'REVIEW_REQUIRED' || value === 'PENDING' || value === 'OPEN') return 'warning';
  return 'info';
}

export default function AdminBookingsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<readonly AdminBookingSummary[]>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState<AdminBookingFilters>(emptyAdminBookingFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AdminBookingFilters>(emptyAdminBookingFilters);
  const [hydrated, setHydrated] = useState(false);

  const syncUrl = useCallback(
    (nextPage: number, nextFilters: AdminBookingFilters, replace = false) => {
      if (typeof window === 'undefined') return;
      const query = toAdminBookingFilterQuery(nextPage, nextFilters);
      const nextUrl = `${window.location.pathname}${query === '' ? '' : `?${query}`}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl === currentUrl) return;
      window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl);
    },
    [],
  );

  const refresh = useCallback(
    (nextPage: number, next: AdminBookingFilters) => {
      setItems(undefined);
      setError(undefined);
      setTotalPages(1);
      const params: {
        page: number;
        pageSize: number;
        q?: string;
        customerUserId?: string;
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
      if (next.customerUserId !== '') params.customerUserId = next.customerUserId;
      if (next.status !== '') params.status = next.status;
      if (next.paymentStatus !== '') params.paymentStatus = next.paymentStatus;
      if (next.reviewPresence !== '') params.reviewPresence = next.reviewPresence;
      if (next.checkInFrom !== '') params.checkInFrom = next.checkInFrom;
      if (next.checkInTo !== '') params.checkInTo = next.checkInTo;
      adminApi
        .listAdminBookings(params)
        .then((response) => {
          const nextTotalPages = Math.max(1, Math.ceil(response.totalItems / response.pageSize));
          setTotalPages(nextTotalPages);
          if (response.page > nextTotalPages) {
            setPage(nextTotalPages);
            syncUrl(nextTotalPages, next, true);
            return;
          }
          setItems(response.items);
          setPage(response.page);
        })
        .catch((cause: unknown) => {
          setItems(undefined);
          setError(
            cause instanceof AdminApiError
              ? translate(locale, 'admin.bookingsLoadError')
              : translate(locale, 'admin.bookingsLoadError'),
          );
        });
    },
    [locale, syncUrl],
  );

  useEffect(() => {
    const applyUrlState = () => {
      const next = readAdminBookingFilterState(new URLSearchParams(window.location.search));
      setFilters(next.filters);
      setAppliedFilters(next.filters);
      setPage(next.page);
      if (hasReversedAdminBookingDateRange(next.filters)) {
        setTotalPages(1);
        setError(translate(locale, 'admin.bookingDateRangeInvalid'));
      } else {
        setError(undefined);
      }
      setHydrated(true);
    };
    applyUrlState();
    window.addEventListener('popstate', applyUrlState);
    return () => window.removeEventListener('popstate', applyUrlState);
  }, [locale]);

  useEffect(() => {
    if (!hydrated || hasReversedAdminBookingDateRange(appliedFilters)) return;
    refresh(page, appliedFilters);
  }, [appliedFilters, hydrated, page, refresh]);

  function updateFilter<K extends keyof AdminBookingFilters>(
    key: K,
    value: AdminBookingFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedFilters: AdminBookingFilters = {
      ...filters,
      checkInFrom: String(formData.get('checkInFrom') ?? filters.checkInFrom),
      checkInTo: String(formData.get('checkInTo') ?? filters.checkInTo),
    };
    setFilters(submittedFilters);
    if (hasReversedAdminBookingDateRange(submittedFilters)) {
      setTotalPages(1);
      setError(translate(locale, 'admin.bookingDateRangeInvalid'));
      return;
    }
    setAppliedFilters(submittedFilters);
    setPage(1);
    setError(undefined);
    syncUrl(1, submittedFilters);
  }

  function resetFilters() {
    setFilters(emptyAdminBookingFilters);
    setAppliedFilters(emptyAdminBookingFilters);
    setPage(1);
    setError(undefined);
    syncUrl(1, emptyAdminBookingFilters);
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.bookingsHeading')}
        description={translate(locale, 'admin.bookingsHelp')}
      />
      <AdminFilterToolbar onSubmit={onSubmit}>
        <Field>
          <FieldLabel htmlFor="admin-booking-code">
            {translate(locale, 'admin.bookingCode')}
          </FieldLabel>
          <Input
            id="admin-booking-code"
            onChange={(event) => updateFilter('bookingCode', event.target.value)}
            placeholder={translate(locale, 'admin.bookingCodePlaceholder')}
            type="search"
            value={filters.bookingCode}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-booking-status">
            {translate(locale, 'admin.status')}
          </FieldLabel>
          <Select
            value={filters.status || 'ALL'}
            onValueChange={(value) =>
              updateFilter('status', value === null || value === 'ALL' ? '' : value)
            }
          >
            <SelectTrigger id="admin-booking-status" className="w-full">
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
          <FieldLabel htmlFor="admin-booking-payment-status">
            {translate(locale, 'account.payment')}
          </FieldLabel>
          <Select
            value={filters.paymentStatus || 'ALL'}
            onValueChange={(value) =>
              updateFilter('paymentStatus', value === null || value === 'ALL' ? '' : value)
            }
          >
            <SelectTrigger id="admin-booking-payment-status" className="w-full">
              <SelectValue>
                {filters.paymentStatus === ''
                  ? translate(locale, 'admin.all')
                  : translatePaymentStatus(locale, filters.paymentStatus)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_OPTIONS.map((value) => (
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
          <FieldLabel htmlFor="admin-booking-review">
            {translate(locale, 'admin.review')}
          </FieldLabel>
          <Select
            value={filters.reviewPresence || 'ALL'}
            onValueChange={(value) =>
              updateFilter('reviewPresence', value === null || value === 'ALL' ? '' : value)
            }
          >
            <SelectTrigger id="admin-booking-review" className="w-full">
              <SelectValue>
                {filters.reviewPresence === ''
                  ? translate(locale, 'admin.all')
                  : translateAdminStatus(locale, filters.reviewPresence)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REVIEW_OPTIONS.map((value) => (
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
          <FieldLabel htmlFor="admin-booking-check-in-from">
            {translate(locale, 'admin.checkInFrom')}
          </FieldLabel>
          <Input
            id="admin-booking-check-in-from"
            name="checkInFrom"
            onChange={(event) => updateFilter('checkInFrom', event.target.value)}
            type="date"
            value={filters.checkInFrom}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-booking-check-in-to">
            {translate(locale, 'admin.to')}
          </FieldLabel>
          <Input
            id="admin-booking-check-in-to"
            name="checkInTo"
            onChange={(event) => updateFilter('checkInTo', event.target.value)}
            type="date"
            value={filters.checkInTo}
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
        <AdminErrorState
          title={error}
          action={
            <Button onClick={() => refresh(page, appliedFilters)} type="button" variant="outline">
              {translate(locale, 'admin.retry')}
            </Button>
          }
        />
      )}
      {items !== undefined && items.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'admin.bookingsEmpty')} />
      ) : null}
      {items !== undefined && items.length > 0 ? (
        <AdminDataTable variant="operational" className="admin-bookings-table">
          <Table>
            <thead>
              <tr>
                <th>{translate(locale, 'admin.code')}</th>
                <th>{translate(locale, 'admin.guest')}</th>
                <th>{translate(locale, 'admin.status')}</th>
                <th>{translate(locale, 'admin.room')}</th>
                <th>{translate(locale, 'admin.roomOperationalStatus')}</th>
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
                  <td data-label={translate(locale, 'admin.code')}>
                    <Link href={`/admin/bookings/${item.bookingCode}`}>{item.bookingCode}</Link>
                  </td>
                  <td data-label={translate(locale, 'admin.guest')}>{item.guestName}</td>
                  <td data-label={translate(locale, 'admin.status')}>
                    <AdminStatusBadge tone={statusTone(item.status)}>
                      {translatePaymentStatus(locale, item.status)}
                    </AdminStatusBadge>
                  </td>
                  <td data-label={translate(locale, 'admin.room')}>
                    {item.roomType.name}
                    {item.room === null ? '' : ` · ${item.room.roomNumber}`}
                  </td>
                  <td data-label={translate(locale, 'admin.roomOperationalStatus')}>
                    {item.roomStatus === undefined || item.roomStatus === null
                      ? translate(locale, 'admin.roomUnassigned')
                      : translate(locale, roomStatusLabels[item.roomStatus])}
                  </td>
                  <td data-label={translate(locale, 'account.checkIn')}>
                    {formatDateTime(locale, item.checkIn)}
                  </td>
                  <td data-label={translate(locale, 'account.checkOut')}>
                    {formatDateTime(locale, item.checkOut)}
                  </td>
                  <td data-label={translate(locale, 'admin.amount')}>
                    {formatVnd(locale, item.finalAmountVnd)}
                  </td>
                  <td data-label={translate(locale, 'account.payment')}>
                    <AdminStatusBadge tone={statusTone(item.paymentStatus)}>
                      {translatePaymentStatus(locale, item.paymentStatus)}
                    </AdminStatusBadge>
                  </td>
                  <td data-label={translate(locale, 'admin.review')}>
                    <AdminStatusBadge tone={statusTone(item.reviewPresence)}>
                      {translateAdminStatus(locale, item.reviewPresence)}
                    </AdminStatusBadge>
                  </td>
                  <td data-label={translate(locale, 'admin.action')}>
                    <Link href={`/admin/bookings/${item.bookingCode}`}>
                      {translate(locale, 'admin.open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </AdminDataTable>
      ) : null}
      {items !== undefined && error === undefined && items.length > 0 && totalPages > 1 ? (
        <AdminTablePagination
          page={page}
          pageCount={totalPages}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            syncUrl(nextPage, appliedFilters);
          }}
          previousLabel={translate(locale, 'admin.previousPage')}
          nextLabel={translate(locale, 'admin.nextPage')}
        />
      ) : null}
    </section>
  );
}
