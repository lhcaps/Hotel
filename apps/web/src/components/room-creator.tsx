'use client';
import type { RoomType } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
export function RoomCreator() {
  const locale = useLocale();
  const [types, setTypes] = useState<readonly RoomType[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    void adminApi
      .listRoomTypes()
      .then((page) => {
        setTypes(page.items);
        setRoomTypeId(page.items[0]?.id ?? '');
      })
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof AdminApiError
            ? translate(locale, 'room.typesLoadError')
            : translate(locale, 'room.typesLoadError'),
        ),
      );
  }, [locale]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const room = await adminApi.createRoom({ roomTypeId, roomNumber });
      setMessage(translate(locale, 'room.created', { number: room.roomNumber }));
      setRoomNumber('');
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'room.createError')
          : translate(locale, 'room.createError'),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-page">
      <h1>{translate(locale, 'room.createHeading')}</h1>
      <p>{translate(locale, 'room.createHelp')}</p>
      <form onSubmit={create}>
        <label>
          {translate(locale, 'admin.roomType')}
          <select
            disabled={pending || types.length === 0}
            onChange={(event) => setRoomTypeId(event.target.value)}
            value={roomTypeId}
          >
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate(locale, 'room.number')}
          <input
            disabled={pending}
            onChange={(event) => setRoomNumber(event.target.value)}
            required
            value={roomNumber}
          />
        </label>
        <button disabled={pending || roomTypeId === ''} type="submit">
          {translate(locale, 'room.create')}
        </button>
      </form>
      {message === undefined ? null : <p role="alert">{message}</p>}
    </section>
  );
}
