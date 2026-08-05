'use client';

import { useEffect, useState } from 'react';
import type { Room } from '@room/contracts';

import { adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

const states = ['CLEAN', 'DIRTY', 'CLEANING'] as const;

export function RoomHousekeepingManager() {
  const locale = useLocale();
  const [rooms, setRooms] = useState<readonly Room[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void adminApi
      .listRooms()
      .then((page) => setRooms(page.items))
      .catch(() => setError(translate(locale, 'admin.loadErrorHeading')));
  }, [locale]);

  async function change(room: Room, housekeepingStatus: Room['housekeepingStatus']) {
    setError(undefined);
    try {
      const next = await adminApi.updateRoomHousekeeping(room.id, housekeepingStatus);
      setRooms((current) => current?.map((item) => (item.id === next.id ? next : item)));
    } catch {
      setError(translate(locale, 'admin.loadErrorHeading'));
    }
  }

  return (
    <section className="admin-page" aria-labelledby="room-operations-heading">
      <h2 id="room-operations-heading">{translate(locale, 'admin.roomOperations')}</h2>
      <p>{translate(locale, 'admin.roomOperationsHelp')}</p>
      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {rooms === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.loading')}</p>
      ) : (
        <ul className="room-housekeeping-list">
          {rooms.map((room) => {
            const housekeepingLabel =
              locale === 'vi'
                ? translate(locale, 'admin.housekeepingForRoom', { room: room.roomNumber })
                : `Housekeeping for ${room.roomNumber}`;
            return (
              <li key={room.id}>
                <span>
                  {room.roomNumber}
                  {room.physicalRoomCode ? ` · ${room.physicalRoomCode}` : ''}
                </span>
                <label>
                  <span className="sr-only">{housekeepingLabel}</span>
                  <select
                    aria-label={housekeepingLabel}
                    onChange={(event) =>
                      void change(room, event.target.value as Room['housekeepingStatus'])
                    }
                    value={room.housekeepingStatus}
                  >
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {translate(
                          locale,
                          state === 'CLEAN'
                            ? 'admin.housekeepingClean'
                            : state === 'DIRTY'
                              ? 'admin.housekeepingDirty'
                              : 'admin.housekeepingCleaning',
                        )}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
