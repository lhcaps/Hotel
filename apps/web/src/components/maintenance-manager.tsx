'use client';
import type { MaintenanceBlock, Room } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { formatDateTime, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
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
      <h1>{translate(locale, 'admin.maintenance')}</h1>
      <p>{translate(locale, 'maintenance.help')}</p>
      <form onSubmit={create}>
        <label>
          {translate(locale, 'admin.rooms')}
          <select
            disabled={pending || rooms.length === 0}
            onChange={(event) => setRoomId(event.target.value)}
            value={roomId}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'maintenance.reason')}
          <input
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />
        </label>
        <label>
          {translate(locale, 'maintenance.startsAt')}
          <input
            disabled={pending}
            onChange={(event) => setStartsAt(event.target.value)}
            required
            type="datetime-local"
            value={startsAt}
          />
        </label>
        <label>
          {translate(locale, 'maintenance.endsAt')}
          <input
            disabled={pending}
            onChange={(event) => setEndsAt(event.target.value)}
            required
            type="datetime-local"
            value={endsAt}
          />
        </label>
        <button disabled={pending || roomId === ''} type="submit">
          {translate(locale, 'maintenance.create')}
        </button>
      </form>
      {message === undefined ? null : <p role="alert">{message}</p>}
      {blocks === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      ) : null}
      {blocks === undefined || blocks.length === 0 ? null : (
        <table>
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
                <td>{block.status}</td>
                <td>
                  <button
                    aria-label={translate(locale, 'maintenance.cancelLabel', {
                      reason: block.reason,
                    })}
                    disabled={pending || block.status === 'CANCELLED'}
                    onClick={() => void cancel(block.id)}
                    type="button"
                  >
                    {translate(locale, 'maintenance.cancel')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
