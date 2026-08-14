'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AdminApiError, adminApi, type AdminRoomOperationsResponse } from '../lib/admin-api';
import { compareRoomDisplayOrder } from '../lib/admin-natural-sort';
import type { AdminMe } from '@room/contracts';
import { translate, type MessageKey } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  AdminDataTable,
  AdminDetailSheet,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTab,
  AdminTabList,
  AdminTabs,
} from './admin/admin-ui';
import { Field, FieldLabel } from './ui/field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { MoreHorizontalIcon } from 'lucide-react';

type RoomOperation = AdminRoomOperationsResponse['items'][number];
type RoomStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
type RoomGroup = RoomOperation['displayGroup'];
type HousekeepingCondition = 'CLEAN' | 'DIRTY' | 'CLEANING';

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

const overrideLabels = {
  CLEAN: 'admin.overrideToClean',
  DIRTY: 'admin.overrideToDirty',
  CLEANING: 'admin.overrideToCleaning',
} as const satisfies Record<HousekeepingCondition, MessageKey>;

const groupLabels = {
  occupied: 'admin.roomGroupOccupied',
  checkout: 'admin.roomGroupCheckout',
  arrival: 'admin.roomGroupArrival',
  cleaning: 'admin.roomGroupCleaning',
  needs_cleaning: 'admin.roomGroupNeedsCleaning',
  ready: 'admin.roomGroupReady',
  maintenance: 'admin.roomGroupMaintenance',
  inactive: 'admin.roomGroupInactive',
} as const satisfies Record<RoomGroup, MessageKey>;

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

function groupStatusTone(group: RoomGroup): 'neutral' | 'success' | 'warning' | 'danger' {
  if (group === 'maintenance' || group === 'inactive') return 'danger';
  if (group === 'ready') return 'success';
  if (group === 'cleaning' || group === 'checkout') return 'warning';
  return 'neutral';
}

function housekeepingConditionTone(
  condition: HousekeepingCondition,
): 'success' | 'warning' | 'danger' {
  if (condition === 'CLEAN') return 'success';
  if (condition === 'DIRTY') return 'danger';
  return 'warning';
}

