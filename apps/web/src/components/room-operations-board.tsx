'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { AdminApiError, adminApi, type AdminRoomOperationsResponse } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

function localDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateRange(value: string): { from: string; to: string } {
  return {
    from: new Date(`${value}T00:00:00`).toISOString(),
    to: new Date(`${value}T23:59:59.999`).toISOString(),
  };
}

function formatTime(value: string, locale: string): string {
  return new Date(value).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const roomStatusLabels = {
  ACTIVE: 'admin.roomStatusActive',
  INACTIVE: 'admin.roomStatusInactive',
  MAINTENANCE: 'admin.roomStatusMaintenance',
} as const;

const housekeepingLabels = {
  CLEAN: 'admin.housekeepingClean',
  DIRTY: 'admin.housekeepingDirty',
  CLEANING: 'admin.housekeepingCleaning',
} as const;

const taskTypeLabels = {
  ARRIVAL_PREP: 'admin.arrivalPrep',
  TURNOVER: 'admin.turnover',
} as const;

const taskStatusLabels = {
  SCHEDULED: 'admin.taskScheduled',
  DUE: 'admin.taskDue',
  IN_PROGRESS: 'admin.taskInProgress',
} as const;

export function RoomOperationsBoard({ viewerMode = false }: Readonly<{ viewerMode?: boolean }>) {
  const locale = useLocale();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [data, setData] = useState<AdminRoomOperationsResponse>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);

  const refresh = useCallback(() => {
    setError(undefined);
    setStale(false);
    return adminApi
      .getRoomOperations(dateRange(date))
      .then(setData)
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? cause.message
            : translate(locale, 'admin.loadErrorHeading'),
        );
      });
  }, [date, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => setStale(true), 60_000);
    return () => window.clearTimeout(timer);
  }, [data?.generatedAt]);

  return (
    <section className="room-operations-board" aria-labelledby="room-board-heading">
      <div className="page-heading">
        <div>
          <h2 id="room-board-heading">{translate(locale, 'admin.roomBoardHeading')}</h2>
          <p>{translate(locale, 'admin.roomBoardHelp')}</p>
        </div>
        <p aria-live="polite">
          {data === undefined
            ? translate(locale, 'admin.roomBoardLoading')
            : translate(locale, 'admin.roomBoardUpdated', {
                time: new Date(data.generatedAt).toLocaleTimeString(locale),
              })}
          {stale ? ` · ${translate(locale, 'admin.roomBoardStale')}` : ''}
        </p>
      </div>
      {viewerMode ? <p>{translate(locale, 'admin.roomViewerScope')}</p> : null}
      <label>
        {translate(locale, 'admin.scheduleDate')}{' '}
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <button className="primary-button" onClick={() => void refresh()} type="button">
        {translate(locale, 'admin.refreshBoard')}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {data !== undefined && data.items.length === 0 ? (
        <p className="table-empty">{translate(locale, 'admin.noPhysicalRooms')}</p>
      ) : null}
      {data !== undefined && data.items.length > 0 ? (
        <ul className="room-board-list">
          {data.items.map((room) => {
            return (
              <li key={room.roomId}>
                <div>
                  <strong>
                    {translate(locale, 'admin.roomNumber', { number: room.roomNumber })}
                  </strong>
                  <span>
                    {translate(locale, 'admin.roomConcept')}: {room.roomConcept} ·{' '}
                    {translate(locale, roomStatusLabels[room.roomStatus])} ·{' '}
                    {translate(locale, 'admin.housekeeping')}:{' '}
                    {translate(locale, housekeepingLabels[room.housekeepingStatus])} ·{' '}
                    {room.maintenanceState === 'ACTIVE'
                      ? translate(locale, 'admin.maintenanceActive')
                      : translate(locale, 'admin.maintenanceNone')}
                  </span>
                </div>
                {viewerMode ? (
                  <>
                    <p>
                      {translate(locale, 'admin.currentOccupancy')}:{' '}
                      {translate(
                        locale,
                        room.currentOccupancy === 'OCCUPIED' ? 'admin.occupied' : 'admin.vacant',
                      )}
                    </p>
                    <p>
                      {translate(locale, 'admin.nextBookingWindow')}:{' '}
                      {room.nextBookingWindow === null
                        ? translate(locale, 'admin.noNextBooking')
                        : `${formatTime(room.nextBookingWindow.checkIn, locale)}–${formatTime(room.nextBookingWindow.checkOut, locale)}`}
                    </p>
                  </>
                ) : (
                  <>
                    {room.activeHousekeepingTask === null ? null : (
                      <p>
                        {translate(locale, taskTypeLabels[room.activeHousekeepingTask.type])} ·{' '}
                        {translate(locale, taskStatusLabels[room.activeHousekeepingTask.status])} ·{' '}
                        {formatTime(room.activeHousekeepingTask.dueAt, locale)}
                      </p>
                    )}
                    <p>
                      {translate(locale, 'admin.freeWindows')}:{' '}
                      {room.freeWindows.length === 0
                        ? translate(locale, 'admin.noneInRange')
                        : room.freeWindows
                            .map(
                              (window) =>
                                `${formatTime(window.startsAt, locale)}–${formatTime(window.endsAt, locale)}`,
                            )
                            .join(', ')}
                    </p>
                    {room.bookings.length === 0 ? (
                      <p>{translate(locale, 'admin.noOccupiedBookingSpan')}</p>
                    ) : (
                      <ul>
                        {room.bookings.map((booking) => (
                          <li key={booking.bookingCode}>
                            <Link href={`/admin/bookings/${booking.bookingCode}`}>
                              {booking.bookingCode}
                            </Link>{' '}
                            · {booking.status} · {formatTime(booking.checkIn, locale)}–
                            {formatTime(booking.checkOut, locale)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
