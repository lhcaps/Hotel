'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AdminApiError, adminApi, type AdminRoomOperationsResponse } from '../lib/admin-api';
import { compareRoomDisplayOrder } from '../lib/admin-natural-sort';
import { translate, type MessageKey } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AdminStatusBadge } from './admin/admin-ui';

type RoomOperation = AdminRoomOperationsResponse['items'][number];
type RoomStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
type RoomGroup =
  'occupied' | 'checkout' | 'arrival' | 'cleaning' | 'ready' | 'maintenance' | 'inactive';

const roomStatusLabels = {
  ACTIVE: 'admin.roomStatusActive',
  INACTIVE: 'admin.roomStatusInactive',
  MAINTENANCE: 'admin.roomStatusMaintenance',
} as const satisfies Record<string, MessageKey>;

const housekeepingLabels = {
  CLEAN: 'admin.housekeepingClean',
  DIRTY: 'admin.housekeepingDirty',
  CLEANING: 'admin.housekeepingCleaning',
} as const satisfies Record<string, MessageKey>;

const groupLabels = {
  occupied: 'admin.roomGroupOccupied',
  checkout: 'admin.roomGroupCheckout',
  arrival: 'admin.roomGroupArrival',
  cleaning: 'admin.roomGroupCleaning',
  ready: 'admin.roomGroupReady',
  maintenance: 'admin.roomGroupMaintenance',
  inactive: 'admin.roomGroupInactive',
} as const satisfies Record<RoomGroup, MessageKey>;

const groupOrder: readonly RoomGroup[] = [
  'occupied',
  'checkout',
  'arrival',
  'cleaning',
  'ready',
  'maintenance',
  'inactive',
];

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
  return new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function isWithinNextDay(value: string, now: number): boolean {
  const timestamp = new Date(value).getTime();
  return timestamp >= now && timestamp <= now + 24 * 60 * 60 * 1000;
}

function groupForRoom(room: RoomOperation, now: number): RoomGroup {
  if (room.roomStatus === 'INACTIVE') return 'inactive';
  if (room.roomStatus === 'MAINTENANCE' || room.maintenanceState === 'ACTIVE') {
    return 'maintenance';
  }
  if (
    room.currentOccupancy === 'OCCUPIED' &&
    room.bookings.some((booking) => isWithinNextDay(booking.checkOut, now))
  ) {
    return 'checkout';
  }
  if (room.currentOccupancy === 'OCCUPIED') return 'occupied';
  if (room.nextBookingWindow !== null && isWithinNextDay(room.nextBookingWindow.checkIn, now)) {
    return 'arrival';
  }
  if (room.housekeepingStatus !== 'CLEAN' || room.activeHousekeepingTask !== null) {
    return 'cleaning';
  }
  return 'ready';
}

function groupStatusTone(group: RoomGroup): 'neutral' | 'success' | 'warning' | 'danger' {
  if (group === 'maintenance' || group === 'inactive') return 'danger';
  if (group === 'ready') return 'success';
  if (group === 'cleaning' || group === 'checkout') return 'warning';
  return 'neutral';
}

