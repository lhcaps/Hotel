'use client';

import { useEffect, useState } from 'react';
import type { Room } from '@room/contracts';

import { adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { AdminErrorState, AdminLoadingState, AdminPageHeader } from './admin/admin-ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const states = ['CLEAN', 'DIRTY', 'CLEANING'] as const;

function housekeepingStatusLabel(value: (typeof states)[number]) {
  return value === 'CLEAN'
    ? 'admin.housekeepingClean'
    : value === 'DIRTY'
      ? 'admin.housekeepingDirty'
      : 'admin.housekeepingCleaning';
}

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
      <AdminPageHeader
        title={translate(locale, 'admin.roomOperations')}
        description={translate(locale, 'admin.roomOperationsHelp')}
      />
      {error ? (
        <AdminErrorState title={translate(locale, 'admin.loadErrorHeading')} description={error} />
      ) : null}
      {rooms === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loading')} />
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
                  <Select
                    value={room.housekeepingStatus}
                    onValueChange={(value) => {
                      if (value !== null) void change(room, value as Room['housekeepingStatus']);
                    }}
                  >
                    <SelectTrigger aria-label={housekeepingLabel} className="w-full">
                      <SelectValue>
                        {translate(locale, housekeepingStatusLabel(room.housekeepingStatus))}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state} value={state}>
                          {translate(
                            locale,
                            state === 'CLEAN'
                              ? 'admin.housekeepingClean'
                              : state === 'DIRTY'
                                ? 'admin.housekeepingDirty'
                                : 'admin.housekeepingCleaning',
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
