'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AdminOperationalReport } from '@room/contracts';

import { AdminApiError, adminApi, type AdminRoomOperationsResponse } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { AdminErrorState, AdminMetric, AdminPageHeader } from './admin/admin-ui';

type RoomItem = AdminRoomOperationsResponse['items'][number];

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

function formatTime(value: string, locale: string): string {
  return new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function nextDayRange(): { from: string; to: string } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return { from: now.toISOString(), to: tomorrow.toISOString() };
}

function withinNextDay(value: string): boolean {
  const now = Date.now();
  const timestamp = new Date(value).getTime();
  return timestamp >= now && timestamp <= now + 24 * 60 * 60 * 1000;
}

function roomMetrics(items: readonly RoomItem[]) {
  return {
    occupied: items.filter((item) => item.currentOccupancy === 'OCCUPIED').length,
    arrivals: items.filter(
      (item) => item.nextBookingWindow !== null && withinNextDay(item.nextBookingWindow.checkIn),
    ).length,
    departures: items.filter((item) =>
      item.bookings.some((booking) => withinNextDay(booking.checkOut)),
    ).length,
    attention: items.filter(
      (item) => item.housekeepingStatus !== 'CLEAN' || item.maintenanceState === 'ACTIVE',
    ).length,
  };
}

function StatusDistribution({
  items,
  locale,
}: {
  readonly items: readonly RoomItem[];
  readonly locale: 'vi' | 'en';
}) {
  const groups = [
    ['OCCUPIED', 'admin.occupied'],
    ['ARRIVAL', 'admin.roomGroupArrival'],
    ['CLEANING', 'admin.roomGroupCleaning'],
    ['READY', 'admin.roomGroupReady'],
    ['MAINTENANCE', 'admin.roomGroupMaintenance'],
  ] as const;
  const counts = groups.map(([group, label]) => {
    const count = items.filter((item) => {
      if (group === 'OCCUPIED') return item.currentOccupancy === 'OCCUPIED';
      if (group === 'ARRIVAL') {
        return item.nextBookingWindow !== null && withinNextDay(item.nextBookingWindow.checkIn);
      }
      if (group === 'CLEANING') {
        return item.housekeepingStatus !== 'CLEAN' && item.maintenanceState === 'NONE';
      }
      if (group === 'MAINTENANCE') return item.maintenanceState === 'ACTIVE';
      return (
        item.currentOccupancy === 'VACANT' &&
        item.housekeepingStatus === 'CLEAN' &&
        item.maintenanceState === 'NONE'
      );
    }).length;
    return { label, count };
  });
  const maximum = Math.max(...counts.map((item) => item.count), 1);
  return (
    <section className="overview-panel" aria-labelledby="room-status-distribution-heading">
      <div className="overview-panel__heading">
        <h2 id="room-status-distribution-heading">
          {translate(locale, 'admin.dashboardStatusDistribution')}
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="admin-state">{translate(locale, 'admin.reportNoData')}</p>
      ) : (
        <ul className="overview-bars">
          {counts.map(({ label, count }) => (
            <li key={label}>
              <div>
                <span>{translate(locale, label)}</span>
                <strong>{count}</strong>
              </div>
              <span className="overview-bars__track">
                <span style={{ width: `${Math.max(4, (count / maximum) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RevenueChart({
  daily,
  locale,
}: Readonly<{ daily: readonly AdminOperationalReport['daily'][number][]; locale: 'vi' | 'en' }>) {
  const maximum = Math.max(...daily.map((point) => point.revenueVnd), 1);
  const width = 760;
  const height = 240;
  const padding = { bottom: 30, left: 8, right: 8, top: 14 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const points = daily.map((point, index) => {
    const x =
      padding.left + (daily.length <= 1 ? plotWidth / 2 : (index / (daily.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - (point.revenueVnd / maximum) * plotHeight;
    return { ...point, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <section
      className="overview-panel overview-revenue-chart"
      aria-labelledby="daily-revenue-heading"
    >
      <div className="overview-panel__heading">
        <div>
          <h2 id="daily-revenue-heading">{translate(locale, 'admin.reportDailyRevenue')}</h2>
          <p>
            {translate(locale, 'admin.dashboardDateRange', {
              from: daily.at(0)?.date ?? '',
              to: daily.at(-1)?.date ?? '',
            })}
          </p>
        </div>
        <strong>
          {money(
            daily.reduce((sum, point) => sum + point.revenueVnd, 0),
            locale,
          )}
        </strong>
      </div>
      {daily.length === 0 ? (
        <p className="admin-state">{translate(locale, 'admin.reportNoBookings')}</p>
      ) : (
        <>
          <svg
            aria-hidden="true"
            className="overview-revenue-chart__svg"
            focusable="false"
            preserveAspectRatio="none"
            viewBox={`0 0 ${width} ${height}`}
          >
            {[0.25, 0.5, 0.75, 1].map((fraction) => (
              <line
                key={fraction}
                x1={padding.left}
                x2={width - padding.right}
                y1={padding.top + plotHeight * (1 - fraction)}
                y2={padding.top + plotHeight * (1 - fraction)}
              />
            ))}
            <path d={path} fill="none" />
            {points.map((point) => (
              <circle key={point.date} cx={point.x} cy={point.y} r="3" />
            ))}
          </svg>
          <table className="sr-only">
            <caption>{translate(locale, 'admin.reportDailyRevenue')}</caption>
            <thead>
              <tr>
                <th>{translate(locale, 'admin.reportDate')}</th>
                <th>{translate(locale, 'admin.reportRevenue')}</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{money(point.revenueVnd, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function Queue({
  title,
  items,
  locale,
  emptyKey,
  mode,
}: {
  readonly title: string;
  readonly items: readonly RoomItem[];
  readonly locale: 'vi' | 'en';
  readonly emptyKey: 'admin.dashboardNoQueue' | 'admin.dashboardNoAttention';
  readonly mode: 'arrival' | 'departure' | 'attention';
}) {
  const filtered = items.filter((item) => {
    if (mode === 'attention') {
      return item.housekeepingStatus !== 'CLEAN' || item.maintenanceState === 'ACTIVE';
    }
    if (mode === 'arrival') {
      return item.nextBookingWindow !== null && withinNextDay(item.nextBookingWindow.checkIn);
    }
    return item.bookings.some((booking) => withinNextDay(booking.checkOut));
  });
  return (
    <section className="overview-panel" aria-label={title}>
      <div className="overview-panel__heading">
        <h2>{title}</h2>
        <span>{filtered.length}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="admin-state">{translate(locale, emptyKey)}</p>
      ) : (
        <ul className="overview-queue">
          {filtered.slice(0, 5).map((item) => {
            const time =
              mode === 'arrival'
                ? item.nextBookingWindow?.checkIn
                : mode === 'departure'
                  ? item.bookings.find((booking) => withinNextDay(booking.checkOut))?.checkOut
                  : undefined;
            return (
              <li key={item.roomId}>
                <div>
                  <strong>
                    {translate(locale, 'admin.roomNumber', { number: item.roomNumber })}
                  </strong>
                  <span>{item.roomConcept}</span>
                </div>
                <span>
                  {time === undefined
                    ? translate(locale, 'admin.housekeeping')
                    : formatTime(time, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function OperationalReportDashboard() {
  const locale = useLocale();
  const today = useMemo(() => new Date(), []);
  const [from] = useState(() =>
    dateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
  );
  const [to] = useState(() => dateInputValue(today));
  const [report, setReport] = useState<AdminOperationalReport>();
  const [rooms, setRooms] = useState<AdminRoomOperationsResponse>();
  const [error, setError] = useState<string>();
  const [roomsError, setRoomsError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setError(undefined);
    setRoomsError(undefined);
    setRefreshing(true);
    const roomRange = nextDayRange();
    const roomRequest =
      typeof adminApi.getRoomOperations === 'function'
        ? adminApi.getRoomOperations(roomRange)
        : Promise.resolve(undefined);
    return Promise.allSettled([
      adminApi.getOperationalReport({
        from: localDayStart(from),
        to: localDayEnd(to),
        bookingStatuses: undefined,
        paymentStatuses: undefined,
        ratePlanCodes: undefined,
        roomTierCodes: undefined,
      }),
      roomRequest,
    ])
      .then(([reportResult, roomResult]) => {
        if (reportResult.status === 'fulfilled') setReport(reportResult.value);
        else {
          setError(
            reportResult.reason instanceof AdminApiError
              ? reportResult.reason.message
              : translate(locale, 'admin.reportLoadError'),
          );
        }
        if (roomResult.status === 'fulfilled' && roomResult.value !== undefined) {
          setRooms(roomResult.value);
        } else if (roomResult.status === 'rejected') {
          setRoomsError(translate(locale, 'admin.dashboardRoomsUnavailable'));
        }
      })
      .finally(() => setRefreshing(false));
  }, [from, locale, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = rooms?.items ?? [];
  const metrics = roomMetrics(items);

  return (
    <section className="admin-overview" aria-labelledby="operational-report-heading">
      <AdminPageHeader
        title={translate(locale, 'admin.dashboardHeading')}
        description={translate(locale, 'admin.dashboardHelp')}
        className="admin-overview__header"
        actions={
          <div className="admin-overview__meta">
            <span>{translate(locale, 'admin.dashboardDateRange', { from, to })}</span>
            <span>
              {report === undefined
                ? translate(locale, 'admin.reportLoading')
                : translate(locale, 'admin.dashboardLastUpdated', {
                    time: new Date(report.generatedAt).toLocaleTimeString(locale),
                  })}
            </span>
            <Button
              disabled={refreshing}
              onClick={() => void refresh()}
              type="button"
              variant="outline"
            >
              {translate(locale, 'admin.dashboardRefresh')}
            </Button>
          </div>
        }
      />

      {error ? (
        <AdminErrorState title={translate(locale, 'admin.reportLoadError')} description={error} />
      ) : null}
      {roomsError ? (
        <p className="admin-alert" role="status">
          {roomsError}
        </p>
      ) : null}

      <section
        className="overview-metrics"
        aria-label={translate(locale, 'admin.dashboardSummary')}
      >
        {[
          ['admin.reportGrossRevenue', report?.grossRevenueVnd ?? null],
          ['admin.currentGuests', metrics.occupied],
          ['admin.upcomingArrivals', metrics.arrivals],
          ['admin.roomsAttention', metrics.attention + (report?.paymentReviewCount ?? 0)],
        ].map(([label, value]) => (
          <AdminMetric
            key={label}
            label={translate(locale, label as Parameters<typeof translate>[1])}
            value={
              value === null
                ? '—'
                : label === 'admin.reportGrossRevenue'
                  ? money(value as number, locale)
                  : value
            }
            tone={label === 'admin.roomsAttention' ? 'warning' : 'info'}
          />
        ))}
      </section>

      {report === undefined && error === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.reportLoading')}</p>
      ) : null}
      {report !== undefined ? (
        <>
          <div className="overview-dashboard-grid">
            <RevenueChart daily={report.daily} locale={locale} />
            <StatusDistribution items={items} locale={locale} />
          </div>
          <div className="overview-queues">
            <Queue
              emptyKey="admin.dashboardNoQueue"
              items={items}
              locale={locale}
              mode="arrival"
              title={translate(locale, 'admin.dashboardArrivals')}
            />
            <Queue
              emptyKey="admin.dashboardNoQueue"
              items={items}
              locale={locale}
              mode="departure"
              title={translate(locale, 'admin.dashboardDepartures')}
            />
            <Queue
              emptyKey="admin.dashboardNoAttention"
              items={items}
              locale={locale}
              mode="attention"
              title={translate(locale, 'admin.dashboardRoomsAttention')}
            />
            <section
              className="overview-panel"
              aria-label={translate(locale, 'admin.dashboardPaymentExceptions')}
            >
              <div className="overview-panel__heading">
                <h2>{translate(locale, 'admin.dashboardPaymentExceptions')}</h2>
                <span>{report.paymentReviewCount}</span>
              </div>
              <p className="admin-state">
                {report.paymentReviewCount === 0
                  ? translate(locale, 'admin.dashboardNoPaymentExceptions')
                  : translate(locale, 'admin.dashboardPaymentAction')}
              </p>
            </section>
          </div>
          <p className="report-disclosure">
            {translate(locale, 'admin.reportOutstandingDisclosure')}
          </p>
        </>
      ) : null}
    </section>
  );
}
