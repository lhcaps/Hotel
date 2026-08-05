'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { Room, RoomType } from '@room/contracts';

import { AdminApiError, adminApi } from '../../../../lib/admin-api';
import { localizedCatalogSafetyReason } from '../../../../lib/catalog-safety';
import { translate, translateAdminStatus } from '../../../../lib/i18n/messages';
import { useLocale } from '../../../../components/locale-provider';
import { RoomHousekeepingManager } from '../../../../components/room-housekeeping-manager';
import { RoomOperationsBoard } from '../../../../components/room-operations-board';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Field, FieldLabel } from '../../../../components/ui/field';
import { Input } from '../../../../components/ui/input';
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
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from '../../../../components/admin/admin-ui';

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
      ) : rooms.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'room.empty')} />
      ) : (
        <AdminDataTable>
          <table>
            <thead>
              <tr>
                <th scope="col">{translate(locale, 'room.number')}</th>
                <th scope="col">{translate(locale, 'admin.roomType')}</th>
                <th scope="col">{translate(locale, 'admin.status')}</th>
                <th scope="col">{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => {
                return (
                  <tr key={room.id}>
                    <td data-label={translate(locale, 'room.number')}>
                      <strong>{room.roomNumber}</strong>
                    </td>
                    <td data-label={translate(locale, 'admin.roomType')}>
                      {types.find((type) => type.id === room.roomTypeId)?.name ?? room.roomTypeId}
                    </td>
                    <td data-label={translate(locale, 'admin.status')}>
                      <AdminStatusBadge tone={room.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {translateAdminStatus(locale, room.status)}
                      </AdminStatusBadge>
                    </td>
                    <td data-label={translate(locale, 'admin.action')}>
                      <div className="admin-row-actions">
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
                      </div>
                      {archiveConfirmId === room.id ? (
                        <div className="admin-confirm-inline" role="group">
                          <Button
                            disabled={archivePending[room.id] === true}
                            onClick={() => void archiveRoom(room.id)}
                            size="sm"
                            variant="destructive"
                          >
                            {archivePending[room.id] === true
                              ? translate(locale, 'admin.cancelling')
                              : translate(locale, 'catalog.archive')}
                          </Button>
                          <Button
                            onClick={() => setArchiveConfirmId(undefined)}
                            size="sm"
                            variant="outline"
                          >
                            {translate(locale, 'admin.cancel')}
                          </Button>
                        </div>
                      ) : null}
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
          </table>
        </AdminDataTable>
      )}
      <RoomHousekeepingManager />
      <RoomOperationsBoard />
    </div>
  );
}
