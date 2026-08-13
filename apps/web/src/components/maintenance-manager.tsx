'use client';
import type { MaintenanceBlock, Room } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { formatDateTime, translate, translateAdminStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table } from './ui/table';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from './admin/admin-ui';
export function MaintenanceManager() {
  const locale = useLocale();
  const [rooms, setRooms] = useState<readonly Room[]>([]);
  const [blocks, setBlocks] = useState<readonly MaintenanceBlock[]>();
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    void Promise.all([adminApi.listRooms(), adminApi.listMaintenanceBlocks()])
      .then(([roomPage, maintenancePage]) => {
        setRooms(roomPage.items);
        setRoomId(roomPage.items[0]?.id ?? '');
        setBlocks(maintenancePage.items);
      })
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof AdminApiError
            ? translate(locale, 'maintenance.loadError')
            : translate(locale, 'maintenance.loadError'),
        ),
      );
  }, [locale]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const block = await adminApi.createMaintenanceBlock({
        roomId,
        reason,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setBlocks((current) => (current === undefined ? current : [...current, block]));
      setMessage(translate(locale, 'maintenance.created', { reason: block.reason }));
      setReason('');
      setCreateOpen(false);
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'maintenance.createError')
          : translate(locale, 'maintenance.createError'),
      );
    } finally {
      setPending(false);
    }
  }
  async function cancel(id: string) {
    setPending(true);
    try {
      const block = await adminApi.cancelMaintenanceBlock(id);
      setBlocks((current) =>
        current === undefined
          ? current
          : current.map((candidate) => (candidate.id === id ? block : candidate)),
      );
      setMessage(translate(locale, 'maintenance.cancelled'));
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'maintenance.cancelError')
          : translate(locale, 'maintenance.cancelError'),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.maintenance')}
        description={translate(locale, 'maintenance.help')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            {translate(locale, 'maintenance.create')}
          </Button>
        }
      />
      <AdminFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={translate(locale, 'maintenance.create')}
        description={translate(locale, 'maintenance.help')}
      >
        <form className="admin-form-stack" onSubmit={create}>
          <label>
            {translate(locale, 'admin.rooms')}
            <Select
              disabled={pending || rooms.length === 0}
              value={roomId}
              onValueChange={(value) => {
                if (value !== null) setRoomId(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.roomNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            {translate(locale, 'maintenance.reason')}
            <Input
              disabled={pending}
              onChange={(event) => setReason(event.target.value)}
              required
              value={reason}
            />
          </label>
          <label>
            {translate(locale, 'maintenance.startsAt')}
            <Input
              disabled={pending}
              onChange={(event) => setStartsAt(event.target.value)}
              required
              type="datetime-local"
              value={startsAt}
            />
          </label>
          <label>
            {translate(locale, 'maintenance.endsAt')}
            <Input
              disabled={pending}
              onChange={(event) => setEndsAt(event.target.value)}
              required
              type="datetime-local"
              value={endsAt}
            />
          </label>
          <Button disabled={pending || roomId === ''} type="submit">
            {translate(locale, 'maintenance.create')}
          </Button>
        </form>
      </AdminFormSheet>
      {message === undefined ? null : <p role="alert">{message}</p>}
      {blocks === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {blocks !== undefined && blocks.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'catalog.noResults')} />
      ) : null}
      {blocks === undefined || blocks.length === 0 ? null : (
        <AdminDataTable variant="management">
          <Table>
            <thead>
              <tr>
                <th scope="col">{translate(locale, 'maintenance.reason')}</th>
                <th scope="col">{translate(locale, 'maintenance.startsAt')}</th>
                <th scope="col">{translate(locale, 'maintenance.endsAt')}</th>
                <th scope="col">{translate(locale, 'admin.status')}</th>
                <th scope="col">{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => (
                <tr key={block.id}>
                  <td>{block.reason}</td>
                  <td>{formatDateTime(locale, block.startsAt)}</td>
                  <td>{formatDateTime(locale, block.endsAt)}</td>
                  <td>
                    <AdminStatusBadge tone={block.status === 'CANCELLED' ? 'neutral' : 'warning'}>
                      {translateAdminStatus(locale, block.status)}
                    </AdminStatusBadge>
                  </td>
                  <td>
                    <Button
                      aria-label={translate(locale, 'maintenance.cancelLabel', {
                        reason: block.reason,
                      })}
                      disabled={pending || block.status === 'CANCELLED'}
                      onClick={() => void cancel(block.id)}
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      {translate(locale, 'maintenance.cancel')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </AdminDataTable>
      )}
    </section>
  );
}
