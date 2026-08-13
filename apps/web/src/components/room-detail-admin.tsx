'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Room, RoomType } from '@room/contracts';

import { adminApi } from '../lib/admin-api';
import { formatDateTime, translate, translateAdminStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from './admin/admin-ui';

export function RoomDetailAdmin({ id }: { readonly id: string }) {
  const locale = useLocale();
  const [room, setRoom] = useState<Room>();
  const [roomType, setRoomType] = useState<RoomType>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([adminApi.listRooms(), adminApi.listRoomTypes()])
      .then(([rooms, types]) => {
        if (!active) return;
        const next = rooms.items.find((item) => item.id === id);
        setRoom(next);
        setRoomType(
          next === undefined ? undefined : types.items.find((item) => item.id === next.roomTypeId),
        );
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!loaded) {
    return <AdminLoadingState label={translate(locale, 'admin.loadingData')} />;
  }
  if (room === undefined) {
    return (
      <AdminEmptyState
        title={translate(locale, 'catalog.noResults')}
        description={translate(locale, 'room.detailHelp')}
        action={<Link href="/admin/rooms">{translate(locale, 'admin.rooms')}</Link>}
      />
    );
  }

  const statusTone =
    room.status === 'ACTIVE' ? 'success' : room.status === 'MAINTENANCE' ? 'warning' : 'neutral';
  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow={translate(locale, 'admin.rooms')}
        title={`${room.roomNumber} · ${room.physicalRoomCode}`}
        description={translate(locale, 'room.detailHelp')}
        actions={<Link href="/admin/rooms">{translate(locale, 'admin.rooms')}</Link>}
      />
      <div className="admin-detail-grid">
        <section className="admin-card">
          <h2>{translate(locale, 'admin.overview')}</h2>
          <dl className="admin-detail-facts">
            <div>
              <dt>{translate(locale, 'admin.status')}</dt>
              <dd>
                <AdminStatusBadge tone={statusTone}>
                  {translateAdminStatus(locale, room.status)}
                </AdminStatusBadge>
              </dd>
            </div>
            <div>
              <dt>{translate(locale, 'admin.roomType')}</dt>
              <dd>{roomType?.name ?? room.roomTypeId}</dd>
            </div>
            <div>
              <dt>{translate(locale, 'admin.housekeeping')}</dt>
              <dd>{translateAdminStatus(locale, room.housekeepingStatus)}</dd>
            </div>
            <div>
              <dt>{translate(locale, 'room.detailHelp')}</dt>
              <dd>{room.notes ?? translate(locale, 'account.notAvailable')}</dd>
            </div>
          </dl>
        </section>
        <section className="admin-card">
          <h2>{translate(locale, 'admin.history')}</h2>
          <dl className="admin-detail-facts">
            <div>
              <dt>{translate(locale, 'admin.createdAt')}</dt>
              <dd>{formatDateTime(locale, room.createdAt)}</dd>
            </div>
            <div>
              <dt>{translate(locale, 'admin.updatedAt')}</dt>
              <dd>{formatDateTime(locale, room.updatedAt)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
