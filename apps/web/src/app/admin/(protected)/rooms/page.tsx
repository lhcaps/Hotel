'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { PriceTier, Room, RoomType } from '@room/contracts';

import {
  AdminApiError,
  adminApi,
  type AdminRoomOperationsResponse,
} from '../../../../lib/admin-api';
import { localizedCatalogSafetyReason } from '../../../../lib/catalog-safety';
import { formatDateTime, translate, translateAdminStatus } from '../../../../lib/i18n/messages';
import { useLocale } from '../../../../components/locale-provider';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Field, FieldLabel } from '../../../../components/ui/field';
import { Input } from '../../../../components/ui/input';
import { Table } from '../../../../components/ui/table';
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
  AdminFilterToolbar,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminRowActions,
  AdminStatusBadge,
} from '../../../../components/admin/admin-ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';

interface RoomDraft {
  readonly roomNumber: string;
  readonly roomTypeId: string;
  readonly notes: string;
}

export default function Rooms() {
  const locale = useLocale();
  const [rooms, setRooms] = useState<readonly Room[]>();
  const [types, setTypes] = useState<readonly RoomType[]>([]);
  const [tiers, setTiers] = useState<readonly PriceTier[]>([]);
  const [operations, setOperations] = useState<AdminRoomOperationsResponse['items']>([]);
  const [drafts, setDrafts] = useState<Record<string, RoomDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [archiveErrors, setArchiveErrors] = useState<Record<string, string>>({});
  const [archivePending, setArchivePending] = useState<Record<string, boolean>>({});
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | undefined>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [editRoomId, setEditRoomId] = useState<string>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Room['status'] | 'ALL'>('ALL');
  const [conceptFilter, setConceptFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [housekeepingFilter, setHousekeepingFilter] = useState<'ALL' | Room['housekeepingStatus']>(
    'ALL',
  );
  const [maintenanceFilter, setMaintenanceFilter] = useState<'ALL' | 'ACTIVE' | 'NONE'>('ALL');

  useEffect(() => {
    let active = true;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    void Promise.all([
      adminApi.listRooms(),
      adminApi.listRoomTypes(),
      adminApi.listPriceTiers(),
      adminApi.getRoomOperations({
        from: from.toISOString(),
        to: to.toISOString(),
        includeInactive: true,
      }),
    ])
      .then(([roomPage, typePage, tierPage, operationPage]) => {
        if (!active) return;
        setRooms(roomPage.items);
        setTypes(typePage.items);
        setTiers(tierPage.items);
        setOperations(operationPage.items);
        setDrafts(
          Object.fromEntries(
            roomPage.items.map((room) => [
              room.id,
              {
                roomNumber: room.roomNumber,
                roomTypeId: room.roomTypeId,
                notes: room.notes ?? '',
              },
            ]),
          ),
        );
      })
      .catch(() => active && setMessage(translate(locale, 'room.typesLoadError')));
    return () => {
      active = false;
    };
  }, [locale]);

  async function saveRoom(roomId: string): Promise<boolean> {
    const draft = drafts[roomId];
    if (draft === undefined) return false;
    setPending(true);
    setMessage(undefined);
    setErrors((current) => ({ ...current, [roomId]: '' }));
    try {
      const updated = await adminApi.updateRoom(roomId, {
        roomNumber: draft.roomNumber,
        roomTypeId: draft.roomTypeId,
        notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
      });
      setRooms((current) =>
        current === undefined
          ? current
          : current.map((room) => (room.id === roomId ? updated : room)),
      );
      setMessage(translate(locale, 'room.updated', { number: updated.roomNumber }));
      return true;
    } catch (cause) {
      const text =
        cause instanceof AdminApiError && cause.problem?.code !== undefined
          ? localizedCatalogSafetyReason(locale, cause.problem.code, cause.problem.detail)
          : translate(locale, 'room.updateError');
      setErrors((current) => ({ ...current, [roomId]: text }));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function refreshRooms() {
    const page = await adminApi.listRooms();
    setRooms(page.items);
  }

  async function archiveRoom(roomId: string) {
    setArchivePending((current) => ({ ...current, [roomId]: true }));
    setArchiveErrors((current) => ({ ...current, [roomId]: '' }));
    setArchiveConfirmId(undefined);
    try {
      await adminApi.archiveRoom(roomId);
      await refreshRooms();
    } catch (cause) {
      const text =
        cause instanceof AdminApiError && cause.problem?.code !== undefined
          ? localizedCatalogSafetyReason(locale, cause.problem.code, cause.problem.detail)
          : translate(locale, 'room.archiveError');
      setArchiveErrors((current) => ({ ...current, [roomId]: text }));
    } finally {
      setArchivePending((current) => ({ ...current, [roomId]: false }));
    }
  }

  const operationsById = new Map(
    operations.map((operation) => [operation.roomId, operation] as const),
  );
  const typeById = new Map(types.map((type) => [type.id, type] as const));
  const tierById = new Map(tiers.map((tier) => [tier.id, tier] as const));
  const visibleRooms = (rooms ?? []).filter((room) => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const operation = operationsById.get(room.id);
    const roomType = typeById.get(room.roomTypeId);
    const matchesQuery =
      normalizedQuery === '' ||
      [room.roomNumber, room.physicalRoomCode]
        .join(' ')
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery);
    return (
      matchesQuery &&
      (statusFilter === 'ALL' || room.status === statusFilter) &&
      (conceptFilter === 'ALL' || roomType?.id === conceptFilter) &&
      (tierFilter === 'ALL' || roomType?.priceTierId === tierFilter) &&
      (housekeepingFilter === 'ALL' || room.housekeepingStatus === housekeepingFilter) &&
      (maintenanceFilter === 'ALL' || operation?.maintenanceState === maintenanceFilter)
    );
  });
  const activeCount =
    operations.filter((operation) => operation.roomStatus === 'ACTIVE').length ||
    (rooms ?? []).filter((room) => room.status === 'ACTIVE').length;
  const archivedCount = operations.filter(
    (operation) => operation.roomStatus === 'INACTIVE',
  ).length;

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow={translate(locale, 'admin.roomOperations')}
        title={translate(locale, 'admin.rooms')}
        description={translate(locale, 'room.createHelp')}
        actions={
          <Button nativeButton={false} render={<Link href="/admin/rooms/new" />}>
            {translate(locale, 'room.create')}
          </Button>
        }
      />
      {message === undefined ? null : <p role="alert">{message}</p>}
      <AdminFilterToolbar>
        <Field>
          <FieldLabel htmlFor="admin-room-search">
            {translate(locale, 'admin.roomSearch')}
          </FieldLabel>
          <Input
            id="admin-room-search"
            type="search"
            placeholder={translate(locale, 'admin.roomSearchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-room-status-filter">
            {translate(locale, 'admin.status')}
          </FieldLabel>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (value !== null) setStatusFilter(value as Room['status'] | 'ALL');
            }}
          >
            <SelectTrigger id="admin-room-status-filter" className="w-full">
              <SelectValue>
                {statusFilter === 'ALL'
                  ? translate(locale, 'admin.all')
                  : translateAdminStatus(locale, statusFilter)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
              <SelectItem value="ACTIVE">{translateAdminStatus(locale, 'ACTIVE')}</SelectItem>
              <SelectItem value="MAINTENANCE">
                {translateAdminStatus(locale, 'MAINTENANCE')}
              </SelectItem>
              <SelectItem value="INACTIVE">{translateAdminStatus(locale, 'INACTIVE')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="admin-filter-toolbar__summary">
          {translate(locale, 'admin.activeRoomsSummary', { count: activeCount })} · {archivedCount}{' '}
          {translate(locale, 'admin.archived')}
        </div>
        <Field>
          <FieldLabel htmlFor="admin-room-concept-filter">
            {translate(locale, 'admin.roomType')}
          </FieldLabel>
          <Select
            value={conceptFilter}
            onValueChange={(value) => value !== null && setConceptFilter(value)}
          >
            <SelectTrigger id="admin-room-concept-filter" className="w-full">
              <SelectValue>
                {conceptFilter === 'ALL'
                  ? translate(locale, 'admin.all')
                  : (types.find((type) => type.id === conceptFilter)?.name ?? conceptFilter)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
              {types.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-room-tier-filter">
            {translate(locale, 'roomType.priceTier')}
          </FieldLabel>
          <Select
            value={tierFilter}
            onValueChange={(value) => value !== null && setTierFilter(value)}
          >
            <SelectTrigger id="admin-room-tier-filter" className="w-full">
              <SelectValue>
                {tierFilter === 'ALL'
                  ? translate(locale, 'admin.all')
                  : (tiers.find((tier) => tier.id === tierFilter)?.name ?? tierFilter)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
              {tiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-room-housekeeping-filter">
            {translate(locale, 'admin.housekeeping')}
          </FieldLabel>
          <Select
            value={housekeepingFilter}
            onValueChange={(value) =>
              value !== null && setHousekeepingFilter(value as typeof housekeepingFilter)
            }
          >
            <SelectTrigger id="admin-room-housekeeping-filter" className="w-full">
              <SelectValue>
                {housekeepingFilter === 'ALL'
                  ? translate(locale, 'admin.all')
                  : translateAdminStatus(locale, housekeepingFilter)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
              <SelectItem value="CLEAN">{translate(locale, 'admin.housekeepingClean')}</SelectItem>
              <SelectItem value="DIRTY">{translate(locale, 'admin.housekeepingDirty')}</SelectItem>
              <SelectItem value="CLEANING">
                {translate(locale, 'admin.housekeepingCleaning')}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-room-maintenance-filter">
            {translate(locale, 'admin.maintenance')}
          </FieldLabel>
          <Select
            value={maintenanceFilter}
            onValueChange={(value) =>
              value !== null && setMaintenanceFilter(value as typeof maintenanceFilter)
            }
          >
            <SelectTrigger id="admin-room-maintenance-filter" className="w-full">
              <SelectValue>
                {maintenanceFilter === 'ALL'
                  ? translate(locale, 'admin.all')
                  : maintenanceFilter === 'ACTIVE'
                    ? translate(locale, 'admin.maintenanceActive')
                    : translate(locale, 'admin.maintenanceNone')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
              <SelectItem value="ACTIVE">{translate(locale, 'admin.maintenanceActive')}</SelectItem>
              <SelectItem value="NONE">{translate(locale, 'admin.maintenanceNone')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </AdminFilterToolbar>
      {editRoomId !== undefined
        ? (() => {
            const room = rooms?.find((candidate) => candidate.id === editRoomId);
            if (room === undefined) return null;
            const draft = drafts[room.id] ?? {
              roomNumber: room.roomNumber,
              roomTypeId: room.roomTypeId,
              notes: room.notes ?? '',
            };
            const error = errors[room.id];
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => {
                  if (!open) setEditRoomId(undefined);
                }}
                title={translate(locale, 'roomType.saveChanges')}
                description={room.roomNumber}
                footer={
                  <Button
                    disabled={pending || draft.roomNumber === ''}
                    onClick={() =>
                      void saveRoom(room.id).then((saved) => {
                        if (saved) setEditRoomId(undefined);
                      })
                    }
                  >
                    {translate(locale, 'roomType.saveChanges')}
                  </Button>
                }
              >
                <div className="admin-form-stack">
                  <Field>
                    <FieldLabel htmlFor="room-number-edit">
                      {translate(locale, 'room.number')}
                    </FieldLabel>
                    <Input
                      id="room-number-edit"
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [room.id]: { ...draft, roomNumber: event.target.value },
                        }))
                      }
                      required
                      value={draft.roomNumber}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="room-type-edit">
                      {translate(locale, 'admin.roomType')}
                    </FieldLabel>
                    <Select
                      value={draft.roomTypeId}
                      onValueChange={(value) => {
                        if (value !== null)
                          setDrafts((current) => ({
                            ...current,
                            [room.id]: { ...draft, roomTypeId: value },
                          }));
                      }}
                    >
                      <SelectTrigger id="room-type-edit" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {types.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="room-notes-edit">
                      {translate(locale, 'room.notes')}
                    </FieldLabel>
                    <Input
                      id="room-notes-edit"
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [room.id]: { ...draft, notes: event.target.value },
                        }))
                      }
                      value={draft.notes}
                    />
                  </Field>
                  {error !== undefined && error !== '' ? (
                    <Alert variant="destructive">
                      <AlertTitle>{translate(locale, 'room.updateError')}</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </AdminFormSheet>
            );
          })()
        : null}
      {rooms === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : visibleRooms.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'room.empty')} />
      ) : (
        <AdminDataTable variant="management" className="admin-physical-rooms-table">
          <Table>
            <thead>
              <tr>
                <th scope="col">{translate(locale, 'room.number')}</th>
                <th scope="col">{translate(locale, 'admin.code')}</th>
                <th scope="col">{translate(locale, 'admin.roomType')}</th>
                <th scope="col">{translate(locale, 'admin.floor', { floor: '#' })}</th>
                <th scope="col">{translate(locale, 'roomType.priceTier')}</th>
                <th scope="col">{translate(locale, 'admin.status')}</th>
                <th scope="col">{translate(locale, 'admin.housekeeping')}</th>
                <th scope="col">{translate(locale, 'admin.maintenance')}</th>
                <th scope="col">{translate(locale, 'admin.nextBookingWindow')}</th>
                <th scope="col">{translate(locale, 'admin.updatedAt')}</th>
                <th scope="col">{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRooms.map((room) => {
                const operation = operationsById.get(room.id);
                const roomType = typeById.get(room.roomTypeId);
                const tier =
                  roomType === undefined ? undefined : tierById.get(roomType.priceTierId);
                return (
                  <tr key={room.id}>
                    <td data-label={translate(locale, 'room.number')}>
                      <strong>{room.roomNumber}</strong>
                      {room.notes === null || room.notes === '' ? null : (
                        <div className="admin-muted">{room.notes}</div>
                      )}
                    </td>
                    <td data-label={translate(locale, 'admin.code')}>
                      <span className="admin-muted">{room.physicalRoomCode}</span>
                    </td>
                    <td data-label={translate(locale, 'admin.roomType')}>
                      {operation?.roomConcept ?? roomType?.name ?? room.roomTypeId}
                    </td>
                    <td data-label={translate(locale, 'admin.floor', { floor: '#' })}>
                      {operation?.floor ?? '—'}
                    </td>
                    <td data-label={translate(locale, 'roomType.priceTier')}>
                      {operation?.roomTier ?? tier?.name ?? '—'}
                    </td>
                    <td data-label={translate(locale, 'admin.status')}>
                      <AdminStatusBadge
                        tone={
                          room.status === 'ACTIVE'
                            ? 'success'
                            : room.status === 'MAINTENANCE'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {translateAdminStatus(locale, room.status)}
                      </AdminStatusBadge>
                    </td>
                    <td data-label={translate(locale, 'admin.maintenance')}>
                      <AdminStatusBadge
                        tone={operation?.maintenanceState === 'ACTIVE' ? 'warning' : 'neutral'}
                      >
                        {operation?.maintenanceState === 'ACTIVE'
                          ? translate(locale, 'admin.maintenanceActive')
                          : translate(locale, 'admin.maintenanceNone')}
                      </AdminStatusBadge>
                    </td>
                    <td data-label={translate(locale, 'admin.nextBookingWindow')}>
                      {operation?.nextBookingWindow === null ||
                      operation?.nextBookingWindow === undefined
                        ? '—'
                        : formatDateTime(locale, operation.nextBookingWindow.checkIn)}
                    </td>
                    <td data-label={translate(locale, 'admin.housekeeping')}>
                      <AdminStatusBadge
                        tone={room.housekeepingStatus === 'CLEAN' ? 'success' : 'warning'}
                      >
                        {translate(
                          locale,
                          room.housekeepingStatus === 'CLEAN'
                            ? 'admin.housekeepingClean'
                            : room.housekeepingStatus === 'DIRTY'
                              ? 'admin.housekeepingDirty'
                              : 'admin.housekeepingCleaning',
                        )}
                      </AdminStatusBadge>
                    </td>
                    <td data-label={translate(locale, 'admin.updatedAt')}>
                      {formatDateTime(locale, room.updatedAt)}
                    </td>
                    <td data-label={translate(locale, 'admin.action')}>
                      <AdminRowActions
                        actions={[
                          {
                            label: translate(locale, 'admin.edit'),
                            onSelect: () => setEditRoomId(room.id),
                          },
                          {
                            label:
                              room.status === 'INACTIVE'
                                ? translate(locale, 'admin.activate')
                                : translate(locale, 'admin.deactivate'),
                            destructive: true,
                            disabled: pending || room.status === 'INACTIVE',
                            onSelect: () => setArchiveConfirmId(room.id),
                          },
                        ]}
                      >
                        <Button
                          aria-label={translate(locale, 'roomType.saveChanges')}
                          onClick={() => setEditRoomId(room.id)}
                          size="sm"
                          variant="outline"
                        >
                          {translate(locale, 'admin.edit')}
                        </Button>
                        <Button
                          aria-label={translate(locale, 'room.archive', {
                            number: room.roomNumber,
                          })}
                          disabled={pending || room.status === 'INACTIVE'}
                          onClick={() => {
                            setArchiveErrors((current) => ({ ...current, [room.id]: '' }));
                            setArchiveConfirmId(room.id);
                          }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          {translate(locale, 'admin.deactivate')}
                        </Button>
                      </AdminRowActions>
                      <AlertDialog
                        open={archiveConfirmId === room.id}
                        onOpenChange={(open) => {
                          if (!open) setArchiveConfirmId(undefined);
                        }}
                      >
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {translate(locale, 'catalog.archive')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {translate(locale, 'room.archive', { number: room.roomNumber })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {translate(locale, 'admin.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              disabled={archivePending[room.id] === true}
                              variant="destructive"
                              onClick={() => void archiveRoom(room.id)}
                            >
                              {archivePending[room.id] === true
                                ? translate(locale, 'admin.cancelling')
                                : translate(locale, 'catalog.archive')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {archiveErrors[room.id] !== undefined && archiveErrors[room.id] !== '' ? (
                        <Alert variant="destructive">
                          <AlertTitle>{translate(locale, 'room.archiveError')}</AlertTitle>
                          <AlertDescription>{archiveErrors[room.id]}</AlertDescription>
                        </Alert>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </AdminDataTable>
      )}
    </div>
  );
}
