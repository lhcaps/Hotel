'use client';
import type { RoomType } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AdminPageHeader } from './admin/admin-ui';
export function RoomCreator() {
  const locale = useLocale();
  const [types, setTypes] = useState<readonly RoomType[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [notes, setNotes] = useState('');
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
      const room = await adminApi.createRoom({
        roomTypeId,
        roomNumber,
        notes: notes.trim() === '' ? undefined : notes.trim(),
      });
      setMessage(translate(locale, 'room.created', { number: room.roomNumber }));
      setRoomNumber('');
      setNotes('');
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
      <AdminPageHeader
        title={translate(locale, 'room.createHeading')}
        description={translate(locale, 'room.createHelp')}
      />
      <form className="admin-form-stack" onSubmit={create}>
        <label>
          {translate(locale, 'admin.roomType')}
          <Select
            disabled={pending || types.length === 0}
            value={roomTypeId}
            onValueChange={(value) => {
              if (value !== null) setRoomTypeId(value);
            }}
          >
            <SelectTrigger className="w-full">
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
        </label>
        <label>
          {translate(locale, 'room.number')}
          <Input
            disabled={pending}
            onChange={(event) => setRoomNumber(event.target.value)}
            required
            value={roomNumber}
          />
        </label>
        <label>
          {translate(locale, 'room.notes')}
          <Input
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>
        <p>{translate(locale, 'room.notesHelp')}</p>
        <Button disabled={pending || roomTypeId === ''} type="submit">
          {translate(locale, 'room.create')}
        </Button>
      </form>
      {message === undefined ? null : <p role="alert">{message}</p>}
    </section>
  );
}
