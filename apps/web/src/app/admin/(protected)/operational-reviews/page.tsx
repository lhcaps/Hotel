'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';
import { Field, FieldLabel } from '../../../../components/ui/field';
import { Textarea } from '../../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import {
  AdminDataTable,
  AdminDetailSheet,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterToolbar,
  AdminLoadingState,
  AdminPageHeader,
  AdminRowActions,
  AdminStatusBadge,
  AdminTab,
  AdminTabList,
  AdminTabs,
  AdminTablePagination,
} from '../../../../components/admin/admin-ui';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['', 'OPEN', 'RESOLVED'] as const;

interface Filters {
  readonly status: (typeof STATUS_OPTIONS)[number];
  readonly bookingCode: string;
}

const emptyFilters: Filters = { status: '', bookingCode: '' };

const reviewCategoryKeys = {
  PAID_CANCELLATION: 'admin.reviewCategoryPaidCancellation',
} as const;

function reviewCategoryLabel(locale: 'vi' | 'en', category: 'PAID_CANCELLATION'): string {
  return translate(locale, reviewCategoryKeys[category]);
}

export default function OperationalReviewsPage() {
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<readonly AdminOperationalReviewSummary[]>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [detailId, setDetailId] = useState<string>();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminApi.getOperationalReview>>>();
  const [detailNote, setDetailNote] = useState('');
  const [detailPending, setDetailPending] = useState(false);

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

  function openDetail(reviewId: string) {
    setDetailId(reviewId);
    setDetail(undefined);
    adminApi
      .getOperationalReview(reviewId)
      .then(setDetail)
      .catch(() => setError(translate(locale, 'admin.reviewDetailLoadError')));
  }

  async function resolveDetail() {
    if (detailId === undefined || detailNote.trim() === '') return;
    setDetailPending(true);
    try {
      const updated = await adminApi.resolveOperationalReview(detailId, detailNote.trim());
      setDetail(updated);
      setDetailNote('');
      refresh(page, appliedFilters);
    } catch {
      setError(translate(locale, 'admin.reviewResolveError'));
    } finally {
      setDetailPending(false);
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.reviews')}
        description={translate(locale, 'admin.reviewsHelp')}
      />
      <AdminTabs
        value={filters.status === '' ? 'ALL' : filters.status}
        onValueChange={(value) => {
          const nextStatus = value === 'ALL' ? '' : (value as Filters['status']);
          const next = { ...filters, status: nextStatus };
          setFilters(next);
          setAppliedFilters(next);
          refresh(1, next);
        }}
      >
        <AdminTabList aria-label={translate(locale, 'admin.reviewFilterLabel')}>
          <AdminTab value="OPEN">{translate(locale, 'admin.reviewOpen')}</AdminTab>
          <AdminTab value="RESOLVED">{translate(locale, 'admin.reviewResolved')}</AdminTab>
          <AdminTab value="ALL">{translate(locale, 'admin.all')}</AdminTab>
        </AdminTabList>
      </AdminTabs>
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
              <SelectGroup>
                {STATUS_OPTIONS.map((value) => (
                  <SelectItem key={value || 'ALL'} value={value || 'ALL'}>
                    {value === ''
                      ? translate(locale, 'admin.all')
                      : translateAdminStatus(locale, value)}
                  </SelectItem>
                ))}
              </SelectGroup>
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
      {items !== undefined ? (
        <AdminDataTable variant="operational" className="admin-reviews-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate(locale, 'admin.review')}</TableHead>
                <TableHead>{translate(locale, 'account.bookings')}</TableHead>
                <TableHead>{translate(locale, 'admin.type')}</TableHead>
                <TableHead>{translate(locale, 'admin.status')}</TableHead>
                <TableHead>{translate(locale, 'admin.openedAt')}</TableHead>
                <TableHead>{translate(locale, 'admin.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <AdminEmptyState title={translate(locale, 'admin.reviewsEmpty')} />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.reviewId}>
                    <TableCell data-label={translate(locale, 'admin.review')}>
                      {item.reviewId.slice(0, 8)}
                    </TableCell>
                    <TableCell data-label={translate(locale, 'account.bookings')}>
                      <Link href={`/admin/bookings/${item.bookingCode}`}>{item.bookingCode}</Link>
                    </TableCell>
                    <TableCell data-label={translate(locale, 'admin.type')}>
                      {reviewCategoryLabel(locale, item.category)}
                    </TableCell>
                    <TableCell data-label={translate(locale, 'admin.status')}>
                      <AdminStatusBadge tone={item.status === 'RESOLVED' ? 'success' : 'warning'}>
                        {translateAdminStatus(locale, item.status)}
                      </AdminStatusBadge>
                    </TableCell>
                    <TableCell data-label={translate(locale, 'admin.openedAt')}>
                      {formatDateTime(locale, item.openedAt)}
                    </TableCell>
                    <TableCell data-label={translate(locale, 'admin.action')}>
                      <AdminRowActions
                        actions={[
                          {
                            label: translate(locale, 'admin.open'),
                            onSelect: () =>
                              router.push(`/admin/operational-reviews/${item.reviewId}`),
                          },
                          {
                            label: translate(locale, 'admin.view'),
                            onSelect: () => openDetail(item.reviewId),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminDataTable>
      ) : null}
      <AdminTablePagination
        page={page}
        pageCount={totalPages}
        onPageChange={(nextPage) => refresh(nextPage, appliedFilters)}
        previousLabel={translate(locale, 'admin.previousPage')}
        nextLabel={translate(locale, 'admin.nextPage')}
      />
      <AdminDetailSheet
        open={detailId !== undefined}
        onOpenChange={(open) => {
          if (!open) setDetailId(undefined);
        }}
        title={
          detail === undefined
            ? translate(locale, 'admin.loadingData')
            : `${translate(locale, 'admin.operationalReview')} · ${detail.bookingCode}`
        }
        description={
          detail === undefined
            ? undefined
            : `${translate(locale, 'admin.type')}: ${reviewCategoryLabel(locale, detail.category)}`
        }
        footer={
          detail?.status === 'OPEN' ? (
            <Button
              disabled={detailPending || detailNote.trim() === ''}
              onClick={() => void resolveDetail()}
            >
              {detailPending
                ? translate(locale, 'admin.processing')
                : translate(locale, 'admin.markResolved')}
            </Button>
          ) : undefined
        }
      >
        {detail === undefined ? (
          <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
        ) : (
          <div className="admin-detail-stack">
            <AdminStatusBadge tone={detail.status === 'OPEN' ? 'warning' : 'success'}>
              {translateAdminStatus(locale, detail.status)}
            </AdminStatusBadge>
            <dl className="admin-detail-facts">
              <div>
                <dt>{translate(locale, 'admin.openReason')}</dt>
                <dd>{detail.openedReason}</dd>
              </div>
              <div>
                <dt>{translate(locale, 'admin.openedAt')}</dt>
                <dd>{formatDateTime(locale, detail.openedAt)}</dd>
              </div>
              <div>
                <dt>{translate(locale, 'admin.amount')}</dt>
                <dd>{detail.amountVnd.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</dd>
              </div>
            </dl>
            {detail.status === 'OPEN' ? (
              <Field>
                <FieldLabel htmlFor="review-detail-note">
                  {translate(locale, 'admin.processingNote')}
                </FieldLabel>
                <Textarea
                  className="admin-textarea"
                  id="review-detail-note"
                  value={detailNote}
                  onChange={(event) => setDetailNote(event.target.value)}
                  placeholder={translate(locale, 'admin.processingNotePlaceholder')}
                />
              </Field>
            ) : null}
            <section className="admin-timeline">
              <h2>{translate(locale, 'admin.history')}</h2>
              {detail.timeline.length === 0 ? (
                <p>{translate(locale, 'admin.noEvents')}</p>
              ) : (
                detail.timeline.map((event) => (
                  <div className="admin-timeline__item" key={event.id}>
                    <strong>{translateAdminStatus(locale, event.eventType)}</strong>
                    <span>{formatDateTime(locale, event.occurredAt)}</span>
                  </div>
                ))
              )}
            </section>
            <Link href={`/admin/operational-reviews/${detail.reviewId}`}>
              {translate(locale, 'admin.open')}
            </Link>
          </div>
        )}
      </AdminDetailSheet>
    </section>
  );
}
