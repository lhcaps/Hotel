'use client';

import { useEffect, useState } from 'react';
import type { Room } from '@room/contracts';

import { adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { AdminErrorState, AdminLoadingState, AdminPageHeader } from './admin/admin-ui';

function housekeepingStatusLabel(value: Room['housekeepingStatus']) {
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
                <span aria-label={housekeepingLabel}>
                  {translate(locale, housekeepingStatusLabel(room.housekeepingStatus))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
