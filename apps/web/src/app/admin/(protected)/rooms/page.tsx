'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { Room, RoomType } from '@room/contracts';

import { AdminApiError, adminApi } from '../../../../lib/admin-api';
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
}

export default function Rooms() {
  const locale = useLocale();
  const [rooms, setRooms] = useState<readonly Room[]>();
  const [types, setTypes] = useState<readonly RoomType[]>([]);
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

  useEffect(() => {
    let active = true;
    void Promise.all([adminApi.listRooms(), adminApi.listRoomTypes()])
      .then(([roomPage, typePage]) => {
        if (!active) return;
        setRooms(roomPage.items);
        setTypes(typePage.items);
        setDrafts(
          Object.fromEntries(
            roomPage.items.map((room) => [
              room.id,
              { roomNumber: room.roomNumber, roomTypeId: room.roomTypeId },
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

  const visibleRooms = (rooms ?? []).filter((room) => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const matchesQuery =
      normalizedQuery === '' ||
      [room.roomNumber, room.physicalRoomCode]
        .join(' ')
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery);
    return matchesQuery && (statusFilter === 'ALL' || room.status === statusFilter);
  });

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
          {translate(locale, 'admin.activeRoomsSummary', { count: visibleRooms.length })}
        </div>
      </AdminFilterToolbar>
      {editRoomId !== undefined
        ? (() => {
            const room = rooms?.find((candidate) => candidate.id === editRoomId);
            if (room === undefined) return null;
            const draft = drafts[room.id] ?? {
              roomNumber: room.roomNumber,
              roomTypeId: room.roomTypeId,
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
        <AdminDataTable className="admin-physical-rooms-table">
          <Table>
            <thead>
              <tr>
                <th scope="col">{translate(locale, 'room.number')}</th>
                <th scope="col">{translate(locale, 'admin.code')}</th>
                <th scope="col">{translate(locale, 'admin.roomType')}</th>
                <th scope="col">{translate(locale, 'admin.status')}</th>
                <th scope="col">{translate(locale, 'admin.housekeeping')}</th>
                <th scope="col">{translate(locale, 'admin.updatedAt')}</th>
                <th scope="col">{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRooms.map((room) => {
                return (
                  <tr key={room.id}>
                    <td data-label={translate(locale, 'room.number')}>
                      <strong>{room.roomNumber}</strong>
                    </td>
                    <td data-label={translate(locale, 'admin.code')}>
                      <span className="admin-muted">{room.physicalRoomCode}</span>
                    </td>
                    <td data-label={translate(locale, 'admin.roomType')}>
                      {types.find((type) => type.id === room.roomTypeId)?.name ?? room.roomTypeId}
                    </td>
                    <td data-label={translate(locale, 'admin.status')}>
                      <AdminStatusBadge tone={room.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {translateAdminStatus(locale, room.status)}
                      </AdminStatusBadge>
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
                            label: translate(locale, 'roomType.saveChanges'),
                            onSelect: () => setEditRoomId(room.id),
                          },
                          {
                            label: translate(locale, 'catalog.archive'),
                            destructive: true,
                            disabled: pending || room.status === 'INACTIVE',
                            onSelect: () => setArchiveConfirmId(room.id),
                          },
                        ]}
                      >
                        <Button onClick={() => setEditRoomId(room.id)} size="sm" variant="outline">
                          {translate(locale, 'roomType.saveChanges')}
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
                          {translate(locale, 'catalog.archive')}
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
