'use client';

import { useEffect, useState } from 'react';

import type { Room } from '@room/contracts';

import { adminApi } from '../lib/admin-api';

const states = ['CLEAN', 'DIRTY', 'CLEANING'] as const;

export function RoomHousekeepingManager() {
  const [rooms, setRooms] = useState<readonly Room[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void adminApi.listRooms().then((page) => setRooms(page.items)).catch(() => setError('Unable to load room operations.'));
  }, []);

  async function change(room: Room, housekeepingStatus: Room['housekeepingStatus']) {
    setError(undefined);
    try {
      const next = await adminApi.updateRoomHousekeeping(room.id, housekeepingStatus);
      setRooms((current) => current?.map((item) => (item.id === next.id ? next : item)));
    } catch {
      setError('Unable to update housekeeping status.');
    }
  }

  return (
    <section className="admin-page" aria-labelledby="room-operations-heading">
      <h2 id="room-operations-heading">Room operations</h2>
      <p>Housekeeping state is internal and visible only to administrators.</p>
      {error ? <p role="alert">{error}</p> : null}
      {rooms === undefined ? <p aria-live="polite">Loading room operations…</p> : (
        <ul className="room-housekeeping-list">
          {rooms.map((room) => (
            <li key={room.id}>
              <span>{room.roomNumber}</span>
              <label>
                <span className="sr-only">Housekeeping for {room.roomNumber}</span>
                <select aria-label={`Housekeeping for ${room.roomNumber}`} onChange={(event) => void change(room, event.target.value as Room['housekeepingStatus'])} value={room.housekeepingStatus}>
                  {states.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