export function RoomOperationsBoard({ viewerMode = false }: Readonly<{ viewerMode?: boolean }>) {
  const locale = useLocale();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [data, setData] = useState<AdminRoomOperationsResponse>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatusFilter>('ALL');
  const includeInactive = statusFilter === 'INACTIVE' || statusFilter === 'MAINTENANCE';

  const refresh = useCallback(() => {
    setError(undefined);
    setStale(false);
    return adminApi
      .getRoomOperations({ ...dateRange(date), includeInactive })
      .then(setData)
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? cause.message
            : translate(locale, 'admin.loadErrorHeading'),
        );
      });
  }, [date, includeInactive, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => setStale(true), 60_000);
    return () => window.clearTimeout(timer);
  }, [data?.generatedAt]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return [...(data?.items ?? [])]
      .filter((room) => statusFilter === 'ALL' || room.roomStatus === statusFilter)
      .filter(
        (room) =>
          normalizedQuery.length === 0 ||
          [room.roomNumber, room.physicalRoomCode, room.roomConcept, room.roomTier].some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery),
          ),
      )
      .sort((left, right) => compareRoomDisplayOrder(left.roomNumber, right.roomNumber));
  }, [data?.items, locale, query, statusFilter]);

  const groups = useMemo(() => {
    const now = Date.now();
    const grouped = new Map<RoomGroup, RoomOperation[]>();
    for (const room of visibleItems) {
      const group = groupForRoom(room, now);
      const current = grouped.get(group) ?? [];
      current.push(room);
      grouped.set(group, current);
    }
    return groupOrder
      .map((group) => ({ group, rooms: grouped.get(group) ?? [] }))
      .filter(({ rooms }) => rooms.length > 0);
  }, [visibleItems]);

  return (
    <section className="room-operations-board" aria-labelledby="room-board-heading">
      <Card className="admin-surface">
        <CardHeader className="admin-surface__header">
          <div className="admin-page-heading admin-page-heading--compact">
            <div>
              <p className="admin-eyebrow">{translate(locale, 'admin.roomOperations')}</p>
              <CardTitle id="room-board-heading">
                {translate(locale, 'admin.roomBoardHeading')}
              </CardTitle>
              <p className="admin-supporting-text">{translate(locale, 'admin.roomBoardHelp')}</p>
            </div>
            <div className="admin-live-state" aria-live="polite">
              {data === undefined
                ? translate(locale, 'admin.roomBoardLoading')
                : `${translate(locale, 'admin.roomBoardUpdated', { time: new Date(data.generatedAt).toLocaleTimeString(locale) })}${stale ? ` · ${translate(locale, 'admin.roomBoardStale')}` : ''}`}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewerMode ? (
            <p className="admin-scope-note">{translate(locale, 'admin.roomViewerScope')}</p>
          ) : null}
          <div className="admin-filter-toolbar room-board-toolbar">
            <div className="admin-filter-toolbar__controls">
              <label>
                {translate(locale, 'admin.scheduleDate')}
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className="admin-filter-toolbar__search">
                {translate(locale, 'admin.roomSearch')}
                <Input
                  placeholder={translate(locale, 'admin.roomSearchPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label>
                {translate(locale, 'admin.status')}
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    if (value !== null) setStatusFilter(value as RoomStatusFilter);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
                    <SelectItem value="ACTIVE">
                      {translate(locale, roomStatusLabels.ACTIVE)}
                    </SelectItem>
                    <SelectItem value="MAINTENANCE">
                      {translate(locale, roomStatusLabels.MAINTENANCE)}
                    </SelectItem>
                    <SelectItem value="INACTIVE">
                      {translate(locale, roomStatusLabels.INACTIVE)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <Button onClick={() => void refresh()} type="button" variant="outline">
                {translate(locale, 'admin.refreshBoard')}
              </Button>
            </div>
            <div className="admin-filter-toolbar__summary">
              {translate(locale, 'admin.activeRoomsSummary', { count: visibleItems.length })}
            </div>
          </div>
          {error ? (
            <p className="admin-alert admin-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {data !== undefined && data.items.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noPhysicalRooms')}</p>
          ) : null}
          {data !== undefined && data.items.length > 0 && visibleItems.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noRoomsMatch')}</p>
          ) : null}
          <div className="room-board-groups">
            {groups.map(({ group, rooms }) => (
              <section className="room-board-group" key={group}>
                <div className="room-board-group__heading">
                  <h3>{translate(locale, groupLabels[group])}</h3>
                  <span>{translate(locale, 'admin.roomsCount', { count: rooms.length })}</span>
                </div>
                <div className="room-board-table-wrap">
                  <Table className="room-board-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{translate(locale, 'admin.room')}</TableHead>
                        <TableHead>{translate(locale, 'admin.roomConcept')}</TableHead>
                        <TableHead>{translate(locale, 'admin.status')}</TableHead>
                        <TableHead>{translate(locale, 'admin.housekeeping')}</TableHead>
                        <TableHead>{translate(locale, 'admin.nextSchedule')}</TableHead>
                        {!viewerMode ? (
                          <TableHead>{translate(locale, 'admin.action')}</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rooms.map((room) => (
                        <TableRow key={room.roomId}>
                          <TableCell data-label={translate(locale, 'admin.room')}>
                            <strong>
                              {translate(locale, 'admin.roomNumber', { number: room.roomNumber })}
                            </strong>
                            <span className="admin-muted room-code">{room.physicalRoomCode}</span>
                          </TableCell>
                          <TableCell data-label={translate(locale, 'admin.roomConcept')}>
                            <span>{room.roomConcept}</span>
                            <span className="admin-muted">{room.roomTier}</span>
                          </TableCell>
                          <TableCell data-label={translate(locale, 'admin.status')}>
                            <AdminStatusBadge tone={groupStatusTone(group)}>
                              {translate(locale, groupLabels[group])}
                            </AdminStatusBadge>
                            <span className="admin-muted">
                              {room.currentOccupancy === 'OCCUPIED'
                                ? translate(locale, 'admin.occupied')
                                : translate(locale, 'admin.vacant')}
                            </span>
                          </TableCell>
                          <TableCell data-label={translate(locale, 'admin.housekeeping')}>
                            <span>
                              {translate(locale, housekeepingLabels[room.housekeepingStatus])}
                            </span>
                            <span className="admin-muted">
                              {room.maintenanceState === 'ACTIVE'
                                ? translate(locale, 'admin.maintenanceActive')
                                : translate(locale, 'admin.maintenanceNone')}
                            </span>
                          </TableCell>
                          <TableCell data-label={translate(locale, 'admin.nextSchedule')}>
                            {room.nextBookingWindow === null ? (
                              translate(locale, 'admin.noNextBooking')
                            ) : (
                              <span>
                                {formatTime(room.nextBookingWindow.checkIn, locale)}–
                                {formatTime(room.nextBookingWindow.checkOut, locale)}
                              </span>
                            )}
                          </TableCell>
                          {!viewerMode ? (
                            <TableCell data-label={translate(locale, 'admin.action')}>
                              <Link href={`/admin/rooms/${room.roomId}`}>
                                {translate(locale, 'admin.open')}
                              </Link>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
