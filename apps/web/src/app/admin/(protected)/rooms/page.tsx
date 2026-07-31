'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { Room, RoomType } from '@room/contracts';

import { AdminApiError, adminApi } from '../../../../lib/admin-api';
import { translate } from '../../../../lib/i18n/messages';
import { useLocale } from '../../../../components/locale-provider';
import { RoomHousekeepingManager } from '../../../../components/room-housekeeping-manager';
import { RoomOperationsBoard } from '../../../../components/room-operations-board';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Field, FieldGroup, FieldLabel } from '../../../../components/ui/field';
import { Input } from '../../../../components/ui/input';

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
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

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

  async function saveRoom(roomId: string) {
    const draft = drafts[roomId];
    if (draft === undefined) return;
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
    } catch (cause) {
      const text =
        cause instanceof AdminApiError && cause.problem?.detail !== undefined
          ? cause.problem.detail
          : translate(locale, 'room.updateError');
      setErrors((current) => ({ ...current, [roomId]: text }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-page">
      <h1>{translate(locale, 'admin.rooms')}</h1>
      <Link className="primary-button" href="/admin/rooms/new">
        {translate(locale, 'room.create')}
      </Link>
      {message === undefined ? null : <p role="alert">{message}</p>}
      {rooms === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      ) : rooms.length === 0 ? (
        <p>{translate(locale, 'room.empty')}</p>
      ) : (
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
              const draft = drafts[room.id] ?? {
                roomNumber: room.roomNumber,
                roomTypeId: room.roomTypeId,
              };
              const error = errors[room.id];
              return (
                <tr key={room.id}>
                  <td>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={`room-number-${room.id}`}>
                          {translate(locale, 'room.number')}
                        </FieldLabel>
                        <Input
                          id={`room-number-${room.id}`}
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
                        <FieldLabel htmlFor={`room-type-${room.id}`}>
                          {translate(locale, 'admin.roomType')}
                        </FieldLabel>
                        <select
                          id={`room-type-${room.id}`}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [room.id]: { ...draft, roomTypeId: event.target.value },
                            }))
                          }
                          value={draft.roomTypeId}
                        >
                          {types.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Button
                        disabled={pending || draft.roomNumber === ''}
                        onClick={() => void saveRoom(room.id)}
                        size="sm"
                        type="button"
                      >
                        {translate(locale, 'roomType.saveChanges')}
                      </Button>
                      {error !== undefined && error !== '' ? (
                        <Alert variant="destructive">
                          <AlertTitle>{translate(locale, 'room.updateError')}</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}
                    </FieldGroup>
                  </td>
                  <td>
                    {types.find((type) => type.id === room.roomTypeId)?.name ?? room.roomTypeId}
                  </td>
                  <td>{room.status}</td>
                  <td>
                    <Button
                      aria-label={translate(locale, 'room.archive', { number: room.roomNumber })}
                      disabled={pending || room.status === 'INACTIVE'}
                      onClick={() =>
                        adminApi
                          .archiveRoom(room.id)
                          .then((updated) =>
                            setRooms((current) =>
                              current === undefined
                                ? current
                                : current.map((item) => (item.id === updated.id ? updated : item)),
                            ),
                          )
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {translate(locale, 'catalog.archive')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <RoomHousekeepingManager />
      <RoomOperationsBoard />
    </div>
  );
}
