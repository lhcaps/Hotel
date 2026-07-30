'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import type { AdminOperationalReport } from '@room/contracts';

import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

const bookingStatuses = [
  'HOLD',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
  'NO_SHOW',
  'CHECKED_IN',
  'CHECKED_OUT',
] as const;
const paymentStatuses = [
  'NONE',
  'PENDING',
  'SUCCEEDED',
  'REVIEW_REQUIRED',
  'CANCELLED',
  'EXPIRED',
] as const;

function dateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function localDayStart(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function localDayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function money(value: number, locale: 'vi' | 'en'): string {
  return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(value)} VND`;
}

function codes(value: string): readonly string[] | undefined {
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length === 0 ? undefined : parsed;
}

function selectedValues(
  event: React.ChangeEvent<HTMLSelectElement>,
): readonly string[] | undefined {
  const values = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
  return values.length === 0 ? undefined : values;
}

function Breakdown({
  headingId,
  title,
  items,
  locale,
}: {
  readonly headingId: string;
  readonly title: string;
  readonly items: AdminOperationalReport['ratePlans'];
  readonly locale: 'vi' | 'en';
}) {
  const maximum = Math.max(...items.map((item) => item.revenueVnd), 1);
  return (
    <section className="report-breakdown" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {items.length === 0 ? (
        <p>{translate(locale, 'admin.reportNoData')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{translate(locale, 'admin.reportCategory')}</th>
              <th scope="col">{translate(locale, 'admin.reportRevenue')}</th>
              <th scope="col">{translate(locale, 'admin.reportBookings')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.label}>
                <th scope="row">{item.label}</th>
                <td>
                  <div
                    aria-label={`${item.label}: ${money(item.revenueVnd, locale)}`}
                    className="report-bar"
                    role="img"
                  >
                    <span style={{ width: `${Math.max(3, (item.revenueVnd / maximum) * 100)}%` }} />
                  </div>
                  {money(item.revenueVnd, locale)}
                </td>
                <td>{item.bookingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function OperationalReportDashboard() {
  const locale = useLocale();
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() =>
    dateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
  );
  const [to, setTo] = useState(() => dateInputValue(today));
  const [bookingFilter, setBookingFilter] = useState<readonly string[]>();
  const [paymentFilter, setPaymentFilter] = useState<readonly string[]>();
  const [ratePlanCodes, setRatePlanCodes] = useState('');
  const [roomTierCodes, setRoomTierCodes] = useState('');
  const [report, setReport] = useState<AdminOperationalReport>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(() => {
    setReport(undefined);
    setError(undefined);
    return adminApi
      .getOperationalReport({
        from: localDayStart(from),
        to: localDayEnd(to),
        bookingStatuses: bookingFilter,
        paymentStatuses: paymentFilter,
        ratePlanCodes: codes(ratePlanCodes),
        roomTierCodes: codes(roomTierCodes),
      })
      .then(setReport)
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? cause.message
            : translate(locale, 'admin.reportLoadError'),
        );
      });
  }, [bookingFilter, from, locale, paymentFilter, ratePlanCodes, roomTierCodes, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void refresh();
  }

  const collectionRate =
    report === undefined || report.grossRevenueVnd === 0
      ? null
      : Math.round((report.settledRevenueVnd / report.grossRevenueVnd) * 100);

  return (
    <section className="operational-report" aria-labelledby="operational-report-heading">
      <div className="page-heading">
        <div>
          <h1 id="operational-report-heading">
            {translate(locale, 'admin.operationalReportHeading')}
          </h1>
          <p>{translate(locale, 'admin.operationalReportHelp')}</p>
        </div>
      </div>
      <form className="report-filters" onSubmit={submit}>
        <label>
          {translate(locale, 'admin.reportFrom')}
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          {translate(locale, 'admin.reportTo')}
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>
          {translate(locale, 'admin.reportBookingStatus')}
          <select
            aria-label={translate(locale, 'admin.reportBookingStatus')}
            multiple
            onChange={(event) => setBookingFilter(selectedValues(event))}
          >
            {bookingStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.reportPaymentStatus')}
          <select
            aria-label={translate(locale, 'admin.reportPaymentStatus')}
            multiple
            onChange={(event) => setPaymentFilter(selectedValues(event))}
          >
            {paymentStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'admin.reportRatePlans')}
          <input
            placeholder="STANDARD, DELUXE"
            value={ratePlanCodes}
            onChange={(event) => setRatePlanCodes(event.target.value)}
          />
        </label>
        <label>
          {translate(locale, 'admin.reportRoomTiers')}
          <input
            placeholder="STANDARD, DELUXE"
            value={roomTierCodes}
            onChange={(event) => setRoomTierCodes(event.target.value)}
          />
        </label>
        <button className="primary-button" type="submit">
          {translate(locale, 'admin.reportApply')}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {report === undefined && error === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.reportLoading')}</p>
      ) : null}
      {report !== undefined ? (
        <>
          <div className="report-kpis">
            <article>
              <span>{translate(locale, 'admin.reportGrossRevenue')}</span>
              <strong>{money(report.grossRevenueVnd, locale)}</strong>
            </article>
            <article>
              <span>{translate(locale, 'admin.reportSettledRevenue')}</span>
              <strong>{money(report.settledRevenueVnd, locale)}</strong>
            </article>
            <article>
              <span>{translate(locale, 'admin.reportCollectionRate')}</span>
              <strong>{collectionRate === null ? '—' : `${collectionRate}%`}</strong>
            </article>
            <article>
              <span>{translate(locale, 'admin.reportBookings')}</span>
              <strong>{report.bookingCount}</strong>
              <small>
                {translate(locale, 'admin.reportConfirmedCancelled', {
                  confirmed: report.confirmedCount,
                  cancelled: report.cancellationCount,
                })}
              </small>
            </article>
            <article>
              <span>{translate(locale, 'admin.reportCustomers')}</span>
              <strong>{report.customerCount}</strong>
              <small>
                {translate(locale, 'admin.reportReturningCustomers', {
                  count: report.returningCustomerCount,
                })}
              </small>
            </article>
          </div>
          <p className="report-disclosure">
            {translate(locale, 'admin.reportOutstandingDisclosure')}
          </p>
          {report.bookingCount === 0 ? (
            <p className="table-empty">{translate(locale, 'admin.reportNoBookings')}</p>
          ) : (
            <>
              <section className="report-series" aria-labelledby="daily-revenue-heading">
                <h2 id="daily-revenue-heading">{translate(locale, 'admin.reportDailyRevenue')}</h2>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{translate(locale, 'admin.reportDate')}</th>
                      <th scope="col">{translate(locale, 'admin.reportRevenue')}</th>
                      <th scope="col">{translate(locale, 'admin.reportBookings')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.daily.map((point) => (
                      <tr key={point.date}>
                        <th scope="row">{point.date}</th>
                        <td>{money(point.revenueVnd, locale)}</td>
                        <td>{point.bookingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <div className="report-breakdowns">
                <Breakdown
                  headingId="rate-plans-heading"
                  title={translate(locale, 'admin.ratePlans')}
                  items={report.ratePlans}
                  locale={locale}
                />
                <Breakdown
                  headingId="room-types-heading"
                  title={translate(locale, 'admin.roomTypes')}
                  items={report.roomTypes}
                  locale={locale}
                />
              </div>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