export function RoomOperationsBoard({ viewerMode = false }: Readonly<{ viewerMode?: boolean }>) {
  const locale = useLocale();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [data, setData] = useState<AdminRoomOperationsResponse>();
  const [me, setMe] = useState<AdminMe>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatusFilter>('ALL');
  const [groupFilter, setGroupFilter] = useState<RoomGroup | 'all'>('all');
  const [overrideRoom, setOverrideRoom] = useState<RoomOperation | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<HousekeepingCondition>('CLEAN');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string>();
  const [overridePending, setOverridePending] = useState(false);
  const includeInactive = statusFilter === 'INACTIVE' || statusFilter === 'MAINTENANCE';

  const refresh = useCallback(() => {
    setError(undefined);
    setStale(false);
    return Promise.all([
      adminApi.getRoomOperations({ ...dateRange(date), includeInactive }),
      adminApi.me(),
    ])
      .then(([operations, actor]) => {
        setData(operations);
        setMe(actor);
      })
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
    if (data === undefined) return;
    const timer = window.setTimeout(() => setStale(true), 60_000);
    return () => window.clearTimeout(timer);
  }, [data?.generatedAt]);

  const canManage = me !== undefined && me.permissions.includes('housekeeping.task.manage');

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return [...(data?.items ?? [])]
      .filter((room) => statusFilter === 'ALL' || room.roomStatus === statusFilter)
      .filter((room) => groupFilter === 'all' || room.displayGroup === groupFilter)
      .filter(
        (room) =>
          normalizedQuery.length === 0 ||
          [room.roomNumber, room.physicalRoomCode, room.roomConcept, room.roomTier].some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery),
          ),
      )
      .sort((left, right) => compareRoomDisplayOrder(left.roomNumber, right.roomNumber));
  }, [data?.items, groupFilter, locale, query, statusFilter]);

  const groupCounts = useMemo(() => {
    const counts = new Map<RoomGroup, number>();
    for (const room of data?.items ?? [])
      counts.set(room.displayGroup, (counts.get(room.displayGroup) ?? 0) + 1);
    return counts;
  }, [data?.items]);

  const handleOverride = useCallback(async () => {
    if (overrideRoom === null) return;
    if (overrideReason.trim() === '') {
      setOverrideError(translate(locale, 'admin.reasonRequired'));
      return;
    }
    setOverridePending(true);
    setOverrideError(undefined);
    try {
      await adminApi.overrideRoomHousekeeping(overrideRoom.roomId, {
        status: overrideTarget,
        expectedVersion: 0,
        reason: overrideReason.trim(),
      });
      setOverrideRoom(null);
      setOverrideReason('');
      setOverrideTarget('CLEAN');
      await refresh();
    } catch (cause: unknown) {
      setOverrideError(
        cause instanceof AdminApiError ? cause.message : translate(locale, 'admin.actionError'),
      );
    } finally {
      setOverridePending(false);
    }
  }, [overrideRoom, overrideTarget, overrideReason, locale, refresh]);

  return (
    <section className="room-operations-board" aria-labelledby="room-board-heading">
      <div className="room-operations-board__body">
        <AdminPageHeader
          eyebrow={translate(locale, 'admin.roomOperations')}
          headingId="room-board-heading"
          title={translate(locale, 'admin.roomBoardHeading')}
          description={translate(locale, 'admin.roomBoardHelp')}
          actions={
            <div className="admin-live-state" aria-live="polite">
              {data === undefined
                ? translate(locale, 'admin.roomBoardLoading')
                : `${translate(locale, 'admin.roomBoardUpdated', { time: new Date(data.generatedAt).toLocaleTimeString(locale) })}${stale ? ` · ${translate(locale, 'admin.roomBoardStale')}` : ''}`}
            </div>
          }
        />
        <div className="room-operations-board__content">
          {viewerMode ? (
            <p className="admin-scope-note">{translate(locale, 'admin.roomViewerScope')}</p>
          ) : null}
          <div
            className="room-operations-status-strip"
            aria-label={translate(locale, 'admin.roomOperations')}
          >
            {(Object.keys(groupLabels) as RoomGroup[])
              .filter((group) => group !== 'inactive')
              .map((group) => (
                <button
                  aria-pressed={groupFilter === group}
                  key={group}
                  onClick={() => setGroupFilter((current) => (current === group ? 'all' : group))}
                  type="button"
                >
                  <span>{translate(locale, groupLabels[group])}</span>
                  <strong>{groupCounts.get(group) ?? 0}</strong>
                </button>
              ))}
          </div>
          <AdminTabs
            value={groupFilter}
            onValueChange={(value) => setGroupFilter(value as RoomGroup | 'all')}
          >
            <AdminTabList variant="line" aria-label={translate(locale, 'admin.status')}>
              <AdminTab value="all">{translate(locale, 'admin.all')}</AdminTab>
              <AdminTab value="occupied">{translate(locale, 'admin.roomGroupOccupied')}</AdminTab>
              <AdminTab value="ready">{translate(locale, 'admin.roomGroupReady')}</AdminTab>
              <AdminTab value="cleaning">{translate(locale, 'admin.roomGroupCleaning')}</AdminTab>
              <AdminTab value="maintenance">
                {translate(locale, 'admin.roomGroupMaintenance')}
              </AdminTab>
            </AdminTabList>
          </AdminTabs>
          <div className="admin-filter-toolbar room-board-toolbar">
            <div className="admin-filter-toolbar__controls">
              <Field>
                <FieldLabel htmlFor="room-board-date">
                  {translate(locale, 'admin.scheduleDate')}
                </FieldLabel>
                <Input
                  id="room-board-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              <Field className="admin-filter-toolbar__search">
                <FieldLabel htmlFor="room-board-search">
                  {translate(locale, 'admin.roomSearch')}
                </FieldLabel>
                <Input
                  id="room-board-search"
                  placeholder={translate(locale, 'admin.roomSearchPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>{translate(locale, 'admin.status')}</FieldLabel>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    if (value !== null) setStatusFilter(value as RoomStatusFilter);
                  }}
                >
                  <SelectTrigger aria-label={translate(locale, 'admin.status')} className="w-full">
                    <SelectValue>
                      {statusFilter === 'ALL'
                        ? translate(locale, 'admin.all')
                        : translate(locale, roomStatusLabels[statusFilter])}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
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
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
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
          <div className="room-board-group room-board-group--flat">
            <AdminDataTable variant="operational" className="room-board-table-wrap">
              <Table className="room-board-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate(locale, 'admin.room')}</TableHead>
                    <TableHead>{translate(locale, 'admin.roomConcept')}</TableHead>
                    <TableHead>{translate(locale, 'admin.status')}</TableHead>
                    <TableHead>{translate(locale, 'admin.housekeepingCondition')}</TableHead>
                    <TableHead>{translate(locale, 'admin.nextSchedule')}</TableHead>
                    {!viewerMode ? (
                      <TableHead>{translate(locale, 'admin.action')}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((room) => (
                    <TableRow key={room.roomId} data-room-id={room.roomId}>
                      <TableCell data-label={translate(locale, 'admin.room')}>
                        <div className="admin-room-label">
                          <span className="admin-room-label__number">
                            {translate(locale, 'admin.roomNumber', {
                              number: room.roomNumber,
                            })}
                          </span>
                          <span className="admin-muted admin-room-label__physical">
                            {room.physicalRoomCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.roomConcept')}>
                        <div className="admin-room-label admin-room-label--concept">
                          <span className="admin-room-label__concept">{room.roomConcept}</span>
                          <span className="admin-muted admin-room-label__tier">
                            {room.roomTier}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.status')}>
                        <div className="admin-workboard-cell-stack">
                          <AdminStatusBadge tone={groupStatusTone(room.displayGroup)}>
                            {translate(locale, groupLabels[room.displayGroup])}
                          </AdminStatusBadge>
                          <span className="admin-muted">
                            {room.currentOccupancy === 'OCCUPIED'
                              ? translate(locale, 'admin.occupied')
                              : translate(locale, 'admin.vacant')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.housekeepingCondition')}>
                        <div className="admin-workboard-cell-stack">
                          <AdminStatusBadge
                            tone={housekeepingConditionTone(room.housekeepingStatus)}
                          >
                            {translate(locale, housekeepingLabels[room.housekeepingStatus])}
                          </AdminStatusBadge>
                          <span className="admin-muted">
                            {room.maintenanceState === 'ACTIVE'
                              ? translate(locale, 'admin.maintenanceActive')
                              : translate(locale, 'admin.maintenanceNone')}
                          </span>
                        </div>
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
                          <div className="admin-workboard-cell-stack">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    aria-label={translate(locale, 'admin.otherActions')}
                                    size="icon-sm"
                                    variant="outline"
                                  />
                                }
                              >
                                <MoreHorizontalIcon aria-hidden="true" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  render={<Link href={`/admin/rooms/${room.roomId}`} />}
                                >
                                  {translate(locale, 'admin.open')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {canManage ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setOverrideRoom(room);
                                  setOverrideTarget(room.housekeepingStatus);
                                  setOverrideReason('');
                                  setOverrideError(undefined);
                                }}
                              >
                                {translate(locale, 'admin.overrideHousekeeping')}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminDataTable>
          </div>
        </div>
      </div>
      <AdminDetailSheet
        open={overrideRoom !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideRoom(null);
            setOverrideReason('');
            setOverrideError(undefined);
          }
        }}
        title={translate(locale, 'admin.overrideHousekeeping')}
        description={translate(locale, 'admin.overrideHousekeepingHelp')}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOverrideRoom(null);
                setOverrideReason('');
                setOverrideError(undefined);
              }}
            >
              {translate(locale, 'admin.cancel')}
            </Button>
            <Button
              type="button"
              disabled={overrideRoom === null || overridePending}
              onClick={() => void handleOverride()}
            >
              {translate(locale, 'admin.apply')}
            </Button>
          </>
        }
      >
        <div className="admin-workboard-cell-stack">
          <p className="admin-helper-text">
            {overrideRoom === null
              ? ''
              : translate(locale, 'admin.roomNumber', { number: overrideRoom.roomNumber })}
          </p>
          <Select
            value={overrideTarget}
            onValueChange={(value) => {
              if (value !== null) setOverrideTarget(value as HousekeepingCondition);
            }}
          >
            <SelectTrigger aria-label={translate(locale, 'admin.overrideHousekeeping')}>
              <SelectValue>{translate(locale, overrideLabels[overrideTarget])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLEAN">{translate(locale, overrideLabels.CLEAN)}</SelectItem>
              <SelectItem value="DIRTY">{translate(locale, overrideLabels.DIRTY)}</SelectItem>
              <SelectItem value="CLEANING">{translate(locale, overrideLabels.CLEANING)}</SelectItem>
            </SelectContent>
          </Select>
          <label className="admin-field-stack">
            <span>{translate(locale, 'admin.reasonRequired')}</span>
            <Textarea
              rows={5}
              required
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder={translate(locale, 'admin.reasonPlaceholder')}
              aria-invalid={overrideReason.trim() === '' ? 'true' : undefined}
            />
          </label>
          {overrideError !== undefined ? (
            <p className="admin-alert admin-alert--error" role="alert">
              {overrideError}
            </p>
          ) : null}
        </div>
      </AdminDetailSheet>
    </section>
  );
}
